import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { City as PrismaCity } from 'generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { City, CityStatus } from '../domain/cities.model';
import {
  CITY_REPOSITORY_PORT,
  CityRepositoryPort,
} from '../domain/city.repository.port';
import { CitiesQueryService } from './cities.query.service';
import { CityFilter } from './city.filter';

// CitiesQueryService(参照系)のテスト
// QueryServiceはPrismaから直接Read Modelを組み立てるため、PrismaServiceをモックにして
// 「Prismaに何を渡したか(並び順・ページング・include)」「Prismaの戻り値をRead Modelに正しく変換したか」を検証する。
// ※ テストで使う共通データ(CITY_ID など)とモックデータの作成ヘルパー(buildMockPrismaRecord など)はファイル末尾に定義している
//
// ⭐️ Read Modelの検証は toMatchObject ではなく toEqual(完全一致)で行う
//    Read Modelはプレーンなオブジェクトで、APIのレスポンスの形そのもの。
//    「返してはいけない項目(userId や、一覧での createdAt など)が混ざっていないこと」も確かめたいため、
//    指定していない項目を無視する toMatchObject ではなく、全項目を比べる toEqual を使う。

// MockPrismaService定義
// findMany(一覧) / findUnique(1件) / count(件数) をモックにする
const mockPrismaService = {
  city: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

// MockConfigService定義
// findAllPaginated()で、page / size 未指定時のデフォルト値(環境変数)を取得するのに使われる
// モックにして「環境変数の値」をテストの中で自由に決められるようにしている
const mockConfigService = {
  get: jest.fn(),
};

// MockRepository定義(findByCodeOrFail()はRepositoryに委譲するだけなので、Repositoryもモックにする)
// as jest.Mocked<>はなくてもいいが、型安全に
const mockCityRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<CityRepositoryPort>;

describe('■■■ CitiesQueryService test ■■■', () => {
  // テスト対象のQueryService
  let citiesQueryService: CitiesQueryService;
  // DIされたRepository(中身は上のmockCityRepository)。jest.spyOn()の対象にする
  let cityRepository: CityRepositoryPort;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  beforeAll(async () => {
    // CitiesQueryServiceが依存する3つ(PrismaService / ConfigService / Repository)を
    // すべて上で定義したモックに差し替えてDIする(本物のDBは使わない)
    const module = await Test.createTestingModule({
      providers: [
        CitiesQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        // Repositoryはinterfaceなのでtoken(CITY_REPOSITORY_PORT)で指定する
        { provide: CITY_REPOSITORY_PORT, useValue: mockCityRepository },
      ],
    }).compile();

    citiesQueryService = module.get<CitiesQueryService>(CitiesQueryService);
    cityRepository = module.get<CityRepositoryPort>(CITY_REPOSITORY_PORT);
  });

  // 前処理: 各テストの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録をすべてリセットする
    // ※ リセット後のモックは呼ばれると undefined を返す
    //   (configService.get も undefined を返す = 環境変数が未設定の状態)
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findAllPaginated() test
  //--------------------------------------
  // mockData:
  // ①Prisma findMany
  // ②Prisma count
  describe('findAllPaginated', () => {
    it('正常系: Prismaデータが一覧用Read Modelに変換され、metaとともに返却されること', async () => {
      // prisma mock data 作成: findMany
      // 1件目: 都道府県(東京都)ありの東京 / 2件目: 都道府県が未設定の都市(DBではnull)
      mockPrismaService.city.findMany.mockResolvedValue([
        buildMockPrismaRecord(),
        buildMockPrismaRecord({
          id: OTHER_CITY_ID,
          code: '009',
          name: 'テスト市',
          kanaName: 'テストシ',
          slug: 'test-city',
          status: 'editing',
          sortOrder: 9,
          prefectureId: null,
          prefecture: null,
        }),
      ]);
      // prisma mock data 作成: count(全件数)
      mockPrismaService.city.count.mockResolvedValue(8);

      // test対象service呼び出し(2ページ目・1ページ10件)
      const filters = { page: 2, size: 10 } satisfies CityFilter;
      const result = await citiesQueryService.findAllPaginated(filters);

      // 検証: Read Modelの配列とmetaが返却されること
      // ・userId / createdAt / updatedAt は一覧のRead Modelに含まれない
      // ・都道府県名(prefectureName)はincludeしたprefecture.nameから取得される
      // ・DBのnull(都道府県未設定)はRead Modelではundefinedに変換される
      expect(result).toEqual({
        data: [
          {
            id: CITY_ID,
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            status: CityStatus.PUBLISHED,
            sortOrder: 1,
            prefectureId: PREFECTURE_ID,
            prefectureName: '東京都',
          },
          {
            id: OTHER_CITY_ID,
            code: '009',
            name: 'テスト市',
            kanaName: 'テストシ',
            slug: 'test-city',
            status: CityStatus.EDITING,
            sortOrder: 9,
            // DBのnullはRead Modelではundefinedに変換される
            prefectureId: undefined,
            prefectureName: undefined,
          },
        ],
        // count の値が totalCount、引数の page / size がそのまま meta になる
        meta: { totalCount: 8, page: 2, size: 10 },
      });
      // 検証: Prisma findMany への引数
      // ・都道府県名をinclude、sortOrder昇順 → code昇順
      // ・take = size(10件)、skip = (page - 1) * size = (2 - 1) * 10 = 10件
      expect(mockPrismaService.city.findMany).toHaveBeenCalledWith({
        include: { prefecture: { select: { name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: 10,
        skip: 10,
      });
      // 検証: 一覧(findMany)と総件数(count)の両方を取得していること(Promise.allで並列に呼んでいる)
      expect(mockPrismaService.city.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.city.count).toHaveBeenCalledTimes(1);
    });

    it('正常系: page/size未指定の場合、環境変数のデフォルト値が使われること', async () => {
      // config mock 設定: 環境変数の値
      // CITY_DEFAULT_PAGE_SIZE → 20、それ以外(CITY_DEFAULT_PAGE) → 1 を返す
      // ⭐️memo: configService.get は同期関数(Promiseを返さない)なので、mockResolvedValueではなく
      //         mockImplementation(または mockReturnValue)で戻り値を設定する
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'CITY_DEFAULT_PAGE_SIZE' ? 20 : 1,
      );
      // prisma mock data 作成: 0件(件数の計算だけを検証するため、中身はなんでもいい)
      mockPrismaService.city.findMany.mockResolvedValue([]);
      mockPrismaService.city.count.mockResolvedValue(0);

      // test対象service呼び出し(filter無し = page / size 未指定)
      const result = await citiesQueryService.findAllPaginated();

      // 検証: 環境変数のデフォルト値(page: 1, size: 20)が使われること
      expect(result.meta).toEqual({ totalCount: 0, page: 1, size: 20 });
      // 検証: Prismaにも take: 20、skip: (1 - 1) * 20 = 0 で渡されること
      // (expect.objectContaining: 指定した項目だけを部分一致で検証する)
      expect(mockPrismaService.city.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('正常系: 環境変数も未設定の場合、コードに書いた既定値(page: 1, size: 20)が使われること', async () => {
      // config mock 設定なし(resetAllMocksにより get は undefined を返す = 環境変数が未設定)
      mockPrismaService.city.findMany.mockResolvedValue([]);
      mockPrismaService.city.count.mockResolvedValue(0);

      // test対象service呼び出し
      const result = await citiesQueryService.findAllPaginated();

      // 検証: ?? で指定した既定値(page: 1, size: 20)が使われること
      expect(result.meta).toEqual({ totalCount: 0, page: 1, size: 20 });
    });

    it('境界値: sizeが上限を超える場合はMAX_PAGE_SIZE、pageが下限未満の場合はMIN_PAGEに丸められること', async () => {
      // prisma mock data 作成: 0件(中身はなんでもいい)
      mockPrismaService.city.findMany.mockResolvedValue([]);
      mockPrismaService.city.count.mockResolvedValue(0);

      // test対象service呼び出し: page は下限(1)未満、size は上限(2000)超え
      const filters = {
        page: 0,
        size: PAGINATION.MAX_PAGE_SIZE + 1,
      } satisfies CityFilter;
      const result = await citiesQueryService.findAllPaginated(filters);

      // 検証: size は上限の MAX_PAGE_SIZE、page は下限の MIN_PAGE に丸められること
      expect(result.meta.size).toBe(PAGINATION.MAX_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MIN_PAGE);
    });

    it('境界値: sizeが下限未満の場合はMIN_PAGE_SIZE、pageが上限を超える場合はMAX_PAGEに丸められること', async () => {
      // prisma mock data 作成: 0件(中身はなんでもいい)
      mockPrismaService.city.findMany.mockResolvedValue([]);
      mockPrismaService.city.count.mockResolvedValue(0);

      // test対象service呼び出し: page は上限(10000)超え、size は下限(1)未満
      const filters = {
        page: PAGINATION.MAX_PAGE + 1,
        size: 0,
      } satisfies CityFilter;
      const result = await citiesQueryService.findAllPaginated(filters);

      // 検証: size は下限の MIN_PAGE_SIZE、page は上限の MAX_PAGE に丸められること
      expect(result.meta.size).toBe(PAGINATION.MIN_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MAX_PAGE);
    });
  });

  //--------------------------------------
  // getDetailByIdOrThrow() test
  //--------------------------------------
  // mockData:
  // ①Prisma findUnique
  describe('getDetailByIdOrThrow', () => {
    it('正常系: 作成日時・更新日時付きの詳細Read Modelが返却されること', async () => {
      // prisma mock data 作成: findUnique(都道府県ありの東京)
      mockPrismaService.city.findUnique.mockResolvedValue(
        buildMockPrismaRecord(),
      );

      // test対象service呼び出し
      const result = await citiesQueryService.getDetailByIdOrThrow(CITY_ID);

      // 検証: 一覧の項目 + createdAt / updatedAt が返却されること(userIdは含まれない)
      expect(result).toEqual({
        id: CITY_ID,
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        status: CityStatus.PUBLISHED,
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
        prefectureName: '東京都',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      // 検証: Prismaにidで検索させ、都道府県名をincludeしていること
      expect(mockPrismaService.city.findUnique).toHaveBeenCalledWith({
        where: { id: CITY_ID },
        include: { prefecture: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 見つからない(findUniqueはnullを返す)
      mockPrismaService.city.findUnique.mockResolvedValue(null);

      // test対象service呼び出し、結果検証: 404の例外になること
      await expect(
        citiesQueryService.getDetailByIdOrThrow(CITY_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連する都市情報が存在しません!! cityId: ${CITY_ID}`,
        ),
      );
    });
  });

  //--------------------------------------
  // getDetailByCodeOrThrow() test
  //--------------------------------------
  // mockData:
  // ①Prisma findUnique
  describe('getDetailByCodeOrThrow', () => {
    it('正常系: 作成日時・更新日時付きの詳細Read Modelが返却されること', async () => {
      // prisma mock data 作成: findUnique(都道府県ありの東京)
      mockPrismaService.city.findUnique.mockResolvedValue(
        buildMockPrismaRecord(),
      );

      // test対象service呼び出し
      const result = await citiesQueryService.getDetailByCodeOrThrow('001');

      // 検証: 詳細Read Modelが返却されること(項目はgetDetailByIdOrThrowと同じ)
      expect(result).toEqual({
        id: CITY_ID,
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        status: CityStatus.PUBLISHED,
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
        prefectureName: '東京都',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      // 検証: Prismaにcodeで検索させていること
      expect(mockPrismaService.city.findUnique).toHaveBeenCalledWith({
        where: { code: '001' },
        include: { prefecture: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 見つからない
      mockPrismaService.city.findUnique.mockResolvedValue(null);

      // test対象service呼び出し、結果検証
      await expect(
        citiesQueryService.getDetailByCodeOrThrow('999'),
      ).rejects.toThrow(
        new NotFoundException(
          'codeに関連する都市情報が存在しません!! code: 999',
        ),
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail() test
  //--------------------------------------
  // mockData:
  // ①Repository findByCodeOrFail
  // ※ このメソッドだけはRead Modelではなくdomainを返す(他モジュールからの参照用)
  describe('findByCodeOrFail', () => {
    it('正常系: Repositoryに委譲し、domain(idを含む)を返却すること', async () => {
      // repository mock data 作成: 掲載中の東京のdomain
      const mockCity = buildMockCity();
      jest
        .spyOn(cityRepository, 'findByCodeOrFail')
        .mockResolvedValue(mockCity);

      // test対象service呼び出し
      const result = await citiesQueryService.findByCodeOrFail('001');

      // 検証: Repositoryが返したdomainが、そのまま(同じインスタンスで)返却されること
      // (toBe: 中身が同じかではなく「同じオブジェクトか」を検証する)
      expect(result).toBe(mockCity);
      // 検証: Repositoryに code '001' で委譲していること
      expect(
        jest.spyOn(cityRepository, 'findByCodeOrFail'),
      ).toHaveBeenCalledWith('001');
    });
  });
});

// テストデータ(各テストで共通に使う値)
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const OTHER_CITY_ID = '4449182c-f84b-42c2-8618-3e122e3c4bb9';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

// QueryServiceが受け取るレコードの形(都道府県名をincludeしたもの)
type MockPrismaCityWithPrefecture = PrismaCity & {
  prefecture: { name: string } | null;
};

/**
 * Prismaのレコード(都道府県名をinclude)のモックデータを作成するヘルパー
 * Prisma.city.findMany / findUnique の戻り値(DBの1行)の代わりに使う
 *
 * 基本形は「掲載中・都道府県(東京都)ありの東京」。引数で一部の項目だけを上書きできる。
 */
const buildMockPrismaRecord = (
  overrides: Partial<MockPrismaCityWithPrefecture> = {},
): MockPrismaCityWithPrefecture => ({
  id: CITY_ID,
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  status: 'published',
  sortOrder: 1,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  prefectureId: PREFECTURE_ID,
  userId: USER_ID,
  prefecture: { name: '東京都' },
  // 引数で渡された項目だけ、上の値を上書きする
  ...overrides,
});

/**
 * City domainのモックデータを作成するヘルパー(掲載中の東京)
 * Repository.findByCodeOrFail() の戻り値の代わりに使う
 * domainはモックにせず、本物のCity.reconstitute()で作る(外部依存のない純粋なクラスのため)
 */
const buildMockCity = (): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '001',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.PUBLISHED,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  });

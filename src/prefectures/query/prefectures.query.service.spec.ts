import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PREFECTURE_REPOSITORY_PORT,
  PrefectureRepositoryPort,
} from '../domain/prefecture.repository.port';
import { Prefecture, PrefectureStatus } from '../domain/prefectures.model';
import { PrefecturesQueryService } from './prefectures.query.service';

// MockPrismaService定義
// QueryServiceはPrismaから直接Read Modelを組み立てるため、prefectureの
// findMany(一覧) / findUnique(1件) / count(件数) をモック化する
const mockPrismaService = {
  prefecture: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

// MockConfigService定義
// findAllPaginated()で、page/size未指定時のデフォルト値(環境変数)を取得するのに使われる
// ⭐️memo: Regionのspecは本物のConfigService(ConfigModule.forRoot)を使っているが、
//         こちらはモックにして「環境変数の値」をテストの中で自由に決められるようにしている
const mockConfigService = {
  get: jest.fn(),
};

// MockRepository定義(Regionのspecと同じ書き方)
// findByCodeOrFail()はRepositoryに処理を委譲するだけなので、Repositoryもモック化する
const mockPrefectureRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<PrefectureRepositoryPort>; // as jest.Mocked<>はなくてもいいが、型安全に

// テストデータ(各テストで共通に使う値)
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * Prismaレコード(地方名include)のmock dataを作成するヘルパー
 *
 * prisma.prefecture.findMany / findUnique が返すレコードの代わりに使う。
 * QueryServiceは include: { region: { select: { name: true } } } で地方名も取得するため、
 * レコードに region: { name } を含めている。
 *
 * 基本形は「掲載中(published)・地方(関東)ありの東京都」。引数で一部の項目だけを上書きできる。
 *   例) buildPrismaRecord()                                   → 関東の東京都
 *       buildPrismaRecord({ regionId: null, region: null })   → 地方未設定(DBではnull)
 */
const buildPrismaRecord = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
  code: '13',
  name: '東京都',
  kanaName: 'トウキョウト',
  status: 'published',
  kanaEn: 'Tokyo-to',
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  regionId: REGION_ID,
  userId: '00000000-0000-4000-8000-000000000001',
  // includeで取得した地方(Region)の名前
  region: { name: '関東' },
  // 引数で渡された項目だけ、上の値を上書きする
  ...overrides,
});

describe('■■■ PrefecturesQueryService test ■■■', () => {
  // DIモジュール
  // テスト対象のQueryService
  let prefecturesQueryService: PrefecturesQueryService;
  // DIされたRepository(中身は上のmockPrefectureRepository)。jest.spyOn()の対象にする
  let prefectureRepository: PrefectureRepositoryPort;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    // PrefecturesQueryServiceが依存する3つ(PrismaService / ConfigService / Repository)を
    // すべて上で定義したモックに差し替えてDIする(本物のDBは使わない)
    const module = await Test.createTestingModule({
      providers: [
        PrefecturesQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        // Repositoryはinterfaceを実装しているのでtoken(=PREFECTURE_REPOSITORY_PORT)で指定
        {
          provide: PREFECTURE_REPOSITORY_PORT,
          useValue: mockPrefectureRepository,
        },
      ],
    }).compile();

    prefecturesQueryService = module.get<PrefecturesQueryService>(
      PrefecturesQueryService,
    );
    // Repositoryは、interfaceのためSymbol(PREFECTURE_REPOSITORY_PORT)で取得する
    prefectureRepository = module.get<PrefectureRepositoryPort>(
      PREFECTURE_REPOSITORY_PORT,
    );
  });

  // 前処理: 各テストケースの前に毎回実行
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
      // 1件目: 地方ありの東京都 / 2件目: 地方未設定の青森県(DBではnull)
      mockPrismaService.prefecture.findMany.mockResolvedValue([
        buildPrismaRecord(),
        // 地方未設定の都道府県
        buildPrismaRecord({
          id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
          code: '02',
          name: '青森県',
          kanaName: 'アオモリケン',
          kanaEn: 'Aomori-ken',
          status: 'editing',
          regionId: null,
          region: null,
        }),
      ]);
      // prisma mock data 作成: count(全件数)
      mockPrismaService.prefecture.count.mockResolvedValue(47);

      // test対象service呼び出し(2ページ目・1ページ10件)
      const result = await prefecturesQueryService.findAllPaginated({
        page: 2,
        size: 10,
      });

      // 検証: Read Modelの配列とmetaが返却されること
      // ・userId / createdAt / updatedAt はRead Modelに含まれない
      // ・地方名(regionName)はincludeしたregion.nameから取得される
      // ・DBのnull(地方未設定)はRead Modelではundefinedに変換される
      expect(result).toEqual({
        data: [
          {
            id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
            code: '13',
            name: '東京都',
            kanaName: 'トウキョウト',
            kanaEn: 'Tokyo-to',
            status: PrefectureStatus.PUBLISHED,
            regionId: REGION_ID,
            regionName: '関東',
          },
          {
            id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
            code: '02',
            name: '青森県',
            kanaName: 'アオモリケン',
            kanaEn: 'Aomori-ken',
            status: PrefectureStatus.EDITING,
            regionId: undefined,
            regionName: undefined,
          },
        ],
        // count の値が totalCount、引数の page / size がそのまま meta になる
        meta: { totalCount: 47, page: 2, size: 10 },
      });
      // 検証: Prisma findMany への引数
      // ・地方名をinclude、code昇順
      // ・take = size(10件)、skip = (page - 1) * size = (2 - 1) * 10 = 10件
      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith({
        include: { region: { select: { name: true } } },
        orderBy: { code: 'asc' },
        take: 10,
        skip: 10,
      });
    });

    it('正常系: page/size未指定の場合、環境変数のデフォルト値が使われること', async () => {
      // config mock 設定: 環境変数の値
      // PREFECTURE_DEFAULT_PAGE_SIZE → 20、それ以外(PREFECTURE_DEFAULT_PAGE) → 1 を返す
      // ⭐️memo: configService.get は同期関数(Promiseを返さない)なので、mockResolvedValueではなく
      //         mockImplementation(または mockReturnValue)で戻り値を設定する
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'PREFECTURE_DEFAULT_PAGE_SIZE' ? 20 : 1,
      );
      // prisma mock data 作成: 0件
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      // test対象service呼び出し(filter無し = page / size 未指定)
      const result = await prefecturesQueryService.findAllPaginated();

      // 検証: 環境変数のデフォルト値(page: 1, size: 20)が使われること
      expect(result.meta).toEqual({ totalCount: 0, page: 1, size: 20 });
      // 検証: Prismaにも take: 20、skip: (1 - 1) * 20 = 0 で渡されること
      // (expect.objectContaining: 指定した項目だけを部分一致で検証する)
      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('境界値: sizeが上限を超える場合はMAX_PAGE_SIZE、pageが下限未満の場合はMIN_PAGEに丸められること', async () => {
      // prisma mock data 作成: 0件(件数ではなく丸めの結果だけを見るため)
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      // test対象service呼び出し: page は下限(1)未満、size は上限(2000)超え
      const result = await prefecturesQueryService.findAllPaginated({
        page: 0,
        size: PAGINATION.MAX_PAGE_SIZE + 1,
      });

      // 検証: size は上限の MAX_PAGE_SIZE、page は下限の MIN_PAGE に丸められること
      expect(result.meta.size).toBe(PAGINATION.MAX_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MIN_PAGE);
    });

    it('境界値: sizeが下限未満の場合はMIN_PAGE_SIZE、pageが上限を超える場合はMAX_PAGEに丸められること', async () => {
      // prisma mock data 作成: 0件
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      // test対象service呼び出し: page は上限(10000)超え、size は下限(1)未満
      const result = await prefecturesQueryService.findAllPaginated({
        page: PAGINATION.MAX_PAGE + 1,
        size: 0,
      });

      // 検証: size は下限の MIN_PAGE_SIZE、page は上限の MAX_PAGE に丸められること
      expect(result.meta.size).toBe(PAGINATION.MIN_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MAX_PAGE);
    });
  });

  //--------------------------------------
  // findCovered() test
  //--------------------------------------
  // mockData:
  // ①Prisma findMany(_count付き)
  describe('findCovered', () => {
    it('正常系: 公開中の店舗数(storeCount)付きのRead Modelが返却されること', async () => {
      // prisma mock data 作成: findMany
      // _count: { store: 3 } → Prismaが集計した「公開中の店舗数」(3件)
      mockPrismaService.prefecture.findMany.mockResolvedValue([
        { ...buildPrismaRecord(), _count: { store: 3 } },
      ]);

      // test対象service呼び出し
      const result = await prefecturesQueryService.findCovered();

      // 検証: 一覧用Read Modelの項目に、_count.store が storeCount として追加されること
      expect(result).toEqual([
        {
          id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          status: PrefectureStatus.PUBLISHED,
          regionId: REGION_ID,
          regionName: '関東',
          storeCount: 3,
        },
      ]);
    });

    it('正常系: 公開中(published)の店舗を条件に絞り込み・件数取得していること', async () => {
      // prisma mock data 作成: 0件(Prismaへの引数だけを検証するため)
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);

      // test対象service呼び出し
      await prefecturesQueryService.findCovered();

      // 検証: Prisma findMany への引数
      // ・where: 公開中(published)の店舗が1件以上(some)ある都道府県だけに絞り込む
      // ・_count: 公開中(published)の店舗だけを数える
      // ※ ここでの status は「店舗(Store)」のstatus(都道府県のstatusではない)
      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith({
        where: { store: { some: { status: 'published' } } },
        include: {
          region: { select: { name: true } },
          _count: { select: { store: { where: { status: 'published' } } } },
        },
        orderBy: { code: 'asc' },
      });
    });
  });

  //--------------------------------------
  // getDetailByIdOrThrow() test
  //--------------------------------------
  // mockData:
  // ①Prisma findUnique
  describe('getDetailByIdOrThrow', () => {
    it('正常系: 作成日時・更新日時付きの詳細Read Modelが返却されること', async () => {
      // prisma mock data 作成: findUnique(関東の東京都)
      mockPrismaService.prefecture.findUnique.mockResolvedValue(
        buildPrismaRecord(),
      );

      // test対象service呼び出し
      const result = await prefecturesQueryService.getDetailByIdOrThrow(
        '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
      );

      // 検証: 一覧用Read Modelの項目に、createdAt / updatedAt を加えた詳細Read Modelが返却されること
      expect(result).toEqual({
        id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        status: PrefectureStatus.PUBLISHED,
        regionId: REGION_ID,
        regionName: '関東',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      // 検証: Prisma findUnique への引数(idで検索し、地方名をinclude)
      expect(mockPrismaService.prefecture.findUnique).toHaveBeenCalledWith({
        where: { id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e' },
        include: { region: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 該当なし(null)
      mockPrismaService.prefecture.findUnique.mockResolvedValue(null);

      // test対象service呼び出し、結果検証
      // NotFoundExceptionがスローされること(例外の型とメッセージを一度に検証)
      await expect(
        prefecturesQueryService.getDetailByIdOrThrow('not-exist-id'),
      ).rejects.toThrow(
        new NotFoundException(
          'idに関連する都道府県情報が存在しません!! prefectureId: not-exist-id',
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
    it('正常系: 地方名付きの詳細Read Modelが返却されること', async () => {
      // prisma mock data 作成: findUnique(関東の東京都)
      mockPrismaService.prefecture.findUnique.mockResolvedValue(
        buildPrismaRecord(),
      );

      // test対象service呼び出し
      const result = await prefecturesQueryService.getDetailByCodeOrThrow('13');

      // 検証: 主要な項目だけを確認する(Read Modelへの変換はgetDetailByIdOrThrowと共通のため)
      // ・code検索でも地方名(regionName)が含まれること
      // ・詳細Read Modelなので createdAt が含まれること
      expect(result.code).toBe('13');
      expect(result.regionName).toBe('関東');
      expect(result.createdAt).toEqual(CREATED_AT);
      // 検証: Prisma findUnique への引数(codeで検索し、地方名をinclude)
      expect(mockPrismaService.prefecture.findUnique).toHaveBeenCalledWith({
        where: { code: '13' },
        include: { region: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 該当なし(null)
      mockPrismaService.prefecture.findUnique.mockResolvedValue(null);

      // test対象service呼び出し、結果検証
      // NotFoundExceptionがスローされること(例外の型とメッセージを一度に検証)
      await expect(
        prefecturesQueryService.getDetailByCodeOrThrow('99'),
      ).rejects.toThrow(
        new NotFoundException(
          'codeに関連する都道府県情報が存在しません!! code: 99',
        ),
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail() test
  //--------------------------------------
  // mockData:
  // ①Repository findByCodeOrFail
  // ※ このメソッドだけはRead Modelではなくdomainを返す(StoresServiceからの参照用)
  describe('findByCodeOrFail', () => {
    it('正常系: Repositoryに委譲し、domain(ID付き)を返却すること', async () => {
      // repository mock data 作成: 掲載中の東京都のdomain(id付き)
      // domainはreconstitute()で復元し、Object.assignでidを付与する(Repositoryが返す形)
      const domainWithId = Object.assign(
        Prefecture.reconstitute({
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          status: PrefectureStatus.PUBLISHED,
          regionId: REGION_ID,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        }),
        { id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e' },
      );
      jest
        .spyOn(prefectureRepository, 'findByCodeOrFail')
        .mockResolvedValue(domainWithId);

      // test対象service呼び出し
      const result = await prefecturesQueryService.findByCodeOrFail('13');

      // 検証: Repositoryが返したdomainが、そのまま(同じインスタンスで)返却されること
      // (toBe: 中身が同じかではなく「同じオブジェクトか」を検証する)
      expect(result).toBe(domainWithId);
      // 検証: Repositoryに code '13' で委譲していること
      expect(
        jest.spyOn(prefectureRepository, 'findByCodeOrFail'),
      ).toHaveBeenCalledWith('13');
    });
  });
});

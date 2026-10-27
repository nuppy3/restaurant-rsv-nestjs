// DistrictsQueryService(参照系)のテスト
// QueryServiceはPrismaから直接Read Modelを組み立てるため、PrismaServiceをモックにして
// 「Prismaに何を渡したか(並び順・ページング・include)」「Prismaの戻り値をRead Modelに正しく変換したか」を検証する。
// ※ テストで使う共通データ(DISTRICT_ID など)とモックデータの作成ヘルパー(buildMockPrismaRecord など)はファイル末尾に定義している
//
// ⭐️ Read Modelの検証は toMatchObject ではなく toEqual(完全一致)で行う
//    Read Modelはプレーンなオブジェクトで、APIのレスポンスの形そのもの。
//    「返してはいけない項目(userId や、一覧での createdAt など)が混ざっていないこと」も確かめたいため、
//    指定していない項目を無視する toMatchObject ではなく、全項目を比べる toEqual を使う。

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { District as PrismaDistrict } from 'generated/prisma';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { DistrictStatus } from '../domain/districts.model';
import { DistrictFilter } from './district.filter';
import { DistrictsQueryService } from './districts.query.service';
import { DistrictListReadModel } from './read-model/district-list.read-model';

// MockPrismaService定義
// findMany(一覧) / findUnique(1件) / count(件数) をモックにする
const mockPrismaService = {
  district: {
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

describe('■■■ DistrictsQueryService test ■■■', () => {
  // テスト対象のQueryService
  let districtsQueryService: DistrictsQueryService;
  let prismaService: PrismaService;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  beforeAll(async () => {
    // CitiesQueryServiceが依存する3つ(PrismaService / ConfigService)を
    // すべて上で定義したモックに差し替えてDIする(本物のDBは使わない)
    const module = await Test.createTestingModule({
      providers: [
        DistrictsQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    districtsQueryService = module.get<DistrictsQueryService>(
      DistrictsQueryService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録をすべてリセットする
    // ※ リセット後のモックは呼ばれると undefined を返す
    //   (configService.get も undefined を返す = 環境変数が未設定の状態)
    console.log('beforeEach: モックをリセット');
    // jest.clearAllMocks();
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findAllPaginated() test
  //--------------------------------------
  // mockData:
  // ①Prisma findMany
  // ②Prisma count
  describe('findAllPaginated', () => {
    it('正常系: Prismaデータがページネーションモデルに変換され返却されること- filter全項目', async () => {
      // 引数作成
      const filters = {
        name: '銀座',
        status: DistrictStatus.PUBLISHED,
        cityCode: '001',
        page: 1,
        size: 10,
      } satisfies DistrictFilter;

      // mock data set
      jest
        .spyOn(prismaService.district, 'findMany')
        .mockResolvedValue(createPrismaMockData());
      jest.spyOn(prismaService.district, 'count').mockResolvedValue(7);

      // test 対象 query service 呼び出し
      const result = await districtsQueryService.findAllPaginated(filters);

      // 検証
      expect(result).toEqual(createExpectedPaginatedResult());

      // 検証: prisma 引数
      expect(
        jest.spyOn(prismaService.district, 'findMany'),
      ).toHaveBeenCalledWith({
        include: { city: { select: { name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: 10,
        skip: 0,
      });
    });

    it('正常系: Prismaデータがページネーションモデルに変換され返却されること- filterなし', () => {});

    it('異常系： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.district, 'findMany')
        .mockRejectedValue(connectionError);

      // Query Serviceがエラーをそのまま伝播（reject）することを確認
      await expect(districtsQueryService.findAllPaginated()).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });
});

// -----------------------------------------------
// テストデータ: 東京に紐づく銀座
// -----------------------------------------------
const DISTRICT_ID = '5b6c7d8e-9f01-4a2b-8c3d-4e5f60718293';
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const USER_ID = '00000000-0000-4000-8000-000000000001';
// UUID形式(8-4-4-4-12桁の16進数)の正規表現。createNewで採番されるidの検証用
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

// QueryServiceが受け取るレコードの形(都市名をincludeしたもの)
type MockPrismaDistrictWithCity = PrismaDistrict & { city: { name: string } };

/**
 * PrismaのDistrictレコード(都市名をinclude)の配列のモックデータを作成するヘルパー
 * Prisma.district.findMany の戻り値の代わりに使う
 *
 * 東京の7地区(seed と同じデータ。sortOrder の昇順)。id は地区ごとに別の値にしている
 * (一覧の検証で、どの地区のRead Modelかを id でも見分けられるようにするため)
 */
const createPrismaMockData = (): MockPrismaDistrictWithCity[] => [
  // 銀座のレコード
  buildMockPrismaDistrict(),
  // 恵比寿のレコード(cityId,createdAt,updatedAtなどはベースのまま)
  buildMockPrismaDistrict({
    id: '6c7d8e9f-0a12-4b3c-9d4e-5f6071829304',
    code: '00002',
    name: '恵比寿',
    kanaName: 'エビス',
    slug: 'ebisu',
    sortOrder: 2,
  }),
  buildMockPrismaDistrict({
    id: '7d8e9f0a-1b23-4c4d-8e5f-607182930415',
    code: '00003',
    name: '広尾',
    kanaName: 'ヒロオ',
    slug: 'hiroo',
    sortOrder: 3,
  }),
  buildMockPrismaDistrict({
    id: '8e9f0a1b-2c34-4d5e-9f60-718293041526',
    code: '00004',
    name: '代官山',
    kanaName: 'ダイカンヤマ',
    slug: 'daikanyama',
    sortOrder: 4,
  }),
  buildMockPrismaDistrict({
    id: '9f0a1b2c-3d45-4e6f-8071-829304152637',
    code: '00005',
    name: '六本木',
    kanaName: 'ロッポンギ',
    slug: 'roppongi',
    sortOrder: 5,
  }),
  buildMockPrismaDistrict({
    id: 'a01b2c3d-4e56-4f70-9182-930415263748',
    code: '00006',
    name: '神楽坂',
    kanaName: 'カグラザカ',
    slug: 'kagurazaka',
    sortOrder: 6,
  }),
  buildMockPrismaDistrict({
    id: 'b12c3d4e-5f67-4081-8293-041526374859',
    code: '00007',
    name: '渋谷',
    kanaName: 'シブヤ',
    slug: 'shibuya',
    sortOrder: 7,
  }),
];

/**
 * PrismaのDistrictレコード(都市名をinclude)のモックデータを1件作成するヘルパー
 * Prisma.district.findUnique の戻り値(DBの1行)の代わりに使う
 *
 * 基本形は「掲載中・東京に紐づく銀座」。引数で一部の項目だけを上書きできる。
 *   例) buildMockPrismaDistrict()                        → 銀座
 *       buildMockPrismaDistrict({ status: 'editing' })   → 編集中の銀座
 */
const buildMockPrismaDistrict = (
  overrides: Partial<MockPrismaDistrictWithCity> = {},
): MockPrismaDistrictWithCity => ({
  id: DISTRICT_ID,
  code: '00001',
  name: '銀座',
  kanaName: 'ギンザ',
  slug: 'ginza',
  status: DistrictStatus.PUBLISHED,
  sortOrder: 1,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  cityId: CITY_ID,
  city: { name: '東京' },
  userId: USER_ID,
  // 引数で渡された項目だけ、上の値を上書きする
  ...overrides,
});

/**
 * 期待値：District List Read Model (PaginatedResult) [] 作成 ※findAll()用
 *
 * ※テストの期待値は、「出力はこうなるはず」がそのまま読めるのが理想です。
 *  ヘルパーで組み立てると、その分だけ1段読み解く必要が出るため、上記のmockデータ作成のように
 *  ヘルパーを使っていない。
 *
 * @returns District List Read Model []
 */
const createExpectedPaginatedResult =
  (): PaginatedResult<DistrictListReadModel> => {
    // createPrismaMockData() の7地区を、一覧のRead Modelに変換した結果(順番も同じ)
    // createdAt / updatedAt / city / userId は一覧のRead Modelに含まれない
    const readModels: DistrictListReadModel[] = [
      {
        id: DISTRICT_ID,
        code: '00001',
        name: '銀座',
        kanaName: 'ギンザ',
        slug: 'ginza',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 1,
        cityId: CITY_ID,
      },
      {
        id: '6c7d8e9f-0a12-4b3c-9d4e-5f6071829304',
        code: '00002',
        name: '恵比寿',
        kanaName: 'エビス',
        slug: 'ebisu',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 2,
        cityId: CITY_ID,
      },
      {
        id: '7d8e9f0a-1b23-4c4d-8e5f-607182930415',
        code: '00003',
        name: '広尾',
        kanaName: 'ヒロオ',
        slug: 'hiroo',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 3,
        cityId: CITY_ID,
      },
      {
        id: '8e9f0a1b-2c34-4d5e-9f60-718293041526',
        code: '00004',
        name: '代官山',
        kanaName: 'ダイカンヤマ',
        slug: 'daikanyama',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 4,
        cityId: CITY_ID,
      },
      {
        id: '9f0a1b2c-3d45-4e6f-8071-829304152637',
        code: '00005',
        name: '六本木',
        kanaName: 'ロッポンギ',
        slug: 'roppongi',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 5,
        cityId: CITY_ID,
      },
      {
        id: 'a01b2c3d-4e56-4f70-9182-930415263748',
        code: '00006',
        name: '神楽坂',
        kanaName: 'カグラザカ',
        slug: 'kagurazaka',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 6,
        cityId: CITY_ID,
      },
      {
        id: 'b12c3d4e-5f67-4081-8293-041526374859',
        code: '00007',
        name: '渋谷',
        kanaName: 'シブヤ',
        slug: 'shibuya',
        status: DistrictStatus.PUBLISHED,
        sortOrder: 7,
        cityId: CITY_ID,
      },
    ] satisfies DistrictListReadModel[];

    // PaginatedResult型に変換
    return {
      data: readModels,
      meta: {
        totalCount: 7,
        page: 1,
        size: 10,
      },
    } satisfies PaginatedResult<DistrictListReadModel>;
  };

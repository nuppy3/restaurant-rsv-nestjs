// DistrictsController(Presentation層)のテスト
// Controllerの役割は「HTTPの入出力の変換」だけなので、依存するServiceはモックにして、
// ・リクエスト(DTO)を、Command / Filter に正しく詰め替えてServiceに渡しているか
// ・Serviceの戻り値(domain / Read Model)を、レスポンスの形(@Expose()の項目 + statusLabel)に変換しているか
// ・Serviceの例外を、そのまま投げているか(HTTPステータスへの変換はExceptionFilterの担当)
// を検証する。
// ※ JWT認証(AuthGuard)はテストでは動かない(Controllerのメソッドを直接呼ぶため)。
//   ログインユーザーは、認証を通過した後の req を自分で作って渡す
// ※ テストで使う共通データ(DISTRICT_ID など)とモックデータの作成ヘルパー(buildMockDistrict など)はファイル末尾に定義している

import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DistrictFilter } from 'src/districts/query/district.filter';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { DistrictStatus } from '../../../districts/domain/districts.model';
import { DistrictsQueryService } from '../../../districts/query/districts.query.service';
import { DistrictListReadModel } from '../../../districts/query/read-model/district-list.read-model';
import { DistrictsController } from './districts.controller';
import {
  DistrictResponseDto,
  PaginatedDistrictResponseDto,
} from './dto/district.dto';

// MockService定義: QueryService(参照系)
// findAllPaginated / getDetailByIdOrThrow / getDetailByCodeOrThrow は Read Model を返す
const mockDistrictsQueryService = {
  findAllPaginated: jest.fn(),
  // getDetailByIdOrThrow: jest.fn(),
  // getDetailByCodeOrThrow: jest.fn(),
};

describe('■■■ DistrictsController test ■■■', () => {
  let districtsController: DistrictsController;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  // Controllerが依存する2つのServiceを、上で定義したモックに差し替える
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DistrictsController],
      providers: [
        { provide: DistrictsQueryService, useValue: mockDistrictsQueryService },
      ],
    }).compile();

    districtsController = module.get<DistrictsController>(DistrictsController);
  });

  // 前処理: 各テストの前に毎回実行(モックの戻り値・呼び出し記録をリセット)
  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findAllPaginated() test: GET /cities
  //--------------------------------------
  describe('findAllPaginated', () => {
    it('正常系: クエリがFilterに詰め替えられ、dto(data / meta)が返却されること', async () => {
      // service mock data 作成: 一覧(Read Model)とページ情報
      mockDistrictsQueryService.findAllPaginated.mockResolvedValue(
        createPrismaMockData(),
      );

      // test対象controller呼び出し(GET /districts?page=2&size=10)
      const result = await districtsController.findAllPaginated({
        name: '銀座',
        status: DistrictStatus.PUBLISHED,
        cityCode: CITY_CODE,
        page: 2,
        size: 10,
      });

      // 検証: クエリ(name/status など)がそのままFilterとしてQueryServiceに渡されること
      expect(mockDistrictsQueryService.findAllPaginated).toHaveBeenCalledWith({
        name: '銀座',
        status: DistrictStatus.PUBLISHED,
        cityCode: CITY_CODE,
        page: 2,
        size: 10,
      } satisfies DistrictFilter);

      // 検証: data はレスポンスの形に変換され(statusLabelが付く)、meta はそのまま返ること
      expect(result).toEqual(createExpectedPaginatedResponseDto());
    });

    it('正常系: クエリが未指定の場合、name/statusなどの項目はundefinedのままQueryServiceに渡されること', async () => {
      // service mock data 作成: 0件(引数の検証だけをするため、中身はなんでもいい)
      mockDistrictsQueryService.findAllPaginated.mockResolvedValue({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });

      // test対象controller呼び出し(GET /cities)
      await districtsController.findAllPaginated({});

      // 検証: 未指定はundefined(デフォルト値はQueryServiceの中で決まる)
      expect(mockDistrictsQueryService.findAllPaginated).toHaveBeenCalledWith({
        name: undefined,
        status: undefined,
        cityCode: undefined,
        page: undefined,
        size: undefined,
      } satisfies DistrictFilter);
    });

    it('正常系: 該当データが0件の場合、dataが空配列で返却されること', async () => {
      // service mock data 作成: 0件(dataが空配列)
      mockDistrictsQueryService.findAllPaginated.mockResolvedValue({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });

      // test対象controller呼び出し
      const result = await districtsController.findAllPaginated({});

      // 検証: dataは空配列のまま(nullやundefinedにならない)、metaはそのまま返ること
      expect(result).toEqual({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });
    });

    it('異常系: QueryServiceが想定外のエラー(DB接続エラーなど)を投げた場合、そのまま投げられること', async () => {
      // service mock data 作成: DB接続エラー
      // mockCitiesQueryService.findAllPaginated.mockRejectedValue(
      //   new Error('Database connection failed'),
      // );
      // 上記でもいいが以下を採用
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(mockDistrictsQueryService, 'findAllPaginated')
        .mockRejectedValue(connectionError);

      // test対象controller呼び出し、結果検証
      // Controllerは例外をcatchしないので、握りつぶさずにそのまま伝わること
      // (HTTPステータス500への変換はグローバルのDomainExceptionFilterが行う)
      // rejects.toBe: モックが投げたエラー(connectionError)が、別のエラーに包み直されず
      //               そのまま(同じインスタンスで)伝わっていることを確かめる
      await expect(districtsController.findAllPaginated({})).rejects.toBe(
        connectionError,
      );
    });
  });
});

// -----------------------------------------------
// テストデータ: 東京に紐づく銀座
// -----------------------------------------------
const DISTRICT_ID = '5b6c7d8e-9f01-4a2b-8c3d-4e5f60718293';
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const CITY_CODE = '00001';

/**
 * Query ServiceのPaginated Read Modelのモックデータを作成するヘルパー
 * Prisma.district.findMany の戻り値の代わりに使う
 *
 * 東京の7地区(seed と同じデータ。sortOrder の昇順)。id は地区ごとに別の値にしている
 * (一覧の検証で、どの地区のRead Modelかを id でも見分けられるようにするため)
 */
const createPrismaMockData = (): PaginatedResult<DistrictListReadModel> => {
  const readModels = [
    // 銀座のレコード
    buildMockDistrictReadModel(),
    // 恵比寿のレコード(cityId,cityNameなどはベースのまま)
    buildMockDistrictReadModel({
      id: '6c7d8e9f-0a12-4b3c-9d4e-5f6071829304',
      code: '00002',
      name: '恵比寿',
      kanaName: 'エビス',
      slug: 'ebisu',
      sortOrder: 2,
    }) satisfies DistrictListReadModel,
    buildMockDistrictReadModel({
      id: '7d8e9f0a-1b23-4c4d-8e5f-607182930415',
      code: '00003',
      name: '広尾',
      kanaName: 'ヒロオ',
      slug: 'hiroo',
      sortOrder: 3,
    }) satisfies DistrictListReadModel,
    buildMockDistrictReadModel({
      id: '8e9f0a1b-2c34-4d5e-9f60-718293041526',
      code: '00004',
      name: '代官山',
      kanaName: 'ダイカンヤマ',
      slug: 'daikanyama',
      sortOrder: 4,
    }) satisfies DistrictListReadModel,
    buildMockDistrictReadModel({
      id: '9f0a1b2c-3d45-4e6f-8071-829304152637',
      code: '00005',
      name: '六本木',
      kanaName: 'ロッポンギ',
      slug: 'roppongi',
      sortOrder: 5,
    }) satisfies DistrictListReadModel,
    buildMockDistrictReadModel({
      id: 'a01b2c3d-4e56-4f70-9182-930415263748',
      code: '00006',
      name: '神楽坂',
      kanaName: 'カグラザカ',
      status: DistrictStatus.EDITING,
      slug: 'kagurazaka',
      sortOrder: 6,
    }) satisfies DistrictListReadModel,
    buildMockDistrictReadModel({
      id: 'b12c3d4e-5f67-4081-8293-041526374859',
      code: '00007',
      name: '渋谷',
      kanaName: 'シブヤ',
      status: DistrictStatus.SUSPENDED,
      slug: 'shibuya',
      sortOrder: 7,
    }) satisfies DistrictListReadModel,
  ];

  return {
    data: readModels,
    meta: {
      totalCount: 7,
      page: 2,
      size: 10,
    },
  } satisfies PaginatedResult<DistrictListReadModel>;
};

/**
 * PrismaのDistrictレコード(都市名をinclude)のモックデータを1件作成するヘルパー
 * Prisma.district.findUnique の戻り値(DBの1行)の代わりに使う
 *
 * 基本形は「掲載中・東京に紐づく銀座」。引数で一部の項目だけを上書きできる。
 *   例) buildMockPrismaDistrict()                        → 銀座
 *       buildMockPrismaDistrict({ status: 'editing' })   → 編集中の銀座
 */
const buildMockDistrictReadModel = (
  overrides: Partial<DistrictListReadModel> = {},
): DistrictListReadModel => ({
  id: DISTRICT_ID,
  code: CITY_CODE,
  name: '銀座',
  kanaName: 'ギンザ',
  slug: 'ginza',
  status: DistrictStatus.PUBLISHED,
  sortOrder: 1,
  cityId: CITY_ID,
  cityName: '東京',
  // 引数で渡された項目だけ、上の値を上書きする
  ...overrides,
});

/**
 * 期待値：PaginatedDistrictResponseDto 作成 ※findAllPaginated()用
 *
 * ※テストの期待値は、「出力はこうなるはず」がそのまま読めるのが理想です。
 *  ヘルパーで組み立てると、その分だけ1段読み解く必要が出るため、上記のmockデータ作成のように
 *  ヘルパーを使っていない。
 *
 * @returns District List Read Model []
 */
const createExpectedPaginatedResponseDto = (): PaginatedDistrictResponseDto => {
  // createPrismaMockData() の7地区を、一覧のRead Modelに変換した結果(順番も同じ)
  // include した city(都市名)は cityName として入る。createdAt / updatedAt / userId は一覧のRead Modelに含まれない
  const readModels: DistrictResponseDto[] = [
    {
      id: DISTRICT_ID,
      code: '00001',
      name: '銀座',
      kanaName: 'ギンザ',
      slug: 'ginza',
      status: DistrictStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 1,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: '6c7d8e9f-0a12-4b3c-9d4e-5f6071829304',
      code: '00002',
      name: '恵比寿',
      kanaName: 'エビス',
      slug: 'ebisu',
      status: DistrictStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 2,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: '7d8e9f0a-1b23-4c4d-8e5f-607182930415',
      code: '00003',
      name: '広尾',
      kanaName: 'ヒロオ',
      slug: 'hiroo',
      status: DistrictStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 3,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: '8e9f0a1b-2c34-4d5e-9f60-718293041526',
      code: '00004',
      name: '代官山',
      kanaName: 'ダイカンヤマ',
      slug: 'daikanyama',
      status: DistrictStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 4,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: '9f0a1b2c-3d45-4e6f-8071-829304152637',
      code: '00005',
      name: '六本木',
      kanaName: 'ロッポンギ',
      slug: 'roppongi',
      status: DistrictStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 5,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: 'a01b2c3d-4e56-4f70-9182-930415263748',
      code: '00006',
      name: '神楽坂',
      kanaName: 'カグラザカ',
      slug: 'kagurazaka',
      status: DistrictStatus.EDITING,
      statusLabel: '編集中',
      sortOrder: 6,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
    {
      id: 'b12c3d4e-5f67-4081-8293-041526374859',
      code: '00007',
      name: '渋谷',
      kanaName: 'シブヤ',
      slug: 'shibuya',
      status: DistrictStatus.SUSPENDED,
      statusLabel: '停止',
      sortOrder: 7,
      cityId: CITY_ID,
      cityName: '東京',
    } satisfies DistrictResponseDto,
  ] satisfies DistrictResponseDto[];

  // PaginatedDistrictResponseDto型に変換
  return {
    data: readModels,
    meta: {
      totalCount: 7,
      page: 2,
      size: 10,
    },
  } satisfies PaginatedDistrictResponseDto;
};

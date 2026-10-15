import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Request as ExpressRequest } from 'express';
import { RequestUser } from '../../../types/requestUser';
import { CitiesService } from '../../application/cities.service';
import {
  City,
  CityStatus,
  ReconstituteCityProps,
} from '../../domain/cities.model';
import { CityAlreadyPublishedException } from '../../domain/errors/cities.exceptions';
import { CitiesQueryService } from '../../query/cities.query.service';
import { CityDetailReadModel } from '../../query/read-model/city-detail.read-model';
import { CitiesController } from './cities.controller';
import { CreateCityDto } from './dto/city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

// CitiesController(Presentation層)のテスト
// Controllerの役割は「HTTPの入出力の変換」だけなので、依存する2つのServiceはモックにして、
// ・リクエスト(DTO)を、Command / Filter に正しく詰め替えてServiceに渡しているか
// ・Serviceの戻り値(domain / Read Model)を、レスポンスの形(@Expose()の項目 + statusLabel)に変換しているか
// ・Serviceの例外を、そのまま投げているか(HTTPステータスへの変換はExceptionFilterの担当)
// を検証する。
// ※ JWT認証(AuthGuard)はテストでは動かない(Controllerのメソッドを直接呼ぶため)。
//   ログインユーザーは、認証を通過した後の req を自分で作って渡す
// ※ テストで使う共通データ(CITY_ID など)とモックデータの作成ヘルパー(buildMockCity など)はファイル末尾に定義している

// MockService定義: Application Service(更新系)
// create / update / publish / unpublish / remove は domain(City)を返す
const mockCitiesService = {
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  remove: jest.fn(),
};

// MockService定義: QueryService(参照系)
// findAllPaginated / getDetailByIdOrThrow / getDetailByCodeOrThrow は Read Model を返す
const mockCitiesQueryService = {
  findAllPaginated: jest.fn(),
  getDetailByIdOrThrow: jest.fn(),
  getDetailByCodeOrThrow: jest.fn(),
};

describe('■■■ CitiesController test ■■■', () => {
  let citiesController: CitiesController;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  // Controllerが依存する2つのServiceを、上で定義したモックに差し替える
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CitiesController],
      providers: [
        { provide: CitiesService, useValue: mockCitiesService },
        { provide: CitiesQueryService, useValue: mockCitiesQueryService },
      ],
    }).compile();

    citiesController = module.get<CitiesController>(CitiesController);
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
      mockCitiesQueryService.findAllPaginated.mockResolvedValue({
        data: [buildMockCityListReadModel()],
        meta: { totalCount: 8, page: 2, size: 10 },
      });

      // test対象controller呼び出し(GET /cities?page=2&size=10)
      const result = await citiesController.findAllPaginated({
        page: 2,
        size: 10,
      });

      // 検証: クエリ(page / size)がそのままFilterとしてQueryServiceに渡されること
      expect(mockCitiesQueryService.findAllPaginated).toHaveBeenCalledWith({
        page: 2,
        size: 10,
      });
      // 検証: data はレスポンスの形に変換され(statusLabelが付く)、meta はそのまま返ること
      expect(result).toEqual({
        data: [expectedListResponse],
        meta: { totalCount: 8, page: 2, size: 10 },
      });
    });

    it('正常系: 該当データが0件の場合、dataが空配列で返却されること', async () => {
      // service mock data 作成: 0件(dataが空配列)
      mockCitiesQueryService.findAllPaginated.mockResolvedValue({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });

      // test対象controller呼び出し
      const result = await citiesController.findAllPaginated({});

      // 検証: dataは空配列のまま(nullやundefinedにならない)、metaはそのまま返ること
      expect(result).toEqual({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });
    });

    it('正常系: クエリが未指定の場合、page / size はundefinedのままQueryServiceに渡されること', async () => {
      // service mock data 作成: 0件(引数の検証だけをするため、中身はなんでもいい)
      mockCitiesQueryService.findAllPaginated.mockResolvedValue({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });

      // test対象controller呼び出し(GET /cities)
      await citiesController.findAllPaginated({});

      // 検証: 未指定はundefined(デフォルト値はQueryServiceの中で決まる)
      expect(mockCitiesQueryService.findAllPaginated).toHaveBeenCalledWith({
        page: undefined,
        size: undefined,
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
        .spyOn(mockCitiesQueryService, 'findAllPaginated')
        .mockRejectedValue(connectionError);

      // test対象controller呼び出し、結果検証
      // Controllerは例外をcatchしないので、握りつぶさずにそのまま伝わること
      // (HTTPステータス500への変換はグローバルのDomainExceptionFilterが行う)
      // rejects.toBe: モックが投げたエラー(connectionError)が、別のエラーに包み直されず
      //               そのまま(同じインスタンスで)伝わっていることを確かめる
      await expect(citiesController.findAllPaginated({})).rejects.toBe(
        connectionError,
      );
    });
  });

  //--------------------------------------
  // findByCode() test: GET /cities/code/:code
  //--------------------------------------
  describe('findByCode', () => {
    it('正常系: 詳細Read Modelがレスポンスの形で返却されること', async () => {
      // service mock data 作成: 詳細(Read Model)
      mockCitiesQueryService.getDetailByCodeOrThrow.mockResolvedValue(
        buildMockCityDetailReadModel(),
      );

      // test対象controller呼び出し
      const result = await citiesController.findByCode('001');

      // 検証: codeでQueryServiceを呼んでいること
      expect(
        mockCitiesQueryService.getDetailByCodeOrThrow,
      ).toHaveBeenCalledWith('001');
      // 検証: レスポンスの形(createdAt / updatedAt は @Expose() が無いので返らない)
      expect(result).toEqual(expectedListResponse);
    });

    it('異常系: QueryServiceがNotFoundExceptionを投げた場合、そのまま投げられること', async () => {
      // service mock data 作成: 存在しない(404)
      mockCitiesQueryService.getDetailByCodeOrThrow.mockRejectedValue(
        new NotFoundException(
          'codeに関連する都市情報が存在しません!! code: 999',
        ),
      );

      // test対象controller呼び出し、結果検証
      await expect(citiesController.findByCode('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  //--------------------------------------
  // findOne() test: GET /cities/:id
  //--------------------------------------
  describe('findOne', () => {
    it('正常系: 詳細Read Modelがレスポンスの形で返却されること', async () => {
      // service mock data 作成: 詳細(Read Model)
      mockCitiesQueryService.getDetailByIdOrThrow.mockResolvedValue(
        buildMockCityDetailReadModel(),
      );

      // test対象controller呼び出し
      const result = await citiesController.findOne(CITY_ID);

      // 検証: idでQueryServiceを呼んでいること
      expect(mockCitiesQueryService.getDetailByIdOrThrow).toHaveBeenCalledWith(
        CITY_ID,
      );
      expect(result).toEqual(expectedListResponse);
    });

    it('正常系: 都道府県が未設定の場合、prefectureId / prefectureName はレスポンスから省略されること', async () => {
      // service mock data 作成: 都道府県が未設定の詳細(Read Model)
      mockCitiesQueryService.getDetailByIdOrThrow.mockResolvedValue(
        buildMockCityDetailReadModel({
          prefectureId: undefined,
          prefectureName: undefined,
        }),
      );

      // test対象controller呼び出し
      const result = await citiesController.findOne(CITY_ID);

      // 検証: 値がundefinedの項目は、キーごと省略されること(exposeUnsetFields: false)
      expect(result).not.toHaveProperty('prefectureId');
      expect(result).not.toHaveProperty('prefectureName');
    });
  });

  //--------------------------------------
  // create() test: POST /cities
  //--------------------------------------
  describe('create', () => {
    it('正常系: DTOがCommandに詰め替えられ、作成したdomainがレスポンスの形で返却されること', async () => {
      // リクエスト(DTO)作成
      const dto = {
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
        prefectureCode: '13',
      } satisfies CreateCityDto;
      // service mock data 作成: 作成された都市(domain・編集中)
      mockCitiesService.create.mockResolvedValue(buildMockCity());

      // test対象controller呼び出し
      const result = await citiesController.create(dto, mockReq);

      // 検証: DTOの値がCommandとして、ログインユーザーのIDと一緒にServiceに渡されること
      expect(mockCitiesService.create).toHaveBeenCalledWith(
        {
          code: '001',
          name: '東京',
          kanaName: 'トウキョウ',
          slug: 'tokyo',
          sortOrder: 1,
          prefectureCode: '13',
        },
        USER_ID,
      );
      // 検証: domainがレスポンスの形に変換されること
      // ・getter(city.name など)から値が読まれる
      // ・domainはprefectureName を持たないため、レスポンスには含まれない
      expect(result).toEqual(expectedDomainResponse);
    });
  });

  //--------------------------------------
  // update() test: PATCH /cities/:id
  //--------------------------------------
  describe('update', () => {
    it('正常系: 指定した項目だけがCommandに入り(未指定はundefined)、更新したdomainが返却されること', async () => {
      // リクエスト(DTO)作成: name だけを指定
      const dto = { name: '東京' } satisfies UpdateCityDto;
      // service mock data 作成: 更新後の都市(domain)
      mockCitiesService.update.mockResolvedValue(buildMockCity());

      // test対象controller呼び出し
      const result = await citiesController.update(CITY_ID, dto, mockReq);

      // 検証: 未指定の項目はundefinedのままCommandに入ること(Application / domainで「更新しない」扱い)
      expect(mockCitiesService.update).toHaveBeenCalledWith(
        CITY_ID,
        {
          code: undefined,
          name: '東京',
          kanaName: undefined,
          slug: undefined,
          sortOrder: undefined,
          prefectureCode: undefined,
        },
        USER_ID,
      );
      expect(result).toEqual(expectedDomainResponse);
    });

    it('異常系: Serviceが例外(掲載中のため更新不可)を投げた場合、そのまま投げられること', async () => {
      // service mock data 作成: domainのルール違反(409)
      mockCitiesService.update.mockRejectedValue(
        new CityAlreadyPublishedException('東京'),
      );

      // test対象controller呼び出し、結果検証
      // (HTTPステータス409への変換はグローバルのDomainExceptionFilterが行う)
      await expect(
        citiesController.update(CITY_ID, { name: '東京' }, mockReq),
      ).rejects.toThrow(CityAlreadyPublishedException);
    });
  });

  //--------------------------------------
  // publish / unpublish / remove test
  //--------------------------------------
  // 3つとも「idとログインユーザーのIDをServiceに渡し、状態が変わったdomainを返す」同じ形のため、まとめて検証する
  describe('publish / unpublish / remove', () => {
    // [呼び出すメソッド名, Serviceが返す都市のstatus, 期待するstatusLabel]
    it.each<['publish' | 'unpublish' | 'remove', CityStatus, string]>([
      ['publish', CityStatus.PUBLISHED, '反映中'],
      ['unpublish', CityStatus.EDITING, '編集中'],
      ['remove', CityStatus.SUSPENDED, '停止'],
    ])(
      '正常系(%s): idとユーザーIDがServiceに渡され、status(%s)に応じたレスポンスが返却されること',
      async (method, status, statusLabel) => {
        // service mock data 作成: 状態が変わった都市(domain)
        mockCitiesService[method].mockResolvedValue(buildMockCity({ status }));

        // test対象controller呼び出し(methodの値で、呼び出すメソッドを切り替える)
        const result = await citiesController[method](CITY_ID, mockReq);

        // 検証: idとログインユーザーのIDがServiceに渡されること
        expect(mockCitiesService[method]).toHaveBeenCalledWith(
          CITY_ID,
          USER_ID,
        );
        // 検証: statusと、statusに応じたstatusLabelが返ること
        expect(result).toEqual({
          ...expectedDomainResponse,
          status,
          statusLabel,
        });
      },
    );
  });
});

// テストデータ(各テストで共通に使う値)
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * JWT認証を通過した後のリクエストのモックデータ
 * (本番ではAuthGuardが req.user にログインユーザーを入れる。テストではGuardが動かないので自分で作る)
 * Controllerが使うのは req.user.id だけなので、必要な項目だけを持たせて型を合わせる
 */
const mockReq = {
  user: { id: USER_ID, name: 'seed-user', status: 'FREE' },
} as unknown as ExpressRequest & { user: RequestUser };

/**
 * 詳細Read Model(QueryService.getDetailBy〜の戻り値)のモックデータを作成するヘルパー
 * 基本形は「掲載中・都道府県(東京都)ありの東京」。引数で一部の項目だけを上書きできる。
 */
const buildMockCityDetailReadModel = (
  overrides: Partial<CityDetailReadModel> = {},
): CityDetailReadModel => ({
  id: CITY_ID,
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  status: CityStatus.PUBLISHED,
  sortOrder: 1,
  prefectureId: PREFECTURE_ID,
  prefectureName: '東京都',
  createdAt: new Date('2025-04-05T10:00:00.000Z'),
  updatedAt: new Date('2025-04-05T12:30:00.000Z'),
  ...overrides,
});

/**
 * 一覧Read Model(QueryService.findAllPaginatedのdataの1件)のモックデータを作成するヘルパー
 * 詳細Read Modelから createdAt / updatedAt を除いたもの
 */
const buildMockCityListReadModel = () => {
  // 分割代入で createdAt / updatedAt を取り除き、残り(rest)を一覧のRead Modelとして使う
  const { createdAt, updatedAt, ...rest } = buildMockCityDetailReadModel();
  // 取り出した日付は使わないため、未使用変数の lint エラーを避ける目的で void で参照する
  void createdAt;
  void updatedAt;
  return rest;
};

/**
 * City domain(Application Serviceの戻り値)のモックデータを作成するヘルパー
 * 基本形は「編集中・都道府県ありの東京」。引数で一部の項目だけを上書きできる。
 * domainはモックにせず、本物のCity.reconstitute()で作る(外部依存のない純粋なクラスのため)
 */
const buildMockCity = (overrides: Partial<ReconstituteCityProps> = {}): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '001',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.EDITING,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: new Date('2025-04-05T10:00:00.000Z'),
    updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    ...overrides,
  });

// レスポンスの期待値(Read Model: 掲載中の東京)
// ・statusLabel はレスポンスDTOの getter(status → 表示用の文言)から付与される
// ・createdAt / updatedAt はレスポンスDTOに @Expose() が無いので返らない
const expectedListResponse = {
  id: CITY_ID,
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  status: CityStatus.PUBLISHED,
  statusLabel: '反映中',
  sortOrder: 1,
  prefectureId: PREFECTURE_ID,
  prefectureName: '東京都',
};

// レスポンスの期待値(domain: 編集中の東京)
// ・domainは都道府県名を持たないため prefectureName は無い
const expectedDomainResponse = {
  id: CITY_ID,
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  status: CityStatus.EDITING,
  statusLabel: '編集中',
  sortOrder: 1,
  prefectureId: PREFECTURE_ID,
};

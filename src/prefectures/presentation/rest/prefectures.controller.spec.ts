import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request as ExpressRequest } from 'express';
import { UpdatePrefectureCommand } from '../../../prefectures/application/commands/update-prefecture.command';
import { RequestUser } from '../../../types/requestUser';
import { PrefecturesService } from '../../application/prefectures.service';
import {
  PrefectureAlreadyPublishedException,
  PrefectureHasStoresException,
  PrefectureRegionNotAssignedException,
} from '../../domain/errors/prefectures.exceptions';
import {
  Prefecture,
  PrefectureStatus,
  ReconstitutePrefectureProps,
} from '../../domain/prefectures.model';
import { PrefecturesQueryService } from '../../query/prefectures.query.service';
import { PrefectureDetailReadModel } from '../../query/read-model/prefecture-detail.read-model';
import { CreatePrefectureCommand } from './../../application/commands/create-prefecture.command';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
  PaginatedPrefectureResponseDto,
  PrefecturePaginationMetaDto,
  PrefectureResponseDto,
} from './dto/prefecture.dto';
import { PrefecturesController } from './prefectures.controller';

// Mock定義
// Controllerは「更新系はApplication Service」「参照系はQueryService」を呼び出す(CQRS)ため、
// その2つをモック化する。Controllerのテストでは、Serviceの中身(ドメインのルールやDB)は扱わず、
// 「Serviceに正しい引数を渡しているか」「Serviceの戻り値を正しいレスポンスに変換しているか」だけを検証する

// MockPrefecturesService定義(更新系: Application層)
// create / update / publish / unpublish / remove の各エンドポイントから呼ばれる
const mockPrefecturesService = {
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  remove: jest.fn(),
};

// MockPrefecturesQueryService定義(参照系: Query層)
// 一覧 / covered / id検索 / code検索 の各エンドポイントから呼ばれる
// (findByCodeOrFailはStoresService用のため、Controllerからは呼ばれない)
const mockPrefecturesQueryService = {
  findAllPaginated: jest.fn(),
  findCovered: jest.fn(),
  getDetailByIdOrThrow: jest.fn(),
  getDetailByCodeOrThrow: jest.fn(),
  findByCodeOrFail: jest.fn(),
};

// テストデータ(各テストで共通に使う値)
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

// JWT認証後のリクエスト(Guardは通過済みとして扱う)
// ⭐️memo: Controllerのメソッドを直接呼び出すテストなので、@UseGuards(AuthGuard('jwt'))は動かない。
//         本来はGuard(JwtStrategy)が req.user にログインユーザーをセットするため、
//         その結果だけを用意して渡している(未認証で401になることは、アプリを起動して確認する)
// 共通引数：ユーザーID
const req: Partial<ExpressRequest & { user: Partial<RequestUser> }> = {
  user: { id: USER_ID },
};

describe('■■■ PrefecturesController(presentation/rest) TEST ■■■', () => {
  // DIモジュール(テスト対象のController)
  let prefecturesController: PrefecturesController;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    // Controllerが依存する2つ(Application Service / QueryService)をモックに差し替えてDIする
    // ※ controllers に登録するのはテスト対象のControllerだけ。Serviceは providers でモックを渡す
    const module = await Test.createTestingModule({
      controllers: [PrefecturesController],
      providers: [
        { provide: PrefecturesService, useValue: mockPrefecturesService },
        {
          provide: PrefecturesQueryService,
          useValue: mockPrefecturesQueryService,
        },
      ],
    }).compile();

    prefecturesController = module.get<PrefecturesController>(
      PrefecturesController,
    );
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録をすべてリセットする
    jest.resetAllMocks();
  });

  //--------------------------------------
  // GET /prefectures
  //--------------------------------------
  // mockData:
  // ①QueryService findAllPaginated
  describe('findAllPaginated', () => {
    it('正常系: filterがQueryServiceに渡され、dataがレスポンスの形(statusLabel付き)で返却されること', async () => {
      // service mock data 作成: findAllPaginated
      // 1件目: 地方ありの東京都 / 2件目: 地方未設定の青森県
      mockPrefecturesQueryService.findAllPaginated.mockResolvedValue({
        data: [
          buildMockDetailReadModel(),
          // 地方未設定の都道府県
          buildMockDetailReadModel({
            id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
            code: '02',
            name: '青森県',
            kanaName: 'アオモリケン',
            kanaEn: 'Aomori-ken',
            status: PrefectureStatus.EDITING,
            regionId: undefined,
            regionName: undefined,
          }),
        ],
        meta: { totalCount: 47, page: 2, size: 2 },
      });

      // test対象controller呼び出し(クエリパラメータ: page=2&size=2)
      const query = { page: 2, size: 2 } satisfies FindAllPrefectureQueryDto;
      const result = await prefecturesController.findAllPaginated(query);

      // 検証: dataがレスポンスの形(PrefectureResponseDto)に変換されていること
      // ・statusLabel が付与される(published → 反映中、editing → 編集中)
      // ・createdAt / updatedAt は返らない(@Expose() が無いため)
      // ・meta はQueryServiceの戻り値がそのまま返る
      expect(result).toEqual({
        data: [
          {
            id: PREFECTURE_ID,
            name: '東京都',
            code: '13',
            kanaName: 'トウキョウト',
            status: 'published',
            statusLabel: '反映中',
            kanaEn: 'Tokyo-to',
            regionId: REGION_ID,
            regionName: '関東',
          } satisfies PrefectureResponseDto,
          {
            id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
            name: '青森県',
            code: '02',
            kanaName: 'アオモリケン',
            status: 'editing',
            statusLabel: '編集中',
            kanaEn: 'Aomori-ken',
          } satisfies PrefectureResponseDto,
        ],
        meta: {
          totalCount: 47,
          page: 2,
          size: 2,
        } satisfies PrefecturePaginationMetaDto,
      } satisfies PaginatedPrefectureResponseDto);

      // 検証: クエリパラメータ(DTO)がfilterとしてQueryServiceに渡されること
      expect(mockPrefecturesQueryService.findAllPaginated).toHaveBeenCalledWith(
        { page: 2, size: 2 },
      );

      // ⭐️ 地方未設定の場合、キーごと省略されること（これはRegionにも入れたい)
      // (toResponseDto の exposeUnsetFields: false により、undefined の項目はレスポンスに含めない)
      expect(result.data[1]).not.toHaveProperty('regionId');
      expect(result.data[1]).not.toHaveProperty('regionName');
    });
  });

  //--------------------------------------
  // GET /prefectures/covered
  //--------------------------------------
  // mockData:
  // ①QueryService findCovered
  describe('findCovered', () => {
    it('正常系: 店舗数(storeCount)付きで返却されること', async () => {
      // service mock data 作成: findCovered
      // covered の Read Model は「一覧用の項目 + storeCount」なので、詳細Read Modelから日付を取り除いて作る
      // (分割代入で createdAt / updatedAt を取り出し、残りを listReadModel に入れる)
      const { createdAt, updatedAt, ...listReadModel } =
        buildMockDetailReadModel();

      // 取り出した createdAt / updatedAt は使わないため、未使用変数の lint エラーを避ける目的で void で参照する
      void createdAt;
      void updatedAt;
      mockPrefecturesQueryService.findCovered.mockResolvedValue([
        { ...listReadModel, storeCount: 3 },
      ]);

      // test対象controller呼び出し
      const result = await prefecturesController.findCovered();

      // 検証: storeCount を含むレスポンスの形(statusLabel付き)で返却されること
      expect(result).toEqual([
        {
          id: PREFECTURE_ID,
          name: '東京都',
          code: '13',
          kanaName: 'トウキョウト',
          status: 'published',
          statusLabel: '反映中',
          kanaEn: 'Tokyo-to',
          storeCount: 3,
          regionId: REGION_ID,
          regionName: '関東',
        },
      ]);
    });
  });

  //--------------------------------------
  // GET /prefectures/code/:code, GET /prefectures/:id
  //--------------------------------------
  // mockData:
  // ①QueryService getDetailByCodeOrThrow / getDetailByIdOrThrow
  describe('findOne / findByCode', () => {
    // レスポンスの期待値(code検索・id検索で共通)
    // 詳細Read Modelには createdAt / updatedAt があるが、レスポンスには含まれない
    const expectedDetail = {
      id: PREFECTURE_ID,
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      statusLabel: '反映中',
      kanaEn: 'Tokyo-to',
      regionId: REGION_ID,
      regionName: '関東',
    };

    it('正常系(id): 詳細が返却されること', async () => {
      // service mock data 作成: getDetailByIdOrThrow
      mockPrefecturesQueryService.getDetailByIdOrThrow.mockResolvedValue(
        buildMockDetailReadModel(),
      );

      // test対象controller呼び出し(パスパラメータ: id)
      // ※ 本来は ParseUUIDPipe がUUID形式を検証するが、Controllerを直接呼ぶテストではPipeは動かない
      const result = await prefecturesController.findOne(PREFECTURE_ID);

      // 検証: レスポンスの形に変換されていること
      expect(result).toEqual(expectedDetail);

      // 検証: パスパラメータの id がQueryServiceに渡されること
      expect(
        mockPrefecturesQueryService.getDetailByIdOrThrow,
      ).toHaveBeenCalledWith(PREFECTURE_ID);
    });

    it('正常系(code): 詳細が返却され、作成日時・更新日時はレスポンスに含まれないこと', async () => {
      // service mock data 作成: getDetailByCodeOrThrow
      mockPrefecturesQueryService.getDetailByCodeOrThrow.mockResolvedValue(
        buildMockDetailReadModel(),
      );

      // test対象controller呼び出し(パスパラメータ: code=13)
      const result = await prefecturesController.findByCode('13');

      // 検証: レスポンスの形に変換されていること
      expect(result).toEqual(expectedDetail);

      // 検証: パスパラメータの code がQueryServiceに渡されること
      expect(
        mockPrefecturesQueryService.getDetailByCodeOrThrow,
      ).toHaveBeenCalledWith('13');

      // 検証: createdAt / updatedAt はレスポンスに含まれないこと(@Expose() が無いため)
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('異常系(id): QueryServiceのNotFoundExceptionがそのままスローされること', async () => {
      // service mock data 作成: 該当なし(NotFoundException)
      mockPrefecturesQueryService.getDetailByIdOrThrow.mockRejectedValue(
        new NotFoundException('not found'),
      );

      // test対象controller呼び出し、結果検証
      // Controllerは例外を加工せず、そのまま投げること(HTTPの404への変換はNestJSが行う)
      await expect(
        prefecturesController.findOne(PREFECTURE_ID),
      ).rejects.toThrow(new NotFoundException('not found'));
    });
  });

  //--------------------------------------
  // POST /prefectures
  //--------------------------------------
  // mockData:
  // ①Application Service create
  describe('create', () => {
    it('正常系: DTOがCommandに詰め替えられ、ユーザーIDとともにServiceに渡されること', async () => {
      // service mock data 作成: create(作成された編集中の東京都)
      mockPrefecturesService.create.mockResolvedValue(buildMockDomainWithId());

      // test対象controller呼び出し(リクエストボディ: CreatePrefectureDto)
      const dto = {
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        regionCode: '03',
      } satisfies CreatePrefectureDto;
      const result = await prefecturesController.create(
        dto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証: Serviceが返したdomainが、レスポンスの形に変換されていること
      expect(result).toEqual(expectedDomainResponse);

      // 検証: DTO が Command(CreatePrefectureCommand)に詰め替えられ、
      //       req.user.id(ログインユーザーのID)とともにServiceに渡されること
      expect(mockPrefecturesService.create).toHaveBeenCalledWith(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          regionCode: '03',
        } satisfies CreatePrefectureCommand,
        USER_ID,
      );
    });
  });

  //--------------------------------------
  // PATCH /prefectures/:id
  //--------------------------------------
  // mockData:
  // ①Application Service update
  describe('update', () => {
    it('正常系: 指定した項目だけがCommandに入り(未指定はundefined)、Serviceに渡されること', async () => {
      // service mock data 作成: update(name が「東京」に更新された domain)
      mockPrefecturesService.update.mockResolvedValue(
        buildMockDomainWithId({ name: '東京' }),
      );

      // test対象controller呼び出し(リクエストボディ: name だけを指定)
      const result = await prefecturesController.update(
        PREFECTURE_ID,
        { name: '東京' },
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証: 更新後のdomainが、レスポンスの形に変換されていること
      expect(result).toEqual({ ...expectedDomainResponse, name: '東京' });

      // 検証: Command には全項目のキーがあり、指定していない項目は undefined になること
      //       (Service / domain 側で「undefined の項目は更新しない」として扱われる)
      expect(mockPrefecturesService.update).toHaveBeenCalledWith(
        PREFECTURE_ID,
        {
          code: undefined,
          name: '東京',
          kanaName: undefined,
          kanaEn: undefined,
          regionCode: undefined,
        } satisfies UpdatePrefectureCommand,
        USER_ID,
      );
    });

    it('異常系: ドメイン例外(掲載中は更新不可)がそのままスローされること', async () => {
      // service mock data 作成: 掲載中のため更新不可(DomainException)
      mockPrefecturesService.update.mockRejectedValue(
        new PrefectureAlreadyPublishedException('東京都'),
      );

      // test対象controller呼び出し、結果検証
      // Controllerは例外を加工せず、そのまま投げること(HTTPの409への変換はDomainExceptionFilterが行う)
      await expect(
        prefecturesController.update(
          PREFECTURE_ID,
          { name: '東京' },
          // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
          // 完全に一致しないため、保守性がやや低下する可能性があるため）
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(new PrefectureAlreadyPublishedException('東京都'));
    });
  });

  //--------------------------------------
  // POST /prefectures/:id/publish, /unpublish, DELETE /prefectures/:id
  //--------------------------------------
  // mockData:
  // ①Application Service publish / unpublish / remove
  // ※ 状態遷移のエンドポイントはリクエストボディを受け取らない(id と ログインユーザーだけ)
  describe('publish / unpublish / remove', () => {
    it('正常系(publish): idとユーザーIDだけがServiceに渡され、掲載中のレスポンスが返却されること', async () => {
      // service mock data 作成: publish(掲載中になった domain)
      mockPrefecturesService.publish.mockResolvedValue(
        buildMockDomainWithId({ status: PrefectureStatus.PUBLISHED }),
      );

      // test対象controller呼び出し
      const result = await prefecturesController.publish(
        PREFECTURE_ID,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証: 掲載中(statusLabel: 反映中)のレスポンスが返却されること
      expect(result).toEqual({
        ...expectedDomainResponse,
        status: 'published',
        statusLabel: '反映中',
      });

      // 検証: id とユーザーID だけがServiceに渡されること
      expect(mockPrefecturesService.publish).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
    });

    it('異常系(publish): 地方未設定のドメイン例外がそのままスローされること', async () => {
      // service mock data 作成: 地方未設定のため掲載不可(DomainException)
      mockPrefecturesService.publish.mockRejectedValue(
        new PrefectureRegionNotAssignedException('東京都'),
      );

      // test対象controller呼び出し、結果検証(例外がそのままスローされること)
      await expect(
        prefecturesController.publish(
          PREFECTURE_ID,
          // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
          // 完全に一致しないため、保守性がやや低下する可能性があるため）
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(new PrefectureRegionNotAssignedException('東京都'));
    });

    it('正常系(unpublish): idとユーザーIDだけがServiceに渡され、編集中のレスポンスが返却されること', async () => {
      // service mock data 作成: unpublish(編集中に戻った domain)
      mockPrefecturesService.unpublish.mockResolvedValue(
        buildMockDomainWithId(),
      );

      // test対象controller呼び出し
      const result = await prefecturesController.unpublish(
        PREFECTURE_ID,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証: 編集中(statusLabel: 編集中)のレスポンスが返却されること
      expect(result).toEqual(expectedDomainResponse);

      // 検証: id とユーザーID だけがServiceに渡されること
      expect(mockPrefecturesService.unpublish).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
    });

    it('正常系(remove): idとユーザーIDだけがServiceに渡され、停止中のレスポンスが返却されること', async () => {
      // service mock data 作成: remove(停止中になった domain。論理削除のためdomainが返る)
      mockPrefecturesService.remove.mockResolvedValue(
        buildMockDomainWithId({ status: PrefectureStatus.SUSPENDED }),
      );

      // test対象controller呼び出し
      const result = await prefecturesController.remove(
        PREFECTURE_ID,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証: 停止中(statusLabel: 停止)のレスポンスが返却されること
      expect(result).toEqual({
        ...expectedDomainResponse,
        status: 'suspended',
        statusLabel: '停止',
      });

      // 検証: id とユーザーID だけがServiceに渡されること
      expect(mockPrefecturesService.remove).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
    });

    it('異常系(remove): 店舗ありのドメイン例外がそのままスローされること', async () => {
      // service mock data 作成: 店舗が紐づいているため削除不可(DomainException)
      mockPrefecturesService.remove.mockRejectedValue(
        new PrefectureHasStoresException(PREFECTURE_ID),
      );

      // test対象controller呼び出し、結果検証(例外がそのままスローされること)
      await expect(
        prefecturesController.remove(
          PREFECTURE_ID,
          // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
          // 完全に一致しないため、保守性がやや低下する可能性があるため）
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(new PrefectureHasStoresException(PREFECTURE_ID));
    });
  });
});

/**
 * 詳細Read Model(QueryServiceの戻り値)を作成するヘルパー
 * ベースは投稿と
 *
 * getDetailByIdOrThrow / getDetailByCodeOrThrow などが返すデータの代わりに使う。
 * 基本形は「掲載中(published)・地方(関東)ありの東京都」。引数で一部の項目だけを上書きできる。
 *   例) buildDetailReadModel({ regionId: undefined, regionName: undefined }) → 地方未設定
 */
const buildMockDetailReadModel = (
  overrides: Partial<PrefectureDetailReadModel> = {},
): PrefectureDetailReadModel => ({
  id: PREFECTURE_ID,
  code: '13',
  name: '東京都',
  kanaName: 'トウキョウト',
  kanaEn: 'Tokyo-to',
  status: PrefectureStatus.PUBLISHED,
  regionId: REGION_ID,
  regionName: '関東',
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  // 引数で渡された項目だけ、上の値を上書きする
  ...overrides,
});

/**
 * domain(Application Serviceの戻り値)を作成するヘルパー
 * ベースは東京都
 *
 * create / update / publish / unpublish / remove が返す domain(Prefecture & { id }) の代わりに使う。
 * 基本形は「編集中(editing)・地方(関東)ありの東京都」。引数で一部の項目だけを上書きできる。
 * domainはreconstitute()で復元し、Object.assignでidを付与する(Serviceが返す形)
 */
const buildMockDomainWithId = (
  overrides: Partial<ReconstitutePrefectureProps> = {},
): Prefecture & { id: string } =>
  Object.assign(
    Prefecture.reconstitute({
      code: '13',
      name: '東京都',
      kanaName: 'トウキョウト',
      kanaEn: 'Tokyo-to',
      status: PrefectureStatus.EDITING,
      regionId: REGION_ID,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      ...overrides,
    }),
    { id: PREFECTURE_ID },
  );

// レスポンスの期待値(domain: 編集中の東京都)
// buildDomainWithId() の domain を Controller が PrefectureResponseDto に変換した結果
// ・statusLabel は ResponseDto の getter(status → 表示用の文言)から付与される
// ・createdAt / updatedAt は ResponseDto に @Expose() が無いので返らない
// ・domain は地方名を持たないため regionName は無い
const expectedDomainResponse = {
  id: PREFECTURE_ID,
  name: '東京都',
  code: '13',
  kanaName: 'トウキョウト',
  status: 'editing',
  statusLabel: '編集中',
  kanaEn: 'Tokyo-to',
  regionId: REGION_ID,
};

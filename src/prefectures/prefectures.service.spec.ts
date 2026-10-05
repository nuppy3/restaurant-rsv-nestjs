import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
// import { PrismaClientKnownRequestError } from '../../generated/prisma/runtime/library';
// import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prefecture as PrismaPrefecture } from '../../generated/prisma';
import { PAGINATION } from '../common/constants/pagination.constants';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  ReconstituteRegionProps,
  Region,
  RegionStatus,
} from '../regions/domain/regions.model';
import { RegionsQueryService } from '../regions/query/regions.query.service';
import { PrismaService } from './../prisma/prisma.service';
import { CreatePrefectureDto } from './dto/prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';
import {
  Prefecture,
  PrefectureFilter,
  PrefectureWithCoverage,
} from './prefectures.model';
import { PrefecturesService } from './prefectures.service';

const mockPrismaService = {
  prefecture: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

/**
 * RegionsQueryServicd mock
 */
const mockRegionsQueryService = {
  findByCodeOrFail: jest.fn(),
};

describe('□□□ Prefecture Test □□□', () => {
  // DIモジュール
  let prefectureService: PrefecturesService;
  // let regionsService: RegionsService;
  let regionsQueryService: RegionsQueryService;
  let prismaService: PrismaService;
  // 実際のprefectures.service.tsでは、ConfigServiceは個別(prefectures.module.ts)で
  // importsしていない。app.module.tsにてグローバルでDI定義している。が、UTで必要なので。
  // serviceのテストを実施する上でconfigServiceのDIは必須だが、使用しないので以下の警告スキップ
  // コメントを入れている
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;

  let prismaMockPrefectures: (PrismaPrefecture & {
    region: { name: string | null };
  })[];
  let expectedPrefectures: PaginatedResult<
    Prefecture & { id: string; regionName?: string }
  >;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ（DIなど）');

    // @Module({
    //   imports: [PrismaModule, RegionsModule],
    //   controllers: [PrefecturesController],
    //   providers: [PrefecturesService],
    // })

    const module = await Test.createTestingModule({
      // ⭐️ 以下のimportsにRegionsModuleを入れると、Jestの依存関係の瞑想地獄が始まってハマった。。
      // importsでモジュールをDIしようとすると、RegionModule内でもPrismaServiceを使っていたり
      // すると、競合してしまい、RegionModuleからのPrismaModule/servie、(この場合、本物のPrismaService
      // をみに行ってしまうらしい)、が採用されてしまうので、providers:で明示的に
      // { provide: PrismaService, useValue: mockPrismaService },を記述しつつ、
      // .overrideProvider(PrismaService).useValue(mockPrismaService).compile()も
      // 実施すること！！！ああ、ハマった！
      // imports: [RegionsModule],
      // → 結論(最終）： importsを使うと、本物のインスタンスを参照しにいく。（mockではなく
      //    実際のRegionMoculeを参照する。ので、provideのmockRegionServiceと競合が
      //    起きたり、依存関係の瞑想地獄に陥る。当たり前だが、UTなので、本物を使うようなtestは
      //    なるべく避けるのが望ましいので、importsは極力使わない方がいい!!
      // imports: [RegionsModule],  ← ここな
      providers: [
        PrefecturesService,
        ConfigService,
        // ここにも明示的に記述(PrismaServiceをmodkPrismaServiceに切り替え）
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RegionsQueryService, useValue: mockRegionsQueryService },
      ],
    })
      // もし RegionsModule 内部の Service が「本物の PrismaService」を見に行ってしまう場合のみ追加
      // .overrideProvider(PrismaService)
      // .useValue(mockPrismaService)
      .compile();

    prefectureService = module.get<PrefecturesService>(PrefecturesService);
    regionsQueryService = module.get<RegionsQueryService>(RegionsQueryService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    // mock data
    prismaMockPrefectures = createPrismaMockData();
    // 期待値
    expectedPrefectures = createExpectedData();
  });

  // 前処理: 書くテストケースの前に毎回実行
  beforeEach(() => {
    // console.log('beforeEach: モックをリセット');
    // jest.clearAllMocks();
    // 実装（mockRejectedValueなど）もリセットするため、clearAllMocks()→resetAllMocks()
    // に修正
    // 背景：直前のテストで「常にエラーを投げる（mockRejectedValue）」という設定が
    //      prismaService.findManyに残ったままになっていることがあり、次のテストでもエラーが
    //      発生したので。
    jest.resetAllMocks();
    // 各テストが終わるたびに、spyOnで作ったモックをすべて解除する：「モックを壊して、『本物の関数』に戻す」
    // findOneのUTにて、prefectureServiceの'findByIdOrFail'をmock化しているが、その後のfindByIdOrFailの
    // UTにて、上位のmockが残ってしまいUTが期待通り動作しないので、「モックを壊して、『本物の関数』に戻す」
    // jest.spyOn で作られたモックを完全に解除し、オリジナル（本物）の実装に戻します。
    jest.restoreAllMocks();
  });

  // ------------------------------
  // findAll()
  // ------------------------------
  describe('findAll', () => {
    it('正常系: Prefecture配列、全項目(prefectureドメイン配列)を返却する (filterなし)', async () => {
      // prisma mock data 作成
      // findMany
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockResolvedValue(createPrismaMockData());
      // count
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(6);

      // テスト対象service呼び出し
      const result = await prefectureService.findAll();

      // 検証
      expect(result).toEqual(expectedPrefectures);
    });

    it('Promise.all が正しく並列で呼ばれていることを確認', async () => {
      // mock data (なんでもいい)
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockResolvedValue(prismaMockPrefectures);
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(5);

      await prefectureService.findAll();

      // Promise.all が呼ばれた証拠として、両方が呼ばれていることを確認
      expect(
        jest.spyOn(prismaService.prefecture, 'findMany'),
      ).toHaveBeenCalledTimes(1);
      expect(
        jest.spyOn(prismaService.prefecture, 'count'),
      ).toHaveBeenCalledTimes(1);
    });

    it('正常系: Prefecture配列を返却する(任意項目はnull→undefinedに変換)', async () => {
      // prisma mock data 作成 ： 任意項目をnullに設定
      const prismaMockData = createPrismaMockData().map(
        (prefecture) =>
          ({
            ...prefecture,
            userId: null, // serviceにてdomainにセットしていない項目だが、一応
            regionId: null,
            region: { regionName: null },
          }) satisfies PrismaPrefecture & {
            region: { regionName: string | null };
          },
      );
      // findMany
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockResolvedValue(prismaMockData);
      // count
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(6);

      // テスト対象service呼び出し
      const result = await prefectureService.findAll();

      // 検証 : 任意項目にundefinedがセットされていること
      expect(result).toEqual({
        data: [
          {
            id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '北海道',
            code: '01',
            kanaName: 'ホッカイドウ',
            status: 'published',
            kanaEn: 'hokkaido',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
          {
            id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '青森',
            code: '02',
            kanaName: 'アオモリ',
            status: 'published',
            kanaEn: 'aomori',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
          {
            id: '374d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '秋田',
            code: '03',
            kanaName: 'アキタ',
            status: 'published',
            kanaEn: 'akita',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
          {
            id: '474d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '岩手',
            code: '04',
            kanaName: 'イワテ',
            status: 'published',
            kanaEn: 'iwate',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
          {
            id: '574d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '山形',
            code: '05',
            kanaName: 'ヤマガタ',
            status: 'published',
            kanaEn: 'yamagata',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
          {
            id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '東京都',
            code: '13',
            kanaName: 'トウキョウト',
            status: 'published',
            kanaEn: 'tokyo-to',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { id: string; regionName?: string },
        ],
        meta: {
          totalCount: 6,
          page: 1,
          size: 20,
        },
      });
    });

    it('正常系: データが0件の場合は空配列を返却する', async () => {
      // prisma mock data 作成(Prismaは０件の場合、空配列を返却する仕様)
      // findMany
      jest.spyOn(prismaService.prefecture, 'findMany').mockResolvedValue([]);
      // count
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(0);

      // test 対象 service 呼び出し
      const result = await prefectureService.findAll();
      // 検証
      expect(result).toEqual({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      });
    });

    // ⭐️当該異常系テストはどんなErrorでテストしてもいい。（元のエラーをそのまま伝搬するだけなので）
    // 今回は、勉強のため、 PrismaClientKnownRequestErrorで厳密なDB接続エラーと
    // 適当なエラーでテストしてみた。実際のテストでは、どちらか一方を実施すれば問題ない。
    it('異常系①: その他エラーのテスト：元のエラーをそのままスローする', async () => {
      // ---------------------
      // DB接続エラー:PrismaClientKnownRequestError
      // ---------------------
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockRejectedValue(connectionError);

      // 検証:
      // prefecture serviceがコールされるとmock ErrorがThrowされるので、期待値のError()と
      // 一致するか。
      // findAllWithStoreCountでは、Errorが投げられているか？、メッセージの内容が正しいか？
      // の2回expect()をしているが、以下のように一回の方が見やすいし楽だよね。
      await expect(prefectureService.findAll()).rejects.toThrow(
        new PrismaClientKnownRequestError("Can't reach database server", {
          code: 'P1001',
          clientVersion: '5.0.0',
        }),
      );

      // 上記のtoThrow()でのエラーチェックだと緩いらしい。エラーが投げられ、メッセージが正しいかくらい。
      // しかも、PrismaClientKnownRequestError以外を期待値にセットしてもUT不正にしてくれない。。
      // ⭐️より厳密にチェックするには以下のようにtoMatchObject()を使う!
      await expect(prefectureService.findAll()).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P1001',
        message: "Can't reach database server",
        clientVersion: '5.0.0',
      });

      // ----------------------------------------------------------------------
      // その他のエラー（適当なエラー): PrismaClientKnownRequestError以外のエラー
      // ----------------------------------------------------------------------
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Other Error');
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockRejectedValue(mockGenericError);

      // 検証:
      // prefecture serviceがコールされるとmock ErrorがThrowされるので、期待値のError()と
      // 一致するか。
      // findAllWithStoreCountでは、Errorが投げられているか？、メッセージの内容が正しいか？
      // の2回expect()をしているが、以下のように一回の方が見やすいし楽だよね。
      await expect(prefectureService.findAll()).rejects.toThrow(
        new Error('Other Error'),
      );
    });

    /**
     * findAllの絞り込み(filter)テストは、toEqual()の検証ではなく、toHaveBeenCalledWithを
     * 用いて、Prismaが期待通りの引数で呼び出されているかをメインに検証する。
     *
     * Prismaはmockしているので、返却値はmockでセットされるため、レスポンス(Prisma/service)を
     * toEqual()にて検証しても意味がない。
     *
     * ＜テスト観点＞
     * serviceクラスの引数(filters)によって、どのようにPrismaのwhere句などの条件が
     * 変更されるか期待値との検証を行う。
     * 従って、mockResolvedValue()でセットするPrismaのmock dataは、何でもいい。
     *
     * toHaveBeenCalledWith()に渡された引数と期待値が合うか。
     *  重要ポイント：PrismaService.store.findMany()はMock化するが、findMany()は「誰が、
     *  どんな引数で呼んだか」を記録してくれているので、モックでも「実際に渡された引数」で「実際の
     *  PrismaService.findManyの引数(型、値)」で渡されているかチェックするという強力なツール!!
     *
     *  例：  expect(prismaService.store, 'findMany').toHaveBeenCalledWith({
     *         where: {
     *          status: StoreStatus.PUBLISHED,
     *          // 他のプロパティが undefined であることも含めてチェックされる ← 何気にこれ重要!!
     *         },
     *       });
     */
    describe('findAllの絞り込み(filter)テスト', () => {
      it('正常系(1): xxxxを指定した場合、Prismaのwhere句に正しく反映されること', async () => {});
      it('正常系(2): xxxxを指定した場合、Prismaのwhere句に正しく反映されること', async () => {});
      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること', async () => {});
      it('正常系(4): xxxxを指定した場合、Prismaのwhere句に正しく反映されること', async () => {});
      it('正常系(5): xxxxを指定した場合、Prismaのwhere句に正しく反映されること', async () => {});
      /**
       * ■ it.each（テーブル、データ駆動テスト）
       * 境界値テストはテストパターンが似通っているので、it.each を使ってデータ駆動で実装し
       * テストコードの冗長化を防止
       *
       *  it.each(table)(name, fn, timeout)
       * ・it.each([])の[]内にデータ駆動のテストケースをケース分作成
       * ・('$xxxx の場合', async () => {})にprismaのwhere句などの期待値を一つ作成
       *
       * プレースホルダーの使い方
       * %s
       *  文字列（String）
       * %i
       *  整数（Integer）
       * %d
       *  数値（Decimal）
       * %p
       *  任意の値（pretty-print）
       * %#
       *  テスト番号（0から）
       */
      describe('正常系(8) sizeパラメータの境界値テスト', () => {
        // memo: Jest の it.each([...]) は、beforeEach が実行されるよりも前
        // （テストスイートの組み立てフェーズ）に、配列の中身を評価しようとするので、it.each内で
        // configServiceなどのDIされたモジュールを呼び出すとundefinedになる。。
        // なので、期待値に.envなどのファイル読みこみはやめて、下手書きが対策となる。
        //
        it.each([
          {
            testCase: 'size未指定',
            note: 'デフォルト値がセットされること',
            filters: { size: undefined } satisfies PrefectureFilter,
            // expectedParam: configService.get<number>(
            //   'PREFECTURE_DEFAULT_PAGE_SIZE',
            // ),
            expectedParam: 20,
          },
          {
            testCase: 'sizeがマイナス値',
            note: 'sizeにMIN_PAGE_SIZEがセットされること',
            filters: { size: -1 },
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'sizeが0',
            note: 'sizeにMIN_PAGE_SIZEがセットされること',
            filters: { size: 0 },
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'sizeが1(下限値)',
            note: 'sizeにMIN_PAGE_SIZEがセットされること',
            filters: { size: 1 },
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'sizeが正常値①',
            filters: { size: 19 },
            expectedParam: 19,
          },
          {
            testCase: 'sizeが正常値②',
            filters: { size: 21 },
            expectedParam: 21,
          },
          {
            testCase: 'sizeが20(=デフォルト値)',
            note: 'sizeにデフォルト値がセットされること',
            filters: { size: 20 },
            expectedParam: 20,
          },
          {
            testCase: 'sizeの上限値',
            filters: { size: 2000 },
            expectedParam: PAGINATION.MAX_PAGE_SIZE,
          },
          {
            testCase: 'sizeの上限値超過',
            note: 'sizeの上限値がセットされること',
            filters: { size: 2001 },
            expectedParam: PAGINATION.MAX_PAGE_SIZE,
          },
        ])(
          '$testCase の場合、sizeに正しく値が反映されること ($note)',
          async ({ filters, expectedParam }) => {
            // mock data (なんでもいい)
            jest
              .spyOn(prismaService.prefecture, 'findMany')
              .mockResolvedValue(prismaMockPrefectures);

            jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(5);

            // test対象呼び出し：結果は取得しない(「const result = 」は不要)
            // 引数: sizeを指定
            await prefectureService.findAll(filters);

            // 検証： 期待通り引数が渡されているか
            expect(
              jest.spyOn(prismaService.prefecture, 'findMany'),
            ).toHaveBeenCalledWith({
              orderBy: { code: 'asc' },
              // limit
              take: expectedParam,
              // Offset (最初のXX件を飛ばす)
              skip: 0,
              // エリア名
              include: {
                region: {
                  select: {
                    name: true,
                  },
                },
              },
            });
          },
        );
      });

      describe('正常系(9) pageパラメータの境界値テスト: skipの算出ロジックテスト', () => {
        it.each([
          {
            testCase: 'page未指定',
            note: 'skipに0がセットされること',
            filters: { page: undefined } satisfies PrefectureFilter,
            expectedParam: 0,
          },
          {
            testCase: 'pageがマイナス値',
            note: 'pageに0がセットされること',
            filters: { page: -1 },
            expectedParam: 0,
          },
          {
            testCase: 'pageが0',
            note: 'pageに0がセットされること',
            filters: { page: 0 },
            expectedParam: 0,
          },
          {
            testCase: 'pageが1(下限値)',
            note: 'pageに0がセットされること',
            filters: { page: 1 },
            expectedParam: 0,
          },
          {
            testCase: 'pageが正常値①',
            filters: { page: 2 },
            expectedParam: 20,
          },
          {
            testCase: 'pageが正常値②',
            filters: { page: 100 },
            expectedParam: 1980,
          },
          {
            testCase: 'pageが20(=デフォルト値)',
            note: 'pageにデフォルト値がセットされること',
            filters: { page: 1 },
            expectedParam: 0,
          },
          {
            testCase: 'pageの上限値',
            filters: { page: 10000 },
            expectedParam: 199980,
          },
          {
            testCase: 'pageの上限値超過',
            note: 'pageの上限値がセットされること',
            filters: { page: 10001 },
            expectedParam: 199980,
          },
        ])(
          '$testCase の場合、skipに正しく値が反映されること ($note)',
          async ({ filters, expectedParam }) => {
            // mock data (なんでもいい)
            jest
              .spyOn(prismaService.prefecture, 'findMany')
              .mockResolvedValue(prismaMockPrefectures);

            jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(20);

            // test対象呼び出し：結果は取得しない(「const result = 」は不要)
            // 引数: sizeを指定
            await prefectureService.findAll(filters);

            // 検証： 期待通り引数が渡されているか
            expect(
              jest.spyOn(prismaService.prefecture, 'findMany'),
            ).toHaveBeenCalledWith({
              orderBy: { code: 'asc' },
              // limit
              take: 20,
              // Offset (最初のXX件を飛ばす)
              skip: expectedParam,
              // エリア名
              include: {
                region: {
                  select: {
                    name: true,
                  },
                },
              },
            });
          },
        );
      });

      /**
       * 境界値テストはテストパターンが似通っているので、it.each を使ってデータ駆動で実装し
       * テストコードの冗長化を防止
       *
       *  it.each(table)(name, fn, timeout)
       * ・it.each([])の[]内にデータ駆動のテストケースをケース分作成
       * ・('$xxxx の場合', async () => {})にprismaのwhere句などの期待値を一つ作成
       *
       * プレースホルダーの使い方
       * %s
       *  文字列（String）
       * %i
       *  整数（Integer）
       * %d
       *  数値（Decimal）
       * %p
       *  任意の値（pretty-print）
       * %#
       *  テスト番号（0から）
       */
      describe('正常系(n) sizeパラメータの境界値テスト', () => {
        it.each([
          { name: '下限値', filters: { size: undefined }, expectedData: 20 },
          { name: '上限値', filters: { size: undefined }, expectedData: 20 },
          { name: 'xxxx', filters: { size: undefined }, expectedData: 20 },
        ])('$name の場合', async () => {});
      });
    });
  });

  // ------------------------------
  // findAllWithStoreCount()
  // ------------------------------
  describe('findAllWithStoreCount', () => {
    it('正常系： domain専用モデル(PrefectureWithCoverage[])を返却する(全項目)', async () => {
      // prisma mock data
      const prismaMockData = createPrismaMockDataIncludeStoreCount();
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockResolvedValue(prismaMockData);

      // テスト対象servie呼び出し
      const results = await prefectureService.findAllWithStoreCount();

      // 検証
      const expectedData = createExpectedPrefectureWithCoverageData();
      expect(results).toEqual(expectedData);
    });

    it('正常系： domain専用モデル(PrefectureWithCoverage[])を返却する(任意項目はundefined)', async () => {
      // prisma mock data : 任意項目にnullをセット
      const prismaMockData = createPrismaMockDataIncludeStoreCount().map(
        (prefecture) =>
          ({
            ...prefecture,
            regionId: null,
            region: { name: null },
          }) satisfies PrismaPrefecture & {
            _count: { store: number };
            region: { name: string | null };
          },
      );
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockResolvedValue(prismaMockData);

      // テスト対象servie呼び出し
      const results = await prefectureService.findAllWithStoreCount();

      // 検証
      const expectedData = createExpectedPrefectureWithCoverageData().map(
        (data) => ({
          ...data,
          prefecture: {
            name: data.prefecture.name,
            code: data.prefecture.code,
            kanaName: data.prefecture.kanaName,
            status: data.prefecture.status,
            kanaEn: data.prefecture.kanaEn,
            createdAt: data.prefecture.createdAt,
            updatedAt: data.prefecture.updatedAt,
            regionId: undefined,
            regionName: undefined,
          } satisfies Prefecture & { regionName?: string },
        }),
      );
      expect(results).toEqual(expectedData);
    });

    it('正常系： データが0件の場合は空配列を返却する', async () => {
      // prisma mock data
      jest.spyOn(prismaService.prefecture, 'findMany').mockResolvedValue([]);
      // test対象service呼び出し
      const results = await prefectureService.findAllWithStoreCount();
      // 検証
      expect(results).toEqual([]);
    });

    it('異常系①: その他エラーのテスト：元のエラーをそのままスローする', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'findMany')
        .mockRejectedValue(mockGenericError);

      // 元のエラー（Generic Error）がそのままスローされることをテスト
      await expect(prefectureService.findAllWithStoreCount()).rejects.toThrow(
        Error,
      );
      await expect(prefectureService.findAllWithStoreCount()).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  // ------------------------------
  // create()
  // ------------------------------
  describe('create', () => {
    // ----------------------------------------------------------------
    // 1. 正常ケースのテスト
    // ----------------------------------------------------------------
    it('正常系: Prefectureの情報を登録(全項目)し、prefectureドメイン(全項目)を返却する', async () => {
      // serviceの引数作成
      const dto: CreatePrefectureDto = {
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        regionCode: '05',
      };
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // RegionsService mock data 作成
      const regionProps = {
        // id: '0524dc98-89a2-4db1-9431-b20feff57700',
        code: '05',
        name: '北陸',
        kanaName: 'ホクリク',
        kanaEn: 'hokuriku',
        status: RegionStatus.PUBLISHED,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps;
      const region = Region.reconstitute(regionProps);
      const regionWithId = Object.assign(region, {
        id: '0524dc98-89a2-4db1-9431-b20feff57700',
      });

      // region service mock data セット
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // (regionsService.findByCodeOrFail as jest.Mock).mockResolvedValue(
      //   regionWithId,
      // );

      // すでに providers で渡している mock オブジェクトを直接操作する
      // mockRegionsService.findByCodeOrFail.mockResolvedValue(regionWithId);

      // prisma mock data 作成 : Prefecture情報
      jest.spyOn(prismaService.prefecture, 'create').mockResolvedValue({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        // Region data の id（region id)
        regionId: regionWithId.id,
        userId: userId,
      });

      const prismaSpy = jest
        .spyOn(prismaService.prefecture, 'create')
        .mockResolvedValue({
          id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
          name: '石川県',
          code: '24',
          kanaName: 'イシカワ',
          kanaEn: 'ishikawa',
          status: 'published',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
          regionId: regionWithId.id,
          userId: userId,
        });

      // テスト対象service呼び出し
      const result = await prefectureService.create(dto, userId);

      // 検証
      expect(result).toEqual({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
      });

      // 引数検証
      expect(prismaSpy).toHaveBeenCalledWith({
        data: {
          name: '石川県',
          code: '24',
          kanaName: 'イシカワ',
          kanaEn: 'ishikawa',
          status: 'published',
          regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
          userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        },
      });
    });

    it('正常系: Prefectureの情報を登録(任意項目はnull)し、prefectureドメイン(任意項目はnull→undefined変換)を返却する', async () => {
      // serviceの引数作成
      const dto: CreatePrefectureDto = {
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        regionCode: '99',
      };
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // RegionsService mock data 作成
      const mockRegionData = {
        // id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        code: '05',
        name: '北陸',
        kanaName: 'ホクリク',
        kanaEn: 'hokuriku',
        status: RegionStatus.PUBLISHED,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps;
      const region = Region.reconstitute(mockRegionData);
      const regionWithId = Object.assign(region, {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      });
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // prisma modk data 作成 : Prefecture情報
      jest.spyOn(prismaService.prefecture, 'create').mockResolvedValue({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: null,
        userId: userId,
      });

      // テスト対象service呼び出し
      const result = await prefectureService.create(dto, userId);

      // 検証
      expect(result).toEqual({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: undefined,
      });
    });

    // ----------------------------------------------------------------
    // 2. エラーケースのテスト ： catch句のテスト
    // ----------------------------------------------------------------
    it('異常系①: Prefectureの情報を登録(全項目)し、一意制約エラー(P2002)の検証', async () => {
      // serviceの引数作成
      const dto: CreatePrefectureDto = {
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        // regionCode: '05',
      };
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // prismaのP2002エラーのmockを作成
      // PrismaClientKnownRequestError：クエリエンジンがリクエストに関連する既知のエラー (たとえば、一意制約違反)
      // を返す場合、Prisma Client は例外をスローします。
      // 一意制約、アクセス不可などは当該Errorは同じで、codeが違うだけ。
      const mockP2002Error = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`code`)',
        {
          code: 'P2002',
          clientVersion: 'test-version',
          meta: { target: ['code'] }, // 一意制約違反のフィールド
        },
      );

      // Pricmaが、P2002 エラーを返すように設定
      // Errorを返却させたい場合はmockRejectedValue()でcreateのPrisma<Prefecture & {id:string}>の
      // 返却をアンラップして、Errorを返すようにする）
      jest
        .spyOn(prismaService.prefecture, 'create')
        .mockRejectedValue(mockP2002Error);

      // test対象service呼び出し、結果検証
      // ConflictExceptionがスローされることをテスト
      await expect(prefectureService.create(dto, userId)).rejects.toThrow(
        ConflictException,
      );

      // ConflictExceptionのmessageが正しいことを検証
      await expect(prefectureService.create(dto, userId)).rejects.toThrow(
        '指定された code は既に存在します。',
      );
    });

    it('異常系②: P2002以外のPrismaエラーの場合、そのままエラーをスローする', async () => {
      // serviceの引数作成
      const dto: CreatePrefectureDto = {
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        // regionCode: '05',
      };
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // P2002以外のエラーを作成（なんでもいいが、P2000:値が長すぎるエラーにしておく)
      const mockP2000Error = new PrismaClientKnownRequestError(
        'Value too long for column',
        { code: 'P2000', clientVersion: 'test-version' },
      );

      // prismaServiceのmock(Error)を設定
      jest
        .spyOn(prismaService.prefecture, 'create')
        .mockRejectedValue(mockP2000Error);

      // serviceを呼び出し、結果を検証
      await expect(prefectureService.create(dto, userId)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
      // Errorに以下が含まれることを検証（このテストはなくてもいいか）
      await expect(
        prefectureService.create(dto, userId),
      ).rejects.toHaveProperty('code', 'P2000');
    });

    it('異常系③: その他エラーのテスト：元のエラーをそのままスローする', async () => {
      // serviceの引数作成
      const dto: CreatePrefectureDto = {
        name: '石川県',
        code: '24',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        // regionCode: '05',
      };
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'create')
        .mockRejectedValue(mockGenericError);

      // 元のエラー（Generic Error）がそのまま再スローされることをテスト
      await expect(prefectureService.create(dto, userId)).rejects.toThrow(
        Error,
      );
      await expect(prefectureService.create(dto, userId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  // ------------------------------
  // findOne()
  // ------------------------------
  describe('findOne', () => {
    it('正常系: findOneはfindByIdOrFail()を呼び出しているだけなのでド正常系のみテスト', async () => {
      // findByCodeOrFailの引数
      const id: string = '174d2683-7012-462c-b7d0-7e452ba0f1ab';

      // serrvice Mockデータ作成
      const mockPrefecture = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionName: '北海道',
      } satisfies Prefecture & { id: string; regionName?: string };

      //  prisma Mockデータセット
      jest
        .spyOn(prefectureService, 'findByIdOrFail')
        .mockResolvedValue(mockPrefecture);

      // テスト対象のfindByCodeOrFail
      const result = await prefectureService.findOne(id);

      // 期待値
      const prefecture: Prefecture & { id: string; regionName?: string } =
        expectedPrefectures.data.find((prefecture) => prefecture.id === id)!;

      // 🗒 Objectからプロパティを除外するテクニック(分割代入 + スプレッド構文)
      // 20260702: regionNameを除外する必要が無くなったのでコメント化
      // const { regionName, ...expected } = prefecture;

      // 検証
      // expect(result).toEqual(
      //   expectedPrefectures.data.find((prefecture) => prefecture.id === id),
      // );
      expect(result).toEqual(prefecture);

      // prisma 引数検証
      expect(
        jest.spyOn(prefectureService, 'findByIdOrFail'),
      ).toHaveBeenCalledWith(id);
    });
  });

  // ------------------------------
  // findByIdOrFail()
  // ------------------------------
  describe('findByIdOrFail', () => {
    it('正常系：idに紐づくPrefectureを取得(全項目)し、domain型に変換して返却する', async () => {
      // findByCodeOrFailの引数
      const id: string = '174d2683-7012-462c-b7d0-7e452ba0f1ab';

      const prismaMockPrefecture = prismaMockPrefectures.find(
        (prefecture) => prefecture.id === id,
      )!;

      // Prisma Modkデータセット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaMockPrefecture);

      // テスト対象のfindByCodeOrFail
      const result = await prefectureService.findByIdOrFail(id);

      // 検証
      expect(result).toEqual(
        expectedPrefectures.data.find((prefecture) => prefecture.id === id),
      );

      // prisma 引数検証
      expect(
        jest.spyOn(prismaService.prefecture, 'findUnique'),
      ).toHaveBeenCalledWith({
        where: { id },
        include: {
          region: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    it('正常系：idに紐づくPrefectureを取得。任意項目がnullの場合undefinedに変換して返却する。', async () => {
      // findByIdOrFailの引数
      const id: string = '274d2683-7012-462c-b7d0-7e452ba0f1ab';

      // prisma mock data : 任意項目をnullに設定
      const mockPrismaData = createPrismaMockData().find(
        (prefecture) => prefecture.id === id,
      )!;
      // regionIdにnullをセット
      mockPrismaData.regionId = null;
      // regionNameにnullをセット
      mockPrismaData.region.name = null;
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(mockPrismaData);

      // test対象のservice呼び出し
      const result = await prefectureService.findByIdOrFail(id);

      // 検証: 任意項目null → undefind
      expect(result).toEqual({
        id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '青森',
        code: '02',
        kanaName: 'アオモリ',
        status: 'published',
        kanaEn: 'aomori',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: undefined,
        regionName: undefined,
      });
    });

    it('異常系：idに紐づくPrefectureを取得(0件)、NotFoundExceptionをスローする', async () => {
      // findBYCodeOrFailの引数
      const id: string = '99';

      // prisma mock data : データなし = null
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      // test対象のservice呼び出し + 検証: codeに紐づく都道府県情報がない場合
      await expect(prefectureService.findByIdOrFail(id)).rejects.toThrow(
        new NotFoundException(
          `idに関連する都道府県情報が存在しません!! id: ${id}`,
        ),
      );
    });
  });

  // ------------------------------
  // findByCodeOrFail()
  // ------------------------------
  describe('findByCodeOrFail', () => {
    it('正常系：codeに紐づくPrefectureを取得(全項目)し、domain型に変換して返却する', async () => {
      // findByCodeOrFailの引数
      const code: string = '01';

      // PrismaのMockデータ作成
      const prismaMockPrefecture = prismaMockPrefectures.find(
        (prefecture) => prefecture.code === code,
      )!;

      // Prisma Modkデータセット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaMockPrefecture);

      // テスト対象のfindByCodeOrFail
      const result = await prefectureService.findByCodeOrFail(code);

      // 期待値
      const prefecture = expectedPrefectures.data.find(
        (prefecture) => prefecture.code === code,
      )!;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { regionName, ...expected } = prefecture;

      // 検証
      expect(result).toEqual(expected);

      // 引数検証
      expect(
        jest.spyOn(prismaService.prefecture, 'findUnique'),
      ).toHaveBeenCalledWith({ where: { code } });
    });

    it('正常系：codeに紐づくPrefectureを取得。任意項目がnullの場合undefinedに変換して返却する。', async () => {
      // findBYCodeOrFailの引数
      const code: string = '02';

      // prisma mock data : 任意項目をnullに設定
      const mockPrismaData = createPrismaMockData().find(
        (prefecture) => prefecture.code === code,
      )!;
      mockPrismaData.regionId = null;
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(mockPrismaData);

      // test対象のservice呼び出し
      const result = await prefectureService.findByCodeOrFail(code);

      // 検証: 任意項目null → undefind
      expect(result).toEqual({
        id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '青森',
        code: '02',
        kanaName: 'アオモリ',
        status: 'published',
        kanaEn: 'aomori',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: undefined,
      });
    });

    it('異常系：codeに紐づくPrefectureを取得(0件)、NotFoundExceptionをスローする', async () => {
      // findBYCodeOrFailの引数
      const code: string = '99';

      // prisma mock data : データなし = null
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      // test対象のservice呼び出し + 検証: codeに紐づく都道府県情報がない場合
      await expect(prefectureService.findByCodeOrFail(code)).rejects.toThrow(
        new NotFoundException(
          `codeに関連する都道府県情報が存在しません!! code: ${code}`,
        ),
      );
    });
  });

  // ------------------------------
  // update()
  // ------------------------------
  describe('update', () => {
    // ----------------------------------------------------------------
    // 1. 正常ケースのテスト
    // ※ prismaServiceを3回呼び出すため(①prefecture.findUnique、
    //   ②regionsService.findByCodeOrFail、③prefecture.update)、mockDataは3回作成している。
    // ----------------------------------------------------------------
    it('正常系: Prefectureの情報をPrismaに連携(全項目)し、prefectureドメイン(全項目)を返却する', async () => {
      // serviceの引数作成
      // prefecture id
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      // 更新対象DTO
      const dto = {
        name: '北海道-更新',
        code: '77',
        kanaName: 'ホッカイドウ更新',
        status: 'editing',
        kanaEn: 'hokkaidoupdate',
        regionCode: '05',
      } satisfies UpdatePrefectureDto;
      // User id
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // ① prisma mock data 作成 (prefecture.findUnique)
      const prismaPrefecture = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // prisma service mock data セット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaPrefecture);

      // ② region service mock data 作成 (regionsService.findByCodeOrFail)
      // region id 意外はなんでもいい
      const region = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        code: '01',
        name: '北海道',
        kanaName: 'ほっかいどう',
        kanaEn: 'hokkaidou',
        status: RegionStatus.EDITING,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // region service mock data セット
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // ③ prisma mock data 作成 (prefecture.update)
      const prismaPrefectureUpdated = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道-更新',
        code: '77',
        kanaName: 'ホッカイドウ更新',
        status: 'editing',
        kanaEn: 'hokkaidoupdate',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // mock data set
      const prismaSpy = jest
        .spyOn(prismaService.prefecture, 'update')
        .mockResolvedValue(prismaPrefectureUpdated);

      // テスト対象service呼び出し
      const result = await prefectureService.update(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道-更新',
        code: '77',
        kanaName: 'ホッカイドウ更新',
        status: 'editing',
        kanaEn: 'hokkaidoupdate',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      } satisfies Prefecture & { id: string });

      // 引数検証
      expect(prismaSpy).toHaveBeenCalledWith({
        data: {
          name: '北海道-更新',
          code: '77',
          kanaName: 'ホッカイドウ更新',
          status: 'editing',
          kanaEn: 'hokkaidoupdate',
          user: { connect: { id: '633931d5-2b25-45f1-8006-c137af49e53d' } },
          region: { connect: { id: 'b96509f2-0ba4-447c-8a98-473aa26e457a' } },
        },
        where: { id: '174d2683-7012-462c-b7d0-7e452ba0f1ab' },
      });
    });

    // ⭐️ DTOの任意項目をundefined/Prismaの任意項目:null/Prefecture domainの任意項目:null→undefined変換
    it('正常系: Prefectureの情報をPrismaに連携(Prismaの任意項目はnull)し、prefectureドメイン(任意項目はnull→undefined変換)を返却する', async () => {
      // serviceの引数作成
      // prefecture id
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      // 更新対象DTO
      // ⚠️ name: nullという設定は型エラーになってしまうので、undefinedか値をセットしない
      //    パターンのテストを実施する。
      const dto = {
        name: undefined,
        code: undefined,
        kanaName: undefined,
        status: undefined,
        kanaEn: undefined,
        regionCode: undefined,
      } satisfies UpdatePrefectureDto;
      // User id
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // ① prisma mock data 作成 (prefecture.findUnique)
      const prismaPrefecture = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // prisma service mock data セット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaPrefecture);

      // ② region service mock data 作成 (regionsService.findByCodeOrFail)
      // region id 意外はなんでもいい
      const region = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        code: '01',
        name: '北海道',
        kanaName: 'ほっかいどう',
        kanaEn: 'hokkaidou',
        status: RegionStatus.PUBLISHED,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // region service mock data セット
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // ③ prisma mock data 作成 (prefecture.update)
      const prismaPrefectureUpdated = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        // regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionId: null,
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // mock data set
      const prismaSpy = jest
        .spyOn(prismaService.prefecture, 'update')
        .mockResolvedValue(prismaPrefectureUpdated);

      // テスト対象service呼び出し
      const result = await prefectureService.update(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        // regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionId: undefined,
      } satisfies Prefecture & { id: string });

      // 引数検証
      expect(prismaSpy).toHaveBeenCalledWith({
        data: {
          name: undefined,
          code: undefined,
          kanaName: undefined,
          status: undefined,
          kanaEn: undefined,
          user: { connect: { id: '633931d5-2b25-45f1-8006-c137af49e53d' } },
          // regionが作成されないこと
          // region: { connect: { id: 'b96509f2-0ba4-447c-8a98-473aa26e457a' } },
        },
        where: { id: '174d2683-7012-462c-b7d0-7e452ba0f1ab' },
      });
    });

    // ⭐️ DTOの任意項目を空/Prismaの任意項目:null/Prefecture domainの任意項目:null→undefined変換
    it('正常系: DTOの任意項目を空、Prefectureの情報をPrismaに連携(任意項目はnull)し、prefectureドメイン(任意項目はnull→undefined変換)を返却する', async () => {
      // serviceの引数作成
      // prefecture id
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      // 更新対象DTO
      // ⚠️ dtoの項目を空に
      const dto = {
        // name: undefined,
        // code: undefined,
        // kanaName: undefined,
        // status: undefined,
        // kanaEn: undefined,
        // regionCode: undefined,
      } satisfies UpdatePrefectureDto;
      // User id
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // ① prisma mock data 作成 (prefecture.findUnique)
      const prismaPrefecture = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // prisma service mock data セット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaPrefecture);

      // ② region service mock data 作成 (regionsService.findByCodeOrFail)
      // region id 意外はなんでもいい
      const region = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        code: '01',
        name: '北海道',
        kanaName: 'ほっかいどう',
        kanaEn: 'hokkaidou',
        status: RegionStatus.PUBLISHED,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // region service mock data セット
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // ③ prisma mock data 作成 (prefecture.update)
      const prismaPrefectureUpdated = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        // regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionId: null,
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // mock data set
      const prismaSpy = jest
        .spyOn(prismaService.prefecture, 'update')
        .mockResolvedValue(prismaPrefectureUpdated);

      // テスト対象service呼び出し
      const result = await prefectureService.update(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2026-04-15T12:30:00.000Z'),
        // regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionId: undefined,
      } satisfies Prefecture & { id: string });

      // 引数検証
      expect(prismaSpy).toHaveBeenCalledWith({
        data: {
          name: undefined,
          code: undefined,
          kanaName: undefined,
          status: undefined,
          kanaEn: undefined,
          user: { connect: { id: '633931d5-2b25-45f1-8006-c137af49e53d' } },
          // regionが作成されないこと
          // region: { connect: { id: 'b96509f2-0ba4-447c-8a98-473aa26e457a' } },
        },
        where: { id: '174d2683-7012-462c-b7d0-7e452ba0f1ab' },
      });
    });

    it('異常系①: idに紐づくPrefectureが存在しない場合(更新対象のPrefecture無し)、NotFundExceptionをスローする', async () => {
      // serviceの引数作成
      // prefecture id
      const id = 'xxxxxx';
      // 更新対象DTO
      const dto = {
        name: '北海道-更新',
        code: '77',
        kanaName: 'ホッカイドウ更新',
        status: 'editing',
        kanaEn: 'hokkaidoupdate',
        regionCode: '05',
      } satisfies UpdatePrefectureDto;
      // User id
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // prisma service mock data セット(null)
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      // テスト対象service呼び出し
      await expect(prefectureService.update(id, dto, userId)).rejects.toThrow(
        new NotFoundException(
          `idに関連する都道府県情報が存在しません!! prefectureId: ${id}`,
        ),
      );
    });

    // // ----------------------------------------------------------------
    // // 2. エラーケースのテスト ： catch句のテスト
    // // ----------------------------------------------------------------
    // it('異常系①: Prefectureの情報を登録(全項目)し、一意制約エラー(P2002)の検証', async () => {
    //   // serviceの引数作成
    //   const dto: CreatePrefectureDto = {
    //     name: '石川県',
    //     code: '24',
    //     kanaName: 'イシカワ',
    //     kanaEn: 'ishikawa',
    //     status: 'published',
    //     // regionCode: '05',
    //   };
    //   const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

    //   // prismaのP2002エラーのmockを作成
    //   // PrismaClientKnownRequestError：クエリエンジンがリクエストに関連する既知のエラー (たとえば、一意制約違反)
    //   // を返す場合、Prisma Client は例外をスローします。
    //   // 一意制約、アクセス不可などは当該Errorは同じで、codeが違うだけ。
    //   const mockP2002Error = new PrismaClientKnownRequestError(
    //     'Unique constraint failed on the fields: (`code`)',
    //     {
    //       code: 'P2002',
    //       clientVersion: 'test-version',
    //       meta: { target: ['code'] }, // 一意制約違反のフィールド
    //     },
    //   );

    //   // Pricmaが、P2002 エラーを返すように設定
    //   // Errorを返却させたい場合はmockRejectedValue()でcreateのPrisma<Prefecture & {id:string}>の
    //   // 返却をアンラップして、Errorを返すようにする）
    //   jest
    //     .spyOn(prismaService.prefecture, 'create')
    //     .mockRejectedValue(mockP2002Error);

    //   // test対象service呼び出し、結果検証
    //   // ConflictExceptionがスローされることをテスト
    //   await expect(prefectureService.create(dto, userId)).rejects.toThrow(
    //     ConflictException,
    //   );

    //   // ConflictExceptionのmessageが正しいことを検証
    //   await expect(prefectureService.create(dto, userId)).rejects.toThrow(
    //     '指定された code は既に存在します。',
    //   );
    // });

    // it('異常系②: P2002以外のPrismaエラーの場合、そのままエラーをスローする', async () => {
    //   // serviceの引数作成
    //   const dto: CreatePrefectureDto = {
    //     name: '石川県',
    //     code: '24',
    //     kanaName: 'イシカワ',
    //     kanaEn: 'ishikawa',
    //     status: 'published',
    //     // regionCode: '05',
    //   };
    //   const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

    //   // P2002以外のエラーを作成（なんでもいいが、P2000:値が長すぎるエラーにしておく)
    //   const mockP2000Error = new PrismaClientKnownRequestError(
    //     'Value too long for column',
    //     { code: 'P2000', clientVersion: 'test-version' },
    //   );

    //   // prismaServiceのmock(Error)を設定
    //   jest
    //     .spyOn(prismaService.prefecture, 'create')
    //     .mockRejectedValue(mockP2000Error);

    //   // serviceを呼び出し、結果を検証
    //   await expect(prefectureService.create(dto, userId)).rejects.toThrow(
    //     PrismaClientKnownRequestError,
    //   );
    //   // Errorに以下が含まれることを検証（このテストはなくてもいいか）
    //   await expect(
    //     prefectureService.create(dto, userId),
    //   ).rejects.toHaveProperty('code', 'P2000');
    // });

    it('異常系③: その他エラーのテスト：元のエラーをそのままスローする', async () => {
      // serviceの引数作成
      // prefecture id
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      // 更新対象DTO
      // ⚠️ name: nullという設定は型エラーになってしまうので、undefinedか値をセットしない
      //    パターンのテストを実施する。
      const dto = {
        name: undefined,
        code: undefined,
        kanaName: undefined,
        status: undefined,
        kanaEn: undefined,
        regionCode: undefined,
      } satisfies UpdatePrefectureDto;
      // User id
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // ① prisma mock data 作成 (prefecture.findUnique)
      const prismaPrefecture = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        // 更新日
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies PrismaPrefecture;

      // prisma service mock data セット
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(prismaPrefecture);

      // ② region service mock data 作成 (regionsService.findByCodeOrFail)
      // region id 意外はなんでもいい
      const region = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        code: '01',
        name: '北海道',
        kanaName: 'ほっかいどう',
        kanaEn: 'hokkaidou',
        status: RegionStatus.PUBLISHED,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // region service mock data セット
      jest
        .spyOn(regionsQueryService, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'update')
        .mockRejectedValue(mockGenericError);

      // 元のエラー（Generic Error）がそのまま再スローされることをテスト
      await expect(prefectureService.update(id, dto, userId)).rejects.toThrow(
        Error,
      );
      await expect(prefectureService.update(id, dto, userId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});

// Prisma Mock Data 作成
function createPrismaMockData(): (PrismaPrefecture & {
  region: { name: string | null };
})[] {
  const domains: (PrismaPrefecture & { region: { name: string | null } })[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      region: { name: '北海道' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      // 厳密には、regionName: string | null 型であるが、よしとしよ
    } satisfies PrismaPrefecture & { region: { name: string | null } },
    {
      id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '青森',
      code: '02',
      kanaName: 'アオモリ',
      status: 'published',
      kanaEn: 'aomori',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '東北' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & { region: { name: string | null } },
    {
      id: '374d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '秋田',
      code: '03',
      kanaName: 'アキタ',
      status: 'published',
      kanaEn: 'akita',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '東北' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & { region: { name: string | null } },
    {
      id: '474d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '岩手',
      code: '04',
      kanaName: 'イワテ',
      status: 'published',
      kanaEn: 'iwate',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '東北' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & { region: { name: string | null } },
    {
      id: '574d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '山形',
      code: '05',
      kanaName: 'ヤマガタ',
      status: 'published',
      kanaEn: 'yamagata',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '東北' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & { region: { name: string | null } },
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '関東' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & { region: { name: string | null } },
  ];
  return domains;
}

/**
 * 店舗ありの都道府県情報と紐づく店舗数を取得するPrismaのmock data
 * 型：
 *  PrismaPrefecture & { _count: { store: number }; region: { name: string | null };
}
 */
function createPrismaMockDataIncludeStoreCount(): (PrismaPrefecture & {
  _count: { store: number };
  region: { name: string | null };
})[] {
  const domains: (PrismaPrefecture & {
    _count: { store: number };
    region: { name: string | null };
  })[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      _count: { store: 1 },
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      region: { name: '北海道' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & {
      _count: { store: number };
      region: { name: string | null };
    },
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      _count: { store: 10 },
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
      region: { name: '関東' },
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
    } satisfies PrismaPrefecture & {
      _count: { store: number };
      region: { name: string | null };
    },
  ];

  return domains;
}

// 期待値作成
function createExpectedData(): PaginatedResult<
  Prefecture & { id: string; regionName?: string }
> {
  const domains: (Prefecture & { id: string; regionName?: string })[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      regionName: '北海道',
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '青森',
      code: '02',
      kanaName: 'アオモリ',
      status: 'published',
      kanaEn: 'aomori',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      regionName: '東北',
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '374d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '秋田',
      code: '03',
      kanaName: 'アキタ',
      status: 'published',
      kanaEn: 'akita',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      regionName: '東北',
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '474d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '岩手',
      code: '04',
      kanaName: 'イワテ',
      status: 'published',
      kanaEn: 'iwate',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      regionName: '東北',
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '574d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '山形',
      code: '05',
      kanaName: 'ヤマガタ',
      status: 'published',
      kanaEn: 'yamagata',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      regionName: '東北',
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
      regionName: '関東',
    } satisfies Prefecture & { id: string; regionName?: string },
  ];

  const expected: PaginatedResult<Prefecture & { id: string }> = {
    data: domains,
    meta: {
      totalCount: 6,
      page: 1,
      size: 20,
    },
  };

  return expected;
}

/**
 * findAllWithStoreCount() service の mock data
 * 店舗有りの都道府県情報と紐づく店舗数
 *
 * @returns PrefectureWithCoverage[]
 */
function createExpectedPrefectureWithCoverageData(): PrefectureWithCoverage[] {
  const domains: PrefectureWithCoverage[] = [
    {
      prefecture: {
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        regionName: '北海道',
      } satisfies Prefecture & { regionName?: string },
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      storeCount: 1,
    },
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      prefecture: {
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
        regionName: '関東',
      } satisfies Prefecture & { regionName?: string },
      storeCount: 10,
    },
  ];
  return domains;
}

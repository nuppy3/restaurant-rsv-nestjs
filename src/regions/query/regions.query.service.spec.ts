import { NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prisma } from 'generated/prisma';
import { Region as PrismaRegion } from '../../../generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REGION_REPOSITORY_PORT,
  RegionRepositoryPort,
} from '../domain/region.repository.port';
import {
  ReconstituteRegionProps,
  Region,
  RegionState,
  RegionStatus,
} from '../domain/regions.model';
import { RegionDetailReadModel } from './read-model/region-detail.read-model';
import { RegionListReadModel } from './read-model/region-list.read-model';
import { RegionOptionReadModel } from './read-model/region-option.read-model';
import { RegionFilter } from './region.filter';
import { RegionsQueryService } from './regions.query.service';

// MockConfigSerivce定義 → 本物のconfigServiceを使うのでコメント
// const mockConfigSerivce = {
//   get: jest.fn(),
// };

// MockService定義
const mockPrismaService = {
  region: {
    findMany: jest.fn(),
    count: jest.fn(),
    // create: jest.fn(),
    findUnique: jest.fn(),
    // update: jest.fn(),
    // upsert: jest.fn(),
  },
};

// MockRepository定義
const mockRegionRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<RegionRepositoryPort>; // as jest.Mocked<>はなくてもいいが、型安全に

describe('■■■ Region Query Service test ■■■', () => {
  // DIモジュール
  let regionsQueryService: RegionsQueryService;
  let regionRepository: RegionRepositoryPort;
  // configServiceは本物を使う
  // let configService: ConfigService;
  let prismaService: PrismaService;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    console.log('beforeAll: モジュールのセットアップ（DIなど）');

    const module = await Test.createTestingModule({
      // ⭐️ConfigServiceについて
      // 本番では app.module.ts の ConfigModule.forRoot({ isGlobal: true }) によって
      // 解決されます。しかし、Test.createTestingModule() は AppModule を自動的には
      // 読み込まないため、グローバル設定もテストには引き継がれません。
      // RegionsModule内部のRegionsQueryServiceがConfigServiceを要求するため、
      // app.module.tsと同様にConfigModule.forRoot({ isGlobal: true })を含める
      // (isGlobalはコンパイルされたモジュールツリー全体に効くため、ネストされた
      // RegionsModule内部にもConfigServiceが行き渡る)
      // 20260918: mock化するため以下をコメント → と思ったけど、やっぱコメントやめる
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [
        RegionsQueryService,
        // configServiceは本物を使う
        // { provide: ConfigService, useValue: mockConfigSerivce },
        { provide: PrismaService, useValue: mockPrismaService },
        // Repositoryはinterfaceを実装しているのでtoken(=REGION_REPOSITORY_PORT)で指定
        {
          provide: REGION_REPOSITORY_PORT,
          useValue: mockRegionRepository,
        },
      ],
    }).compile();

    // ⭐️memo: mockPrismaServiceなどで、findManyなどを jest.fn() している時点で、prismaService
    //         のfindMany()はmock化されており、mockPrismaServiceを呼び出すだけで、モック
    //         を扱うことができるので、実は、以下のような定義は不要。実際、以下のprismaService(頭にmockがつかない)
    //         は、実態としては、mockPrismaSerivceのインスタンスが入っているので同じモノ。
    //         なので、定義が重複している。
    //         ただ、mockが頭につかない以下のprismaServiceを使ってmockResolvedValue()などを
    //         したい場合、jest.spyOn()でprismaServiceを呼び出す必要がある。ここが変なところ。
    //         → 理由はTypeScriptの型の推論のせい。
    //          prismaServiceはmodule.get<PrismaService>(PrismaService)で取得しているため、
    //          変数の型は本物のPrismaService(Prisma Clientが生成する型)になってしまう。。
    //          { provide: PrismaService, useValue: mockPrismaService },してたとしっても。。
    //          TypeScriptが本物のprismaServiceの型と認識してしまってるので、spyOnなしで呼ぶと
    //          コンパイルエラーというか警告が出るということらしい。
    //          そして、mockPrismaService()、jest.spyOn(prismaService.region...)の両方を
    //          使っても問題ないらしい。
    regionsQueryService = module.get<RegionsQueryService>(RegionsQueryService);
    // configServiceは本物を使う
    // configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    regionRepository = module.get<RegionRepositoryPort>(REGION_REPOSITORY_PORT);
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    console.log('beforeEach: モックをリセット');
    // jest.clearAllMocks();
    jest.resetAllMocks();
    // Configのデフォルト値設定（undefined)
    // ⭐️memo: configSerivceは同期関数(Promiseを返さない)のため、mockReturnValue()で
    //         返却値をセットする。prismaSerivceなどの非同期関数は(Promiseを返す)、
    //         mockResolvedValue()にて返却値を返す必要がある。mockResolvedValueでは
    //         返却値をPromiseで返すように実装されている。
    // 結局、configServiceは本物を使う
    // mockConfigSerivce.get.mockReturnValue(undefined);
  });

  //--------------------------------------
  // findAllPaginated() test
  //--------------------------------------
  // modkData:
  // ①Prisma findMany
  // ②Prisma count
  describe('findAllPaginated', () => {
    it('正常系：ReadMdel配列(全項目)が返却されること(dtoは全て@Expose()がセットされている) - (filter無し)', async () => {
      // prisma mock data 作成: findMany
      const mockDatas = createPrismaMockData();
      jest.spyOn(prismaService.region, 'findMany').mockResolvedValue(mockDatas);

      // prisma mock data 作成: count
      const count = 5;
      jest.spyOn(prismaService.region, 'count').mockResolvedValue(count);

      // テスト対象Service呼び出し
      const filters = {} satisfies RegionFilter;
      const result = await regionsQueryService.findAllPaginated(filters);

      // 検証
      const dtos = createExpectedPaginatedResult();
      expect(result).toEqual(dtos);

      // prisma引数検証
      // prisma(findManay) の パラメータ(where/take/skip/orderBn) 検証
      expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
        include: { _count: { select: { prefectures: true } } },
        where: {},
        take: 20,
        skip: 0,
        // 配列：Prisma.RegionOrderByWithRelationInput[]
        orderBy: [{ code: 'asc' }],
      });
    });

    it('Promise.all が正しく並列で呼ばれていることを確認', async () => {
      // mock data 作成 （なんでもいい)
      jest
        .spyOn(prismaService.region, 'findMany')
        .mockResolvedValue(createPrismaMockData());
      jest.spyOn(prismaService.region, 'count').mockResolvedValue(5);

      // テスト対象のservice呼び出し（結果を取得しない)
      const filters = {} satisfies RegionFilter;
      await regionsQueryService.findAllPaginated(filters);

      // Promise.allが呼ばれた証拠として、両方が呼ばれていることを確認
      expect(
        jest.spyOn(prismaService.region, 'findMany'),
      ).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(prismaService.region, 'count')).toHaveBeenCalledTimes(
        1,
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
     *  重要ポイント：PrismaService.region.findMany()はMock化するが、findMany()は「誰が、
     *  どんな引数で呼んだか」を記録してくれているので、モックでも「実際に渡された引数」で「実際の
     *  PrismaService.findManyの引数(型、値)」で渡されているかチェックするという強力なツール!!
     *
     *  例：  expect(prismaService.fegion, 'findMany').toHaveBeenCalledWith({
     *         where: {
     *          status: StoreStatus.PUBLISHED,
     *          // 他のプロパティが undefined であることも含めてチェックされる ← 何気にこれ重要!!
     *         },
     *       });
     */
    describe('findAllPaginatedの絞り込み(filter) Where句 テスト', () => {
      it('正常系(1): codeを指定した場合、prismaのwhere句に正しく反映されること。', async () => {
        // 引数
        const filters = { code: '01' } satisfies RegionFilter;

        // mock data 作成 （mockデータなので、実際に絞り込まれている必要はない）
        // const prismaRegion = createPrismaMockData().find(
        //   (region) => region.code === filters.code,
        // );

        // mock data set (spyOnを使わないパターン)
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // test対象 service 呼び出し(結果を取得しない)
        await regionsQueryService.findAllPaginated(filters);

        // 検証： prisma の where句
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: { code: '01' },
          take: 20,
          skip: 0,
          // 配列
          orderBy: [{ code: 'asc' }],
        });
        expect(mockPrismaService.region.count).toHaveBeenCalledWith({
          where: { code: '01' },
        });
      });

      it('正常系(2): nameを指定した場合、prismaのwhere句に正しく反映されること。', async () => {
        // 引数
        const filters = { name: '関東' } satisfies RegionFilter;

        // mock data set （mockデータなので、実際に絞り込まれている必要はない）
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // test対象 service 呼び出し(結果を取得しない)
        await regionsQueryService.findAllPaginated(filters);

        // 検証： prisma の where句
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: { name: { contains: '関東' } },
          take: 20,
          skip: 0,
          // 配列
          orderBy: [{ code: 'asc' }],
        });
        expect(mockPrismaService.region.count).toHaveBeenCalledWith({
          where: { name: { contains: '関東' } },
        });
      });

      it('正常系(3): statusを指定した場合、prismaのwhere句に正しく反映されること。', async () => {
        // 引数
        const filters = { status: 'editing' } satisfies RegionFilter;

        // mock data set （mockデータなので、実際に絞り込まれている必要はない）
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // test対象 service 呼び出し(結果を取得しない)
        await regionsQueryService.findAllPaginated(filters);

        // 検証： prisma の where句
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: { status: 'editing' },
          take: 20,
          skip: 0,
          // 配列
          orderBy: [{ code: 'asc' }],
        });
        expect(mockPrismaService.region.count).toHaveBeenCalledWith({
          where: { status: 'editing' },
        });
      });
    });

    /**
     * ■ it.each（テーブル、データ駆動テスト）
     * 境界値テストはテストパターンが似通っているので、it.each を使ってデータ駆動で実装し
     * テストコードの冗長化を防止
     *
     *  it.each(table)(testCase, fn, timeout)
     * ・table: テストケースの配列。配列の要素はオブジェクトで、テストケース名、引数、期待値などを持たせる。
     *    例： {
     *          testCase: 'size未指定',
     *          note: 'デフォルト値がセットされること(他のケースで実施されるが一応)',
     *          filters: { size: undefined } satisfies RegionFilter,
     *          expectedParam: 20,
     *        }
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
    describe('findAllPaginatedのページネーションテスト', () => {
      // ■ sizeの境界値テスト
      // ・未指定
      // ・サイズがマイナス値
      // ・サイズが0
      // ・サイズが1(下限値)
      // ・サイズが正常値：20
      // ・サイズが最大値(100)
      // ・サイズが最大値を超える(101)
      describe('sizeの境界値テスト', () => {
        // memo: it.each([...])はbeforeEachより前(テストスイート組み立てフェーズ)に評価されるため、
        // it.each内でconfigServiceなど、DIされたモジュールを呼び出すとundefinedになる。
        // なので期待値の.envファイル読み込みは行わず、直書きする(prefectures.service.spec.tsに準拠)。
        it.each([
          {
            testCase: 'size未指定',
            note: 'デフォルト値がセットされること(他のケースで実施されるが一応)',
            filters: { size: undefined } satisfies RegionFilter,
            expectedParam: 20,
          },
          {
            testCase: 'sizeがマイナス値',
            note: 'MIN_PAGE_SIZEがセットされること',
            filters: { size: -1 } satisfies RegionFilter,
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'sizeが0',
            note: 'MIN_PAGE_SIZEがセットされること',
            filters: { size: 0 } satisfies RegionFilter,
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'サイズが1(下限値)',
            note: '下限値:PAGINATION.MIN_PAGE_SIZEがセットされること',
            filters: { size: 1 } satisfies RegionFilter,
            expectedParam: PAGINATION.MIN_PAGE_SIZE,
          },
          {
            testCase: 'サイズが正常値：20',
            note: '正常値:20がセットされること',
            filters: { size: 20 } satisfies RegionFilter,
            expectedParam: 20,
          },
          {
            testCase: 'サイズが最大値(2000)',
            note: '最大値:RAGINATION.MAX_PAGE_SIZEがセットされること',
            filters: { size: 2000 } satisfies RegionFilter,
            expectedParam: PAGINATION.MAX_PAGE_SIZE,
          },
          {
            testCase: 'サイズが最大値を超える(2001)',
            note: '最大値:RAGINATION.MAX_PAGE_SIZEがセットされること',
            filters: { size: 2001 } satisfies RegionFilter,
            expectedParam: PAGINATION.MAX_PAGE_SIZE,
          },
        ])('$testCase', async ({ filters, expectedParam }) => {
          // mock data set (なんでもいい)
          mockPrismaService.region.findMany.mockResolvedValue(
            createPrismaMockData(),
          );
          mockPrismaService.region.count.mockResolvedValue(5);

          // test対象 service 呼び出し
          await regionsQueryService.findAllPaginated(filters);

          // 検証： prisma の take句
          expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
            include: { _count: { select: { prefectures: true } } },
            where: {},
            take: expectedParam,
            skip: 0,
            // 配列
            orderBy: [{ code: 'asc' }],
          });
        });
      });

      describe('pageの境界値テスト: skipの算出ロジックテスト', () => {
        // ■ pageの境界値テスト
        // ・未指定
        // ・マイナス値
        // ・0
        // ・1(下限値)
        // ・正常値：2
        // ・最大値(10000)
        // ・ 最大値を超える(10001)
        it.each([
          {
            testCase: 'page未指定',
            note: 'デフォルト値がセットされること(他のケースで実施されるが一応)',
            filters: { page: undefined } satisfies RegionFilter,
            expectedParam: 0,
          },
          {
            testCase: 'pageがマイナス値',
            note: 'skip句に0がセットされること',
            filters: { page: -1 } satisfies RegionFilter,
            expectedParam: 0,
          },
          {
            testCase: 'pageが0',
            note: 'skip句に0がセットされること',
            filters: { page: 0 } satisfies RegionFilter,
            expectedParam: 0,
          },
          {
            testCase: 'pageが1(下限値)',
            note: 'skip句に0がセットされること',
            filters: { page: 1 } satisfies RegionFilter,
            expectedParam: 0,
          },
          {
            testCase: 'pageが正常値：2',
            note: 'skip句に20がセットされること',
            filters: { page: 2 } satisfies RegionFilter,
            expectedParam: 20,
          },
          {
            testCase: 'pageが最大値(10000)',
            note: 'skip句に199980がセットされること',
            filters: { page: 10000 } satisfies RegionFilter,
            expectedParam: 199980,
          },
          {
            testCase: 'pageが最大値を超える(10001)',
            note: 'skip句に199980がセットされること',
            filters: { page: 10001 } satisfies RegionFilter,
            expectedParam: 199980,
          },
        ])('$testCase', async ({ filters, expectedParam }) => {
          // mock data set (なんでもいい)
          mockPrismaService.region.findMany.mockResolvedValue(
            createPrismaMockData(),
          );
          mockPrismaService.region.count.mockResolvedValue(5);

          // test対象 service 呼び出し
          await regionsQueryService.findAllPaginated(filters);

          // 検証: skip句の算出ロジック
          expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
            include: { _count: { select: { prefectures: true } } },
            where: {},
            take: 20,
            skip: expectedParam,
            // 配列
            orderBy: [{ code: 'asc' }],
          });
        });
      });

      it('正常系: sizeとpageの両方を指定した場合、正しくskipとtakeが算出されること', async () => {
        // mock data set (なんでもいい)
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // テスト対象service呼び出し
        const filters = {
          size: 10,
          page: 3,
        } satisfies RegionFilter;
        await regionsQueryService.findAllPaginated(filters);

        // 検証: Prisma の take/skip句の算出
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: {},
          // サイズ
          take: 10,
          // offset(最初のXX件を飛ばす)
          skip: 20,
          // 配列
          orderBy: [{ code: 'asc' }],
        });
      });
    });

    describe('findAllPaginatedのorderBy句テスト', () => {
      it('正常系: sortBy sortOrderを指定した場合、orderBy句が正しくセットされる', async () => {
        // 引数
        const filters = {
          sortBy: 'name',
          sortOrder: 'desc',
        } satisfies RegionFilter;

        // mock data （なんでもいい）
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // test対象service呼び出し
        await regionsQueryService.findAllPaginated(filters);

        // 検証：orderBy句
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: {},
          take: 20,
          skip: 0,
          orderBy: [{ name: 'desc' }],
        });
      });

      it('正常系: sortBy sortOrderが未指定の場合、デフォルトソート（code = asc）がセットされる', async () => {
        // 引数
        const filters = {
          sortBy: undefined,
          sortOrder: undefined,
        } satisfies RegionFilter;

        // mock data （なんでもいい）
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );
        mockPrismaService.region.count.mockResolvedValue(5);

        // test対象service呼び出し
        await regionsQueryService.findAllPaginated(filters);

        // 検証：orderBy句
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: {},
          take: 20,
          skip: 0,
          orderBy: [{ code: 'asc' }],
        });
      });
    });

    describe('findAllPaginatedの絞り込み(filter) スモークテスト(複合条件)', () => {
      it('filterが全て指定された場合、正しくwhere句、skip、take、orderBy などが組み立てられること', async () => {
        // 引数
        const filters = {
          code: '01',
          name: '北海道',
          status: 'editing',
          size: 10,
          page: 2,
          sortBy: 'name',
          sortOrder: 'desc',
        } satisfies RegionFilter;

        // prisma modk data (なんでもいい)
        mockPrismaService.region.findMany.mockResolvedValue(
          createPrismaMockData(),
        );

        // seavice 呼び出し
        await regionsQueryService.findAllPaginated(filters);

        // prisma(findManay) の パラメータ(where/take/skip/orderBn) 検証
        expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
          include: { _count: { select: { prefectures: true } } },
          where: {
            code: filters.code,
            name: { contains: filters.name },
            status: filters.status,
          },
          take: 10,
          skip: 10,
          // 配列：Prisma.RegionOrderByWithRelationInput[]
          orderBy: [{ name: 'desc' }],
        });
        // prisma(findManay) の パラメータ(count) 検証
        expect(mockPrismaService.region.count).toHaveBeenCalledWith({
          where: {
            code: filters.code,
            name: { contains: filters.name },
            status: filters.status,
          },
        });
      });
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される', async () => {
      // mock data 作成(空配列)
      jest.spyOn(prismaService.region, 'findMany').mockResolvedValue([]);
      // 0件
      jest.spyOn(prismaService.region, 'count').mockResolvedValue(0);

      // test対象Controller呼び出し
      const filters = {} satisfies RegionFilter;
      const result = await regionsQueryService.findAllPaginated(filters);

      // 期待値: PaginatedResult (空配列と0件)
      const paginatedExpect = {
        // 空配列
        data: [],
        meta: {
          // 0件
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<RegionListReadModel>;

      // 検証：
      expect(result).toEqual(paginatedExpect);
    });

    it('異常系(カバレッジ100%のため)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.region, 'findMany')
        .mockRejectedValue(connectionError);

      // Query Serviceがエラーをそのまま伝播（reject）することを確認
      await expect(regionsQueryService.findAllPaginated()).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------------
  // findAll() test
  //--------------------------------------
  // modkData:
  // ①Prisma findMany
  describe('findAll', () => {
    it('正常系：ReadMdel配列(全項目)が返却されること', async () => {
      // prisma mock data 作成: findMany
      const mockDatas = createPrismaMockData();
      jest.spyOn(prismaService.region, 'findMany').mockResolvedValue(mockDatas);

      // テスト対象Service呼び出し
      const result = await regionsQueryService.findAll();

      // 検証
      expect(result).toEqual([
        {
          id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
          name: '北海道',
          code: '01',
        } satisfies RegionOptionReadModel,
        {
          id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
          name: '東北',
          code: '02',
        } satisfies RegionOptionReadModel,
        {
          id: '0324dc98-89a2-4db1-9431-b20feff57700',
          name: '関東',
          code: '03',
        } satisfies RegionOptionReadModel,
        {
          id: '0424dc98-89a2-4db1-9431-b20feff57700',
          name: '東海',
          code: '04',
        } satisfies RegionOptionReadModel,
        {
          id: '0524dc98-89a2-4db1-9431-b20feff57700',
          name: '北陸',
          code: '05',
        } satisfies RegionOptionReadModel,
      ] satisfies RegionOptionReadModel[]);

      // prisma引数検証
      // prisma(findManay) の パラメータ(where/take/skip/orderBn) 検証
      expect(mockPrismaService.region.findMany).toHaveBeenCalledWith({
        where: {
          status: RegionStatus.PUBLISHED,
        } satisfies Prisma.RegionWhereInput,
        orderBy: [
          { code: 'asc' },
        ] satisfies Prisma.RegionOrderByWithRelationInput[],
      });
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される', async () => {
      // mock data 作成(空配列)
      jest.spyOn(prismaService.region, 'findMany').mockResolvedValue([]);

      // test対象Controller呼び出し
      const result = await regionsQueryService.findAll();

      // 検証
      expect(result).toEqual([]);
    });

    it('異常系(カバレッジ100%のため)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.region, 'findMany')
        .mockRejectedValue(connectionError);

      // Query Serviceがエラーをそのまま伝播（reject）することを確認
      await expect(regionsQueryService.findAll()).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------------
  // findOne() test
  //--------------------------------------
  describe('findOne', () => {
    it('正常系： 指定idに関連するRegionドメイン(＋id)(全項目)を返却する', async () => {
      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstitute()を使う（BP)
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps) satisfies Region;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      //  jest.spyOn は「本物のメソッドを監視・上書きしたいとき」に使うため、本来は以下のように
      //  直接mockに対してmockresolvedValue()するのが主流のよう。
      //  これからはspyOn()をやめてみよう。。
      mockRegionRepository.findByIdOrFail.mockResolvedValue(regionWithId);

      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';

      // テスト対象 service 呼び出し
      const result = await regionsQueryService.findOne(id);

      // 検証: RegionドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      // mockDataの型指定(Region & { id: string })は不要（というかRegionはプレーンオブジェクト
      // ではないので型指定すると不一致エラーが出てしまうので、RegionStateというRegion domain 全属性を
      // 使用している。
      expect(result).toMatchObject({
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies RegionState & { id: string });

      // 引数チェック
      expect(
        jest.spyOn(regionRepository, 'findByIdOrFail'),
      ).toHaveBeenCalledWith(id);
    });

    it('異常系①： 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'xxxx';

      // mock data 作成(Repository): Regionが存在しない
      const mockException = new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // 検証：NotFoundException
      await expect(regionsQueryService.findOne(id)).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系②： Retion情報の更新時のエラー（DB接続エラー)', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';

      // DB接続エラー
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );

      // mock data set (Error)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(connectionError);

      // 検証: エラーをそのまま伝搬することを確認
      await expect(regionsQueryService.findOne(id)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail() test
  //--------------------------------------
  describe('findByCodeOrFail', () => {
    it('正常系： 指定codeのRegion domain(全項目)を返却する', async () => {
      // serviceの引数
      const code = '02';

      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstitute()を使う（BP)
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps) satisfies Region;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByCodeOrFail')
        .mockResolvedValue(regionWithId);

      // test対象service呼び出し
      const result = await regionsQueryService.findByCodeOrFail(code);

      // 検証:
      // expect(result).toEqual(expected);
      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      // RegionドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      // mockDataの型指定(Region & { id: string })は不要（というかRegionはプレーンオブジェクト
      // ではないので型指定すると不一致エラーが出てしまうので、RegionStateというRegion domain 全属性を
      // 使用している。
      expect(result).toMatchObject({
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies RegionState & { id: string });

      // service→regionRepository.findByCodeOrFail()への引数の検証
      expect(
        jest.spyOn(regionRepository, 'findByCodeOrFail'),
      ).toHaveBeenCalledWith(code);
    });

    it('異常系： codeに関連するエリア情報が存在しない場合、NotFoundExcepton(エラーの伝搬確認)', async () => {
      // serviceの引数
      const code = '99';

      // repositoryにException(期待値)をセット
      const mockException = new NotFoundException(
        `codeに関連するエリア情報が存在しません!! code: ${code}`,
      );
      jest
        .spyOn(regionRepository, 'findByCodeOrFail')
        .mockRejectedValue(mockException);

      // 検証
      await expect(regionsQueryService.findByCodeOrFail(code)).rejects.toThrow(
        new NotFoundException(
          `codeに関連するエリア情報が存在しません!! code: ${code}`,
        ),
      );
    });
  });

  //--------------------------------------
  // getDetailByIdOrThrow() test
  //--------------------------------------
  describe('getDetailByIdOrThrow', () => {
    it('正常系: idに関連するReadModel(全項目)を返却する', async () => {
      // 引数
      const id = 'ad24dc98-89a2-4db1-9431-b20feff57700';

      // prisma mock data set
      mockPrismaService.region.findUnique.mockResolvedValue(
        createPrismaMockData().find((region) => region.id === id),
      );

      // test 対象 Query Service 呼び出し
      const result = await regionsQueryService.getDetailByIdOrThrow(id);

      // 検証
      expect(result).toEqual({
        id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
        name: '東北',
        code: '02',
        kanaName: 'とうほく',
        status: 'published',
        kanaEn: 'tohoku',
        prefectureCount: 2,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies RegionDetailReadModel);
    });

    it('異常系: 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // 引数
      const id = 'xxxxxxx';

      // prisma mock data set : Regionが存在しない
      mockPrismaService.region.findUnique.mockResolvedValue(null);

      // Exception検証（①NotFoundExceptionの検証 ②メッセージの検証）のやり方より以下のように
      // 一発で検証するやり方がBP。
      await expect(
        regionsQueryService.getDetailByIdOrThrow(id),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系(エラーの伝搬)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.region, 'findUnique')
        .mockRejectedValue(connectionError);

      // 引数
      const id = 'ad24dc98-89a2-4db1-9431-b20feff57700';

      // Query Serviceがエラーをそのまま伝播（reject）することを確認
      await expect(
        regionsQueryService.getDetailByIdOrThrow(id),
      ).rejects.toThrow(PrismaClientKnownRequestError);
    });
  });

  //--------------------------------------
  // getDetailByCodeOrThrow() test
  //--------------------------------------
  describe('getDetailByCodeOrThrow', () => {
    it('正常系: codeに関連するReadModel(全項目)を返却する', async () => {
      // 引数
      const code = '03';

      // prisma mock data set
      mockPrismaService.region.findUnique.mockResolvedValue(
        createPrismaMockData().find((region) => region.code === code),
      );

      // test 対象 Query Service 呼び出し
      const result = await regionsQueryService.getDetailByCodeOrThrow(code);

      // 検証
      expect(result).toEqual({
        id: '0324dc98-89a2-4db1-9431-b20feff57700',
        name: '関東',
        code: '03',
        kanaName: 'かんとう',
        status: 'published',
        kanaEn: 'kantou',
        prefectureCount: 3,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies RegionDetailReadModel);
    });

    it('異常系: 指定codeに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // 引数
      const code = 'xx';

      // prisma mock data set : Regionが存在しない
      mockPrismaService.region.findUnique.mockResolvedValue(null);

      // Exception検証（①NotFoundExceptionの検証 ②メッセージの検証）のやり方より以下のように
      // 一発で検証するやり方がBP。
      await expect(
        regionsQueryService.getDetailByCodeOrThrow(code),
      ).rejects.toThrow(
        new NotFoundException(
          `codeに関連するエリア情報が存在しません!! regionCode: ${code}`,
        ),
      );
    });

    it('異常系(エラーの伝搬)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prismaService.region, 'findUnique')
        .mockRejectedValue(connectionError);

      // 引数
      const code = '01';

      // Query Serviceがエラーをそのまま伝播（reject）することを確認
      await expect(
        regionsQueryService.getDetailByIdOrThrow(code),
      ).rejects.toThrow(PrismaClientKnownRequestError);
    });
  });
});

/**
 * Prisma Mock Data作成
 * @returns Prisma Mock Data
 */
function createPrismaMockData(): (PrismaRegion & {
  _count: { prefectures: number };
})[] {
  const mockDatas: (PrismaRegion & { _count: { prefectures: number } })[] = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      _count: { prefectures: 1 },
    },
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      _count: { prefectures: 2 },
    },
    {
      id: '0324dc98-89a2-4db1-9431-b20feff57700',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'published',
      kanaEn: 'kantou',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      _count: { prefectures: 3 },
    },
    {
      id: '0424dc98-89a2-4db1-9431-b20feff57700',
      name: '東海',
      code: '04',
      kanaName: 'とうかい',
      status: 'published',
      kanaEn: 'tokai',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      _count: { prefectures: 4 },
    },
    {
      id: '0524dc98-89a2-4db1-9431-b20feff57700',
      name: '北陸',
      code: '05',
      kanaName: 'ほくりく',
      status: 'editing',
      kanaEn: 'hokuriku',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      _count: { prefectures: 5 },
    },
  ];
  return mockDatas;
}

/**
 * 期待値：Region List Read Model (PaginatedResult) [] 作成 ※findAll()用
 *
 * @returns Region List Read Model []
 */
function createExpectedPaginatedResult(): PaginatedResult<RegionListReadModel> {
  const readModels: RegionListReadModel[] = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      prefectureCount: 1,
    } satisfies RegionListReadModel,
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      prefectureCount: 2,
    } satisfies RegionListReadModel,
    {
      id: '0324dc98-89a2-4db1-9431-b20feff57700',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'published',
      kanaEn: 'kantou',
      prefectureCount: 3,
    } satisfies RegionListReadModel,
    {
      id: '0424dc98-89a2-4db1-9431-b20feff57700',
      name: '東海',
      code: '04',
      kanaName: 'とうかい',
      status: 'published',
      kanaEn: 'tokai',
      prefectureCount: 4,
    } satisfies RegionListReadModel,
    {
      id: '0524dc98-89a2-4db1-9431-b20feff57700',
      name: '北陸',
      code: '05',
      kanaName: 'ほくりく',
      status: 'editing',
      kanaEn: 'hokuriku',
      prefectureCount: 5,
    } satisfies RegionListReadModel,
  ];

  // ページネーション化
  const paginated = {
    data: readModels,
    meta: {
      totalCount: 5,
      page: 1,
      size: 20,
    },
  } satisfies PaginatedResult<RegionListReadModel>;

  return paginated;
}

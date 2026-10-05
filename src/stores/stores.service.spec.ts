import { Test } from '@nestjs/testing';
import { PrismaService } from './../prisma/prisma.service';
// import { Store } from './entities/store.entity';
import { NotFoundException } from '@nestjs/common';
// PrismaのスキーマはXXXXPrismaという名前にリネーム
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Prefecture as PrefecturePrisma,
  Store as StorePrisma,
} from '../../generated/prisma';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { PrefecturesService } from '../prefectures/prefectures.service';
import { RegionsModule } from '../regions/regions.module';
import { PublishStoreDto } from './dto/publish-store.dto';
import { CreateStoreDto } from './dto/store.dto';
import { StoreReadModel } from './query/stores.read-model';
import { SortOrder, StoreFilter, StoreStatus } from './stores.model';
import { StoresService } from './stores.service';

// PrismaServiceのMock
const mockPrismaService = {
  store: {
    // fn()はmock関数(振る舞いはテスト実施時に指定)
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  prefecture: { findUnique: jest.fn() },
};

// describe():関連する複数のテストケースをグループ化
describe('StoresService Test', () => {
  // DIモジュール

  // serviceのテストを実施する上でconfigServiceのDIは必須だが、使用しないので以下の警告スキップ
  // コメントを入れている
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;
  let storesService: StoresService;
  let prismaService: PrismaService;
  // 正常系データ: Prismaの返却値(StoreはPrismaの型)
  let prismaMockStores: (StorePrisma & {
    prefecture: PrefecturePrisma | null;
  })[];
  // 期待値: seriveの返却値
  let expectedStores: PaginatedResult<StoreReadModel>;
  // Prismaの型：Store + Prefectrue
  // prefectureのidを取得していないので除外するためPartialとして定義(Omitだと都度除外しないといけないのでPartialで対応)
  type PrismaStoreWithPrefecture = StorePrisma & {
    prefecture: Partial<PrefecturePrisma | null>;
  };

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ（DIなど）');

    //---------------------------------
    // @Module({
    //   imports: [PrismaModule, AuthModule, RegionsModule],
    //   controllers: [StoresController],
    //   providers: [StoresService, PrefecturesService],
    // })
    //---------------------------------
    // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
    // この便利なDIの仕組みはNestJSの仕組み。
    // 最後の.compile()を忘れずに
    const module = await Test.createTestingModule({
      // DI対象サービス
      // RegionsModule内のRegionsQuerySerivceにてConfigModuleを使用しているためConfigModule
      // のimportsを追加。実際、本番では、app.module.tsでConfigModule.forRoot({ isGlobal: true })を
      // 指定しているので、DIされるが、Testではapp.module.tsを自動的に読み込まないので、
      // ConfigModule.forRoot()を追加する必要がある。
      imports: [
        RegionsModule,
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [
        ConfigService,
        StoresService,
        // PrismaServiceはmock(mockPrismaService)に切り替える
        { provide: PrismaService, useValue: mockPrismaService },
        PrefecturesService,
      ],
    })
      // imports: [RegionsModule]によるJestの依存関係競合問題があるため、
      // overrideProviderも実施する必要がある。
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    configService = module.get<ConfigService>(ConfigService);
    storesService = module.get<StoresService>(StoresService);
    prismaService = module.get<PrismaService>(PrismaService);

    // PrismaService Mock Data
    // memo : mockDataをメンバで保持(厳密にはclassではないのでメンバではないが)するのは、テスト内で
    // 内容が書き換えられている可能性があるため、テストの都度、createMockStores()を呼び出すことを
    // 推奨する。下名もfindByCodeOrFail()のテストにおいてハマった経験あり。
    prismaMockStores = createMockStores();
    // 期待値：Serviceの返却値
    expectedStores = createExpectStoresHaveReadModel();
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
  });

  describe('■■■ findAll TEST ■■■', () => {
    it('正常系: Stroeドメイン配列(全項目)を返却する（filter無し)', async () => {
      // mockの返却値作成
      // findany()
      jest
        .spyOn(prismaService.store, 'findMany')
        .mockResolvedValue(prismaMockStores);
      // count()
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

      // test対象呼び出し
      const result = await storesService.findAll();

      // 結果検証
      expect(result).toEqual(createExpectStoresHaveReadModel());

      // 念の為、where句も検証、orderByはデフォルトソート指定を検証
      expect(jest.spyOn(prismaService.store, 'findMany')).toHaveBeenCalledWith({
        include: { prefecture: true },
        where: {
          status: undefined,
        },
        take: 20,
        skip: 0,
        orderBy: [
          {
            kanaName: SortOrder.ASC,
          },
        ],
      });

      expect(jest.spyOn(prismaService.store, 'count')).toHaveBeenCalledWith({
        where: {
          status: undefined,
        },
      });
    });

    it('Promise.all が正しく並列で呼ばれていることを確認', async () => {
      // mock data 何でもいい
      // あと、jest.spyOn(prismaService.store, 'findMany') っていう呼び方ではなく、以下でも
      // テスト通った。。。なぜ。。。
      mockPrismaService.store.findMany.mockResolvedValue([]);
      mockPrismaService.store.count.mockResolvedValue(5);

      await storesService.findAll({});

      // Promise.all が呼ばれた証拠として、両方が呼ばれていることを確認
      expect(mockPrismaService.store.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.store.count).toHaveBeenCalledTimes(1);
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
      it('正常系(1): prefectureCodeを指定した場合、Prismaのwhere句に正しく反映されること', async () => {
        // 引数作成
        const filters = {
          prefectureCode: '13',
        } satisfies StoreFilter;

        // mockの返却値作成
        jest
          .spyOn(prismaService.store, 'findMany')
          .mockResolvedValue(prismaMockStores);
        // count()
        jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

        // test対象呼び出し：結果は取得しない(「const result = 」は不要)
        // 引数: prefectureCodeを指定
        await storesService.findAll(filters);

        // 結果検証
        // 上記にも記載しているが、toEqual()での検証は不要
        // expect(result).toEqual(expectedStores);
        expect(
          jest.spyOn(prismaService.store, 'findMany'),
        ).toHaveBeenCalledWith({
          include: {
            prefecture: true,
          },
          // 以下は期待値
          where: {
            status: undefined,
            prefecture: {
              code: '13',
            },
          },
          take: 20,
          skip: 0,
          orderBy: [
            {
              kanaName: 'asc',
            },
          ],
        });
      });

      it('正常系(2): statusを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {
        // prisma mock data 作成：中身は何でもいい
        jest
          .spyOn(prismaService.store, 'findMany')
          .mockResolvedValue(prismaMockStores);
        // count()
        jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

        // test対象呼び出し：結果は取得しない(「const result = 」は不要)
        // 引数: statusを指定
        const filters: StoreFilter = { status: 'published' };
        await storesService.findAll(filters);

        // 結果検証
        // 上記にも記載しているが、toEqual()での検証は不要
        // expect(result).toEqual(expectedStores);
        expect(
          jest.spyOn(prismaService.store, 'findMany'),
        ).toHaveBeenCalledWith({
          include: {
            prefecture: true,
          },
          // 以下は期待値
          where: {
            status: StoreStatus.PUBLISHED,
          },
          take: 20,
          skip: 0,
          orderBy: [
            {
              kanaName: 'asc',
            },
          ],
        });
      });

      it('正常系(3): name(店舗名)を指定した場合、Prismaのwhere句に正しく反映されること)', async () => {
        // prisma mock data 作成（中身は適当)
        jest
          .spyOn(prismaService.store, 'findMany')
          .mockResolvedValue(prismaMockStores);
        // count()
        jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

        // テスト対象service呼び出し
        const filters: StoreFilter = { name: '赤羽' };
        await storesService.findAll(filters);

        // PrismaのWhere句の検証
        expect(
          jest.spyOn(prismaService.store, 'findMany'),
        ).toHaveBeenCalledWith({
          include: {
            prefecture: true,
          },
          where: {
            status: undefined,
            name: { contains: filters.name },
          },
          take: 20,
          skip: 0,
          orderBy: [
            {
              kanaName: 'asc',
            },
          ],
        });
      });

      it('正常系(4): regionCodeを指定した場合、Prismaのwhere句に正しく反映されること', async () => {
        // 引数作成
        const filters = {
          regionCode: '03',
        } satisfies StoreFilter;

        // mockの返却値作成
        jest
          .spyOn(prismaService.store, 'findMany')
          .mockResolvedValue(prismaMockStores);
        // count()
        jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

        // test対象呼び出し：結果は取得しない(「const result = 」は不要)
        // 引数: statusを指定
        await storesService.findAll(filters);

        // 結果検証
        // 上記にも記載しているが、toEqual()での検証は不要
        // expect(result).toEqual(expectedStores);
        expect(
          jest.spyOn(prismaService.store, 'findMany'),
        ).toHaveBeenCalledWith({
          include: {
            prefecture: true,
          },
          // 以下は期待値
          where: {
            status: undefined,
            prefecture: {
              region: {
                code: '03',
              },
            },
          },
          take: 20,
          skip: 0,
          orderBy: [
            {
              kanaName: 'asc',
            },
          ],
        });
      });

      describe('sortBy と sortOrder の組み合わせ', () => {
        it('正常系(5): sortBy と sortOrderを指定した場合、PrismaのorderBy句に正しく反映されること', async () => {
          // 引数作成
          const filters = {
            sortOrder: 'desc',
            sortBy: 'id',
          } satisfies StoreFilter;

          // mockの返却値作成
          jest
            .spyOn(prismaService.store, 'findMany')
            .mockResolvedValue(prismaMockStores);
          // count()
          jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

          // test対象呼び出し：結果は取得しない(「const result = 」は不要)
          // 引数: statusを指定
          await storesService.findAll(filters);

          // 結果検証
          // 上記にも記載しているが、toEqual()での検証は不要
          // expect(result).toEqual(expectedStores);
          expect(
            jest.spyOn(prismaService.store, 'findMany'),
          ).toHaveBeenCalledWith({
            include: {
              prefecture: true,
            },
            // 以下は期待値
            where: {
              status: undefined,
            },
            take: 20,
            skip: 0,
            orderBy: [
              {
                id: 'desc',
              },
            ],
          });
        });
        it('正常系(6): sortBy のみを指定した場合、PrismaのorderBy句に正しく反映されること(デフォルトソート)', async () => {
          // 引数作成
          const filters = {
            // sortOrder: 'desc',
            sortBy: 'id',
          } satisfies StoreFilter;

          // mockの返却値作成
          jest
            .spyOn(prismaService.store, 'findMany')
            .mockResolvedValue(prismaMockStores);
          // count()
          jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

          // test対象呼び出し：結果は取得しない(「const result = 」は不要)
          // 引数: statusを指定
          await storesService.findAll(filters);

          // 結果検証
          // 上記にも記載しているが、toEqual()での検証は不要
          // expect(result).toEqual(expectedStores);
          expect(
            jest.spyOn(prismaService.store, 'findMany'),
          ).toHaveBeenCalledWith({
            include: {
              prefecture: true,
            },
            // 以下は期待値
            where: {
              status: undefined,
            },
            take: 20,
            skip: 0,
            orderBy: [
              {
                id: 'asc',
              },
            ],
          });
        });
        it('正常系(7): sortOrderのみを指定した場合、PrismaのorderBy句に正しく反映されること(デフォルトソート)', async () => {
          // 引数作成
          const filters = {
            sortOrder: 'desc',
            // sortBy: 'id',
          } satisfies StoreFilter;

          // mockの返却値作成
          jest
            .spyOn(prismaService.store, 'findMany')
            .mockResolvedValue(prismaMockStores);
          // count()
          jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

          // test対象呼び出し：結果は取得しない(「const result = 」は不要)
          // 引数: statusを指定
          await storesService.findAll(filters);

          // 結果検証
          // 上記にも記載しているが、toEqual()での検証は不要
          // expect(result).toEqual(expectedStores);
          expect(
            jest.spyOn(prismaService.store, 'findMany'),
          ).toHaveBeenCalledWith({
            include: {
              prefecture: true,
            },
            // 以下は期待値
            where: {
              status: undefined,
            },
            take: 20,
            skip: 0,
            orderBy: [
              {
                kanaName: 'desc',
              },
            ],
          });
        });
      });

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
        it.each([
          {
            name: '未指定 → デフォルト20件(他のテストケースで実施されるが一応）',
            filters: { size: undefined } satisfies StoreFilter,
            expectedTake: 20,
          },
          {
            name: '0はcontrollerのvalidationで弾くが一応テスト',
            filters: { size: 0 } satisfies StoreFilter,
            expectedTake: 1,
          },
          {
            name: '下限値',
            filters: { size: 1 } satisfies StoreFilter,
            expectedTake: 1,
          },
          {
            name: 'デフォルト値の境界値(下)',
            filters: { size: 19 },
            expectedTake: 19,
          },
          {
            name: 'デフォルト値とイコール',
            filters: { size: 20 } satisfies StoreFilter,
            expectedTake: 20,
          },
          {
            name: 'デフォルト値の境界値(上)',
            filters: { size: 21 } satisfies StoreFilter,
            expectedTake: 21,
          },
          {
            name: '上限値',
            filters: { size: 100 } satisfies StoreFilter,
            expectedTake: 100,
          },
          {
            name: '上限値超過: controllerにて101以上は弾いているが一応テスト',
            filters: { size: 101 } satisfies StoreFilter,
            expectedTake: 100,
          },
          {
            name: 'マイナス値: マイナスはcontrollerのvalidationで弾かれるが、一応',
            filters: { size: -5 } satisfies StoreFilter,
            expectedTake: 1,
          },
        ])(
          '$name の場合、Prismaのwhere句に正しく反映されること',
          async ({ filters, expectedTake }) => {
            // mockの返却値作成
            jest.spyOn(prismaService.store, 'findMany').mockResolvedValue([]);
            // count()
            jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

            // test対象呼び出し：結果は取得しない(「const result = 」は不要)
            // 引数: sizeを指定
            await storesService.findAll(filters);

            // 結果検証
            // 上記にも記載しているが、toEqual()での検証は不要
            // expect(result).toEqual(expectedStores);

            expect(
              jest.spyOn(prismaService.store, 'findMany'),
            ).toHaveBeenCalledWith({
              include: {
                prefecture: true,
              },
              // 以下は期待値
              where: { status: undefined },
              take: expectedTake,
              skip: 0,
              orderBy: [
                {
                  kanaName: 'asc',
                },
              ],
            });
          },
        );
      });

      describe('正常系(9): pageの境界値テスト', () => {
        it.each([
          {
            name: '未指定 → デフォルト1(他のテストケースで実施されるが一応）',
            filters: { page: undefined } satisfies StoreFilter,
            expectedSkip: 0,
          },
          {
            name: '0を指定 → 0はcontrollerのvalidationで弾くが一応テスト',
            filters: { page: 0 } satisfies StoreFilter,
            expectedSkip: 0,
          },
          {
            name: '下限値(デフォルト値とイコール)：1を指定 → expectedSkip:0',
            filters: { page: 1 } satisfies StoreFilter,
            expectedSkip: 0,
          },
          {
            name: 'デフォルト値の境界値(上)：2を指定 → expectedSkip:20',
            filters: { page: 2 } satisfies StoreFilter,
            expectedSkip: 20,
          },
          {
            name: '上限値：10000を指定 → expectedSkip:199980',
            filters: { page: 10000 } satisfies StoreFilter,
            expectedSkip: 199980,
          },
          {
            name: '上限値超過：10001を指定 → expectedSkip:199980',
            filters: { page: 10001 } satisfies StoreFilter,
            expectedSkip: 199980,
          },
          {
            name: 'マイナス値：-1を指定 → expectedSkip:0',
            filters: { page: -1 } satisfies StoreFilter,
            expectedSkip: 0,
          },
        ])(
          '$name の場合、Prismaのwhere句に正しく反映されること',
          async ({ filters, expectedSkip }) => {
            // mockの返却値作成
            jest.spyOn(prismaService.store, 'findMany').mockResolvedValue([]);
            // count()
            jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

            // test対象呼び出し：結果は取得しない(「const result = 」は不要)
            // 引数: statusを指定
            await storesService.findAll(filters);

            // 結果検証
            // 上記にも記載しているが、toEqual()での検証は不要
            // expect(result).toEqual(expectedStores);

            expect(
              jest.spyOn(prismaService.store, 'findMany'),
            ).toHaveBeenCalledWith({
              include: {
                prefecture: true,
              },
              // 以下は期待値
              where: { status: undefined },
              take: 20,
              skip: expectedSkip,
              orderBy: [
                {
                  kanaName: 'asc',
                },
              ],
            });
          },
        );
      });

      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {});

      /**
       * 境界値テストはテストパターンが似通っているので、it.each を使ってデータ駆動で実装し
       * テストコードの冗長化を防止
       */
      describe('XXXXパラメータの境界値テスト', () => {
        it.each([
          { name: 'xxxの境界値(下)', filters: { size: undefined } },
          {},
          {},
          {},
        ])('$name の場合', async () => {});
      });
      /**
       * 境界値テストはテストパターンが似通っているので、it.each を使ってデータ駆動で実装し
       * テストコードの冗長化を防止
       */
      describe('パラメータの境界値テスト', () => {
        it.each([
          { name: 'xxxの境界値(下)', filters: { size: undefined } },
          {},
          {},
          {},
        ])('$name の場合', async () => {});
      });

      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {});
      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {});
      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {});
      it('正常系(3): xxxxを指定した場合、Prismaのwhere句に正しく反映されること)', async () => {});
    });

    describe('findAllの絞り込み(filter) 複合条件のテスト', () => {
      it('(1)+(2)+(3)+(4)+(5)+(6)+(7)+(8)+(9): status/都道府県コード/name/エリアコード/ソート条件を指定した場合、正しくWhere句が組み立てられること', async () => {
        // prisma modk data(中身は何でもOK)
        jest.spyOn(prismaService.store, 'findMany').mockResolvedValue([]);
        // count()
        jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);

        // test対象service呼び出し: statusと都道府県コードを指定
        const filters: StoreFilter = {
          status: StoreStatus.PUBLISHED,
          prefectureCode: '13',
          name: '赤羽',
          regionCode: '03',
          sortOrder: SortOrder.ASC,
          sortBy: 'id',
          size: 20,
          page: 2,
        };

        await storesService.findAll(filters);
        // 検証
        expect(
          jest.spyOn(prismaService.store, 'findMany'),
        ).toHaveBeenCalledWith({
          include: {
            prefecture: true,
          },
          where: {
            status: StoreStatus.PUBLISHED,
            name: { contains: filters.name },
            prefecture: {
              code: '13',
              region: {
                code: '03',
              },
            },
          },
          orderBy: [{ id: 'asc' }],
          take: 20,
          skip: 20,
        });
      });
    });

    it('正常系: Storeの任意項目が取得できない場合、null→undefinedで返す（1件)', async () => {
      // Storeの中にネストされたPrefectureがあった場合は、mockResulvedValueに直接[{...}]で
      // mockデータを指定すると型エラー関連の警告で怒られる。→ mockValuesとして定数を外だしして
      // 型を明示して解決
      const mockValues: (StorePrisma & {
        prefecture: PrefecturePrisma | null;
      })[] = [
        {
          id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
          name: '山田電気 赤羽店',
          status: 'published',
          email: 'yamada-akabane@test.co.jp',
          phoneNumber: '03-1122-9901',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
          code: null,
          kanaName: null,
          // prefecture: null,
          holidays: [],
          zipCode: null,
          address: null,
          businessHours: null,
          userId: '633931d5-2b25-45f1-8006-c137af49e53d',
          prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
          prefecture: null,
        },
      ];
      // mockの返却値作成
      jest.spyOn(prismaService.store, 'findMany').mockResolvedValue(mockValues);
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(1);

      // テスト実施
      const result = await storesService.findAll();
      // 検証
      expect(result).toEqual({
        data: [
          {
            id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
            name: '山田電気 赤羽店',
            status: 'published',
            email: 'yamada-akabane@test.co.jp',
            phoneNumber: '03-1122-9901',
            createdAt: new Date('2025-04-05T10:00:00.000Z'),
            updatedAt: new Date('2025-04-05T12:30:00.000Z'),
            code: undefined,
            kanaName: undefined,
            // prefecture: undefined,
            holidays: undefined,
            zipCode: undefined,
            address: undefined,
            businessHours: undefined,
            userId: '633931d5-2b25-45f1-8006-c137af49e53d',
            // prefecture: undefined,
          },
        ],
        meta: {
          totalCount: 1,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<StoreReadModel>);
    });

    it('正常系: Storeの任意項目が取得できない場合、null→undefinedで返す（複数件)', async () => {
      // mockの返却値作成
      // 以下のように実装してみたものの、[{...}]の形でベタ書した方がUTとしては直感的かも。。
      jest.spyOn(prismaService.store, 'findMany').mockResolvedValue(
        // Mockデータの任意項目をnullに書き換え
        prismaMockStores.map((store) => {
          store.kanaName = null;
          // store.prefecture = null;
          store.holidays = [];
          store.zipCode = null;
          store.address = null;
          store.businessHours = null;
          store.prefecture = null;
          return Object.assign({}, store);
        }),
      );
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(3);

      // テスト実施
      const result = await storesService.findAll();

      // 検証
      // 期待値の中の定義を外だしで可読性を向上可能であるが、以下でやってみた。
      expect(result).toEqual({
        data:
          // 期待値の任意項目をundefinedに書き換え
          expectedStores.data.map((store) => {
            store.kanaName = undefined;
            // store.prefecture = undefined;
            store.holidays = undefined;
            store.zipCode = undefined;
            store.address = undefined;
            store.businessHours = undefined;
            store.prefecture = undefined;
            return Object.assign({}, store);
          }),
        meta: {
          totalCount: 3,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<StoreReadModel>);
    });

    // prismaのfindManyはデータがない場合[]を返す仕様。null,undefindedは返さない。
    it('データが0件の場合は空配列を返す', async () => {
      // prisma mock データ
      jest.spyOn(prismaService.store, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);
      // テスト実施
      const result = await storesService.findAll();
      // 検証
      expect(result).toEqual({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<StoreReadModel>);
    });

    // 実施する必要はない気がするが、一応
    it('データが0件の場合は空配列を返す(filter有り)', async () => {
      // 引数：filter(検索条件)
      const filters = {
        prefectureCode: '',
      } satisfies StoreFilter;
      // prisma mock データ
      jest.spyOn(prismaService.store, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);
      // テスト実施
      const result = await storesService.findAll(filters);
      // 検証
      expect(result).toEqual({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<StoreReadModel>);
    });
  });

  //-----------------------------------------------------
  // findBYCodeOrFail(): TEST
  //-----------------------------------------------------
  describe('--- findByCodeOrFail() TEST---', () => {
    it('正常系: codeに紐づく店舗情報取得し、Stroeドメインに詰め替え返却する（全項目)', async () => {
      // servieの引数
      const code = '00002';

      // prisma mock data 作成
      // meme:
      // prismaMockStores.find((store) => store.code == code) は undefinedを返す可能性があるため
      // 厳密な型チェックによりエラーが発生している。
      // ので、対策としてsprismaMockStores.find(
      //   (store) => store.code == code,
      // )!
      // の様に末尾に「!」をつけている。
      // TypeScriptにおける「!」 は、「Non-null Assertion Operator」（非 Null アサーション演算子）と呼ばれます。
      // これは、プログラマーがTypeScriptコンパイラに対して、「この値は、たとえコンパイラが null や
      // undefined の可能性があると推論しても、実行時には決して null や undefined にならない」と
      // 断言するための構文です。
      const prismaMockData = createMockStores().find(
        (store) => store.code === code,
      )!;
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockResolvedValue(prismaMockData);

      // テスト対象service呼び出し
      const result = await storesService.findByCodeOrFail(code);

      // 結果検証
      const expectedStore = createExpectStoresHaveReadModel().data.find(
        (store) => store.code === code,
      )!;
      expect(result).toEqual(expectedStore);
    });

    it('正常系: 店舗情報の任意項目が取得できない場合、null→undefinedに変換して返却（任意項目)', async () => {
      // servieの引数
      const code = '00002';

      // prisma mock data 作成
      const prismaMockData = createMockStores().find(
        (store) => store.code === code,
      )!;
      // 任意項目をnullにセット（holidaysはWeekDay[]なので空配列[]をセット)
      // prismaMockData.code = null;
      prismaMockData.kanaName = null;
      prismaMockData.zipCode = null;
      prismaMockData.address = null;
      prismaMockData.businessHours = null;
      prismaMockData.holidays = [];
      prismaMockData.prefecture = null;
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockResolvedValue(prismaMockData);

      // テスト対象service呼び出し
      const result = await storesService.findByCodeOrFail(code);

      // 結果検証
      expect(result).toEqual({
        id: '70299537-4f16-435f-81ed-7bed4ae63758',
        code: '00002',
        name: '山田電気 江戸川店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        // prefecture: '東京都',
        // service.findByCodeOrFail()のholidaysについて、findAll()とは違うコードを
        // あえて書いてみた。undefinedではなく空配列が期待値。
        holidays: [],
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefecture: undefined,
      } satisfies StoreReadModel);
    });

    it('正常系: やる必要ないが: 店舗情報内の都道府県情報のprefectureIdが取得できた場合、Storeドメインにセットされず、返却されないこと（任意項目)', async () => {
      // servieの引数
      const code = '00002';

      // prisma mock data 作成
      const prismaMockData = {
        id: '70299537-4f16-435f-81ed-7bed4ae63758',
        code: '00002',
        name: '山田電気 江戸川店',
        status: StoreStatus.PUBLISHED,
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｴﾄﾞｶﾞﾜｼﾃﾝ',
        // prefecture: '東京都',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '東京都江戸川区西念1丁目10番地',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefectureId: '999999d5-2b25-45f1-8006-c137af49e53d',
        prefecture: {
          name: '東京都',
          code: '13',
          kanaName: 'トウキョウト',
          status: 'published',
          kanaEn: 'tokyo-to',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        },
      };
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockResolvedValue(prismaMockData);

      // テスト対象service呼び出し
      const result = await storesService.findByCodeOrFail(code);

      // 結果検証
      const expectedStore = {
        id: '70299537-4f16-435f-81ed-7bed4ae63758',
        code: '00002',
        name: '山田電気 江戸川店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｴﾄﾞｶﾞﾜｼﾃﾝ',
        // prefecture: '東京都',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '東京都江戸川区西念1丁目10番地',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        // prefectureId: '999999d5-2b25-45f1-8006-c137af49e53d',
        prefecture: {
          name: '東京都',
          code: '13',
          kanaName: 'トウキョウト',
          status: 'published',
          kanaEn: 'tokyo-to',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        },
      } satisfies StoreReadModel;
      expect(result).toEqual(expectedStore);
    });

    it('正常系: codeに紐づく店舗情報が存在しない(0件)', async () => {
      // servieの引数
      const code = '00002';

      // prisma mock data 作成 : データなし
      jest.spyOn(prismaService.store, 'findUnique').mockResolvedValue(null);

      // テスト対象service呼び出し + 結果検証
      // await(非同期)メソッドの場合、Promiseを返却する必要があるが、Promiseをアンラップ(rejects)して別の
      // Matcherを連鎖させるようにして、toThrowを呼んだりする。
      await expect(storesService.findByCodeOrFail(code)).rejects.toThrow(
        new NotFoundException(`
            codeに関連する店舗情報が存在しません!! code: ${code}`),
      );
    });
    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: findUnique()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockRejectedValue(mockGenericError);

      // 元のエラー（Generic Error）がそのままスローされることをテスト(引数は何でもいい)
      await expect(storesService.findByCodeOrFail('')).rejects.toThrow(Error);
      // await expect(storesService.findByCodeOrFail('')).rejects.toThrow(
      //   'Database connection failed',
      // );
      await expect(storesService.findByCodeOrFail('')).rejects.toMatchObject({
        name: 'Error',
        message: 'Database connection failed',
      });
    });
  });

  //-----------------------------------------------------
  // create(): TEST
  //-----------------------------------------------------
  // mock :
  // 1. prismaService.prefecture, 'findUnique'
  // 2. prismaService.store, 'create'
  describe('create', () => {
    it('正常系: 店舗情報登録(全項目)し、Storeドメイン＋idの形で返却する', async () => {
      // storesService.create()の引数作成（登録対象の店舗情報）
      const storeDto: CreateStoreDto = {
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        prefectureCode: '17',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '石川県北区赤羽３丁目',
        businessHours: '10:00-20:00',
      };

      // 1. 「Prisma Prefecture Mock Data」 prismaService.prefecture, 'findUnique'
      const mockPrefectureValue: PrefecturePrisma = {
        id: '000d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '17',
        kanaName: 'イシカワケン',
        status: 'published',
        kanaEn: 'ishikawa',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      };
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(mockPrefectureValue);

      // ------------------------------------------
      // 2. Prisma mock Data 設定 prismaService.store, 'create'
      // ------------------------------------------
      // 「Prisma Store Mock Data」
      const mockStoreValue: PrismaStoreWithPrefecture = {
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        code: '00001',
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '石川県北区赤羽３丁目',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        prefecture: {
          name: '石川県',
          code: '17',
          kanaName: 'イシカワケン',
          status: 'published',
          kanaEn: 'ishikawa',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        },
      };
      jest
        .spyOn(prismaService.store, 'create')
        .mockResolvedValue(mockStoreValue);

      // テスト対象service呼び出し
      const result = await storesService.create(
        storeDto,
        '633931d5-2b25-45f1-8006-c137af49e53d', // userId
      );

      // 検証
      expect(result).toEqual({
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        code: '00001',
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '石川県北区赤羽３丁目',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefecture: {
          name: '石川県',
          code: '17',
          kanaName: 'イシカワケン',
          status: 'published',
          kanaEn: 'ishikawa',
          createdAt: new Date('2025-04-05T10:00:00.000Z'),
          updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        },
      } satisfies StoreReadModel);

      // 1回呼ばれたか
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledTimes(
        1,
      );

      // prismaService.store.create()の引数チェック
      // 複雑な変換ロジックがないので、toHaveBeenCalledWithは不要だが一応。
      // 引数を検証（data と include を両方チェック）
      // ⭐️ポイント：外側のマッチャーにて、includeとdataをチェック（objectContainingなので
      // 少なくとdataとincludeというプロパティを持っていればOKとしている）
      // includeの中はobjectContainingを指定していないので、jestは厳密にチェックする!!
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledWith(
        expect.objectContaining({
          // ↑ 外側のマッチャー
          // === include の検証（厳密に一致）===
          include: {
            prefecture: {
              select: {
                code: true,
                name: true,
                kanaName: true,
                kanaEn: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          // === data の検証（完全一致）===
          // 単なる詰め替えなので実施する必要はないかもだが、一応。
          data: {
            name: storeDto.name,
            kanaName: storeDto.kanaName,
            status: storeDto.status,
            zipCode: storeDto.zipCode,
            email: storeDto.email,
            address: storeDto.address,
            phoneNumber: storeDto.phoneNumber,
            businessHours: storeDto.businessHours,
            holidays: storeDto.holidays,
            userId: '633931d5-2b25-45f1-8006-c137af49e53d',
            prefectureId: '000d2683-7012-462c-b7d0-7e452ba0f1ab',
          },
        }),
      );
    });

    it('正常系: 店舗情報登録(任意項目除外)し、Storeドメイン＋idの形で返却する', async () => {
      // storesService.create()の引数作成（登録対象の店舗情報）
      const storeDto: CreateStoreDto = {
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        // kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        // prefectureCode: '17',
        // holidays: ['WEDNESDAY', 'SUNDAY'],
        // zipCode: '100-0001',
        // address: '石川県北区赤羽３丁目',
        // businessHours: '10:00-20:00',
      };

      // Prisma mock Data 設定
      // Prismaはcreateの項目がundefined(key自体なし)でも、key: nullの形で返却する仕様
      const mockValue: PrismaStoreWithPrefecture = {
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        code: null,
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: null,
        holidays: [],
        zipCode: null,
        address: null,
        businessHours: null,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefectureId: null,
        prefecture: null,
      };
      jest.spyOn(prismaService.store, 'create').mockResolvedValue(mockValue);

      // テスト対象service呼び出し: パラメーター(任意項目削除)
      const result = await storesService.create(
        storeDto,
        '633931d5-2b25-45f1-8006-c137af49e53d',
      );

      // 検証
      expect(result).toEqual({
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        code: undefined,
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        holidays: undefined,
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefecture: undefined,
      });

      // 1回呼ばれたか
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledTimes(
        1,
      );

      // prismaService.store.create()の引数チェック
      // 複雑な変換ロジックがないので、toHaveBeenCalledWithは不要だが一応。
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledWith(
        // includeとdataの部分一致（最低限、incudeとdataのプロパティが存在すればOK）
        expect.objectContaining({
          include: {
            prefecture: {
              select: {
                code: true,
                name: true,
                kanaName: true,
                kanaEn: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          // objectContaining(obj)：obj内の項目と部分一致（指定したキーだけ）
          // → CreateItemDtoにある値(必須)だけを検証:単なる詰め替えなのでこの程度でOK
          // Jestの型バグのため下記↓コードを入れている。
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            name: storeDto.name,
            status: storeDto.status,
            email: storeDto.email,
            phoneNumber: storeDto.phoneNumber,
          }),
        }),
      );
    });

    it('正常系: 店舗情報登録(任意項目undefind)し、Storeドメイン＋idの形で返却する', async () => {
      // storesService.create()の引数作成（登録対象の店舗情報）
      const storeDto: CreateStoreDto = {
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        prefectureCode: undefined,
        holidays: undefined,
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
      };

      // Prisma mock Data 設定
      // Prismaはcreateの項目がundefined(key自体なし)でも、key: nullの形で返却する仕様
      const mockValue: PrismaStoreWithPrefecture = {
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        code: null,
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: null,
        holidays: [],
        zipCode: null,
        address: null,
        businessHours: null,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        prefecture: null,
      };
      jest.spyOn(prismaService.store, 'create').mockResolvedValue(mockValue);

      // テスト対象service呼び出し: パラメーター(任意項目削除)
      const result = await storesService.create(
        storeDto,
        '633931d5-2b25-45f1-8006-c137af49e53d',
      );

      // 検証
      expect(result).toEqual({
        id: 'a1111111-1234-462c-b7d0-7e452ba0f111',
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        code: undefined,
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        // prefecture: undefined,
        holidays: undefined,
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
        prefecture: undefined,
      });
      // 1回呼ばれたか
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledTimes(
        1,
      );
      // prismaService.store.create()の引数チェック
      // 複雑な変換ロジックがないので、toHaveBeenCalledWithは不要だが一応。
      expect(jest.spyOn(prismaService.store, 'create')).toHaveBeenCalledWith(
        // includeを毎回チェックする必要はないので当該テストでは除外
        expect.objectContaining({
          // objectContaining(obj)：obj内の項目と部分一致（指定したキーだけ）
          // → CreateItemDtoにある値(必須)だけを検証:単なる詰め替えなのでこの程度でOK
          // Jestの型バグのため下記↓コードを入れている。
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            name: storeDto.name,
            status: storeDto.status,
            email: storeDto.email,
            phoneNumber: storeDto.phoneNumber,
          }),
        }),
      );
    });

    it('異常系①: Prefectureの情報が存在しない。NotFoundExceptionの検証。', async () => {
      // storesService.create()の引数作成（登録対象の店舗情報）
      const storeDto: CreateStoreDto = {
        name: '山田電気 能登店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        prefectureCode: '99',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '石川県北区赤羽３丁目',
        businessHours: '10:00-20:00',
      };

      // Prisma Prefecture(都道府県)のレスポンスを作成（null:該当なし）
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      // test対象service呼び出し、結果検証
      // ConflictExceptionがスローされることをテスト
      await expect(
        storesService.create(storeDto, '633931d5-2b25-45f1-8006-c137af49e53d'),
      ).rejects.toThrow(
        new NotFoundException(
          `prefectureCodeに該当する都道府県情報が存在しません。 prefectureCode: ${storeDto.prefectureCode}`,
        ),
      );
    });
  });

  //-----------------------------------------------------
  // publish(): TEST
  //-----------------------------------------------------
  describe('publish test', () => {
    // mock: prismaService.store.findUnique()
    //       prismaService.store.update()
    it('正常系: 店舗情報を更新(全項目)し、Storeドメイン＋idの形で返却する', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: prismaService.store.findUnique()
      const findUniqueMockData = createMockStores().find(
        (store) => store.id === id,
      );
      mockPrismaService.store.findUnique.mockResolvedValue(findUniqueMockData);

      // mock data set: prismaService.store.update()
      const updateMockData = createMockStores().find(
        (store) => store.id === id,
      )!;
      // createMockStoresのデータは全てpublishなので、あえて以下のようにpublishに更新する
      // 必要はないが、念の為。
      updateMockData.status = 'published';
      mockPrismaService.store.update.mockResolvedValue(updateMockData);

      // test 対象 service 呼び出し
      const result = await storesService.publish(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
        code: '00001',
        name: '山田電気 赤羽店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '東京都北区赤羽３丁目',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies StoreReadModel);

      // 引数検証: prismaService.store.findUnique
      expect(
        jest.spyOn(prismaService.store, 'findUnique'),
      ).toHaveBeenCalledWith({
        where: { id },
      });

      // 引数検証: prismaService.store.findUnique
      expect(jest.spyOn(prismaService.store, 'update')).toHaveBeenCalledWith({
        data: { status: 'published', userId: userId },
        where: { id },
      });
    });

    // mock: prismaService.store.findUnique()
    //       prismaService.store.update()
    it('正常系: 店舗情報を更新し、Storeドメイン＋id(任意項目null→undefind変換)の形で返却する', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: prismaService.store.findUnique()
      const findUniqueMockData = createMockStores().find(
        (store) => store.id === id,
      );
      mockPrismaService.store.findUnique.mockResolvedValue(findUniqueMockData);

      // mock data 作成: prismaService.store.update()
      let updateMockData = createMockStores().find((store) => store.id === id)!;
      // createMockStoresのデータは全てpublishなので、あえて以下のようにpublishに更新する
      // 必要はないが、念の為。
      updateMockData.status = 'published';
      // 🗒 取得したObjectの中身を更新するテクニック
      updateMockData = {
        ...updateMockData,
        code: null,
        kanaName: null,
        zipCode: null,
        address: null,
        businessHours: null,
        holidays: [],
        prefectureId: null,
      } satisfies StorePrisma;
      // mock data set: prismaService.store.update()
      mockPrismaService.store.update.mockResolvedValue(updateMockData);

      // test 対象 service 呼び出し
      const result = await storesService.publish(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
        code: undefined,
        name: '山田電気 赤羽店',
        status: 'published',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
        holidays: undefined,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies StoreReadModel);
    });

    // mock: prismaService.store.findUnique()
    it('異常系: 更新対象の店舗情報が存在しない。NotFoundExceptionがスローされることを検証', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: null
      mockPrismaService.store.findUnique.mockResolvedValue(null);

      // 検証: NotFoundExceptionがスローされること
      await expect(storesService.publish(id, dto, userId)).rejects.toThrow(
        new NotFoundException(
          `idに関連する店舗情報が存在しません!! storeId: ${id}`,
        ),
      );
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: findUnique()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockRejectedValue(mockGenericError);

      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // 元のエラー（Generic Error）がそのままスローされることをテスト(引数は何でもいい)
      await expect(storesService.publish(id, dto, userId)).rejects.toThrow(
        Error,
      );
      await expect(
        storesService.publish(id, dto, userId),
      ).rejects.toMatchObject({
        name: 'Error',
        message: 'Database connection failed',
      });
    });
  });

  //-----------------------------------------------------
  // unpublish(): TEST
  //-----------------------------------------------------
  describe('unpublish test', () => {
    // mock: prismaService.store.findUnique()
    //       prismaService.store.update()
    it('正常系: 店舗情報を更新(全項目)し、Storeドメイン＋idの形で返却する', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: prismaService.store.findUnique()
      const findUniqueMockData = createMockStores().find(
        (store) => store.id === id,
      );
      mockPrismaService.store.findUnique.mockResolvedValue(findUniqueMockData);

      // mock data set: prismaService.store.update()
      const updateMockData = createMockStores().find(
        (store) => store.id === id,
      )!;
      // createMockStoresのデータは全てpublishなので、あえて以下のようにeditingに更新する
      // 必要はないが、念の為。
      updateMockData.status = 'editing';
      mockPrismaService.store.update.mockResolvedValue(updateMockData);

      // test 対象 service 呼び出し
      const result = await storesService.unpublish(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
        code: '00001',
        name: '山田電気 赤羽店',
        status: 'editing',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
        holidays: ['WEDNESDAY', 'SUNDAY'],
        zipCode: '100-0001',
        address: '東京都北区赤羽３丁目',
        businessHours: '10:00-20:00',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies StoreReadModel);

      // 引数検証: prismaService.store.findUnique
      expect(
        jest.spyOn(prismaService.store, 'findUnique'),
      ).toHaveBeenCalledWith({
        where: { id },
      });

      // 引数検証: prismaService.store.findUnique
      expect(jest.spyOn(prismaService.store, 'update')).toHaveBeenCalledWith({
        data: { status: 'editing', userId: userId },
        where: { id },
      });
    });

    // mock: prismaService.store.findUnique()
    //       prismaService.store.update()
    it('正常系: 店舗情報を更新し、Storeドメイン＋id(任意項目null→undefind変換)の形で返却する', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: prismaService.store.findUnique()
      const findUniqueMockData = createMockStores().find(
        (store) => store.id === id,
      );
      mockPrismaService.store.findUnique.mockResolvedValue(findUniqueMockData);

      // mock data 作成: prismaService.store.update()
      let updateMockData = createMockStores().find((store) => store.id === id)!;
      // createMockStoresのデータは全てpublishなので、あえて以下のようにpublishに更新する
      // 必要はないが、念の為。
      updateMockData.status = 'editing';
      // 🗒 取得したObjectの中身を更新するテクニック
      updateMockData = {
        ...updateMockData,
        code: null,
        kanaName: null,
        zipCode: null,
        address: null,
        businessHours: null,
        holidays: [],
        prefectureId: null,
      } satisfies StorePrisma;
      // mock data set: prismaService.store.update()
      mockPrismaService.store.update.mockResolvedValue(updateMockData);

      // test 対象 service 呼び出し
      const result = await storesService.unpublish(id, dto, userId);

      // 検証
      expect(result).toEqual({
        id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
        code: undefined,
        name: '山田電気 赤羽店',
        status: 'editing',
        email: 'yamada-akabane@test.co.jp',
        phoneNumber: '03-1122-9901',
        kanaName: undefined,
        zipCode: undefined,
        address: undefined,
        businessHours: undefined,
        holidays: undefined,
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies StoreReadModel);
    });

    // mock: prismaService.store.findUnique()
    it('異常系: 更新対象の店舗情報が存在しない。NotFoundExceptionがスローされることを検証', async () => {
      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // modk data set: null
      mockPrismaService.store.findUnique.mockResolvedValue(null);

      // 検証: NotFoundExceptionがスローされること
      await expect(storesService.unpublish(id, dto, userId)).rejects.toThrow(
        new NotFoundException(
          `idに関連する店舗情報が存在しません!! storeId: ${id}`,
        ),
      );
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: findUnique()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.store, 'findUnique')
        .mockRejectedValue(mockGenericError);

      // 引数
      const id = 'b74d2683-7012-462c-b7d0-7e452ba0f1ab';
      const dto: PublishStoreDto = {};
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // 元のエラー（Generic Error）がそのままスローされることをテスト(引数は何でもいい)
      // 検証①+②がいいのか、検証③だけでいい気がする。
      // 検証①
      await expect(storesService.unpublish(id, dto, userId)).rejects.toThrow(
        Error,
      );
      // 検証②
      await expect(
        storesService.unpublish(id, dto, userId),
      ).rejects.toMatchObject({
        name: 'Error',
        message: 'Database connection failed',
      });
      // 検証③
      await expect(storesService.unpublish(id, dto, userId)).rejects.toThrow(
        new Error('Database connection failed'),
      );
    });
  });
});

/**
 * Prismaの返却値(Store配列)を作成
 */
// 型は、Prisma.StoreGetPayload<{ include: { prefecture: true } }>[]が便利だが、@prisma/clientの
// import問題なのか、エラーになったので、(Store & { prefecture: Prefecture | null })[]としている。
function createMockStores(): (StorePrisma & {
  prefecture: PrefecturePrisma | null;
})[] {
  const stores: (StorePrisma & { prefecture: PrefecturePrisma | null })[] = [
    {
      id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
      code: '00001',
      name: '山田電気 赤羽店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都北区赤羽３丁目',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      prefecture: {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      },
    } satisfies StorePrisma & { prefecture: PrefecturePrisma | null },
    {
      id: '70299537-4f16-435f-81ed-7bed4ae63758',
      code: '00002',
      name: '山田電気 江戸川店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｴﾄﾞｶﾞﾜｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都江戸川区西念1丁目10番地',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      prefecture: {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      },
    } satisfies StorePrisma & { prefecture: PrefecturePrisma | null },
    {
      id: '1dfe32a5-ddac-4f3c-ad16-98e48a4dd63d',
      code: '00003',
      name: '山田電気 銀座店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｷﾞﾝｻﾞｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都中央区西銀座5丁目',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefectureId: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      prefecture: {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0324dc98-89a2-4db1-9431-b20feff57700',
        userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      },
    } satisfies StorePrisma & { prefecture: PrefecturePrisma | null },
  ];
  return stores;
}

// 期待値作成：serviceの返却値
function createExpectStoresHaveReadModel(): PaginatedResult<StoreReadModel> {
  const stores: StoreReadModel[] = [
    {
      id: 'b74d2683-7012-462c-b7d0-7e452ba0f1ab',
      code: '00001',
      name: '山田電気 赤羽店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｱｶﾊﾞﾈｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都北区赤羽３丁目',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefecture: {
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      },
    } satisfies StoreReadModel,
    {
      id: '70299537-4f16-435f-81ed-7bed4ae63758',
      code: '00002',
      name: '山田電気 江戸川店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｴﾄﾞｶﾞﾜｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都江戸川区西念1丁目10番地',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefecture: {
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      },
    } satisfies StoreReadModel,
    {
      id: '1dfe32a5-ddac-4f3c-ad16-98e48a4dd63d',
      code: '00003',
      name: '山田電気 銀座店',
      status: 'published',
      email: 'yamada-akabane@test.co.jp',
      phoneNumber: '03-1122-9901',
      kanaName: 'ﾔﾏﾀﾞﾃﾞﾝｷ ｷﾞﾝｻﾞｼﾃﾝ',
      // prefecture: '東京都',
      holidays: ['WEDNESDAY', 'SUNDAY'],
      zipCode: '100-0001',
      address: '東京都中央区西銀座5丁目',
      businessHours: '10:00-20:00',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      prefecture: {
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      },
    } satisfies StoreReadModel,
  ];

  // ページネーションされたStoreドメインオブジェクト
  const paginatedResult: PaginatedResult<StoreReadModel> = {
    data: stores,
    meta: {
      totalCount: 3,
      page: 1,
      size: 20,
    },
  };

  return paginatedResult;
}

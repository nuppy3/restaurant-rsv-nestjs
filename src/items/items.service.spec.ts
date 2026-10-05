import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Item, ItemStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { ItemsService } from './items.service';

// Mock(PrismaService) : 正確には、PrismaServiceのitem modelのfindManay()をモック化
// 別のやり方として、axiosのモック化 jest.mock("axios")みたいな指定もできるみたい。
const mockPrismaService = {
  item: {
    findMany: jest.fn(), // fn()はmock関数(振る舞いはテスト実施時に指定)
    // 以下のようなジェネリクスでmockPrismaServiceの型を明示する方法も提案されたけどエラーになる、、
    // 意味はなんとなくわかる。
    // findMany: jest.fn<jest.MockedFunction<PrismaService['item']['findMany']>>(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// descrive():関連する複数のテストケースをグループ化
describe('ItemsService Test', () => {
  // DI対象モジュールの宣言
  let itemsService: ItemsService;
  let prismaService: PrismaService; // Mock化するためにDI
  let sharedResultItems: Item[]; // 全テストで共有
  let sharedExpectedItems: Item[];
  // 本物のPrismaServiceを使う場合
  // let app: INestApplication;

  // ＜前処理＞
  // まずは、テスト対象のItemsServiceをインスタンス化(DI)しないと呼び出すことすらできない。
  // また、ItemsServiceから呼び出しているPrismaServiceにおいてもインスタンス化(DI)する必要がある。
  // ただ、今回はDBに繋がずUTを実施するため、PrismaServiceをMock化する。
  //
  // 要は、item.module.ts で実施していることをやる必要がある
  // imports: [PrismaModule, AuthModule],
  // controllers: [ItemsController],
  // providers: [ItemsService],
  // 以下はItemService内でのPrismaServiceのDI
  // constructor(private readonly prismaService: PrismaService) {}

  // beforeAll: テスト全体の前に1回だけ実行
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ');

    // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
    // この便利なDIの仕組みはNestJSの仕組み。
    // 最後の.compile()を忘れずに
    const module = await Test.createTestingModule({
      // DI対象のサービス
      providers: [
        ItemsService,
        // PrismaServiceはmock(mockPrismaService)に切り替える
        { provide: PrismaService, useValue: mockPrismaService },
        //
      ],
      // 以下のように本物のPrismaモジュールをDIすることも可能→integrationテスト対象
      // items.service.integration.spec.tsとしてunitテストとは分離して管理がベスト（CI/CDも重なる）
      // 分ける際のやり方、ベストプラクティス（jest.config.ts定義、pakage.json定義はGPTに聞く）
      // imports: [PrismaModule],
    }).compile(); // compile()にてモジュールを生成する。

    // 本物のPrismaを使う場合
    // app = module.createNestApplication();
    // await app.init();

    itemsService = module.get<ItemsService>(ItemsService);
    prismaService = module.get<PrismaService>(PrismaService);
    // 全テストで共有: Service(mock)の結果、期待値
    sharedResultItems = createResultItems();
    sharedExpectedItems = createExpectedItems();
  });

  // 各テストケースの前に毎回実行：こっちでcreateTestingModule()してもいいが、
  // 重いのでbeforeAll()で1回だけ実行するようにするのがベストプラクティス
  beforeEach(() => {
    // console.log('beforeEach: モックをリセット');
    jest.clearAllMocks(); // モックの状態をリセット
  });

  describe('findAll', () => {
    it('正常系1', async () => {
      // ・prismaServiceのモック関数の中身、振る舞いをmockResolvedValue()にて実装
      // prismaService.item.findMany.mockRejectedValue()としたいところだが、eslintでの型エラーが
      // 出るので、as jest.Mockに型キャストして使用している。
      // テストケース毎にMockの返却値を変えない場合は、mockPrismaServiceにて直接
      // jest.fn().mockResolvedValue()でもいいか。→空のケースとかは必ず実施するから、Mockの
      // 返却値を変えないなんてことはないから、以下の実装がベストプラクティス
      // (prismaService.item.findMany as jest.Mock).mockResolvedValue(
      //   sharedResultItems,
      // );
      //
      // → 以下に書き換え（spyOnがベストプラクティス）型キャスト不要
      jest
        .spyOn(prismaService.item, 'findMany')
        .mockResolvedValue(sharedResultItems);

      // 期待値
      const expectedItems = sharedExpectedItems;

      // 試しに、prismaServiceのMock化が正常に実施できているかを検証してみた（念のため）
      // const result = await prismaService.item.findMany();
      // expect([]).toEqual(result);

      // テスト対象サービス・メソッド呼び出し
      const results = await itemsService.findAll();
      expect(results).toEqual(expectedItems);
    });

    it('StatusがON_SALE のみ', async () => {
      // Mockの返却値作成（PrismaService）
      const mockResultItems = sharedResultItems.filter(
        (item) => item.status === 'ON_SALE',
      );
      // jest.spyOn()に修正
      jest
        .spyOn(prismaService.item, 'findMany')
        .mockResolvedValue(mockResultItems);
      // (prismaService.item.findMany as jest.Mock).mockResolvedValue(
      //   mockResultItems,
      // );

      // テスト対象Service.method()
      const results = await itemsService.findAll();
      // 期待値
      const expectedItems = sharedExpectedItems.filter(
        (item) => item.status === 'ON_SALE',
      );
      expect(results).toEqual(expectedItems);
    });

    // prismaのfindManyはデータがない場合[]を返す仕様。null,undefindedは返さない。
    it('空配列の場合', async () => {
      jest.spyOn(prismaService.item, 'findMany').mockResolvedValue([]);
      // (prismaService.item.findMany as jest.Mock).mockResolvedValue([]);
      const results = await itemsService.findAll();
      expect(results).toEqual([]);
    });
  });

  describe('findById', () => {
    it('正常系1', async () => {
      // アイテムID
      const itemId = '2e7a7dab-cc05-4468-835a-9cec4b77da8c';

      // ・prismaServiceのモック関数の中身、振る舞いをmockResolvedValue()にて実装
      const mockResultItem = sharedResultItems.find(
        (item) => item.id === itemId,
      )!;

      jest
        .spyOn(prismaService.item, 'findUnique')
        .mockResolvedValue(mockResultItem);
      // (prismaService.item.findUnique as jest.Mock).mockResolvedValue(
      //   mockResultItem,
      // );

      // テスト対象メソッド
      const result = await itemsService.findById(itemId);

      // 以下について、期待値はmockResultItemでもいいっぽい
      expect(result).toEqual({
        id: '2e7a7dab-cc05-4468-835a-9cec4b77da8c',
        name: 'JBLイヤホン003',
        price: 30000,
        description: '未使用品です',
        status: 'ON_SALE',
        createdAt: new Date('2025-10-04T07:47:52.000Z'),
        updatedAt: new Date('2025-10-04T07:47:52.000Z'),
        userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
      });
      // PrismaServiceのfindUnique()が適切な引数で実行されたかテスト
      // toHaveBeenCalledWith()に渡された引数と期待値が合うか。
      // 重要ポイント：prismaService.item.findUniqueはMock化するが、findUnique()は「誰が、
      // どんな引数で呼んだか」を記録してくれているので、モックでも「実際に渡された引数」で「実際の
      // Prismaの引数(型、値)」で渡されているかチェックするという強力なツール!!
      // 以下のコードはEslintエラーが出るが、テストコード内限定でESLintの以下を無効化
      expect(jest.spyOn(prismaService.item, 'findUnique')).toHaveBeenCalledWith(
        {
          // expect(prismaService.item.findUnique as jest.Mock).toHaveBeenCalledWith({
          where: { id: itemId },
        },
      );
    });
    it('異常系: 商品が存在しない（null)', async () => {
      // アイテムID
      const itemId = '';
      // prismaSeviceのモック設定
      jest.spyOn(prismaService.item, 'findUnique').mockResolvedValue(null);
      // (prismaService.item.findUnique as jest.Mock).mockResolvedValue(null);

      // await(非同期)メソッドの場合、Promiseを返却する必要があるが、Promiseをアンラップ(rejects)して別の
      // Matcherを連鎖させるようにして、toThrowを呼んだりする。
      await expect(itemsService.findById(itemId)).rejects.toThrow(
        new NotFoundException('Itemが存在しません'),
      );
    });
    // ★以下のundefinedのケースは不要。prismaのfindUnique()はデータが存在しない場合はnullを返却するため。
    // it('異常系2: 商品が存在しない（undefined)', async () => {
    //   // アイテムID
    //   const itemId = '2e7a7dab-cc05-4468-835a-9cec4b77da8c';
    //   // prismaSeviceのモック設定
    //   (prismaService.item.findUnique as jest.Mock).mockResolvedValue(undefined);
    //   // await(非同期)メソッドの場合、Promiseを返却する必要があるが、Promiseをアンラップ(rejects)して別の
    //   // Matcherを連鎖させるようにして、toThrowを呼んだりする。
    //   await expect(itemsService.findById(itemId)).rejects.toThrow(
    //     new NotFoundException('Itemが存在しません'),
    //   );
    // });
    // これは、やれたらやる。
    // it('異常系3： DB接続エラー（DBダウン）', async () => {});
  });
  describe('create', () => {
    it('正常系1', async () => {
      // create()の引数作成
      const param: CreateItemDto = {
        name: 'JBLイヤホン100',
        price: 1000,
        description: '未使用品です',
      };
      const paramUserId = '9de29d9d-fca8-4061-9427-b821d96dea2b';

      // PridmaServiceの返却値(Mock)
      const mockResultItem = {
        id: '9de29d9d-fca8-4061-9427-b821d96dea2b',
        name: 'JBLイヤホン100',
        price: 1000,
        description: '未使用品です',
        status: ItemStatus.ON_SALE,
        createdAt: new Date('2025-10-02T07:39:21.000Z'),
        updatedAt: new Date('2025-10-02T07:39:21.000Z'),
        userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
      };

      jest
        .spyOn(prismaService.item, 'create')
        .mockResolvedValue(mockResultItem);

      // テスト対象メソッド(expectはmockResultItemをそのまま渡してもいい)
      const result = await itemsService.create(param, paramUserId);
      expect(result).toEqual({
        id: '9de29d9d-fca8-4061-9427-b821d96dea2b',
        name: 'JBLイヤホン100',
        price: 1000,
        description: '未使用品です',
        status: 'ON_SALE',
        createdAt: new Date('2025-10-02T07:39:21.000Z'),
        updatedAt: new Date('2025-10-02T07:39:21.000Z'),
        userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
      });

      // prismaService.item.create()の引数チェック

      expect(jest.spyOn(prismaService.item, 'create')).toHaveBeenCalledWith({
        // expect(prismaService.item.create as jest.Mock).toHaveBeenCalledWith({
        data: {
          name: param.name,
          price: param.price,
          description: param.description,
          status: 'ON_SALE',
          userId: paramUserId,
        },
      });
    });
  });
  describe('updateStatus', () => {
    it('正常系1', async () => {
      // updateStatusへの引数作成
      const itemId = '2e7a7dab-cc05-4468-835a-9cec4b77da8c';
      const userId = '9de29d9d-fca8-4061-9427-b821d96dea2b';

      // PrismaServiceの返却値(Mock)作成
      const mockResulItem = sharedResultItems.find(
        (item) => item.id === itemId,
      )!;
      jest.spyOn(prismaService.item, 'update').mockResolvedValue(mockResulItem);
      // (prismaService.item.update as jest.Mock).mockResolvedValue(mockResulItem);

      // テスト対象メソッド
      const result = await itemsService.updateStatus(itemId, userId);
      expect(result).toEqual({
        id: '2e7a7dab-cc05-4468-835a-9cec4b77da8c',
        name: 'JBLイヤホン003',
        price: 30000,
        description: '未使用品です',
        status: 'ON_SALE',
        createdAt: new Date('2025-10-04T07:47:52.000Z'),
        updatedAt: new Date('2025-10-04T07:47:52.000Z'),
        userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
      });
      // prismaService.item.updateの引数チェック
      expect(jest.spyOn(prismaService.item, 'update')).toHaveBeenCalledWith({
        // expect(prismaService.item.update as jest.Mock).toHaveBeenCalledWith({
        data: { status: 'SOLD_OUT', userId }, // userIdはkey名と一致しているので省略形
        where: { id: itemId },
      });
    });
  });
  describe('delete', () => {
    it('正常系1', async () => {
      // 引数作成
      const itemId = '0d083b96-67ab-4491-a1a2-db8c301a7f1e';
      const userId = '9de29d9d-fca8-4061-9427-b821d96dea2b';

      // voidメソッドなので、期待値検証ではなく、呼び出し検証
      // 戻り値はItem型で値は任意。なので、適当にセット
      jest.spyOn(prismaService.item, 'delete').mockResolvedValue({
        id: '2e7a7dab-cc05-4468-835a-9cec4b77da8c',
        name: 'JBLイヤホン003',
        price: 30000,
        description: '未使用品です',
        status: 'ON_SALE',
        createdAt: new Date('2025-10-04T07:47:52.000Z'),
        updatedAt: new Date('2025-10-04T07:47:52.000Z'),
        userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
      });
      // (prismaService.item.delete as jest.Mock).mockResolvedValue(null);
      await itemsService.delete(itemId, userId);

      // prismaService.item.delete()の引数チェック

      expect(jest.spyOn(prismaService.item, 'delete')).toHaveBeenCalledWith({
        // expect(prismaService.item.delete as jest.Mock).toHaveBeenCalledWith({
        where: {
          id: itemId,
          userId,
        },
      });

      // 追加検証（1回しか呼ばれないよねチェック。このテストcreatecreateいるのか。。。）
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.item.delete).toHaveBeenCalledTimes(1);

      // 以下は、本来複数回の呼び出しでも引数が正しく渡されるかのテスト。
      // なので、当該テストのように1回のテストの場合、上記の正常系1のtoHaveBeenCalledWithで
      // 事足りている。ので以下は不要。
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.item.delete).toHaveBeenNthCalledWith(1, {
        where: { id: itemId, userId },
      });
    });
  });
});

function createResultItems(): Item[] {
  const mockResulItems: Item[] = [
    {
      id: '3c301c04-d88e-463a-af83-faa994489803',
      name: 'JBLイヤホン002',
      price: 20000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-02T07:39:21.000Z'),
      updatedAt: new Date('2025-10-02T07:39:21.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: '0d083b96-67ab-4491-a1a2-db8c301a7f1e',
      name: 'JBLイヤホン001',
      price: 10000,
      description: '未使用品です',
      status: 'SOLD_OUT',
      createdAt: new Date('2025-10-02T04:15:06.000Z'),
      updatedAt: new Date('2025-10-02T09:05:18.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: '2e7a7dab-cc05-4468-835a-9cec4b77da8c',
      name: 'JBLイヤホン003',
      price: 30000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-04T07:47:52.000Z'),
      updatedAt: new Date('2025-10-04T07:47:52.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: 'c8fdf54f-cdcc-4d5b-8ad0-73b0338b915f',
      name: 'JBLイヤホン004',
      price: 40000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-04T07:48:00.000Z'),
      updatedAt: new Date('2025-10-04T07:48:00.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
  ];
  return mockResulItems;
}

function createExpectedItems(): Item[] {
  const mockResulItems: Item[] = [
    {
      id: '3c301c04-d88e-463a-af83-faa994489803',
      name: 'JBLイヤホン002',
      price: 20000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-02T07:39:21.000Z'),
      updatedAt: new Date('2025-10-02T07:39:21.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: '0d083b96-67ab-4491-a1a2-db8c301a7f1e',
      name: 'JBLイヤホン001',
      price: 10000,
      description: '未使用品です',
      status: 'SOLD_OUT',
      createdAt: new Date('2025-10-02T04:15:06.000Z'),
      updatedAt: new Date('2025-10-02T09:05:18.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: '2e7a7dab-cc05-4468-835a-9cec4b77da8c',
      name: 'JBLイヤホン003',
      price: 30000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-04T07:47:52.000Z'),
      updatedAt: new Date('2025-10-04T07:47:52.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
    {
      id: 'c8fdf54f-cdcc-4d5b-8ad0-73b0338b915f',
      name: 'JBLイヤホン004',
      price: 40000,
      description: '未使用品です',
      status: 'ON_SALE',
      createdAt: new Date('2025-10-04T07:48:00.000Z'),
      updatedAt: new Date('2025-10-04T07:48:00.000Z'),
      userId: '9de29d9d-fca8-4061-9427-b821d96dea2b',
    },
  ];
  return mockResulItems;
}

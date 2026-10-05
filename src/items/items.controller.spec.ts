import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request as ExpressRequest } from 'express';
import { RequestUser } from 'src/types/requestUser';
import { Item } from '../../generated/prisma'; // Prismaのmodel(リレーション)で定義したItem
import { CreateItemDto } from './dto/create-item.dto';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

// Mock(ItemsService) : 正確には、ItemsServiceのfindById()をモック化
// 別のやり方として、axiosのモック化 jest.mock("axios")みたいな指定もできるみたい。
const mockItemsService = {
  findAll: jest.fn(), // fn()はmock関数(振る舞いはテスト実施時に指定)
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
};

// descrive():関連する複数のテストケースをグループ化
describe('ItemsController Test', () => {
  // DI対象モジュールの宣言
  let itemsController: ItemsController;
  let itemsService: ItemsService;
  let sharedResultItems: Item[]; // 全テストで共有
  let sharedExpectedItems: Item[];
  // 本物のItemsServiceを使う場合
  // let app: INestApplication;

  // ＜前処理＞
  // まずは、テスト対象のItemsControllerをインスタンス化(DI)しないと呼び出すことすらできない。
  // また、ItemsCotrollerから呼び出しているitemsServiceにおいてもインスタンス化(DI)する必要がある。
  // UTのBP(ベストプラクティス)はDB接続など他の依存関係との分離なのでitemsServiceをMock化する。
  //
  // ＜DIについて＞
  // 要は、item.module.ts で実施していることをやる必要がある
  // ただ、item.mocule.tsで定義しているモジュール達は、Controller、Serviceの両方で使用するため
  // テスト実施においては必要に応じて必要なモジュールをDIする（例：ControllerのテストではPrismaMoculeは不要）
  // imports: [PrismaModule, AuthModule],
  // controllers: [ItemsController],
  // providers: [ItemsService],

  // 以下はItemService内でのItemsServiceのDI
  // constructor(private readonly ItemsService: ItemsService) {}

  // beforeAll: テスト全体の前に1回だけ実行
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ');

    // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
    // この便利なDIの仕組みはNestJSの仕組み。
    // 最後の.compile()を忘れずに
    const module = await Test.createTestingModule({
      // DI対象のサービス
      controllers: [ItemsController],
      providers: [
        // ItemsServiceはmock(mockItemsService)に切り替える
        { provide: ItemsService, useValue: mockItemsService },
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

    itemsController = module.get<ItemsController>(ItemsController);
    itemsService = module.get<ItemsService>(ItemsService);

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
      // ・ItemsServiceのモック関数の中身、振る舞いをmockResolvedValue()にて実装
      // ItemsService.item.findMany.mockRejectedValue()としたいところだが、eslintでの型エラーが
      // 出るので、as jest.Mockに型キャストして使用している。
      // テストケース毎にMockの返却値を変えない場合は、mockItemsServiceにて直接
      // jest.fn().mockResolvedValue()でもいいか。→空のケースとかは必ず実施するから、Mockの
      // 返却値を変えないなんてことはないから、以下の実装がベストプラクティス
      // (itemsService.findAll as jest.Mock).mockResolvedValue(sharedResultItems);

      // 上記ではなく、以下のspyOnがベストプラクティスなので切り替え
      jest.spyOn(itemsService, 'findAll').mockResolvedValue(sharedResultItems);

      // 期待値
      const expectedItems = sharedExpectedItems;

      // テスト対象サービス・メソッド呼び出し
      const results = await itemsController.findAll();
      expect(results).toEqual(expectedItems);
    });

    it('正常系2:データなし', async () => {
      // モックの返却値
      jest.spyOn(itemsService, 'findAll').mockResolvedValue([]);
      // テスト対象Service.method()
      const results = await itemsController.findAll();
      // 結果検証
      expect(results).toEqual([]);
    });
  });

  /**
   * findByIdのテストについて、引数のチェック(ParseUUIDPipeを使用したValidation)は
   * E2Eテストにて実施するのがベストプラクティス。
   * したがって、findByIdのユニットテストでは、有効なUUID（例: '2e7a7dab-cc05-4468-835a-9cec4b77da8c'）を
   * 引数として渡し、Serviceが正しく呼び出されることのみを確認すれば十分です。
   */
  describe('findById', () => {
    it('正常系1:', async () => {
      // 返却値
      const itemId = '2e7a7dab-cc05-4468-835a-9cec4b77da8c';
      // 以下のspyOnのコードの「.mockResolvedValue(mockResoultItem)」のmockResoultItemについて、
      // 型エラーが発生する。
      // itemsService.findByIDはデータが空であっても返却値にnull | undefinedを返すことは無いが、
      // sharedResultItems.find((item) => item.id == itemId) は undefinedを返す可能性があるため
      // 厳密な型チェックによりエラーが発生している。
      // ので、対策としてsharedResultItems.find((item) => item.id == itemId)!
      // の様に末尾に「!」をつけている。
      // TypeScriptにおける「!」 は、「Non-null Assertion Operator」（非 Null アサーション演算子）と呼ばれます。
      // これは、プログラマーがTypeScriptコンパイラに対して、「この値は、たとえコンパイラが null や
      // undefined の可能性があると推論しても、実行時には決して null や undefined にならない」と
      // 断言するための構文です。
      const mockResoultItem = sharedResultItems.find(
        (item) => item.id == itemId,
      )!;
      jest.spyOn(itemsService, 'findById').mockResolvedValue(mockResoultItem);
      // テスト対象メソッド呼び出し
      const result = await itemsController.findById(itemId);
      // 結果検証
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

      // ItemsServiceのfindById()が適切な引数で実行されたかテスト
      // toHaveBeenCalledWith()に渡された引数と期待値が合うか。
      // 重要ポイント：ItemsService.findByIdはMock化するが、findById()は「誰が、
      // どんな引数で呼んだか」を記録してくれているので、モックでも「実際に渡された引数」で「実際の
      // itemsService.findByIdの引数(型、値)」で渡されているかチェックするという強力なツール!!
      //
      // 例：  expect(itemsService.ifindById as jest.Mock).toHaveBeenCalledWith({
      //        where: { id: itemId },
      //      });
      expect(jest.spyOn(itemsService, 'findById')).toHaveBeenCalledWith(itemId);
    });
    it('異常系：指定したIDの商品が存在しない場合の例外確認', async () => {
      // IDをキーに、DBに対象商品データが存在しない場合、Service側で例外をスローし、Controllerでは
      // 例外をキャッチせず、NestJSの例外フィルターが処理する。
      // Serviceからスローされた例外がそのまま外側に伝播することをテストする。
      // mockのcontrollerをアンラップ(rejects)して別のMatcherを連鎖させるようにして、
      // Exceptionを返すようにする。（エラーを返す際にmockRejectedValueをよく使う)
      jest
        .spyOn(itemsService, 'findById')
        .mockRejectedValue(new NotFoundException('Itemが存在しません'));
      // 結果検証
      // await(非同期)メソッドが失敗し例外を投げる際のテストコード：非同期処理の場合Promiseを
      // 返却する必要があるが、Promiseをアンラップ(rejects)して別のMatcherを連鎖させるようにして、
      // toThrowを呼んだりする。
      await expect(itemsController.findById('')).rejects.toThrow(
        new NotFoundException('Itemが存在しません'),
      );
      expect(jest.spyOn(itemsService, 'findById')).toHaveBeenCalledWith('');
      // 以下でもエラーにはならなかった。。
      // expect(itemsController.findById).toHaveBeenCalledWith('');
    });
  });

  describe('create', () => {
    it('正常系', async () => {
      // controllerの引数
      const itemDto: CreateItemDto = {
        name: 'test-イヤホン001',
        price: 1000,
        description: '未使用品です。',
      };
      const expressRec: ExpressRequest & { user: RequestUser } =
        createRequest();

      // mockの返却値セット(serviceクラス)
      const mockResult: Item = {
        id: '1x301c04-d88e-463a-af83-faa994478901',
        ...itemDto,
        status: 'ON_SALE',
        // descriptionについて、ItemDtoとItemで型が若干異なるので(description: string | nullと string | undefined)
        // nullとundefinedで型推論でエラーが発生するため、以下のように直接description:stringで
        // 上書きをしている
        description: '未使用品です。',
        createdAt: new Date('2025-11-06T04:15:06.000Z'),
        updatedAt: new Date('2025-11-06T09:05:18.000Z'),
        userId: expressRec.user.id,
      };
      jest.spyOn(itemsService, 'create').mockResolvedValue(mockResult);

      // テスト対象メソッド呼び出し
      const result = await itemsController.create(itemDto, expressRec);

      // 結果検証(期待値はmockResultの値そのまま)
      expect(result).toEqual({ ...mockResult });
      // 引数検証
      expect(jest.spyOn(itemsService, 'create')).toHaveBeenCalledWith(
        itemDto,
        expressRec.user.id,
      );
    });
  });

  describe('updateStatus', () => {
    it('正常系', async () => {
      // Mock返却値(serviceクラス)
      const id: string = '0d083b96-67ab-4491-a1a2-db8c301a7f1e';
      const mockResoultItem = sharedResultItems.find((item) => item.id == id)!;
      jest
        .spyOn(itemsService, 'updateStatus')
        .mockResolvedValue(mockResoultItem);

      // 引数
      const expressRec: ExpressRequest & { user: RequestUser } =
        createRequest();
      expressRec.user.id = '9de29d9d-fca8-4061-9427-b821d96dea2b';

      // テスト対象メソッド呼び出し
      const result = await itemsController.updateStatus(id, expressRec);

      // 期待値
      const expectedItem = createExpectedItems().find(
        (item) => item.id === id,
      )!;
      expectedItem.status = 'SOLD_OUT';

      // 結果検証
      expect(result).toEqual(expectedItem);
      // 引数検証
      expect(jest.spyOn(itemsService, 'updateStatus')).toHaveBeenCalledWith(
        id,
        expressRec.user.id,
      );
    });
  });
  describe('delete', () => {
    it('正常系', async () => {
      // 引数設定
      const id: string = '3c301c04-d88e-463a-af83-faa994489803';
      const expressRec: ExpressRequest & { user: RequestUser } =
        createRequest();

      // mock返却値設定（serviceクラス）: delete()は戻り値が無い(void)ため、undefinedを指定。
      jest.spyOn(itemsService, 'delete').mockResolvedValue(undefined);

      // テスト対象メソッド呼び出し
      await itemsController.delete(id, expressRec);

      // 結果検証: delete()は返却値がvoidなのでexpect()toEqual()の検証はしない
      // expect(result).toEqual();

      // 引数検証
      expect(jest.spyOn(itemsService, 'delete')).toHaveBeenCalledWith(
        id,
        expressRec.user.id,
      );
    });
  });
});

/**
 * req: ExpressRequest & { user: RequestUser } をモックする。
 * ExpressRequest（通常は express の Request 型）にカスタムの user プロパティ（RequestUser 型）を
 * 追加したリクエストオブジェクトを模倣する必要があります。
 * → ExpressRequest と RequestUser を組み合わせた型を満たすようにモックを作成します。
 *
 */
function createRequest(): ExpressRequest & { user: RequestUser } {
  // 認証情報を含むモックリクエストオブジェクト
  // req: ExpressRequest & { user: RequestUser }
  // const mockRequest = { user: mockRequestUser } as ExpressRequest & { user: RequestUser };

  // RequestUserをモック
  const mockUser: RequestUser = {
    id: 'test-001',
    name: 'テストユーザー',
    status: 'FREE',
  };

  // モックリクエスト（ExpressRequest & { user: RequestUser } を満たすデータを作成）
  // Partial<T>は、ユーティリティ型の一つで、指定した型Tのすべてのプロパティをオプション(任意)に
  // する型を生成します。
  // ExpressRequest（expressのRequest型を拡張した型）は、通常多くのプロパティ
  // （headers, query, bodyなど）を持っています。
  // テストではすべてのプロパティをモックする必要がないため、Partial<ExpressRequest>を使って
  // 必要なプロパティ（この場合はuser）だけを定義します。
  const mockRequest: Partial<ExpressRequest & { user: RequestUser }> = {
    user: mockUser,
  };
  // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
  // 完全に一致しないため、保守性がやや低下する可能性があるため）
  return mockRequest as ExpressRequest & { user: RequestUser };
}

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

import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PrefectureHasStoresException } from './errors/prefectures.exceptions';
import { PrefecturesDomainService } from './prefectures.domain.service';

// PrefecturesDomainService のテスト
// DomainServiceは、Prefecture(Entity)単体では判定できない「他集約(Store)をまたぐルール」を担当する。
// assertDeletable は「店舗が1件でも紐づいていたら削除できない」というルールで、
// 店舗の件数を PrismaService(store.count)で数えている。
// そのため、PrismaService の store.count だけをモックにすれば、DBなしでテストできる。

// MockService定義
// assertDeletable で使う prisma.store.count だけを用意する
const mockPrismaService = {
  store: {
    count: jest.fn(),
  },
};

describe('■■■ PrefecturesDomainService test ■■■', () => {
  // DIモジュール
  // テスト対象のDomainService
  let prefecturesDomainService: PrefecturesDomainService;
  // DIされたPrismaService(中身は上のmockPrismaService)
  // ⭐️memo: prismaService と mockPrismaService は同じオブジェクト(useValue で差し替えているため)。
  //         ただし module.get<PrismaService>() で取得しているので、prismaService には
  //         「本物のPrismaServiceの型」が付く。そのため mockResolvedValue などを直接呼べず、
  //         jest.spyOn(prismaService.store, 'count') 経由で設定・検証している
  //         (mockPrismaService.store.count.mockResolvedValue(...) と書いても同じ動きになる)
  let prismaService: PrismaService;

  // 引数: なんでもいい
  // (DBにはアクセスしないので、存在するIDである必要はない。Prismaに渡す引数の検証にだけ使う)
  const prefectureId = '17b54147-b6ed-4d4e-a25f-4b632b0b444e';

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    // PrefecturesDomainServiceが依存する PrismaService をモックに差し替えてDIする
    const module = await Test.createTestingModule({
      providers: [
        PrefecturesDomainService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    prefecturesDomainService = module.get<PrefecturesDomainService>(
      PrefecturesDomainService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    // 前のテストで設定したモックの戻り値・呼び出し記録をすべてリセットする
    jest.resetAllMocks();
  });

  //--------------------------------------
  // assertDeletable test
  //--------------------------------------
  // mockData:
  // ①Prisma store.count(都道府県に紐づく店舗の件数)
  describe('assertDeletable', () => {
    it('正常系: idに紐づく店舗が存在しない場合は正常終了する', async () => {
      // prisma mock data 作成 : 紐づく店舗が0件
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      // ・assertDeletable は async 関数なので、戻り値は Promise<void>
      // ・.resolves: Promise が「成功(resolve)」したときの値を取り出して検証する
      // ・.toBeUndefined(): void なので値は undefined = 例外なく最後まで処理が終わったこと
      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).resolves.toBeUndefined();

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      // await prefecturesDomainService.assertDeletable(prefectureId);

      // Prismaへの引数検証
      // 指定した都道府県ID(prefectureId)に紐づく店舗だけを数えていること
      expect(jest.spyOn(prismaService.store, 'count')).toHaveBeenCalledWith({
        where: { prefectureId: prefectureId },
      });
    });

    it('異常系: idに紐づく店舗が存在する場合、PrefectureHasStoresExceptionをスローする', async () => {
      // prisma mock data 作成： 紐づく店舗が1件
      // (1件でもあれば削除不可。0件との境界になる1件で確認している)
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(1);

      // test対象service呼び出し、結果検証
      // ・.rejects: Promise が「失敗(reject)」したときの例外を取り出して検証する
      // ・toThrow(new Xxx(...)): 例外の型とメッセージを一度に検証する
      //   (PrefectureHasStoresException は DomainException で、HTTPでは409になる)
      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).rejects.toThrow(new PrefectureHasStoresException(prefectureId));
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // prisma mock data 作成： count がエラーになる(DB接続エラーを想定)
      // mockRejectedValue: Promise が失敗(reject)するように設定する
      jest
        .spyOn(prismaService.store, 'count')
        .mockRejectedValue(new Error('Database connection failed'));

      // test対象service呼び出し、結果検証
      // DomainServiceはDBのエラーを握りつぶしたり、別の例外に変換したりせず、そのまま投げること
      // (握りつぶすと「店舗0件」と誤判定して削除できてしまう危険があるため)
      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).rejects.toThrow(new Error('Database connection failed'));
    });
  });
});

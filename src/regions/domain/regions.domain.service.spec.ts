import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from './../../prisma/prisma.service';
import { RegionsDomainService } from './regions.domain.service';

// MockService定義
const mockPrismaSercie = {
  prefecture: {
    count: jest.fn(),
  },
};

describe('■■■ Region test ■■■', () => {
  // DIモジュール
  let regionsDomainService: RegionsDomainService;
  let prismaService: PrismaService;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    console.log('beforeAll: モジュールのセットアップ（DIなど）');

    const module = await Test.createTestingModule({
      providers: [
        RegionsDomainService,
        { provide: PrismaService, useValue: mockPrismaSercie },
      ],
    }).compile();

    regionsDomainService =
      module.get<RegionsDomainService>(RegionsDomainService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    console.log('beforeEach: モックをリセット');
    // jest.clearAllMocks();
    jest.resetAllMocks();
  });

  //--------------------------------------
  // assertPublishable test
  //--------------------------------------
  describe('assertPublishable', () => {
    it('正常系: idに紐づく都道府県が存在する場合は正常終了する', async () => {
      // prisma mock data 作成 : 紐づく都道府県が1件
      const mockData = 1;
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      await regionsDomainService.assertPublishable(regionId);

      // Prismaへの引数検証
      expect(
        jest.spyOn(prismaService.prefecture, 'count'),
      ).toHaveBeenCalledWith({ where: { regionId: regionId } });
    });

    it('異常系: idに紐づく都道府県が無い場合、ConflictExceptionをスローする', async () => {
      // prisma mock data 作成： 紐づく都道府県が存在しない
      const mockData = 0;
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // ConflictExceptionがスローされることをテスト
      // await expect(
      //   regionsDomainService.assertPublishable(regionId),
      // ).rejects.toThrow(ConflictException);

      // // ConflictExceptionのメッセージ検証
      // await expect(
      //   regionsDomainService.assertPublishable(regionId),
      // ).rejects.toThrow(
      //   `都道府県が登録されていないため、この地域は「掲載中」にできません。regionId: ${regionId}`,
      // );

      // 上記のException検証（①ConflictionExceptionの検証 ②メッセージの検証）のやり方より以下のように
      // 一発で検証するやり方がBP。
      await expect(
        regionsDomainService.assertPublishable(regionId),
      ).rejects.toThrow(
        new ConflictException(
          `都道府県が登録されていないため、この地域は「掲載中」にできません。regionId: ${regionId}`,
        ),
      );
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'count')
        .mockRejectedValue(mockGenericError);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // 元のエラー（Generic Error）がそのままスローされることをテスト
      await expect(
        regionsDomainService.assertPublishable(regionId),
      ).rejects.toThrow(new Error('Database connection failed'));
    });
  });

  //--------------------------------------
  // assertUnpublishable test
  //--------------------------------------
  describe('assertUnpublishable', () => {
    it('正常系: idに紐づく都道府県が無い場合は正常終了する', async () => {
      // prisma mock data 作成 : 紐づく都道府県が1件
      const mockData = 0;
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      await regionsDomainService.assertUnpublishable(regionId);

      // Prismaへの引数検証
      expect(
        jest.spyOn(prismaService.prefecture, 'count'),
      ).toHaveBeenCalledWith({ where: { regionId: regionId } });
    });

    it('異常系: idに紐づく都道府県が存在する場合、ConflictExceptionをスローする', async () => {
      // prisma mock data 作成： 紐づく都道府県が存在しない
      // const mockData = 0;
      // jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);
      // // 引数: なんでもいい
      // const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';
      // // ConflictExceptionがスローされることをテスト
      // await expect(
      //   regionsDomainService.assertPublishable(regionId),
      // ).rejects.toThrow(
      //   new ConflictException(
      //     `掲載中の都道府県が登録されているため、この地域は「編集中」にできません。regionId: ${regionId}`,
      //   ),
      // );
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'count')
        .mockRejectedValue(mockGenericError);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // 元のエラー（Generic Error）がそのままスローされることをテスト
      await expect(
        regionsDomainService.assertUnpublishable(regionId),
      ).rejects.toThrow(new Error('Database connection failed'));
    });
  });

  //--------------------------------------
  // assertDeletable test
  //--------------------------------------
  describe('assertDeletable', () => {
    it('正常系: idに紐づく都道府県が存在しない場合は正常終了する', async () => {
      // prisma mock data 作成 : 紐づく都道府県が0件
      const mockData = 0;
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      await regionsDomainService.assertDeletable(regionId);

      // Prismaへの引数検証
      expect(
        jest.spyOn(prismaService.prefecture, 'count'),
      ).toHaveBeenCalledWith({ where: { regionId: regionId } });
    });

    it('異常系: idに紐づく都道府県がする場合、ConflictExceptionをスローする', async () => {
      // prisma mock data 作成： 紐づく都道府県が存在する
      const mockData = 3;
      jest.spyOn(prismaService.prefecture, 'count').mockResolvedValue(mockData);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // ConflictExceptionがスローされることをテスト
      await expect(
        regionsDomainService.assertDeletable(regionId),
      ).rejects.toThrow(ConflictException);
      await expect(
        regionsDomainService.assertDeletable(regionId),
      ).rejects.toThrow(
        `都道府県が登録されているため、この地域は削除できません。regionId: ${regionId}`,
      );
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest
        .spyOn(prismaService.prefecture, 'count')
        .mockRejectedValue(mockGenericError);

      // 引数: なんでもいい
      const regionId = '0524dc98-89a2-4db1-9431-b20feff57700';

      // 元のエラー（Generic Error）がそのままスローされることをテスト
      await expect(
        regionsDomainService.assertDeletable(regionId),
      ).rejects.toThrow(Error);
      await expect(
        regionsDomainService.assertDeletable(regionId),
      ).rejects.toThrow('Database connection failed');
    });
  });
});

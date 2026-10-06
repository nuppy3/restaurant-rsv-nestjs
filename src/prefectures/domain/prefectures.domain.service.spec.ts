import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PrefectureHasStoresException } from './errors/prefectures.exceptions';
import { PrefecturesDomainService } from './prefectures.domain.service';

// MockService定義
const mockPrismaService = {
  store: {
    count: jest.fn(),
  },
};

describe('■■■ PrefecturesDomainService test ■■■', () => {
  let prefecturesDomainService: PrefecturesDomainService;
  let prismaService: PrismaService;

  // 引数: なんでもいい
  const prefectureId = '17b54147-b6ed-4d4e-a25f-4b632b0b444e';

  beforeAll(async () => {
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

  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // assertDeletable test
  //--------------------------------------
  describe('assertDeletable', () => {
    it('正常系: idに紐づく店舗が存在しない場合は正常終了する', async () => {
      // prisma mock data 作成 : 紐づく店舗が0件
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).resolves.toBeUndefined();

      // Prismaへの引数検証
      expect(jest.spyOn(prismaService.store, 'count')).toHaveBeenCalledWith({
        where: { prefectureId: prefectureId },
      });
    });

    it('異常系: idに紐づく店舗が存在する場合、PrefectureHasStoresExceptionをスローする', async () => {
      // prisma mock data 作成： 紐づく店舗が1件
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(1);

      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).rejects.toThrow(new PrefectureHasStoresException(prefectureId));
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      jest
        .spyOn(prismaService.store, 'count')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(
        prefecturesDomainService.assertDeletable(prefectureId),
      ).rejects.toThrow(new Error('Database connection failed'));
    });
  });
});

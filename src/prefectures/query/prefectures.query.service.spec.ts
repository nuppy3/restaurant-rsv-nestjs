import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { PREFECTURE_REPOSITORY_PORT } from '../domain/prefecture.repository.port';
import { Prefecture, PrefectureStatus } from '../domain/prefectures.model';
import { PrefecturesQueryService } from './prefectures.query.service';

type PrefectureWithId = Prefecture & { id: string };

// Mock定義
const mockPrismaService = {
  prefecture: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};
const mockConfigService = {
  get: jest.fn(),
};
const mockPrefectureRepository = {
  findByIdOrFail: jest.fn<Promise<PrefectureWithId>, [string]>(),
  findByCodeOrFail: jest.fn<Promise<PrefectureWithId>, [string]>(),
  save: jest.fn<Promise<PrefectureWithId>, [PrefectureWithId, string]>(),
};

// テストデータ
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * Prismaレコード(地方名include)のmock dataを作成するヘルパー
 */
const buildPrismaRecord = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
  code: '13',
  name: '東京都',
  kanaName: 'トウキョウト',
  status: 'published',
  kanaEn: 'Tokyo-to',
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  regionId: REGION_ID,
  userId: '00000000-0000-4000-8000-000000000001',
  region: { name: '関東' },
  ...overrides,
});

describe('■■■ PrefecturesQueryService test ■■■', () => {
  let prefecturesQueryService: PrefecturesQueryService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PrefecturesQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: PREFECTURE_REPOSITORY_PORT,
          useValue: mockPrefectureRepository,
        },
      ],
    }).compile();

    prefecturesQueryService = module.get<PrefecturesQueryService>(
      PrefecturesQueryService,
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findAllPaginated test
  //--------------------------------------
  describe('findAllPaginated', () => {
    it('正常系: Prismaデータが一覧用Read Modelに変換され、metaとともに返却されること', async () => {
      mockPrismaService.prefecture.findMany.mockResolvedValue([
        buildPrismaRecord(),
        // 地方未設定の都道府県
        buildPrismaRecord({
          id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
          code: '02',
          name: '青森県',
          kanaName: 'アオモリケン',
          kanaEn: 'Aomori-ken',
          status: 'editing',
          regionId: null,
          region: null,
        }),
      ]);
      mockPrismaService.prefecture.count.mockResolvedValue(47);

      const result = await prefecturesQueryService.findAllPaginated({
        page: 2,
        size: 10,
      });

      expect(result).toEqual({
        data: [
          {
            id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
            code: '13',
            name: '東京都',
            kanaName: 'トウキョウト',
            kanaEn: 'Tokyo-to',
            status: PrefectureStatus.PUBLISHED,
            regionId: REGION_ID,
            regionName: '関東',
          },
          {
            id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
            code: '02',
            name: '青森県',
            kanaName: 'アオモリケン',
            kanaEn: 'Aomori-ken',
            status: PrefectureStatus.EDITING,
            regionId: undefined,
            regionName: undefined,
          },
        ],
        meta: { totalCount: 47, page: 2, size: 10 },
      });
      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith({
        include: { region: { select: { name: true } } },
        orderBy: { code: 'asc' },
        take: 10,
        skip: 10,
      });
    });

    it('正常系: page/size未指定の場合、環境変数のデフォルト値が使われること', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'PREFECTURE_DEFAULT_PAGE_SIZE' ? 20 : 1,
      );
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      const result = await prefecturesQueryService.findAllPaginated();

      expect(result.meta).toEqual({ totalCount: 0, page: 1, size: 20 });
      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('境界値: sizeが上限を超える場合はMAX_PAGE_SIZE、pageが下限未満の場合はMIN_PAGEに丸められること', async () => {
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      const result = await prefecturesQueryService.findAllPaginated({
        page: 0,
        size: PAGINATION.MAX_PAGE_SIZE + 1,
      });

      expect(result.meta.size).toBe(PAGINATION.MAX_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MIN_PAGE);
    });

    it('境界値: sizeが下限未満の場合はMIN_PAGE_SIZE、pageが上限を超える場合はMAX_PAGEに丸められること', async () => {
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);
      mockPrismaService.prefecture.count.mockResolvedValue(0);

      const result = await prefecturesQueryService.findAllPaginated({
        page: PAGINATION.MAX_PAGE + 1,
        size: 0,
      });

      expect(result.meta.size).toBe(PAGINATION.MIN_PAGE_SIZE);
      expect(result.meta.page).toBe(PAGINATION.MAX_PAGE);
    });
  });

  //--------------------------------------
  // findCovered test
  //--------------------------------------
  describe('findCovered', () => {
    it('正常系: 公開中の店舗数(storeCount)付きのRead Modelが返却されること', async () => {
      mockPrismaService.prefecture.findMany.mockResolvedValue([
        { ...buildPrismaRecord(), _count: { store: 3 } },
      ]);

      const result = await prefecturesQueryService.findCovered();

      expect(result).toEqual([
        {
          id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          status: PrefectureStatus.PUBLISHED,
          regionId: REGION_ID,
          regionName: '関東',
          storeCount: 3,
        },
      ]);
    });

    it('正常系: 公開中(published)の店舗を条件に絞り込み・件数取得していること', async () => {
      mockPrismaService.prefecture.findMany.mockResolvedValue([]);

      await prefecturesQueryService.findCovered();

      expect(mockPrismaService.prefecture.findMany).toHaveBeenCalledWith({
        where: { store: { some: { status: 'published' } } },
        include: {
          region: { select: { name: true } },
          _count: { select: { store: { where: { status: 'published' } } } },
        },
        orderBy: { code: 'asc' },
      });
    });
  });

  //--------------------------------------
  // getDetailByIdOrThrow test
  //--------------------------------------
  describe('getDetailByIdOrThrow', () => {
    it('正常系: 作成日時・更新日時付きの詳細Read Modelが返却されること', async () => {
      mockPrismaService.prefecture.findUnique.mockResolvedValue(
        buildPrismaRecord(),
      );

      const result = await prefecturesQueryService.getDetailByIdOrThrow(
        '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
      );

      expect(result).toEqual({
        id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e',
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        status: PrefectureStatus.PUBLISHED,
        regionId: REGION_ID,
        regionName: '関東',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      expect(mockPrismaService.prefecture.findUnique).toHaveBeenCalledWith({
        where: { id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e' },
        include: { region: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      mockPrismaService.prefecture.findUnique.mockResolvedValue(null);

      await expect(
        prefecturesQueryService.getDetailByIdOrThrow('not-exist-id'),
      ).rejects.toThrow(
        new NotFoundException(
          'idに関連する都道府県情報が存在しません!! prefectureId: not-exist-id',
        ),
      );
    });
  });

  //--------------------------------------
  // getDetailByCodeOrThrow test
  //--------------------------------------
  describe('getDetailByCodeOrThrow', () => {
    it('正常系: 地方名付きの詳細Read Modelが返却されること', async () => {
      mockPrismaService.prefecture.findUnique.mockResolvedValue(
        buildPrismaRecord(),
      );

      const result = await prefecturesQueryService.getDetailByCodeOrThrow('13');

      expect(result.code).toBe('13');
      expect(result.regionName).toBe('関東');
      expect(result.createdAt).toEqual(CREATED_AT);
      expect(mockPrismaService.prefecture.findUnique).toHaveBeenCalledWith({
        where: { code: '13' },
        include: { region: { select: { name: true } } },
      });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      mockPrismaService.prefecture.findUnique.mockResolvedValue(null);

      await expect(
        prefecturesQueryService.getDetailByCodeOrThrow('99'),
      ).rejects.toThrow(
        new NotFoundException(
          'codeに関連する都道府県情報が存在しません!! code: 99',
        ),
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail test
  //--------------------------------------
  describe('findByCodeOrFail', () => {
    it('正常系: Repositoryに委譲し、domain(ID付き)を返却すること', async () => {
      const domainWithId = Object.assign(
        Prefecture.reconstitute({
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          status: PrefectureStatus.PUBLISHED,
          regionId: REGION_ID,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        }),
        { id: '17b54147-b6ed-4d4e-a25f-4b632b0b444e' },
      );
      mockPrefectureRepository.findByCodeOrFail.mockResolvedValue(domainWithId);

      const result = await prefecturesQueryService.findByCodeOrFail('13');

      expect(result).toBe(domainWithId);
      expect(mockPrefectureRepository.findByCodeOrFail).toHaveBeenCalledWith(
        '13',
      );
    });
  });
});

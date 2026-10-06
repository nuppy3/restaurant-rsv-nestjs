import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request as ExpressRequest } from 'express';
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
import { PrefecturesController } from './prefectures.controller';

// Mock定義
const mockPrefecturesService = {
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  remove: jest.fn(),
};
const mockPrefecturesQueryService = {
  findAllPaginated: jest.fn(),
  findCovered: jest.fn(),
  getDetailByIdOrThrow: jest.fn(),
  getDetailByCodeOrThrow: jest.fn(),
  findByCodeOrFail: jest.fn(),
};

// テストデータ
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

// JWT認証後のリクエスト(Guardは通過済みとして扱う)
const req = { user: { id: USER_ID } } as ExpressRequest & {
  user: RequestUser;
};

/**
 * 詳細Read Model(QueryServiceの戻り値)を作成するヘルパー
 */
const buildDetailReadModel = (
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
  ...overrides,
});

/**
 * domain(Application Serviceの戻り値)を作成するヘルパー
 */
const buildDomainWithId = (
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

describe('■■■ PrefecturesController(presentation/rest) TEST ■■■', () => {
  let prefecturesController: PrefecturesController;

  beforeAll(async () => {
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

  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // GET /prefectures
  //--------------------------------------
  describe('findAllPaginated', () => {
    it('正常系: filterがQueryServiceに渡され、dataがレスポンスの形(statusLabel付き)で返却されること', async () => {
      mockPrefecturesQueryService.findAllPaginated.mockResolvedValue({
        data: [
          buildDetailReadModel(),
          // 地方未設定の都道府県
          buildDetailReadModel({
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

      const result = await prefecturesController.findAllPaginated({
        page: 2,
        size: 2,
      });

      expect(mockPrefecturesQueryService.findAllPaginated).toHaveBeenCalledWith(
        { page: 2, size: 2 },
      );
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
          },
          {
            id: '4449182c-f84b-42c2-8618-3e122e3c4bb9',
            name: '青森県',
            code: '02',
            kanaName: 'アオモリケン',
            status: 'editing',
            statusLabel: '編集中',
            kanaEn: 'Aomori-ken',
          },
        ],
        meta: { totalCount: 47, page: 2, size: 2 },
      });
      // 地方未設定の場合、キーごと省略されること
      expect(result.data[1]).not.toHaveProperty('regionId');
      expect(result.data[1]).not.toHaveProperty('regionName');
    });
  });

  //--------------------------------------
  // GET /prefectures/covered
  //--------------------------------------
  describe('findCovered', () => {
    it('正常系: 店舗数(storeCount)付きで返却されること', async () => {
      const { createdAt, updatedAt, ...listReadModel } = buildDetailReadModel();
      void createdAt;
      void updatedAt;
      mockPrefecturesQueryService.findCovered.mockResolvedValue([
        { ...listReadModel, storeCount: 3 },
      ]);

      const result = await prefecturesController.findCovered();

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
  describe('findByCode / findOne', () => {
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

    it('正常系(code): 詳細が返却され、作成日時・更新日時はレスポンスに含まれないこと', async () => {
      mockPrefecturesQueryService.getDetailByCodeOrThrow.mockResolvedValue(
        buildDetailReadModel(),
      );

      const result = await prefecturesController.findByCode('13');

      expect(
        mockPrefecturesQueryService.getDetailByCodeOrThrow,
      ).toHaveBeenCalledWith('13');
      expect(result).toEqual(expectedDetail);
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('正常系(id): 詳細が返却されること', async () => {
      mockPrefecturesQueryService.getDetailByIdOrThrow.mockResolvedValue(
        buildDetailReadModel(),
      );

      const result = await prefecturesController.findOne(PREFECTURE_ID);

      expect(
        mockPrefecturesQueryService.getDetailByIdOrThrow,
      ).toHaveBeenCalledWith(PREFECTURE_ID);
      expect(result).toEqual(expectedDetail);
    });

    it('異常系(id): QueryServiceのNotFoundExceptionがそのままスローされること', async () => {
      mockPrefecturesQueryService.getDetailByIdOrThrow.mockRejectedValue(
        new NotFoundException('not found'),
      );

      await expect(
        prefecturesController.findOne(PREFECTURE_ID),
      ).rejects.toThrow(new NotFoundException('not found'));
    });
  });

  //--------------------------------------
  // POST /prefectures
  //--------------------------------------
  describe('create', () => {
    it('正常系: DTOがCommandに詰め替えられ、ユーザーIDとともにServiceに渡されること', async () => {
      mockPrefecturesService.create.mockResolvedValue(buildDomainWithId());

      const result = await prefecturesController.create(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          regionCode: '03',
        },
        req,
      );

      expect(mockPrefecturesService.create).toHaveBeenCalledWith(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          regionCode: '03',
        },
        USER_ID,
      );
      expect(result).toEqual(expectedDomainResponse);
    });
  });

  //--------------------------------------
  // PATCH /prefectures/:id
  //--------------------------------------
  describe('update', () => {
    it('正常系: 指定した項目だけがCommandに入り(未指定はundefined)、Serviceに渡されること', async () => {
      mockPrefecturesService.update.mockResolvedValue(
        buildDomainWithId({ name: '東京' }),
      );

      const result = await prefecturesController.update(
        PREFECTURE_ID,
        { name: '東京' },
        req,
      );

      expect(mockPrefecturesService.update).toHaveBeenCalledWith(
        PREFECTURE_ID,
        {
          code: undefined,
          name: '東京',
          kanaName: undefined,
          kanaEn: undefined,
          regionCode: undefined,
        },
        USER_ID,
      );
      expect(result).toEqual({ ...expectedDomainResponse, name: '東京' });
    });

    it('異常系: ドメイン例外(掲載中は更新不可)がそのままスローされること', async () => {
      mockPrefecturesService.update.mockRejectedValue(
        new PrefectureAlreadyPublishedException('東京都'),
      );

      await expect(
        prefecturesController.update(PREFECTURE_ID, { name: '東京' }, req),
      ).rejects.toThrow(new PrefectureAlreadyPublishedException('東京都'));
    });
  });

  //--------------------------------------
  // POST /prefectures/:id/publish, /unpublish, DELETE /prefectures/:id
  //--------------------------------------
  describe('publish / unpublish / remove', () => {
    it('正常系(publish): idとユーザーIDだけがServiceに渡され、掲載中のレスポンスが返却されること', async () => {
      mockPrefecturesService.publish.mockResolvedValue(
        buildDomainWithId({ status: PrefectureStatus.PUBLISHED }),
      );

      const result = await prefecturesController.publish(PREFECTURE_ID, req);

      expect(mockPrefecturesService.publish).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
      expect(result).toEqual({
        ...expectedDomainResponse,
        status: 'published',
        statusLabel: '反映中',
      });
    });

    it('異常系(publish): 地方未設定のドメイン例外がそのままスローされること', async () => {
      mockPrefecturesService.publish.mockRejectedValue(
        new PrefectureRegionNotAssignedException('東京都'),
      );

      await expect(
        prefecturesController.publish(PREFECTURE_ID, req),
      ).rejects.toThrow(new PrefectureRegionNotAssignedException('東京都'));
    });

    it('正常系(unpublish): idとユーザーIDだけがServiceに渡され、編集中のレスポンスが返却されること', async () => {
      mockPrefecturesService.unpublish.mockResolvedValue(buildDomainWithId());

      const result = await prefecturesController.unpublish(PREFECTURE_ID, req);

      expect(mockPrefecturesService.unpublish).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
      expect(result).toEqual(expectedDomainResponse);
    });

    it('正常系(remove): idとユーザーIDだけがServiceに渡され、停止中のレスポンスが返却されること', async () => {
      mockPrefecturesService.remove.mockResolvedValue(
        buildDomainWithId({ status: PrefectureStatus.SUSPENDED }),
      );

      const result = await prefecturesController.remove(PREFECTURE_ID, req);

      expect(mockPrefecturesService.remove).toHaveBeenCalledWith(
        PREFECTURE_ID,
        USER_ID,
      );
      expect(result).toEqual({
        ...expectedDomainResponse,
        status: 'suspended',
        statusLabel: '停止',
      });
    });

    it('異常系(remove): 店舗ありのドメイン例外がそのままスローされること', async () => {
      mockPrefecturesService.remove.mockRejectedValue(
        new PrefectureHasStoresException(PREFECTURE_ID),
      );

      await expect(
        prefecturesController.remove(PREFECTURE_ID, req),
      ).rejects.toThrow(new PrefectureHasStoresException(PREFECTURE_ID));
    });
  });
});

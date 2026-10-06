import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Region } from '../../regions/domain/regions.model';
import { RegionsQueryService } from '../../regions/query/regions.query.service';
import {
  PrefectureAlreadyEditedException,
  PrefectureAlreadyPublishedException,
  PrefectureHasStoresException,
  PrefectureRegionNotAssignedException,
} from '../domain/errors/prefectures.exceptions';
import { PREFECTURE_REPOSITORY_PORT } from '../domain/prefecture.repository.port';
import { PrefecturesDomainService } from '../domain/prefectures.domain.service';
import {
  Prefecture,
  PrefectureStatus,
  ReconstitutePrefectureProps,
} from '../domain/prefectures.model';
import { PrefecturesService } from './prefectures.service';

type PrefectureWithId = Prefecture & { id: string };

// Mock定義
// jest.Mocked<PrefectureRepositoryPort>だとメソッド扱いになり、expect(mock.save)が
// eslint(unbound-method)に抵触するため、型付きのjest.fnをプロパティとして定義する
const mockPrefectureRepository = {
  findByIdOrFail: jest.fn<Promise<PrefectureWithId>, [string]>(),
  findByCodeOrFail: jest.fn<Promise<PrefectureWithId>, [string]>(),
  save: jest.fn<Promise<PrefectureWithId>, [PrefectureWithId, string]>(),
};
const mockPrefecturesDomainService = {
  assertDeletable: jest.fn(),
};
const mockRegionsQueryService = {
  findByCodeOrFail: jest.fn(),
};

// テストデータ
const PREFECTURE_ID = '17b54147-b6ed-4d4e-a25f-4b632b0b444e';
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * 任意のstatusでPrefecture domain(ID付き)を作成するヘルパー
 */
const buildPrefectureWithId = (
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
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      ...overrides,
    }),
    { id: PREFECTURE_ID },
  );

/**
 * RegionsQueryService.findByCodeOrFail の戻り値(地方: 関東)
 */
const buildRegionWithId = (): Region & { id: string } =>
  Object.assign(
    Region.reconstitute({
      code: '03',
      name: '関東',
      kanaName: 'カントウ',
      kanaEn: 'kanto',
      status: 'published',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    }),
    { id: REGION_ID },
  );

/**
 * saveに渡された引数(domain)を取り出すヘルパー
 */
const savedDomain = (): PrefectureWithId =>
  mockPrefectureRepository.save.mock.calls[0][0];

describe('■■■ PrefecturesService(Application) test ■■■', () => {
  let prefecturesService: PrefecturesService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PrefecturesService,
        {
          provide: PREFECTURE_REPOSITORY_PORT,
          useValue: mockPrefectureRepository,
        },
        {
          provide: PrefecturesDomainService,
          useValue: mockPrefecturesDomainService,
        },
        { provide: RegionsQueryService, useValue: mockRegionsQueryService },
      ],
    }).compile();

    prefecturesService = module.get<PrefecturesService>(PrefecturesService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // saveは受け取ったdomainをそのまま返す
    mockPrefectureRepository.save.mockImplementation((domain) =>
      Promise.resolve(domain),
    );
  });

  //--------------------------------------
  // create test
  //--------------------------------------
  describe('create', () => {
    it('正常系: 編集中のdomainがregionId付き・id空文字でsaveに渡されること', async () => {
      mockRegionsQueryService.findByCodeOrFail.mockResolvedValue(
        buildRegionWithId(),
      );

      await prefecturesService.create(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
          regionCode: '03',
        },
        USER_ID,
      );

      expect(mockRegionsQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '03',
      );
      expect(mockPrefectureRepository.save).toHaveBeenCalledWith(
        expect.any(Prefecture),
        USER_ID,
      );
      const domain = savedDomain();
      expect(domain.id).toBe('');
      expect(domain.status).toBe(PrefectureStatus.EDITING);
      expect(domain.code).toBe('13');
      expect(domain.name).toBe('東京都');
      expect(domain.kanaName).toBe('トウキョウト');
      expect(domain.kanaEn).toBe('Tokyo-to');
      expect(domain.regionId).toBe(REGION_ID);
    });

    it('正常系: regionCode未指定の場合、地方未設定で作成され、RegionsQueryServiceは呼ばれないこと', async () => {
      await prefecturesService.create(
        {
          code: '13',
          name: '東京都',
          kanaName: 'トウキョウト',
          kanaEn: 'Tokyo-to',
        },
        USER_ID,
      );

      expect(mockRegionsQueryService.findByCodeOrFail).not.toHaveBeenCalled();
      expect(savedDomain().regionId).toBeUndefined();
    });

    it('異常系: regionCodeに該当する地方が存在しない場合、NotFoundExceptionをスローし、saveしないこと', async () => {
      mockRegionsQueryService.findByCodeOrFail.mockRejectedValue(
        new NotFoundException(
          'codeに関連するエリア情報が存在しません!! code: 99',
        ),
      );

      await expect(
        prefecturesService.create(
          {
            code: '13',
            name: '東京都',
            kanaName: 'トウキョウト',
            kanaEn: 'Tokyo-to',
            regionCode: '99',
          },
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // update test
  //--------------------------------------
  describe('update', () => {
    it('正常系: 指定した項目だけが更新されてsaveされること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId(),
      );

      await prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID);

      expect(mockPrefectureRepository.findByIdOrFail).toHaveBeenCalledWith(
        PREFECTURE_ID,
      );
      expect(mockRegionsQueryService.findByCodeOrFail).not.toHaveBeenCalled();
      const domain = savedDomain();
      expect(domain.id).toBe(PREFECTURE_ID);
      expect(domain.name).toBe('東京');
      expect(domain.code).toBe('13');
      expect(domain.regionId).toBe(REGION_ID);
    });

    it('正常系: regionCodeを指定した場合、regionIdに解決されて更新されること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId({ regionId: undefined }),
      );
      mockRegionsQueryService.findByCodeOrFail.mockResolvedValue(
        buildRegionWithId(),
      );

      await prefecturesService.update(
        PREFECTURE_ID,
        { regionCode: '03' },
        USER_ID,
      );

      expect(mockRegionsQueryService.findByCodeOrFail).toHaveBeenCalledWith(
        '03',
      );
      expect(savedDomain().regionId).toBe(REGION_ID);
    });

    it('異常系: 掲載中の場合、PrefectureAlreadyPublishedExceptionをスローし、saveしないこと', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId({ status: PrefectureStatus.PUBLISHED }),
      );

      await expect(
        prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID),
      ).rejects.toThrow(new PrefectureAlreadyPublishedException('東京都'));
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });

    it('異常系: 都道府県が存在しない場合、NotFoundExceptionをスローすること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        prefecturesService.update(PREFECTURE_ID, { name: '東京' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // publish test
  //--------------------------------------
  describe('publish', () => {
    it('正常系: 地方ありの編集中の都道府県が、掲載中になってsaveされること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId(),
      );

      const result = await prefecturesService.publish(PREFECTURE_ID, USER_ID);

      expect(result.status).toBe(PrefectureStatus.PUBLISHED);
      expect(mockPrefectureRepository.save).toHaveBeenCalledWith(
        expect.any(Prefecture),
        USER_ID,
      );
    });

    it('異常系: 地方が未設定の場合、PrefectureRegionNotAssignedExceptionをスローし、saveしないこと', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId({ regionId: undefined }),
      );

      await expect(
        prefecturesService.publish(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureRegionNotAssignedException('東京都'));
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // unpublish test
  //--------------------------------------
  describe('unpublish', () => {
    it('正常系: 掲載中の都道府県が、編集中になってsaveされること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId({ status: PrefectureStatus.PUBLISHED }),
      );

      const result = await prefecturesService.unpublish(PREFECTURE_ID, USER_ID);

      expect(result.status).toBe(PrefectureStatus.EDITING);
      expect(mockPrefectureRepository.save).toHaveBeenCalledTimes(1);
    });

    it('異常系: すでに編集中の場合、PrefectureAlreadyEditedExceptionをスローし、saveしないこと', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId(),
      );

      await expect(
        prefecturesService.unpublish(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureAlreadyEditedException('東京都'));
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });
  });

  //--------------------------------------
  // remove test
  //--------------------------------------
  describe('remove', () => {
    it('正常系: assertDeletableを通過した場合、停止中になってsaveされること', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId(),
      );
      mockPrefecturesDomainService.assertDeletable.mockResolvedValue(undefined);

      const result = await prefecturesService.remove(PREFECTURE_ID, USER_ID);

      expect(mockPrefecturesDomainService.assertDeletable).toHaveBeenCalledWith(
        PREFECTURE_ID,
      );
      expect(result.status).toBe(PrefectureStatus.SUSPENDED);
      expect(mockPrefectureRepository.save).toHaveBeenCalledTimes(1);
    });

    it('異常系: 店舗が紐づいている場合、PrefectureHasStoresExceptionをスローし、saveしないこと', async () => {
      mockPrefectureRepository.findByIdOrFail.mockResolvedValue(
        buildPrefectureWithId(),
      );
      mockPrefecturesDomainService.assertDeletable.mockRejectedValue(
        new PrefectureHasStoresException(PREFECTURE_ID),
      );

      await expect(
        prefecturesService.remove(PREFECTURE_ID, USER_ID),
      ).rejects.toThrow(new PrefectureHasStoresException(PREFECTURE_ID));
      expect(mockPrefectureRepository.save).not.toHaveBeenCalled();
    });
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prefecture as PrismaPrefecture } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prefecture,
  PrefectureStatus,
  ReconstitutePrefectureProps,
} from '../domain/prefectures.model';
import { PrefectureRepository } from './prefecture.repository';

// MockService定義
const mockPrismaService = {
  prefecture: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// テストデータ
const PREFECTURE_ID = '17b54147-b6ed-4d4e-a25f-4b632b0b444e';
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * Prismaのレコード(mock data)を作成するヘルパー
 */
const buildPrismaRecord = (
  overrides: Partial<PrismaPrefecture> = {},
): PrismaPrefecture => ({
  id: PREFECTURE_ID,
  code: '13',
  name: '東京都',
  kanaName: 'トウキョウト',
  status: 'editing',
  kanaEn: 'Tokyo-to',
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  regionId: REGION_ID,
  userId: USER_ID,
  ...overrides,
});

/**
 * Prefecture domain(ID付き)を作成するヘルパー
 * idが空文字の場合は新規作成扱い
 */
const buildDomainWithId = (
  id: string,
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
    { id },
  );

describe('□□□ Prefecture Repository TEST □□□', () => {
  let prefectureRepository: PrefectureRepository;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PrefectureRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    prefectureRepository =
      module.get<PrefectureRepository>(PrefectureRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findByIdOrFail test
  //--------------------------------------
  describe('findByIdOrFail test', () => {
    it('正常系: Prismaデータが Prefecture domain + id に変換されること', async () => {
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(buildPrismaRecord());

      const result = await prefectureRepository.findByIdOrFail(PREFECTURE_ID);

      expect(result).toBeInstanceOf(Prefecture);
      expect(result.id).toBe(PREFECTURE_ID);
      expect(result.toSnapshot()).toEqual({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        status: 'editing',
        regionId: REGION_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      expect(
        jest.spyOn(prismaService.prefecture, 'findUnique'),
      ).toHaveBeenCalledWith({ where: { id: PREFECTURE_ID } });
    });

    it('正常系: regionIdがnullの場合、domainではundefinedになること', async () => {
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(buildPrismaRecord({ regionId: null }));

      const result = await prefectureRepository.findByIdOrFail(PREFECTURE_ID);

      expect(result.regionId).toBeUndefined();
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        prefectureRepository.findByIdOrFail(PREFECTURE_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連する都道府県情報が存在しません!! prefectureId: ${PREFECTURE_ID}`,
        ),
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail test
  //--------------------------------------
  describe('findByCodeOrFail test', () => {
    it('正常系: Prismaデータが Prefecture domain + id に変換されること', async () => {
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(buildPrismaRecord());

      const result = await prefectureRepository.findByCodeOrFail('13');

      expect(result.id).toBe(PREFECTURE_ID);
      expect(result.code).toBe('13');
      expect(result.name).toBe('東京都');
      expect(
        jest.spyOn(prismaService.prefecture, 'findUnique'),
      ).toHaveBeenCalledWith({ where: { code: '13' } });
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      jest
        .spyOn(prismaService.prefecture, 'findUnique')
        .mockResolvedValue(null);

      await expect(prefectureRepository.findByCodeOrFail('99')).rejects.toThrow(
        new NotFoundException(
          'codeに関連する都道府県情報が存在しません!! code: 99',
        ),
      );
    });
  });

  //--------------------------------------
  // save test
  //--------------------------------------
  describe('save test', () => {
    describe('新規作成(idが空)', () => {
      it('正常系: createが呼ばれ、地方ありの場合はregionをconnectすること', async () => {
        jest
          .spyOn(prismaService.prefecture, 'create')
          .mockResolvedValue(buildPrismaRecord());

        const result = await prefectureRepository.save(
          buildDomainWithId(''),
          USER_ID,
        );

        expect(result.id).toBe(PREFECTURE_ID);
        expect(
          jest.spyOn(prismaService.prefecture, 'create'),
        ).toHaveBeenCalledWith({
          data: {
            code: '13',
            name: '東京都',
            kanaName: 'トウキョウト',
            kanaEn: 'Tokyo-to',
            status: 'editing',
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            region: { connect: { id: REGION_ID } },
          },
        });
        expect(
          jest.spyOn(prismaService.prefecture, 'update'),
        ).not.toHaveBeenCalled();
      });

      it('正常系: 地方なしの場合、regionキー自体を含めないこと', async () => {
        jest
          .spyOn(prismaService.prefecture, 'create')
          .mockResolvedValue(buildPrismaRecord({ regionId: null }));

        await prefectureRepository.save(
          buildDomainWithId('', { regionId: undefined }),
          USER_ID,
        );

        const createSpy = jest.spyOn(prismaService.prefecture, 'create');
        const args = createSpy.mock.calls[0][0];
        expect(args.data).not.toHaveProperty('region');
      });
    });

    describe('更新(idあり)', () => {
      it('正常系: updateがidで呼ばれ、地方ありの場合はregionをconnectすること', async () => {
        jest
          .spyOn(prismaService.prefecture, 'update')
          .mockResolvedValue(buildPrismaRecord());

        const result = await prefectureRepository.save(
          buildDomainWithId(PREFECTURE_ID),
          USER_ID,
        );

        expect(result.id).toBe(PREFECTURE_ID);
        expect(
          jest.spyOn(prismaService.prefecture, 'update'),
        ).toHaveBeenCalledWith({
          where: { id: PREFECTURE_ID },
          data: {
            code: '13',
            name: '東京都',
            kanaName: 'トウキョウト',
            kanaEn: 'Tokyo-to',
            status: 'editing',
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            region: { connect: { id: REGION_ID } },
          },
        });
        expect(
          jest.spyOn(prismaService.prefecture, 'create'),
        ).not.toHaveBeenCalled();
      });

      it('正常系: 地方なしの場合、regionをdisconnectすること', async () => {
        jest
          .spyOn(prismaService.prefecture, 'update')
          .mockResolvedValue(buildPrismaRecord({ regionId: null }));

        await prefectureRepository.save(
          buildDomainWithId(PREFECTURE_ID, { regionId: undefined }),
          USER_ID,
        );

        const updateSpy = jest.spyOn(prismaService.prefecture, 'update');
        const args = updateSpy.mock.calls[0][0];
        expect(args.data.region).toEqual({ disconnect: true });
      });
    });

    describe('異常系', () => {
      it('codeが重複(P2002)した場合、ConflictExceptionをスローすること', async () => {
        const mockP2002Error = new PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`code`)',
          {
            code: 'P2002',
            clientVersion: 'test-version',
            meta: { target: ['code'] },
          },
        );
        jest
          .spyOn(prismaService.prefecture, 'create')
          .mockRejectedValue(mockP2002Error);

        await expect(
          prefectureRepository.save(buildDomainWithId(''), USER_ID),
        ).rejects.toThrow(
          new ConflictException('指定された code は既に存在します。'),
        );
      });

      it('P2002以外のエラーの場合、元のエラーをそのままスローすること', async () => {
        jest
          .spyOn(prismaService.prefecture, 'update')
          .mockRejectedValue(new Error('Database connection failed'));

        await expect(
          prefectureRepository.save(buildDomainWithId(PREFECTURE_ID), USER_ID),
        ).rejects.toThrow(new Error('Database connection failed'));
      });
    });
  });
});

import { Test } from '@nestjs/testing';
import {
  City,
  CityStatus,
  ReconstituteCityProps,
} from '../../cities/domain/cities.model';
import { PrismaService } from '../../prisma/prisma.service';
import { DistrictsDomainService } from './districts.domain.service';
import {
  District,
  DistrictStatus,
  ReconstituteDistrictProps,
} from './districts.model';
import {
  DistrictCityNotPublishedException,
  DistrictHasStoresException,
} from './errors/districts.exceptions';

// MockService定義
const mockPrismaService = {
  store: {
    count: jest.fn(),
  },
};

describe('■■■ District Domain Service test ■■■', () => {
  // DIモジュール
  let districtsDomainService: DistrictsDomainService;
  let prismaService: PrismaService;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    console.log('beforeAll: モジュールのセットアップ（DIなど）');

    const module = await Test.createTestingModule({
      providers: [
        DistrictsDomainService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    // テスト対象モジュール
    districtsDomainService = module.get<DistrictsDomainService>(
      DistrictsDomainService,
    );
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
    it('正常系: City(都市)が公開中の場合は正常終了する', () => {
      // 引数
      const district = buildMockDistrict();
      const city = buildMockCity();

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      districtsDomainService.assertPublishable(district, city);
      // 上記でも正常系のテストは検証可能だが、以下のようにexpect()を使った検証も可能。
      expect(() =>
        districtsDomainService.assertPublishable(district, city),
      ).not.toThrow();
    });

    it('異常系: City(都市)が公開中以外の場合、DistrictCityNotPublishedExceptionをスローする', () => {
      // 引数
      const district = buildMockDistrict();
      const city = buildMockCity({
        // ステータス: 公開中以外
        status: CityStatus.SUSPENDED,
      } satisfies Partial<ReconstituteCityProps>);

      // test対象service呼び出し：Exception確認
      // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
      //   districtsDomainService.assertPublishable() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
      expect(() =>
        districtsDomainService.assertPublishable(district, city),
      ).toThrow(
        new DistrictCityNotPublishedException(district.name, city.name),
      );
    });

    // テスト補強：ステータスのバリエーションテスト
    it.each([CityStatus.EDITING, CityStatus.SUSPENDED])(
      '異常系: City(都市)のステータスが %S の場合、DistrictCityNotPublishedExceptionをスローする',
      (status) => {
        // 引数
        const district = buildMockDistrict();
        const city = buildMockCity({
          // ステータス: 公開中以外
          status: status,
        } satisfies Partial<ReconstituteCityProps>);

        // test対象service呼び出し：Exception確認
        // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
        //   districtsDomainService.assertPublishable() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
        expect(() =>
          districtsDomainService.assertPublishable(district, city),
        ).toThrow(
          new DistrictCityNotPublishedException(district.name, city.name),
        );
      },
    );
  });

  //--------------------------------------
  // assertDeletable test
  //--------------------------------------
  describe('assertDeletable', () => {
    it('正常系: Store(店舗)が0件の場合は正常終了する', async () => {
      // prisma mock data set
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(0);

      // 引数
      const district = buildMockDistrict();

      // test対象service呼び出し： 戻り値はなし（void) なので正常終了することを確認
      await districtsDomainService.assertDeletable(district);

      // 上記でも正常系のテストは検証可能だが、以下のようにexpect()を使った検証も可能。
      // assertDeletable は Promise を返すので、resolves で「正常に終わった(reject されなかった)」ことを検証する
      // (void を返すので、正常に終われば値は undefined)
      await expect(
        districtsDomainService.assertDeletable(district),
      ).resolves.toBeUndefined();

      // Prismaへの引数検証
      // 指定した地区ID（districtId）に紐づく店舗だけを数えていること
      expect(jest.spyOn(prismaService.store, 'count')).toHaveBeenCalledWith({
        where: { districtId: district.id },
      });
    });

    it('異常系: Store(店舗)が1件以上の場合、DistrictHasStoresExceptionをスローする', async () => {
      // prisma mock data set
      jest.spyOn(prismaService.store, 'count').mockResolvedValue(1);

      // 引数
      const district = buildMockDistrict();

      // test対象service呼び出し：Exception確認
      // ・.rejects: Promise が「失敗(reject)」したときの例外を取り出して検証する
      // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
      //   districtsDomainService.assertPublishable() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
      await expect(
        districtsDomainService.assertDeletable(district),
      ).rejects.toThrow(new DistrictHasStoresException(district.name));
    });

    // エラーを隠蔽・変換せずに透過的に投げているか
    it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
      // prisma mock data 作成： count がエラーになる(DB接続エラーを想定)
      // mockRejectedValue: Promise が失敗(reject)するように設定する
      jest
        .spyOn(prismaService.store, 'count')
        .mockRejectedValue(new Error('Database connection failed'));

      // 引数
      const district = buildMockDistrict();

      // test対象service呼び出し、結果検証
      // DomainServiceはDBのエラーを握りつぶしたり、別の例外に変換したりせず、そのまま投げること
      // (握りつぶすと「店舗0件」と誤判定して削除できてしまう危険があるため)
      await expect(
        districtsDomainService.assertDeletable(district),
      ).rejects.toThrow(new Error('Database connection failed'));
    });
  });
});

const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const DISTRICT_ID = '5b6c7d8e-9f01-4a2b-8c3d-4e5f60718293';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * District domain mock data を再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
 *
 * 基本形は銀座を設定している。
 * 引数で一部の項目だけを上書きできる。引数なしの場合は基本型の銀座を返す。
 *
 * @param overrides 上書き対象項目
 * @returns District domain mock data
 */
const buildMockDistrict = (
  overrides: Partial<ReconstituteDistrictProps> = {},
): District =>
  District.reconstitute({
    id: DISTRICT_ID,
    code: '00001',
    name: '銀座',
    kanaName: 'ギンザ',
    slug: 'ginza',
    sortOrder: 1,
    status: DistrictStatus.PUBLISHED,
    cityId: CITY_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  } satisfies ReconstituteDistrictProps);

/**
 * City domain mock data を再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
 *
 * 基本形は東京を設定している。
 * 引数で一部の項目だけを上書きできる。引数なしの場合は基本型の東京を返す。
 *
 * @param overrides 上書き対象項目
 * @returns City domain mock data
 */
const buildMockCity = (overrides: Partial<ReconstituteCityProps> = {}): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '0001',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.PUBLISHED,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  } satisfies ReconstituteCityProps);

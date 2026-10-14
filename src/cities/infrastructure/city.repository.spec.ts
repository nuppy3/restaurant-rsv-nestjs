import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { City as PrismaCity } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import {
  City,
  CityStatus,
  ReconstituteCityProps,
} from '../domain/cities.model';
import { Prisma } from './../../../generated/prisma/index.d';
import { CityRepository } from './city.repository';

// City Repository(Infrastructure層)のテスト
// Repositoryは PrismaService を使ってDBに読み書きする。テストでは本物のDBを使わず、
// PrismaService の city.findUnique / city.upsert だけをモックにして、
// 「Prismaに何を渡したか」「Prismaの戻り値をdomainに正しく変換したか」を検証する。

// MockService定義
// saveはupsert1本で作成・更新を行うため、create / update ではなく upsert をモックする
const mockPrismaService = {
  city: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('□□□ City Repository TEST □□□', () => {
  let cityRepository: CityRepository;
  // DIされたPrismaService(中身は上のmockPrismaService)。jest.spyOn()の対象にする
  let prismaService: PrismaService;

  // 前処理: テスト全体の前に1回だけ実行(DIのセットアップ)
  // PrismaServiceをモックに差し替えて、CityRepositoryを生成する
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CityRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    cityRepository = module.get<CityRepository>(CityRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  // 前処理: 各テストの前に毎回実行
  // 前のテストで設定したモックの戻り値・呼び出し記録をリセットする
  beforeEach(() => {
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findByIdOrFail test
  //--------------------------------------
  describe('findByIdOrFail test', () => {
    it('正常系: Prismaデータが City domain(idを含む)に変換されること', async () => {
      // prisma mock data 作成: DBに東京のレコードがある
      jest
        .spyOn(prismaService.city, 'findUnique')
        .mockResolvedValue(buildPrismaMockRecord());

      // test対象repository呼び出し
      const result = await cityRepository.findByIdOrFail(CITY_ID);

      // 期待値
      const expectded = {
        id: CITY_ID,
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        status: 'editing',
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      };

      // 検証: City domainのインスタンスが返ること
      expect(result).toBeInstanceOf(City);

      // 検証: CityドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      //      プロパティをすべて持っているか、プロパティ値が正しいか
      //.     → が、以下のようにsnapshotでの検証もアリだね
      // 検証: DBの値がそのままdomainに復元されていること(idも含む)
      expect(result.toSnapshot()).toEqual(expectded);
      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      expect(result).toMatchObject(expectded);

      // ⭐️以下もtoMatchObjectでの検証と同じ検証ができる。
      // objectContaining()にてプレーンなオブジェクトでの比較検証を行うのが定石
      expect(result).toEqual(expect.objectContaining(expectded));

      // 検証: 引数チェック
      expect(jest.spyOn(prismaService.city, 'findUnique')).toHaveBeenCalledWith(
        { where: { id: CITY_ID } },
      );
    });

    it('正常系: Prismaデータの任意項目がnullの場合、domainではundefinedに変換されること', async () => {
      // prisma mock data 作成: 都道府県が未設定(null)のレコード
      const prismaMockData = buildPrismaMockRecord({ prefectureId: null });
      jest
        .spyOn(prismaService.city, 'findUnique')
        .mockResolvedValue(prismaMockData);

      // test対象repository呼び出し
      const result = await cityRepository.findByIdOrFail(CITY_ID);

      // 検証: DBのnullが、domainではundefinedに変換されていること(Mapperの ?? undefined)
      expect(result.prefectureId).toBeUndefined();
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 見つからない(findUniqueはnullを返す)
      jest.spyOn(prismaService.city, 'findUnique').mockResolvedValue(null);

      // test対象repository呼び出し、結果検証: 404の例外になること
      await expect(cityRepository.findByIdOrFail(CITY_ID)).rejects.toThrow(
        new NotFoundException(
          `idに関連する都市情報が存在しません!! cityId: ${CITY_ID}`,
        ),
      );
    });
  });

  //--------------------------------------
  // findByCodeOrFail test
  //--------------------------------------
  describe('findByCodeOrFail test', () => {
    it('正常系: Prismaデータが City domain(idを含む)に変換されること', async () => {
      // prisma mock data 作成
      jest
        .spyOn(prismaService.city, 'findUnique')
        .mockResolvedValue(buildPrismaMockRecord());

      // test対象repository呼び出し
      const result = await cityRepository.findByCodeOrFail('001');

      // 期待値
      const expectded = {
        id: CITY_ID,
        code: '001',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        status: 'editing',
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      };

      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      expect(result).toMatchObject(expectded);

      // 検証: 引数チェック
      expect(jest.spyOn(prismaService.city, 'findUnique')).toHaveBeenCalledWith(
        { where: { code: '001' } },
      );
    });

    it('異常系: 該当データが存在しない場合、NotFoundExceptionをスローすること', async () => {
      // prisma mock data 作成: 見つからない
      jest.spyOn(prismaService.city, 'findUnique').mockResolvedValue(null);

      // test対象repository呼び出し、結果検証
      await expect(cityRepository.findByCodeOrFail('999')).rejects.toThrow(
        new NotFoundException(
          'codeに関連する都市情報が存在しません!! code: 999',
        ),
      );
    });
  });

  //--------------------------------------
  // save test
  //--------------------------------------
  // saveはupsert(where: id)で、DBに同じidが無ければcreate、あればupdateになる。
  // どちらになるかはDB側で決まるため、ここでは「upsertに渡す引数(where / create / update)」を検証する
  describe('save test', () => {
    describe('正常系', () => {
      it('Cityデータ(全項目)が正しくPrismaに連携され、PrismaCityが City domain(idを含む)に変換されること', async () => {
        // prisma mock data 作成: upsert後のレコード
        jest
          .spyOn(prismaService.city, 'upsert')
          .mockResolvedValue(buildPrismaMockRecord());

        // test対象repository呼び出し: save対象のdomainはreconstituteでもcreateNewでもなんでもいい)
        const result = await cityRepository.save(buildDomain(), USER_ID);

        // 期待値
        const expectded = {
          id: CITY_ID,
          code: '001',
          name: '東京',
          kanaName: 'トウキョウ',
          slug: 'tokyo',
          status: 'editing',
          sortOrder: 1,
          prefectureId: PREFECTURE_ID,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        };

        // 検証: DBのレコードがdomainに変換されて返ること
        expect(result).toBeInstanceOf(City);
        // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
        expect(result).toMatchObject(expectded);

        // 検証: upsertの引数チェック
        expect(jest.spyOn(prismaService.city, 'upsert')).toHaveBeenCalledWith({
          // where: domainが持つid(作成か更新かの判定に使う)
          where: { id: CITY_ID },
          // create: domainで採番したidをそのまま保存する(DBの@default(uuid())は使わない)
          create: {
            id: CITY_ID,
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            status: 'editing',
            sortOrder: 1,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            prefecture: { connect: { id: PREFECTURE_ID } },
          } satisfies Prisma.CityCreateInput,
          // update: idは識別子なので更新対象に含めない。createdAtも更新しない
          update: {
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            status: 'editing',
            sortOrder: 1,
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            prefecture: { connect: { id: PREFECTURE_ID } },
          } satisfies Prisma.CityUpdateInput,
        });
      });

      it('都道府県なしの場合(任意項目なし)、createにはprefectureキー自体を含めず、updateではprefectureをdisconnectすること', async () => {
        // prisma mock data 作成: 都道府県が未設定のレコード
        jest
          .spyOn(prismaService.city, 'upsert')
          .mockResolvedValue(buildPrismaMockRecord({ prefectureId: null }));

        // test対象repository呼び出し: 都道府県が未設定のdomainを保存する
        await cityRepository.save(
          buildDomain({ prefectureId: undefined }),
          USER_ID,
        );

        // 引数チェック： 以下でもいいんだけど、mock.calles[0][0]での引数取得・チェックは
        //              個人的にわかりづらいので、やめた。
        //
        // upsertに渡された引数を取り出す(mock.calls[0][0] = 1回目の呼び出しの1番目の引数)
        // const upsertSpy = jest.spyOn(prismaService.city, 'upsert');
        // const args = upsertSpy.mock.calls[0][0];
        // // 検証(create): 新規作成なので、紐づけが無ければprefecture自体を指定しない
        // expect(args.create).not.toHaveProperty('prefecture');
        // // 検証(update): 既存の紐づけを外すためにdisconnectする
        // expect(args.update.prefecture).toEqual({ disconnect: true });

        // 検証: upsertの引数チェック
        expect(jest.spyOn(prismaService.city, 'upsert')).toHaveBeenCalledWith({
          // where: domainが持つid(作成か更新かの判定に使う)
          where: { id: CITY_ID },
          // create: domainで採番したidをそのまま保存する(DBの@default(uuid())は使わない)
          create: {
            id: CITY_ID,
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            status: 'editing',
            sortOrder: 1,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            // prefecture: { connect: { id: PREFECTURE_ID } },
          } satisfies Prisma.CityCreateInput,
          // update: idは識別子なので更新対象に含めない。createdAtも更新しない
          update: {
            code: '001',
            name: '東京',
            kanaName: 'トウキョウ',
            slug: 'tokyo',
            status: 'editing',
            sortOrder: 1,
            updatedAt: UPDATED_AT,
            user: { connect: { id: USER_ID } },
            prefecture: { disconnect: true },
          } satisfies Prisma.CityUpdateInput,
        });
      });
    });

    describe('異常系', () => {
      // it.each: 一意制約(@unique)の項目ごとに同じテストを繰り返す
      // (テスト名の %s に項目名が入る → code / slug の2件のテストになる)
      it.each(['code', 'slug'])(
        '%sが重複(P2002)した場合、ConflictExceptionをスローすること',
        async (field) => {
          // prisma mock data 作成: 一意制約違反のエラー(meta.targetに重複した項目名が入る)
          const mockP2002Error = new PrismaClientKnownRequestError(
            `Unique constraint failed on the fields: (\`${field}\`)`,
            {
              code: 'P2002',
              clientVersion: 'test-version',
              meta: { target: [field] },
            },
          );
          jest
            .spyOn(prismaService.city, 'upsert')
            .mockRejectedValue(mockP2002Error);

          // test対象repository呼び出し、結果検証: 重複した項目名入りの409になること
          await expect(
            cityRepository.save(buildDomain(), USER_ID),
          ).rejects.toThrow(
            new ConflictException(`指定された ${field} は既に存在します。`),
          );
        },
      );

      it('P2002以外のエラーの場合、元のエラーをそのままスローすること', async () => {
        // prisma mock data 作成: DB接続エラーなど
        jest
          .spyOn(prismaService.city, 'upsert')
          .mockRejectedValue(new Error('Database connection failed'));

        // test対象repository呼び出し、結果検証: 握りつぶさず、同じエラーが投げられること
        await expect(
          cityRepository.save(buildDomain(), USER_ID),
        ).rejects.toThrow(new Error('Database connection failed'));
      });
    });
  });
});

// テストデータ
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * Prismaのレコード(mock data)を作成するヘルパー（mock data 作成）
 * Prisma.city.findUnique / upsert の戻り値(DBの1行)の代わりに使う
 * 基本形は「編集中・都道府県(東京都)ありの東京」。引数で一部の項目だけを上書きできる。
 */
const buildPrismaMockRecord = (
  overrides: Partial<PrismaCity> = {},
): PrismaCity => ({
  id: CITY_ID,
  code: '001',
  name: '東京',
  kanaName: 'トウキョウ',
  slug: 'tokyo',
  status: 'editing',
  sortOrder: 1,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  prefectureId: PREFECTURE_ID,
  userId: USER_ID,
  ...overrides,
});

/**
 * City domainを作成するヘルパー
 * save() に渡すdomainの代わりに使う
 * domain自身がidを持つため、reconstituteにidを渡すだけでよい(Object.assignでの後付けは不要)
 * domainはreconstituteでもcreateNewでもなんでもいいが、reconstituteを採用
 */
const buildDomain = (overrides: Partial<ReconstituteCityProps> = {}): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '001',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.EDITING,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  });

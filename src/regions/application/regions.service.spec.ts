import { ConflictException, NotFoundException } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
    RegionAlreadyEditedException,
    RegionAlreadyPublishedException,
    RegionAlreadySuspendedException,
} from '../domain/errors/regions.exceptions';
import {
    REGION_REPOSITORY_PORT,
    RegionRepositoryPort,
} from '../domain/region.repository.port';
import { RegionsDomainService } from '../domain/regions.domain.service';
import {
    ReconstituteRegionProps,
    Region,
    RegionState,
    RegionStatus,
} from '../domain/regions.model';
import { PublishRegionDto } from '../presentation/rest/dto/publish-region.dto';
import { CreateRegionDto } from '../presentation/rest/dto/region.dto';
import { UnpublishRegionDto } from '../presentation/rest/dto/unpublish-region.dto';
import { UpdateRegionDto } from '../presentation/rest/dto/update-region.dto';
import { RegionsService } from './regions.service';

// MockService定義
const mockPrismaService = {
  region: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

// MockRepository定義
const mockRegionRepository = {
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  save: jest.fn(),
} as jest.Mocked<RegionRepositoryPort>; // as jest.Mocked<>はなくてもいいが、型安全に

// MockRegionsDomainService定義
const mockRegionsDomainService = {
  assertPublishable: jest.fn(),
  assertUnpublishable: jest.fn(),
  assertDeletable: jest.fn(),
};

describe('■■■ Region test ■■■', () => {
  // DIモジュール
  let regionsService: RegionsService;
  // ⭐️prismaはApplication Serviceからは呼ばない(repository経由)
  // let prismaService: PrismaService;
  // RegionRepositoryをinterface化したのでコメント
  // let regionRepository: RegionRepository;
  let regionRepository: RegionRepositoryPort;
  let regionsDomainService: RegionsDomainService;

  // 前処理: テスト全体の前に1回だけ実行される
  beforeAll(async () => {
    console.log('beforeAll: モジュールのセットアップ（DIなど）');

    // @Module({
    //   imports: [PrismaModule],
    //   controllers: [RegionsController],
    //   providers: [RegionsService, RegionRepository, RegionsDomainService],
    // })

    const module = await Test.createTestingModule({
      // ⭐️ConfigServiceについて
      // 本番では app.module.ts の ConfigModule.forRoot({ isGlobal: true }) によって
      // 解決されます。しかし、Test.createTestingModule() は AppModule を自動的には
      // 読み込まないため、グローバル設定もテストには引き継がれません。
      // RegionsModule内部のRegionsQueryServiceがConfigServiceを要求するため、
      // app.module.tsと同様にConfigModule.forRoot({ isGlobal: true })を含める
      // (isGlobalはコンパイルされたモジュールツリー全体に効くため、ネストされた
      // RegionsModule内部にもConfigServiceが行き渡る)
      //
      // → が、このテストモジュールのprovidersにはRegionsQueryServiceが含まれておらず、
      // RegionsService自体もConfigServiceに依存していないため、ConfigModuleは不要のためコメント。
      // imports: [
      //   ConfigModule.forRoot({
      //     isGlobal: true,
      //     envFilePath: '.env',
      //   }),
      // ],
      providers: [
        RegionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        // Repositoryはinterfaceを実装しているのでtoken(=REGION_REPOSITORY_PORT)で指定
        {
          provide: REGION_REPOSITORY_PORT,
          useValue: mockRegionRepository,
        },
        { provide: RegionsDomainService, useValue: mockRegionsDomainService },
      ],
    }).compile();

    regionsService = module.get<RegionsService>(RegionsService);
    // prismaService = module.get<PrismaService>(PrismaService);
    regionRepository = module.get<RegionRepositoryPort>(REGION_REPOSITORY_PORT);
    regionsDomainService =
      module.get<RegionsDomainService>(RegionsDomainService);
  });

  // 前処理: 各テストケースの前に毎回実行
  beforeEach(() => {
    console.log('beforeEach: モックをリセット');
    // jest.clearAllMocks();
    jest.resetAllMocks();
  });

  //--------------------------------------
  // findAll test → Query Serviceへ移動済み
  //--------------------------------------
  // describe('findAll', () => {
  //   it('正常系: Regionドメイン配列(全項目)を返却する', async () => {
  //     // prisma mock data 作成
  //     const mockData = createPrismaMockData();
  //     jest.spyOn(prismaService.region, 'findMany').mockResolvedValue(mockData);

  //     // test対象service呼び出し
  //     const results = await regionsService.findAll();

  //     // 検証: プロパティのみ検証
  //     const expectedData = createExpectedData();
  //     // 以下のexpect.objectContaining(expectedData)での比較だと_codeとcodeでの
  //     // 比較をしてしまうのでNG
  //     // expect(results).toEqual(expect.objectContaining(expectedData));

  //     // toMatchObjectでの比較はgetterをベースに比較してくれる
  //     expect(results).toMatchObject(expectedData);
  //   });

  //   it('正常系: Regionデータが０件の場合は空配列を返却する', async () => {
  //     // prisma mock data 作成
  //     jest.spyOn(prismaService.region, 'findMany').mockResolvedValue([]);
  //     // test対象service呼び出し
  //     const results = await regionsService.findAll();
  //     // 検証
  //     expect(results).toEqual([]);
  //   });

  //   // エラーを隠蔽・変換せずに透過的に投げているか
  //   it('異常系: エラーが発生した場合、元のエラーをそのままスローする(DB接続エラー)', async () => {
  //     // PrismaClientKnownRequestError以外の一般エラーを作成
  //     const mockGenericError = new Error('Database connection failed');

  //     // モックの実装: create()が一般のエラーを投げるように設定
  //     jest
  //       .spyOn(prismaService.region, 'findMany')
  //       .mockRejectedValue(mockGenericError);

  //     // 元のエラー（Generic Error）がそのままスローされることをテスト
  //     await expect(regionsService.findAll()).rejects.toThrow(Error);
  //     await expect(regionsService.findAll()).rejects.toThrow(
  //       'Database connection failed',
  //     );
  //   });
  // });

  //--------------------------------------
  // create test
  //--------------------------------------
  describe('create', () => {
    // 共通引数：ユーザーID
    const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

    it('正常系： Region情報を登録(全項目)し、Regionドメイン(＋id)を返却する', async () => {
      // servic 引数 (dto) 作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstitute()を使う（BP)
      const mockRegion = Region.reconstitute({
        // id: '106509f2-0ba4-447c-8a98-473aa26e457a',
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: 'published',
        kanaEn: 'okinawa',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies Region;

      // Region + id
      const repositoryMockData = Object.assign(mockRegion, {
        id: '106509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // repositoryにmockdataをセット
      jest
        .spyOn(regionRepository, 'save')
        .mockResolvedValue(repositoryMockData);

      // テスト対象service呼び出し
      const result = await regionsService.create(dto, userId);

      // 期待値
      // Regionドメインのカプセル化(getter()など追加)のため、プレーンなオブジェクトではないため
      // satisfiesでの型チェックはできないし、しない。
      const expectedData = {
        id: '106509f2-0ba4-447c-8a98-473aa26e457a',
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: 'published',
        kanaEn: 'okinawa',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        // } satisfies Region & { id: string };
      };

      // 検証
      // Regionを完全カプセル化したことにより、getterなどのfunctionが含まれているので
      // toEqualでの完全一致比較だとNGになる。
      // → objectContaining()にてプレーンなオブジェクトでの比較検証を行うのが定石
      // expect(result).toEqual(expectedData);
      expect(result).toEqual(expect.objectContaining(expectedData));
      // ちなみに、以下でもプレーンオブエクト（プロパティとその値のみチェック）の判定が可能であり
      // 上記とほぼ同じらしい。のでどちらか一方の検証をすればOK
      expect(result).toMatchObject(expectedData);
    });

    // 任意項目なし
    it('正常系： Region情報を登録(任意項目除外)し、Regionドメインを返却する', () => {
      // servic 引数 作成
      // prisma mock data 作成
      // テスト対象service呼び出し
      // 検証
    });

    // 任意項目なし
    it('正常系： Region情報を登録(任意項目をundefined)し、Regionドメインを返却する', () => {
      // servic 引数 作成
      // prisma mock data 作成
      // テスト対象service呼び出し
      // 検証
    });

    //--------------------
    // エラーケースのテスト
    //--------------------
    it('異常系①： Region情報を登録(全項目)し、一意制約(P2002)が発生', async () => {
      // servic 引数 (dto) 作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // prisma P2002 error mock data 作成
      // PrismaClientKnownRequestError：クエリエンジンがリクエストに関連する既知のエラー (たとえば、一意制約違反)
      // を返す場合、Prisma Client は例外をスローします。
      // 一意制約、アクセス不可などは当該Errorは同じで、codeが違うだけ。
      const mockError = new ConflictException(
        '指定された code は既に存在します。',
      );

      // repositoryが、P2002 エラーを返すように設定
      // Errorを返却させたい場合はmockRejectedValue()でcreateのPrisma<Region & {id:string}>の
      // 返却をアンラップして、Errorを返すようにする）
      jest.spyOn(regionRepository, 'save').mockRejectedValue(mockError);

      // テスト対象service呼び出し、検証
      // ConflictExceptionがスローされることをテスト
      await expect(regionsService.create(dto, userId)).rejects.toThrow(
        ConflictException,
      );

      // ConflictExceptionのmessage 検証
      await expect(regionsService.create(dto, userId)).rejects.toThrow(
        '指定された code は既に存在します。',
      );
    });

    it('異常系②： 一意制約(P2002)以外のPrismaエラーが発生した場合、そのまま元のエラーを伝搬(スロー)する', async () => {
      // servic 引数 (dto) 作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // prisma P2000(P2002以外のエラー) error mock data 作成
      const mockP2000Error = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`code`)',
        {
          code: 'P2000',
          clientVersion: 'test-version',
        },
      );

      // repositoryのmock(Error)を設定
      jest.spyOn(regionRepository, 'save').mockRejectedValue(mockP2000Error);

      // テスト対象service呼び出し、結果を検証
      await expect(regionsService.create(dto, userId)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );

      // Errorに以下が含まれることを検証（このテストはなくてもいいか）
      // await expect(regionsService.create(dto)).rejects.toHaveProperty(
      //   'code',
      //   'P2000',
      // );
    });

    it('異常系③： その他エラーのテスト: 元のエラーをそのまま伝搬(スロー)する', async () => {
      // servic 引数 (dto) 作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // PrismaClientKnownRequestError以外の一般エラーを作成
      const mockGenericError = new Error('Database connection failed');

      // モックの実装: create()が一般のエラーを投げるように設定
      jest.spyOn(regionRepository, 'save').mockRejectedValue(mockGenericError);

      // 元のエラー（Generic Error）がそのまま再スローされることをテスト
      await expect(regionsService.create(dto, userId)).rejects.toThrow(Error);
      await expect(regionsService.create(dto, userId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  //--------------------------------------
  // update() test
  //--------------------------------------
  describe('update Test', () => {
    // mock対象:
    // ①regionRepository.findByIdOrFail()
    // ②egionRepository.save()
    it('正常系： 指定idに関連するRegion情報を更新し、Regionドメイン(＋id)(全項目)を返却する', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道のid
      const dto = {
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // regions service findOne mock data 作成: domainをreconstituteで作成(時間などをセットできるため)
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // ①mock data set
      // private findByIdOrFail()は本物で、そこから呼ばれている
      // regionRepository.findByIdOrFail()をmock化
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // Repository.save mock data 作成
      const savedRegion = Region.reconstitute({
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-25T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const savedRegionWithId = Object.assign(savedRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // ②mock data set (Repository)
      jest.spyOn(regionRepository, 'save').mockResolvedValue(savedRegionWithId);

      // テスト対象 service 呼び出し
      const result = await regionsService.update(id, dto, userId);

      // 期待値: Region & {id:string}型だが、_name,_codeやgetterなどが無いので
      //        satisfiesでの型判定はしない。
      const expected = {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-25T12:30:00.000Z'),
      };

      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      expect(result).toMatchObject(expected);
    });

    // ⚠️本当はnull→undefined変換のテストを実施したいが、UpdateRegionDtoの型チェックにてnull
    //   をセットすることはできない。のでundefinedで試験を実施している。（やる意味はないが)
    //   ただ、実際のリクエストパラメータではnullがセットされるので非常に悩ましい。。。！！！
    it('正常系： 指定idに関連するRegion情報を更新し(null項目をundefinedに変換)、Regionドメイン(＋id)(全項目)を返却する', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道のid
      const dto = {
        name: undefined,
        code: undefined,
        kanaName: undefined,
        status: undefined,
        kanaEn: undefined,
      } satisfies UpdateRegionDto;
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // regions service findOne mock data 作成: domainをreconstituteで作成(時間などをセットできるため)
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // Repository.save mock data 作成
      const savedRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const savedRegionWithId = Object.assign(savedRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest.spyOn(regionRepository, 'save').mockResolvedValue(savedRegionWithId);

      // テスト対象 service 呼び出し
      const result = await regionsService.update(id, dto, userId);

      // 期待値: Region & {id:string}型だが、_name,_codeやgetterなどが無いので
      //        satisfiesでの型判定はしない。
      const expected = {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      };

      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      expect(result).toMatchObject(expected);
    });

    it('異常系①： 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる(エラーの伝搬)', async () => {
      // serviceの引数作成
      const id = 'xxxx';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const dto = {
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;

      // mock data 作成(region service findOne): Regionが存在しない
      const mockException = new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // 検証：NotFoundException
      await expect(regionsService.update(id, dto, userId)).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系②： 指定idに関連するRegion情報のステータスが掲載中のため、RegionAlreadyPublishedExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道のid
      const dto = {
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // regions service findOne mock data 作成: domainをreconstituteで作成(時間などをセットできるため)
      const region = Region.reconstitute({
        name: '北海道テスト',
        code: '01',
        kanaName: 'ほっかいどう',
        // 掲載中
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const regionWithId = Object.assign(region, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // 検証：RegionAlreadyPublishedException
      await expect(regionsService.update(id, dto, userId)).rejects.toThrow(
        new RegionAlreadyPublishedException('北海道テスト'),
      );

      // 検証：message
      await expect(regionsService.update(id, dto, userId)).rejects.toThrow(
        `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： 北海道テスト`,
      );
    });
  });

  //--------------------------------------
  // publish() test
  //--------------------------------------
  describe('publish Test', () => {
    it('正常系： 指定idに関連するRegion情報が更新され、Regionドメイン(＋id)(全項目)を返却する', async () => {
      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstitute()を使う（BP)
      // Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
      // これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps) satisfies Region;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (regins service findOne)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // spyOnをやめてみた
      mockRegionRepository.findByIdOrFail.mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertPublishable').mockResolvedValue();

      // repository 'save' mock data
      const mockPublished = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        // userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies ReconstituteRegionProps) satisfies Region;
      const publishedWithId = Object.assign(mockPublished, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      jest.spyOn(regionRepository, 'save').mockResolvedValue(publishedWithId);

      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const publishRegionDto: PublishRegionDto = {};

      // テスト対象 service 呼び出し
      const result = await regionsService.publish(id, publishRegionDto, userId);

      // 検証: プロパティをすべて持っているか、プロパティ値が正しいか
      //       RegionドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      expect(result).toMatchObject(
        createExpectedData().find((region) => region.id === id)!,
      );

      // 引数チェック
      expect(jest.spyOn(regionRepository, 'save')).toHaveBeenCalledWith(
        regionWithId,
        userId,
      );
    });

    it('異常系①： 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'xxxx';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const publishRegionDto: PublishRegionDto = {};

      // mock data 作成(Repository): Regionが存在しない
      const mockException = new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // 検証：NotFoundException
      await expect(
        regionsService.publish(id, publishRegionDto, userId),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系②： 指定idに関連する都道府県情報が存在しないため、ConflictExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const publishRegionDto: PublishRegionDto = {};

      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // mock data set (Regions Domin Serivce: ConflictException)
      jest
        .spyOn(regionsDomainService, 'assertPublishable')
        .mockRejectedValue(
          new ConflictException(
            `都道府県が登録されていないため、この地域は「掲載中」にできません。regionId: ${id}`,
          ),
        );

      // 検証: ConflictExceptionがスローされることをテスト
      await expect(
        regionsService.publish(id, publishRegionDto, userId),
      ).rejects.toThrow(
        new ConflictException(
          `都道府県が登録されていないため、この地域は「掲載中」にできません。regionId: ${id}`,
        ),
      );
    });

    it('異常系③： 指定idに関連する都道府県情報が既に掲載中状態のため、RegionAlreadyPublishedExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const publishRegionDto: PublishRegionDto = {};

      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 掲載中
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertPublishable').mockResolvedValue();

      // 検証: RegionAlreadyPublishedExceptionがスローされることをテスト
      //      (本物のregons domainからのExceptionスローを検証している)
      await expect(
        regionsService.publish(id, publishRegionDto, userId),
      ).rejects.toThrow(new RegionAlreadyPublishedException('北海道'));
      // messageの内容を検証
      await expect(
        regionsService.publish(id, publishRegionDto, userId),
      ).rejects.toThrow(
        `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： 北海道`,
      );
    });

    it('異常系④： Retion情報の更新時(ソフトデリート)のエラー（DB接続エラー)', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const publishRegionDto: PublishRegionDto = {};

      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertPublishable').mockResolvedValue();

      // DB接続エラー
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest.spyOn(regionRepository, 'save').mockRejectedValue(connectionError);

      // 検証: エラーをそのまま伝搬することを確認
      await expect(
        regionsService.publish(id, publishRegionDto, userId),
      ).rejects.toThrow(PrismaClientKnownRequestError);
    });
  });

  //--------------------------------------
  // unpublish() test
  //--------------------------------------
  describe('unpublish Test', () => {
    it('正常系： 指定idに関連するRegion情報が更新され、Regionドメイン(＋id)(全項目)を返却する', async () => {
      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps) satisfies Region;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (regins service findOne)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // spyOnをやめてみた
      mockRegionRepository.findByIdOrFail.mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertPublishable').mockResolvedValue();

      // repository 'save' mock data
      const mockPublished = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 編集中
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        // userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies ReconstituteRegionProps) satisfies Region;
      const publishedWithId = Object.assign(mockPublished, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      jest.spyOn(regionRepository, 'save').mockResolvedValue(publishedWithId);

      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const unpublishRegionDto: UnpublishRegionDto = {};

      // テスト対象 service 呼び出し
      const result = await regionsService.unpublish(
        id,
        unpublishRegionDto,
        userId,
      );

      // 期待値: status = EDITING
      const domain = createExpectedData().find((region) => region.id === id);
      const expected = {
        ...domain,
        status: RegionStatus.EDITING,
      };

      // 検証: プロパティをすべて持っているか、プロパティ値が正しいか
      //       RegionドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      expect(result).toMatchObject(expected);

      // 引数チェック
      expect(jest.spyOn(regionRepository, 'save')).toHaveBeenCalledWith(
        regionWithId,
        userId,
      );
    });

    it('異常系①： 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'xxxx';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const unpublishRegionDto: UnpublishRegionDto = {};

      // mock data 作成(Repository): Regionが存在しない
      const mockException = new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // 検証：NotFoundException
      await expect(
        regionsService.unpublish(id, unpublishRegionDto, userId),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    // 現状は当該ケースは存在しない
    // it('異常系②： 指定idに関連する都道府県情報が存在するため、ConflictExceptionがスローされる', async () => {
    //   // serviceの引数作成
    //   const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
    //   const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
    //   const unpublishRegionDto: UnpublishRegionDto = {};

    //   // Repository mock data 作成
    //   const mockRegion = Region.reconstitute({
    //     name: '北海道',
    //     code: '01',
    //     kanaName: 'ほっかいどう',
    //     status: 'published',
    //     kanaEn: 'hokkaidou',
    //     createdAt: new Date('2025-04-05T10:00:00.000Z'),
    //     updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    //   }) satisfies ReconstituteRegionProps;
    //   const regionWithId = Object.assign(mockRegion, {
    //     id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
    //   });

    //   // mock data set (Repository)
    //   jest
    //     .spyOn(regionRepository, 'findByIdOrFail')
    //     .mockResolvedValue(regionWithId);

    //   // mock data set (Regions Domin Serivce: ConflictException)
    //   jest
    //     .spyOn(regionsDomainService, 'assertUnpublishable')
    //     .mockRejectedValue(
    //       new ConflictException(
    //         `掲載中の都道府県が登録されているため、この地域は「編集中」にできません。regionId: ${id}`,
    //       ),
    //     );

    //   // 検証: ConflictExceptionがスローされることをテスト
    //   await expect(
    //     regionsService.unpublish(id, unpublishRegionDto, userId),
    //   ).rejects.toThrow(
    //     new ConflictException(
    //       `掲載中の都道府県が登録されているため、この地域は「編集中」にできません。regionId: ${id}`,
    //     ),
    //   );
    // });

    it('異常系③： 指定idに関連する都道府県情報が既に編集中状態のため、RegionAlreadyEditedExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const unpublishRegionDto: UnpublishRegionDto = {};

      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 編集中
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest
        .spyOn(regionsDomainService, 'assertUnpublishable')
        .mockResolvedValue();

      // 検証: RegionAlreadyPublishedExceptionがスローされることをテスト
      //      (本物のregons domainからのExceptionスローを検証している)
      await expect(
        regionsService.unpublish(id, unpublishRegionDto, userId),
      ).rejects.toThrow(new RegionAlreadyEditedException('北海道'));
      // messageの内容を検証
      await expect(
        regionsService.unpublish(id, unpublishRegionDto, userId),
      ).rejects.toThrow(
        `この地域は既に編集中のため、更新できません。 地域： 北海道`,
      );
    });

    it('異常系④： Retion情報の更新時(ソフトデリート)のエラー（DB接続エラー)', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';
      const unpublishRegionDto: UnpublishRegionDto = {};

      // Repository mock data 作成
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest
        .spyOn(regionsDomainService, 'assertUnpublishable')
        .mockResolvedValue();

      // DB接続エラー
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest.spyOn(regionRepository, 'save').mockRejectedValue(connectionError);

      // 検証: エラーをそのまま伝搬することを確認
      await expect(
        regionsService.unpublish(id, unpublishRegionDto, userId),
      ).rejects.toThrow(PrismaClientKnownRequestError);
    });
  });

  //--------------------------------------
  // remove() test
  //--------------------------------------
  describe('remove Test', () => {
    it('正常系： 指定idに関連するRegion情報が削除され、Regionドメイン(＋id)(全項目)を返却する', async () => {
      // 以下はRegionRepositoryのUTにて実施 --------------

      // // prisma region 'findUnique' mock data
      // const mockPrismaRegion = {
      //   id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      //   name: '北海道',
      //   code: '01',
      //   kanaName: 'ほっかいどう',
      //   status: 'published',
      //   kanaEn: 'hokkaidou',
      //   createdAt: new Date('2025-04-05T10:00:00.000Z'),
      //   updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      //   userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      // } satisfies PrismaRegion;

      // jest
      //   .spyOn(prismaService.region, 'findUnique')
      //   .mockResolvedValue(mockPrismaRegion);

      // RegionRepositoryのUTにて実施 --------------

      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstitute()を使う（BP)
      // Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
      // これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps) satisfies Region;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (regins service findOne)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // ⭐️jest.spyOn は「本物のメソッドを監視・上書きしたいとき」に使うため、本来は以下のように
      //  直接mockに対してmockresolvedValue()するのが主流のよう。
      //  これからはspyOn()をやめてみよう。。
      mockRegionRepository.findByIdOrFail.mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertDeletable').mockResolvedValue();

      // repository 'save' mock data
      const mockDeleted = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        // userId: '633931d5-2b25-45f1-8006-c137af49e53d',
      } satisfies ReconstituteRegionProps) satisfies Region;
      const deletedWithId = Object.assign(mockDeleted, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      jest.spyOn(regionRepository, 'save').mockResolvedValue(deletedWithId);

      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // テスト対象 service 呼び出し
      const result = await regionsService.remove(id, userId);

      // 検証: RegionドメインのtoEqual()の検証はしない（domainはプレーンオブジェクトではないため）
      // expect(result).toEqual(
      //   createExpectedData().find((region) => region.id === id),
      // );
      // 検証：プロパティをすべて持っているか、プロパティ値が正しいか
      expect(result).toMatchObject(
        createExpectedData().find((region) => region.id === id)!,
      );

      // RegionMapper.toDomain()はMock化せず、本物を使用する
      // Serviceのテストにおいて、RegionMapper は 「本物を使ってもOK」 な部類です。
      // 理由は Region ドメインと同様に、外部依存がなく、実行が高速で、副作用がないからです。

      // prisma(update) → repository.save()に移動のため、コメント
      // ⭐️以下のDate(日付)の期待値検証の誤差について、ノウハウとして残しておきたいので、削除していない。
      // expect(jest.spyOn(prismaService.region, 'update')).toHaveBeenCalledWith({
      //   data: {
      //     status: RegionStatus.SUSPENDED, // 厳密には、RegionStatus.suspended(PrismaのRegionStatus)だが、多めにみる。
      //     userId: userId,
      //     // updatedAtについて、new Date()はミリ秒で結果と期待値に誤差が出るので
      //     // expect.any(Date)としている。が、anyで警告が出るので、解除コメントを挿入。
      //     // updatedAt: new Date(),
      //     // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      //     updatedAt: expect.any(Date),
      //   },
      //   where: { id },
      // });

      // 引数チェック
      expect(jest.spyOn(regionRepository, 'save')).toHaveBeenCalledWith(
        regionWithId,
        userId,
      );
    });

    it('異常系①： 指定idに関連するRegion情報が存在しないので、NotFoundExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'xxxx';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // mock data 作成(Repository): Regionが存在しない
      const mockException = new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockRejectedValue(mockException);

      // ⭐️TODO ここは、Repositoryにてテストを行う
      // mock data 作成 (データ無し)
      // jest.spyOn(prismaService.region, 'findUnique').mockResolvedValue(null);

      // 検証：NotFoundException
      await expect(regionsService.remove(id, userId)).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系②： 指定idに関連する都道府県情報が存在するため、ConflictExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstiture()を使う（BP)
      // Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
      // これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // mock data set (Regions Domin Serivce: ConflictException)
      jest
        .spyOn(regionsDomainService, 'assertDeletable')
        .mockRejectedValue(
          new ConflictException(
            `都道府県が登録されているため、この地域は削除できません。regionId: ${id}`,
          ),
        );

      // 検証: ConflictExceptionがスローされることをテスト
      await expect(regionsService.remove(id, userId)).rejects.toThrow(
        new ConflictException(
          `都道府県が登録されているため、この地域は削除できません。regionId: ${id}`,
        ),
      );
    });

    it('異常系③： 指定idに関連する都道府県情報が既に利用停止状態のため、RegionAlreadySuspendedExceptionがスローされる', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstiture()を使う（BP)
      // Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
      // これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 停止
        status: 'suspended',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertDeletable').mockResolvedValue();

      // 検証: RegionAlreadySuspendedExceptionがスローされることをテスト
      await expect(regionsService.remove(id, userId)).rejects.toThrow(
        new RegionAlreadySuspendedException('北海道'),
      );
      // messageの内容を検証
      await expect(regionsService.remove(id, userId)).rejects.toThrow(
        `この地域はすでに利用停止状態です。地域： 北海道`,
      );
    });

    it('異常系④： Retion情報の更新時(ソフトデリート)のエラー（DB接続エラー)', async () => {
      // serviceの引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const userId = '633931d5-2b25-45f1-8006-c137af49e53d';

      // Repository mock data 作成
      // Region & {id:string} の生成は本物のRegion.reconstiture()を使う（BP)
      // Region は「ドメインモデル」であり、外部依存（DBやAPI）を持たない純粋なロジックのかたまりです。
      // これを Mock にしてしまうと、テストコードが非常に複雑になる割にメリットがありません。
      const mockRegion = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;
      const regionWithId = Object.assign(mockRegion, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // mock data set (Repository)
      jest
        .spyOn(regionRepository, 'findByIdOrFail')
        .mockResolvedValue(regionWithId);

      // regionsDomainService mock data: void
      jest.spyOn(regionsDomainService, 'assertDeletable').mockResolvedValue();

      // DB接続エラー
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );

      jest.spyOn(regionRepository, 'save').mockRejectedValue(connectionError);

      // 検証: エラーをそのまま伝搬することを確認
      await expect(regionsService.remove(id, userId)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });
});

/**
 * 期待値作成
 *
 * memo:
 * mockDataの型指定(Region & { id: string })[]は不要（というかRegionはプレーンオブジェクト
 * ではないので型指定すると不一致エラーが出てしまうので、削除。
 * → 現状は期待値としてプレーンオブジェクトにしている。これは自作のRegionのreconstitube()を
 *   使用して期待値を作ってしまうとテストの信頼性が下がってしまうから。
 *
 * @returns 期待値
 */
function createExpectedData(): (RegionState & { id: string })[] {
  // mockDataの型指定(Region & { id: string })[]は不要（というかRegionはプレーンオブジェクト
  // ではないので型指定すると不一致エラーが出てしまう。
  const expectedData = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionState & { id: string },
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionState & { id: string },
    {
      id: '0324dc98-89a2-4db1-9431-b20feff57700',
      name: '関東',
      code: '03',
      kanaName: 'kanto',
      status: 'published',
      kanaEn: 'kantou',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionState & { id: string },
    {
      id: '0424dc98-89a2-4db1-9431-b20feff57700',
      name: '東海',
      code: '04',
      kanaName: 'とうかい',
      status: 'published',
      kanaEn: 'tokai',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionState & { id: string },
    {
      id: '0524dc98-89a2-4db1-9431-b20feff57700',
      name: '北陸',
      code: '05',
      kanaName: 'ほくりく',
      status: 'published',
      kanaEn: 'hokuriku',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionState & { id: string },
  ];
  return expectedData;
}

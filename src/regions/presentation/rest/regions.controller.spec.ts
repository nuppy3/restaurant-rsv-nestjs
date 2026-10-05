import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Request as ExpressRequest } from 'express';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { RegionOptionReadModel } from '../../../regions/query/read-model/region-option.read-model';
import { RequestUser } from '../../../types/requestUser';
import { RegionsService } from '../../application/regions.service';
import { RegionAlreadyPublishedException } from '../../domain/errors/regions.exceptions';
import {
  ReconstituteRegionProps,
  Region,
  RegionStatus,
} from '../../domain/regions.model';
import { RegionDetailReadModel } from '../../query/read-model/region-detail.read-model';
import { RegionListReadModel } from '../../query/read-model/region-list.read-model';
import { RegionsQueryService } from '../../query/regions.query.service';
import { PublishRegionDto } from './dto/publish-region.dto';
import {
  CreateRegionDto,
  FindAllRegionsQueryDto,
  PaginatedRegionResponseDto,
  RegionOptionResponseDto,
  RegionResponseDto,
} from './dto/region.dto';
import { UnpublishRegionDto } from './dto/unpublish-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionsController } from './regions.controller';

const mockRegionsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findByCodeOrFail: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
};

const mockRegionsQueryService = {
  findAllPaginated: jest.fn(),
  findAll: jest.fn(),
  getDetailByIdOrThrow: jest.fn(),
  getDetailByCodeOrThrow: jest.fn(),
};

describe('■■■　Regions Controller TEST ■■■', () => {
  // DI対象モジュール宣言
  let regionsController: RegionsController;
  let regionsService: RegionsService;
  let regionsQueryService: RegionsQueryService;

  // テスト全体の前に1回だけ実行
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ');

    // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
    // この便利なDIの仕組みはNestJSの仕組み。
    // 最後の.compile()を忘れずに(compile()にてモジュールを生成する)
    const module = await Test.createTestingModule({
      // @Module({
      // imports: [PrismaModule],
      // controllers: [RegionsController],
      // providers: [RegionsService],
      // })

      // DI対象モジュール：module.tsをほぼコピペ（serviceのMockを指定する）
      controllers: [RegionsController],
      providers: [
        { provide: RegionsService, useValue: mockRegionsService },
        { provide: RegionsQueryService, useValue: mockRegionsQueryService },
      ],
    }).compile();

    regionsController = module.get<RegionsController>(RegionsController);
    regionsService = module.get<RegionsService>(RegionsService);
    regionsQueryService = module.get<RegionsQueryService>(RegionsQueryService);
  });

  // 各テストケースの前に毎回実行：こっちでcreateTestingModule()してもいいが、
  // 重いのでbeforeAll()で1回だけ実行するようにするのがベストプラクティス
  beforeEach(() => {
    // console.log('beforeEach: モックをリセット jest.clearAllMocks()');
    jest.clearAllMocks();
  });

  //--------------------------------
  // findAllPaginated()
  //--------------------------------
  describe('findAllPaginated', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている) - RequestParameter無し', async () => {
      // query service mock data 作成
      const mockDatas = createServiceMockPaginatedResult();
      jest
        .spyOn(regionsQueryService, 'findAllPaginated')
        .mockResolvedValue(mockDatas);

      // テスト対象Controller呼び出し(queryなし)
      const query = {
        // code: '01',
      } satisfies FindAllRegionsQueryDto;

      const result = await regionsController.findAllPaginated(query);

      // 検証
      const dto = createExpectedPaginatedRegionDto();
      expect(result).toEqual(dto);

      // regiosQueryServie()の引数検証
      expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
        code: undefined,
        name: undefined,
        status: undefined,
        page: undefined,
        size: undefined,
        sortOrder: undefined,
        sortBy: undefined,
      });
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される', async () => {
      // mock data 作成 (空配列/0件)
      jest.spyOn(regionsQueryService, 'findAllPaginated').mockResolvedValue({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<RegionListReadModel>);

      // test対象Controller呼び出し
      const query = { code: 'xx' } satisfies FindAllRegionsQueryDto;
      const result = await regionsController.findAllPaginated(query);

      // 検証：plainToInstance()は空配列が渡ってきた場合、空配列を返す
      expect(result).toEqual({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedRegionResponseDto);
    });

    describe('findAllPaginatedの絞り込み(filter)テスト', () => {
      it('正常系(1): codeを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = { code: '10' } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          code: '10',
        });
      });

      it('正常系(2): nameを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );
        // テスト対象 contrller 呼び出し
        const query = { name: '関東' } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);
        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          name: '関東',
        });
      });

      it('正常系(3): statusを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = {
          status: 'editing',
        } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          status: 'editing',
        });
      });

      it('正常系(4): pageを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = { page: 2 } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          page: 2,
        });
      });

      it('正常系(5): sizeを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = { size: 30 } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          size: 30,
        });
      });

      it('正常系(6): sortByを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = { sortBy: 'name' } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          sortBy: 'name',
        });
      });

      it('正常系(7): sortOrderを指定した場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // mock data 作成(jest.spyOnを使用しないパターン)
        // toHavebeeanCalledWith()の確認なので、mock データは何でもいい。
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // テスト対象 contrller 呼び出し
        const query = { sortOrder: 'desc' } satisfies FindAllRegionsQueryDto;
        await regionsController.findAllPaginated(query);

        // 引数検証: Serviceを期待通りの引数で呼んでいるか
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          sortOrder: 'desc',
        });
      });
    });

    // queryの変換処理はcontrolerで実施していないし、
    // controllerで複合ケースの試験は不要な気もするが一応
    describe('findAllPaginatedの絞り込み(filter) スモークテスト(複合条件)', () => {
      it('(1)+(2)+(3)+(4)+(5)+(6)+(7)が指定された場合、QueryServiceを期待通りの引数で呼び出しているか', async () => {
        // 引数
        const reqDto = {
          code: '01',
          name: '北海道',
          status: 'editing',
          page: 5,
          size: 20,
          sortBy: 'name',
          sortOrder: 'desc',
        } satisfies FindAllRegionsQueryDto;

        // query service mock data (なんでもいい)
        mockRegionsQueryService.findAllPaginated.mockResolvedValue(
          createServiceMockPaginatedResult(),
        );

        // controller 呼び出し
        await regionsController.findAllPaginated(reqDto);

        // query service への引数検証
        expect(mockRegionsQueryService.findAllPaginated).toHaveBeenCalledWith({
          code: '01',
          name: '北海道',
          status: 'editing',
          page: 5,
          size: 20,
          sortBy: 'name',
          sortOrder: 'desc',
        });
      });
    });

    //-------------------------------
    // カバレッジ100%対応：
    // async findAllPaginated(): Promise<PrefectureResponseDto[]> {
    // の、<PrefectureResponseDto[]> {  が黄色くハイライトされてしまう問題。
    // このメソッドが「正常系（成功時）」しかテストされていため発生。
    //
    // async 関数は内部で Promise を返す ため、Jest（istanbul）のカバレッジでは以下の2つの「分岐」を
    // 考慮します：
    // resolved（成功） した場合のパス（正常に値が返る）
    // rejected（エラー） した場合のパス（throw または Promise.reject）
    // rejected（エラー）のケースが存在しないため発生。
    //
    // カバレッジを通すだけであれば適当なErrorを作成してテストを通すこともできるが、実際に発生しうる
    // PrismaのError（DB接続エラー）をモックして実装してみた。
    //
    // 20251224: 上記を実施するのは正しいらしいが、完全に黄色のハイライトは消えなかった。。
    //-------------------------------
    it('異常系(カバレッジ100%のため)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(regionsQueryService, 'findAllPaginated')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      const query = { code: '10' } satisfies FindAllRegionsQueryDto;
      await expect(regionsController.findAllPaginated(query)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------
  // findAll()
  //--------------------------------
  describe('findAll', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている) - RequestParameter無し', async () => {
      // query service mock data 作成
      const mockDatas = createServiceMockOptionReadModels();
      jest.spyOn(regionsQueryService, 'findAll').mockResolvedValue(mockDatas);

      // テスト対象Controller呼び出し
      const result = await regionsController.findAll();

      // 検証
      expect(result).toEqual([
        {
          id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
          name: '北海道',
          code: '01',
        } satisfies RegionOptionResponseDto,
        {
          id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
          name: '東北',
          code: '02',
        } satisfies RegionOptionResponseDto,
        {
          id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
          name: '関東',
          code: '03',
        } satisfies RegionOptionResponseDto,
        {
          id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
          name: '沖縄',
          code: '10',
        } satisfies RegionOptionResponseDto,
      ] satisfies RegionOptionResponseDto[]);
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される', async () => {
      // mock data 作成 (空配列/0件)
      jest.spyOn(regionsQueryService, 'findAll').mockResolvedValue([]);

      // test対象Controller呼び出し
      const result = await regionsController.findAll();

      // 検証：plainToInstance()は空配列が渡ってきた場合、空配列を返す
      expect(result).toEqual([]);
    });

    it('異常系(カバレッジ100%のため)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(regionsQueryService, 'findAll')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      await expect(regionsController.findAll()).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------
  // findOne() TEST
  //--------------------------------
  describe('findOne test', () => {
    it('正常系: 指定したidを元に、エリア情報DTO（全項目）を返却する', async () => {
      // 引数
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道

      // region servie mock data 作成
      const serviceModkRegionData = createQueryServiceMockData().find(
        (region) => region.id === id,
      )!;
      jest
        .spyOn(regionsQueryService, 'getDetailByIdOrThrow')
        .mockResolvedValue(serviceModkRegionData);

      // テスト対象controller呼び出し
      const result = await regionsController.findOne(id);

      // 検証
      const expected = createExpectedRegionHavingPrefectureCountDtos().find(
        (region) => region.id === id,
      );
      expect(result).toEqual(expected);
    });

    it('異常系： idに紐づくエリア情報なし（データ0件)の場合、NotFoundExceptionを伝播', async () => {
      // 引数
      const id = 'xxxxxxxx-0ba4-xxxx-xxxx-473aa26e457a'; // 北海道

      // region query service mock data 作成(NotFoundException)
      jest
        .spyOn(regionsQueryService, 'getDetailByIdOrThrow')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連するエリア情報が存在しません!! regionId: ${id}`,
          ),
        );

      // 検証
      await expect(
        jest.spyOn(regionsQueryService, 'getDetailByIdOrThrow'),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });
  });

  //--------------------------------
  // findByCode() TEST
  //--------------------------------
  describe('findByCode test', () => {
    it('正常系: 指定したcodeを元に、エリア情報DTO（全項目）を返却する', async () => {
      // 引数
      const code = '01';

      // region query servie mock data 作成
      const serviceModkRegionData = createQueryServiceMockData().find(
        (region) => region.code === code,
      )!;
      jest
        .spyOn(regionsQueryService, 'getDetailByCodeOrThrow')
        .mockResolvedValue(serviceModkRegionData);

      // テスト対象controller呼び出し
      const result = await regionsController.findByCode(code);

      // 検証
      const expected = createExpectedRegionHavingPrefectureCountDtos().find(
        (region) => region.code === code,
      );
      expect(result).toEqual(expected);
    });

    it('異常系： codeに紐づくエリア情報なし（データ0件)の場合、NotFoundExceptionを伝播', async () => {
      // 引数
      const code = '00';

      // region query service mock data 作成(NotFoundException)
      jest
        .spyOn(regionsQueryService, 'getDetailByCodeOrThrow')
        .mockRejectedValue(
          new NotFoundException(
            `codeに関連するエリア情報が存在しません!! code: ${code}`,
          ),
        );

      // 検証
      await expect(regionsController.findByCode(code)).rejects.toThrow(
        new NotFoundException(
          `codeに関連するエリア情報が存在しません!! code: ${code}`,
        ),
      );
    });

    // 上記のNotFoundExceptionの伝播を実施しているのでやる必要はないが、練習
    it('異常系： DB接続エラーの場合、エラーをそのまま伝播', async () => {
      // Error
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );

      // region query service mock data 作成(NotFoundException)
      jest
        .spyOn(regionsQueryService, 'getDetailByCodeOrThrow')
        .mockRejectedValue(connectionError);

      const code = '01';

      // 検証: Controllerがエラーをそのまま伝播（reject）することを確認
      // 厳密にErrorの内容を検証するため、toThew()→toMatchObject()に変更
      // toMatchObject()は引数のオブジェクトの内容がtoThrowとは異なるので注意。
      // → toThew()での検証のままでもいい気もする。
      await expect(regionsController.findByCode(code)).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P1001',
        message: "Can't reach database server",
        clientVersion: '5.0.0',
      });
    });
  });

  //--------------------------------
  // create()
  //--------------------------------
  describe('create test', () => {
    // 共通引数：ユーザーID
    const request: Partial<ExpressRequest & { user: Partial<RequestUser> }> = {
      user: { id: '633931d5-2b25-45f1-8006-c137af49e53d' },
    };

    it('正常系: ReginResponseDto(全項目)を返却する', async () => {
      // controller 引数（dto)作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // service mock data 作成
      // 自作のdomain作成メソッドで自作自演にならないの？ → ならない。本物を使うべき！
      // Mock（入力値や外部サービスの戻り値）に関しては、本物のクラス（または完璧な模倣）を
      // 返すべきです。なぜなら、その Mock を受け取る「
      // テスト対象のコード」が、Region クラスであることを前提に動くから。
      // 一方、テストの期待値 (Expected):→ クラスを使わずリテラルで比較すべき（自作自演防止）。

      // mock Region domain 作成用の Props
      const mockProps = {
        code: '10',
        name: '沖縄',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps;
      // mock Region domain 作成
      const mockRegion = Region.reconstitute(mockProps);
      // mock Region domain + id
      const serviceMockData = Object.assign(mockRegion, {
        id: '1024dc98-89a2-4db1-9431-b20feff57700',
      });

      // mock data set
      jest.spyOn(regionsService, 'create').mockResolvedValue(serviceMockData);

      // テスト対象controller呼び出し
      const result = await regionsController.create(
        dto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        request as ExpressRequest & { user: RequestUser },
      );

      // 検証
      expect(result).toEqual({
        id: '1024dc98-89a2-4db1-9431-b20feff57700',
        code: '10',
        name: '沖縄',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
        statusLabel: '掲載中',
      } satisfies RegionResponseDto);
    });

    it('異常系: reginServiceにエラーが発生した場合、元のエラーをそのまま伝搬する', async () => {
      // controller 引数（dto)作成
      const dto = {
        name: '沖縄',
        code: '10',
        kanaName: 'おきなわ',
        status: RegionStatus.PUBLISHED,
        kanaEn: 'okinawa',
      } satisfies CreateRegionDto;

      // service mock data(Error) 作成
      const conectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest.spyOn(regionsService, 'create').mockRejectedValue(conectionError);

      // テスト対象controller呼び出し
      await expect(
        regionsController.create(
          dto,
          // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
          // 完全に一致しないため、保守性がやや低下する可能性があるため）
          request as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(PrismaClientKnownRequestError);

      // 検証
    });
  });

  //--------------------------------
  // update() test
  //--------------------------------
  describe('update() test', () => {
    it('正常系：指定idに関連するエリア情報を更新し、削除対象のDto(全項目)を返却する', async () => {
      // 引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };
      const dto = {
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;

      // mock data 作成
      const updatedDomain = Region.reconstitute({
        // id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-25T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);
      const updatedDomainWithId = Object.assign(updatedDomain, {
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      });

      // service に mock deta セット
      jest
        .spyOn(regionsService, 'update')
        .mockResolvedValue(updatedDomainWithId);

      // test 対象 controller 呼び出し
      const result = await regionsController.update(
        id,
        dto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証
      expect(result).toEqual({
        id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
        statusLabel: '掲載中',
      } satisfies RegionResponseDto);
    });

    it('異常系①：idに関連するエリア情報が存在しない。(serviceのNotFoundExceptionを伝播', async () => {
      // 引数作成
      const id = 'xxxx';
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };
      const dto = {
        name: '北海道テスト',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;

      // mock data (NotFoundException)
      jest
        .spyOn(regionsService, 'update')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連するエリア情報が存在しません!! regionId: ${id}`,
          ),
        );

      // 検証
      await expect(
        regionsController.update(
          id,
          dto,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });

    it('異常系②：更新対象のエリア情報が掲載中の場合、RegionAlreadyPublishedExceptionをスローする', async () => {
      // 引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a'; // 北海道
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };
      const dto = {
        name: '北海道テストUPDATE',
        code: '99',
        kanaName: 'ほっかいどうてすと',
        status: 'published',
        kanaEn: 'hokkaidoutest',
      } satisfies UpdateRegionDto;

      // mock data セット (RegionAlreadyPublishedException)
      jest
        .spyOn(regionsService, 'update')
        .mockRejectedValue(new RegionAlreadyPublishedException('北海道テスト'));

      // test 対象 controller 呼び出し
      // 検証： RegionAlreadyPublishedException
      await expect(
        regionsController.update(
          id,
          dto,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(new RegionAlreadyPublishedException('北海道テスト'));

      // message検証
      await expect(
        regionsController.update(
          id,
          dto,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(
        `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： 北海道テスト`,
      );
    });
  });

  //--------------------------------
  // publish()
  //--------------------------------
  describe('publish() test', () => {
    it('正常系：指定idに関連するエリア情報を更新し、削除対象のDto(全項目)を返却する', async () => {
      // 引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const publishRegioDto: PublishRegionDto = {};
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data 作成
      jest
        .spyOn(regionsService, 'publish')
        .mockResolvedValue(
          createServiceMockData().find((region) => region.id === id)!,
        );

      // test 対象 controller 呼び出し
      const result = await regionsController.publish(
        id,
        publishRegioDto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証
      expect(result).toEqual(
        createExpectedRegionDtos().find((region) => region.id === id),
      );
    });

    it('異常系：idに関連するエリア情報が存在しない。(serviceのNotFoundExceptionを伝播', async () => {
      // 引数作成
      const id = 'xxxx';
      const publishRegioDto: PublishRegionDto = {};
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data (NotFoundException)
      jest
        .spyOn(regionsService, 'publish')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連するエリア情報が存在しません!! regionId: ${id}`,
          ),
        );

      // 検証
      await expect(
        regionsController.publish(
          id,
          publishRegioDto,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });
  });

  //--------------------------------
  // unpublish()
  //--------------------------------
  describe('unpublish() test', () => {
    it('正常系：指定idに関連するエリア情報を更新し、削除対象のDto(全項目)を返却する', async () => {
      // 引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const unpublishRegioDto: UnpublishRegionDto = {};
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data 作成
      jest
        .spyOn(regionsService, 'unpublish')
        .mockResolvedValue(
          createServiceMockData().find((region) => region.id === id)!,
        );

      // test 対象 controller 呼び出し
      const result = await regionsController.unpublish(
        id,
        unpublishRegioDto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証
      expect(result).toEqual(
        createExpectedRegionDtos().find((region) => region.id === id),
      );
    });

    it('異常系：idに関連するエリア情報が存在しない。(serviceのNotFoundExceptionを伝播', async () => {
      // 引数作成
      const id = 'xxxx';
      const unpublishRegioDto: UnpublishRegionDto = {};
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data (NotFoundException)
      jest
        .spyOn(regionsService, 'unpublish')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連するエリア情報が存在しません!! regionId: ${id}`,
          ),
        );

      // 検証
      await expect(
        regionsController.unpublish(
          id,
          unpublishRegioDto,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });
  });

  //--------------------------------
  // remove()
  //--------------------------------
  describe('remove() test', () => {
    it('正常系：指定idに関連するエリア情報を削除し、削除対象のDto(全項目)を返却する', async () => {
      // 引数作成
      const id = 'b96509f2-0ba4-447c-8a98-473aa26e457a';
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data 作成
      jest
        .spyOn(regionsService, 'remove')
        .mockResolvedValue(
          createServiceMockData().find((region) => region.id === id)!,
        );

      // test 対象 controller 呼び出し
      const result = await regionsController.remove(
        id,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        req as ExpressRequest & { user: RequestUser },
      );

      // 検証
      expect(result).toEqual(
        createExpectedRegionDtos().find((region) => region.id === id),
      );
    });

    it('異常系：idに関連するエリア情報が存在しない。(serviceのNotFoundExceptionを伝播', async () => {
      // 引数作成
      const id = 'xxxx';
      const req: Partial<ExpressRequest & { user: RequestUser }> = {
        user: {
          id: '633931d5-2b25-45f1-8006-c137af49e53d',
          // 以下は適当で。user: Partial<RequestUser> でもいいけどね。
          name: '',
          status: 'FREE',
        },
      };

      // mock data (NotFoundException)
      jest
        .spyOn(regionsService, 'remove')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連するエリア情報が存在しません!! regionId: ${id}`,
          ),
        );

      // 検証
      await expect(
        regionsController.remove(
          id,
          req as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `idに関連するエリア情報が存在しません!! regionId: ${id}`,
        ),
      );
    });
  });
});

/**
 * region query service mock data (ページネーションされたRegionListReadModel[]) 作成
 *
 * @returns region service mock data
 */
function createServiceMockPaginatedResult(): PaginatedResult<RegionListReadModel> {
  // dtoリスト
  const readModels = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      prefectureCount: 1,
    } satisfies RegionListReadModel,
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      prefectureCount: 2,
    } satisfies RegionListReadModel,
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      prefectureCount: 3,
    } satisfies RegionListReadModel,
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      prefectureCount: 4,
    } satisfies RegionListReadModel,
  ] satisfies RegionListReadModel[];

  // ページネーション化
  const paginated = {
    data: readModels,
    meta: {
      totalCount: 4,
      page: 1,
      size: 20,
    },
  } satisfies PaginatedResult<RegionListReadModel>;

  return paginated;
}

/**
 * region query service mock data (RegionOptionReadModel[]) 作成
 *
 * @returns region service mock data
 */
function createServiceMockOptionReadModels(): RegionOptionReadModel[] {
  // RegionOptionReadModelリスト
  const readModels = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
    } satisfies RegionOptionReadModel,
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
    } satisfies RegionOptionReadModel,
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
    } satisfies RegionOptionReadModel,
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
    } satisfies RegionOptionReadModel,
  ] satisfies RegionOptionReadModel[];

  return readModels;
}

/**
 * Region Query Service mock data (RegionDetailReadModel) 作成
 *
 * 補足:
 * RegionDetailReadModelをリスト化して作成する必要はないが、RegionDetailReadModel(Mockデータ)の
 * バリエーションを持たせるため、当該メソッドを作成している。
 *
 * @returns RegionDetailReadModelの一覧
 */
function createQueryServiceMockData(): RegionDetailReadModel[] {
  // domain作成用のProps+idリスト
  const readModels = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      prefectureCount: 1,
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionDetailReadModel,
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      prefectureCount: 4,
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionDetailReadModel,
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      prefectureCount: 5,
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionDetailReadModel,
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      prefectureCount: 1,
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies RegionDetailReadModel,
  ] satisfies RegionDetailReadModel[];

  return readModels;
}

/**
 * region service mock data 作成
 * TODO: 上記のメソッドに集約されるため、いづれ削除する
 *
 * @returns region service mock data
 */
function createServiceMockData() {
  // domain作成用のProps+idリスト
  const propsList = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    },
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    },
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    },
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    },
  ] satisfies (ReconstituteRegionProps & { id: string })[];

  const domainWithIds: (Region & { id: string })[] = propsList.map((props) => {
    const domain = Region.reconstitute(props);
    return Object.assign(domain, { id: props.id });
  });

  return domainWithIds;
}

/**
 * 期待値：Paginated Region DTO 作成 (prefectureCountあり)
 *
 * @returns Paginated Region DTO (prefectureCountあり)
 */
function createExpectedPaginatedRegionDto(): PaginatedRegionResponseDto {
  const dtos: RegionResponseDto[] = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      statusLabel: '掲載中',
      prefectureCount: 1,
    } satisfies RegionResponseDto,
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      statusLabel: '掲載中',
      prefectureCount: 2,
    } satisfies RegionResponseDto,
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      statusLabel: '編集中',
      prefectureCount: 3,
    } satisfies RegionResponseDto,
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      statusLabel: '停止',
      prefectureCount: 4,
    } satisfies RegionResponseDto,
  ];

  const paginated = {
    data: dtos,
    meta: {
      totalCount: 4,
      page: 1,
      size: 20,
    },
  } satisfies PaginatedRegionResponseDto;

  return paginated;
}

/**
 * 期待値：Region DTO[] 作成 (prefectureCountあり)
 *
 * @returns Region DTO [] (prefectureCountあり)
 */
function createExpectedRegionHavingPrefectureCountDtos(): RegionResponseDto[] {
  const dtos: RegionResponseDto[] = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      statusLabel: '掲載中',
      prefectureCount: 1,
    },
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      statusLabel: '掲載中',
      prefectureCount: 2,
    },
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      statusLabel: '編集中',
      prefectureCount: 3,
    },
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      statusLabel: '停止',
      prefectureCount: 4,
    },
  ];

  return dtos;
}

/**
 * 期待値：Region DTO [] 作成
 * @returns Region DTO []
 */
function createExpectedRegionDtos(): RegionResponseDto[] {
  const dtos: RegionResponseDto[] = [
    {
      id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
      name: '北海道',
      code: '01',
      kanaName: 'ほっかいどう',
      status: 'published',
      kanaEn: 'hokkaidou',
      statusLabel: '掲載中',
    },
    {
      id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
      name: '東北',
      code: '02',
      kanaName: 'とうほく',
      status: 'published',
      kanaEn: 'tohoku',
      statusLabel: '掲載中',
    },
    {
      id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      name: '関東',
      code: '03',
      kanaName: 'かんとう',
      status: 'editing',
      kanaEn: 'kanto',
      statusLabel: '編集中',
    },
    {
      id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
      name: '沖縄',
      code: '10',
      kanaName: '沖縄',
      status: RegionStatus.SUSPENDED,
      kanaEn: 'okinawa',
      statusLabel: '停止',
    },
  ];

  return dtos;
}

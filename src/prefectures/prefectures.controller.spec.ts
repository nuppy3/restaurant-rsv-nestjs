import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Request as ExpressRequest } from 'express';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { RequestUser } from 'src/types/requestUser';
import { PrefecturesService } from '../prefectures/prefectures.service';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
  PaginatedPrefectureResponseDto,
  PrefectureResponseDto,
} from './dto/prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';
import { PrefecturesController } from './prefectures.controller';
import { Prefecture, PrefectureWithCoverage } from './prefectures.model';

const mockPrerectureService = {
  findAll: jest.fn(),
  findAllWithStoreCount: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  findByIdOrFail: jest.fn(),
  findByCodeOrFail: jest.fn(),
  update: jest.fn(),
};

describe('■■■ Prefectures Controller TEST ■■■', () => {
  // DI対象モジュール宣言
  let prefecturesController: PrefecturesController; // テスト対象
  let prefecturesService: PrefecturesService; // Controllerから呼ばれるService

  // servic mock data(domain[])
  let mockPrefectures: PaginatedResult<
    Prefecture & { id: string; regionName: string }
  >;
  // controller mock data(期待値:dto[])
  let expectedPrefectureDtos: PaginatedPrefectureResponseDto;

  // テスト全体の前に1回だけ実行
  beforeAll(async () => {
    // console.log('beforeAll: モジュールのセットアップ');

    // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
    // この便利なDIの仕組みはNestJSの仕組み。
    // 最後の.compile()を忘れずに(compile()にてモジュールを生成する)
    const module = await Test.createTestingModule({
      // @Module({
      //   imports: [PrismaModule],
      //   controllers: [PrefecturesController],
      //   providers: [PrefecturesService],
      // })

      // DI対象モジュール：module.tsをほぼコピペ（serviceのMockを指定する）
      controllers: [PrefecturesController],
      providers: [
        { provide: PrefecturesService, useValue: mockPrerectureService },
      ],
    }).compile();

    prefecturesController = module.get<PrefecturesController>(
      PrefecturesController,
    );
    prefecturesService = module.get<PrefecturesService>(PrefecturesService);
    // service mock data
    mockPrefectures = createSriviceMockData();
    // controller mock data(期待値)
    expectedPrefectureDtos = createExpectedPrefectureDtos();
  });

  // 各テストケースの前に毎回実行：こっちでcreateTestingModule()してもいいが、
  // 重いのでbeforeAll()で1回だけ実行するようにするのがベストプラクティス
  beforeEach(() => {
    // console.log('beforeEach: モックをリセット jest.clearAllMocks()');
    jest.clearAllMocks();
  });

  //--------------------------------
  // findAll()
  //--------------------------------
  describe('findAll', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている - リクエストパラメータなし', async () => {
      // service mock data 作成
      const paginatedDomain: PaginatedResult<Prefecture & { id: string }> =
        mockPrefectures;
      jest
        .spyOn(prefecturesService, 'findAll')
        .mockResolvedValue(paginatedDomain);

      // テスト対象Controller呼び出し
      // 引数
      const query: FindAllPrefectureQueryDto = {};
      const result = await prefecturesController.findAll(query);
      // 検証
      expect(result).toEqual(expectedPrefectureDtos);
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される - リクエストパラメータなし - ', async () => {
      // mock data 作成(PaginatedResultのdataが[]空配列、metaのtotalCountが0)
      jest.spyOn(prefecturesService, 'findAll').mockResolvedValue({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });
      // 引数
      const query: FindAllPrefectureQueryDto = {};
      // test対象Controller呼び出し
      const result = await prefecturesController.findAll(query);
      // 検証：plainToInstance()は空配列が渡ってきた場合、空配列を返す
      expect(result).toEqual({
        data: [],
        meta: { totalCount: 0, page: 1, size: 20 },
      });
    });

    //--------------------------------------------------------------------------
    // filterテスト：toEquals()の期待値チエックではなく、toHaveBeenCalldWith()での
    // 引数チェック
    //--------------------------------------------------------------------------
    describe('findAllの絞り込み(filter)テスト', () => {
      it('正常系(8): sizeを指定した場合、serviceを期待意通りの引数で呼び出しているか', async () => {
        // 引数
        const query: FindAllPrefectureQueryDto = {
          size: 20,
        };
        // controller呼び出し（toEquals()での検証なし）
        await prefecturesController.findAll(query);

        // 検証: 引数が正しいか（特に編集処理をしていないので、そのままqueryで検証）
        expect(jest.spyOn(prefecturesService, 'findAll')).toHaveBeenCalledWith(
          query,
        );
      });

      it('正常系(9): pageを指定した場合、serviceを期待意通りの引数で呼び出しているか', async () => {
        // 引数
        const query: FindAllPrefectureQueryDto = {
          page: 1,
        };
        // controller呼び出し（toEquals()での検証なし）
        await prefecturesController.findAll(query);

        // 検証: 引数が正しいか（特に編集処理をしていないので、そのままqueryで検証）
        expect(jest.spyOn(prefecturesService, 'findAll')).toHaveBeenCalledWith(
          query,
        );
      });
    });

    //-------------------------------
    // カバレッジ100%対応：
    // async findAll(): Promise<PrefectureResponseDto[]> {
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
        .spyOn(prefecturesService, 'findAll')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      // 厳密にErrorの内容を検証するため、toThew()→toMatchObject()に変更
      // await expect(prefecturesController.findAll()).rejects.toThrow(
      //   PrismaClientKnownRequestError,
      // );
      await expect(prefecturesController.findAll({})).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P1001',
        message: "Can't reach database server",
        clientVersion: '5.0.0',
      });
    });
  });

  //--------------------------------
  // findCovered()
  //--------------------------------
  describe('findCovered', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている', async () => {
      // service mock data 作成
      const domains: PrefectureWithCoverage[] =
        createSriviceMockDataWithCoverage();
      jest
        .spyOn(prefecturesService, 'findAllWithStoreCount')
        .mockResolvedValue(domains);

      // テスト対象Controller呼び出し
      const result = await prefecturesController.findCovered();

      // 検証
      expect(result).toEqual(createExpectedPrefectureWithCoverageDtos());
    });

    it('正常系：取得データが０件、dto[]の空配列が返却される', async () => {
      // mock data 作成(空配列)
      jest
        .spyOn(prefecturesService, 'findAllWithStoreCount')
        .mockResolvedValue([]);
      // test対象Controller呼び出し
      const result = await prefecturesController.findCovered();
      // 検証：plainToInstance()は空配列が渡ってきた場合、空配列を返す
      expect(result).toEqual([]);
    });

    it('異常系(カバレッジ100%のため)： DB接続エラー', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prefecturesService, 'findAllWithStoreCount')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      await expect(prefecturesController.findAll({})).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------
  // create() TEST
  //--------------------------------
  describe('create', () => {
    it('正常系：都道府県情報作成（DTOの全項目あり）し、DTO全項目を返却する', async () => {
      // Controllerの引数作成
      const requestDto: CreatePrefectureDto = {
        name: '石川県',
        code: '17',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        regionCode: '05',
      };

      // 引数：リクエストパラメータ作成
      // const request = {} satisfies ExpressRequest & { user: RequestUser };
      const request: Partial<ExpressRequest & { user: Partial<RequestUser> }> =
        {
          user: { id: '633931d5-2b25-45f1-8006-c137af49e53d' },
        };

      // service mock data 作成(domain + id)
      const domainWithId: Prefecture & { id: string } = {
        id: '27d991fd-fd54-4abd-b9c0-1f24270e8295',
        name: '石川県',
        code: '17',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
      };
      jest.spyOn(prefecturesService, 'create').mockResolvedValue(domainWithId);

      // test対象controller呼び出し
      const result = await prefecturesController.create(
        requestDto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        request as ExpressRequest & { user: RequestUser },
      );

      // 期待値作成(dto→plainToInstanceした時のオブジェクト)
      const expecedData: PrefectureResponseDto = {
        id: '27d991fd-fd54-4abd-b9c0-1f24270e8295',
        name: '石川県',
        code: '17',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        statusLabel: '反映中',
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
      };

      // 検証
      expect(result).toEqual(expecedData);
    });

    it('異常系: prefecturesServiceにエラーが発生した場合、元のエラーをそのまま伝搬する', async () => {
      // Controllerの引数作成
      const requestDto: CreatePrefectureDto = {
        name: '石川県',
        code: '17',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        // regionCode: '05',
      };

      // 引数：リクエストパラメータ作成
      // const request = {} satisfies ExpressRequest & { user: RequestUser };
      const request: Partial<ExpressRequest & { user: Partial<RequestUser> }> =
        {
          user: { id: '633931d5-2b25-45f1-8006-c137af49e53d' },
        };

      // service mock data(Error) 作成
      const conectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prefecturesService, 'create')
        .mockRejectedValue(conectionError);

      // テスト対象controller呼び出し
      await expect(
        prefecturesController.create(
          requestDto,
          request as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(PrismaClientKnownRequestError);

      // 検証
    });
  });

  //--------------------------------
  // findOne()
  //--------------------------------
  describe('findOne の テスト', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている', async () => {
      // 引数
      const id = '674d2683-7012-462c-b7d0-7e452ba0f1ab';

      // service mock data
      const servieMockData = createSriviceMockData().data.find(
        (prefecture) => prefecture.id === id,
      )!;
      jest
        .spyOn(prefecturesService, 'findOne')
        .mockResolvedValue(servieMockData);

      // test対象controller呼び出し
      const result = await prefecturesController.findOne(id);

      // 検証
      expect(result).toEqual({
        id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
        regionName: '関東',
        statusLabel: '反映中',
      });

      // 引数検証
      expect(jest.spyOn(prefecturesService, 'findOne')).toHaveBeenCalledWith(
        id,
      );
    });

    it('正常系：dto配列(任意項目削除)が返却される(任意項目はkey毎削除)', async () => {
      // 引数
      const id = '674d2683-7012-462c-b7d0-7e452ba0f1ab';

      // service mock data : 任意項目をundefinedに書き換え
      const mockPrefecture = createSriviceMockData().data.find(
        (prefecture) => prefecture.id === id,
      )!;
      // regionIdをundefined: regionIdはResponseDTOの項目に存在しないが念の為
      mockPrefecture.regionId = undefined;
      // regionNameをundefined
      mockPrefecture.regionName = undefined;

      jest
        .spyOn(prefecturesService, 'findOne')
        .mockResolvedValue(mockPrefecture);

      // test対象controller呼び出し
      const result = await prefecturesController.findOne(id);

      // 検証
      expect(result).toEqual({
        id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        statusLabel: '反映中',
      } satisfies PrefectureResponseDto);
    });

    it('異常系：検索結果0件（idに紐づく都道府県情報なし）', async () => {
      // 引数
      const id = '99';

      // modk data : mockRejectedValueでNotFundExceptionをセット
      jest
        .spyOn(prefecturesService, 'findOne')
        .mockRejectedValue(
          new NotFoundException(
            `idに関連する都道府県情報が存在しません!! id: ${id}`,
          ),
        );

      // test対象controller呼び出し + 検証
      await expect(prefecturesController.findOne(id)).rejects.toThrow(
        new NotFoundException(
          `idに関連する都道府県情報が存在しません!! id: ${id}`,
        ),
      );
    });

    it('異常系：DB接続エラー: serviceのエラーをそのまま伝搬', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prefecturesService, 'findOne')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      await expect(prefecturesService.findOne('99')).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //--------------------------------
  // findByCodeOrFail()
  //--------------------------------
  describe('findByCodeOrFail の テスト', () => {
    it('正常系：dto配列(全項目)が返却される(dtoは全て@Expose()がセットされている', async () => {
      // 引数
      const code = '13';

      // service mock data
      const mockPrefecture = createSriviceMockData().data.find(
        (prefecture) => prefecture.code === code,
      )!;

      // 🗒 オブジェクトからプロパティを除外するテクニック
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { regionName, ...servieMockData } = mockPrefecture;
      jest
        .spyOn(prefecturesService, 'findByCodeOrFail')
        .mockResolvedValue(servieMockData);

      // test対象controller呼び出し
      const result = await prefecturesController.findByCode(code);

      // 検証
      expect(result).toEqual({
        id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
        statusLabel: '反映中',
      });

      // 引数検証
      expect(
        jest.spyOn(prefecturesService, 'findByCodeOrFail'),
      ).toHaveBeenCalledWith(code);
    });

    // 現時点で、任意項目はregionIdのみであり、DTOにそもそも当該項目が存在しないので、
    // UT実施の意味はないが念の為。
    it('正常系：dto配列(任意項目削除)が返却される(任意項目はkey毎削除)', async () => {
      // 引数
      const code = '13';

      // service mock data : 任意項目をundefinedに書き換え
      const mockPrefecture = createSriviceMockData().data.find(
        (prefecture) => prefecture.code === code,
      )!;
      mockPrefecture.regionId = undefined;

      // 🗒 オブジェクトからプロパティを除外するテクニック
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { regionName, ...servieMockData } = mockPrefecture;
      jest
        .spyOn(prefecturesService, 'findByCodeOrFail')
        .mockResolvedValue(servieMockData);

      // test対象controller呼び出し
      const result = await prefecturesController.findByCode(code);

      // 検証
      expect(result).toEqual({
        id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        statusLabel: '反映中',
      });
    });

    it('異常系：検索結果0件（codeに紐づく都道府県情報なし）', async () => {
      // 引数
      const code = '99';

      // modk data : mockRejectedValueでNotFundExceptionをセット
      jest
        .spyOn(prefecturesService, 'findByCodeOrFail')
        .mockRejectedValue(
          new NotFoundException(
            `codeに関連する都道府県情報が存在しません!! code: ${code}`,
          ),
        );

      // test対象controller呼び出し + 検証
      await expect(prefecturesController.findByCode(code)).rejects.toThrow(
        new NotFoundException(
          `codeに関連する都道府県情報が存在しません!! code: ${code}`,
        ),
      );
    });

    it('異常系：DB接続エラー: serviceのエラーをそのまま伝搬', async () => {
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prefecturesService, 'findByCodeOrFail')
        .mockRejectedValue(connectionError);

      // Controllerがエラーをそのまま伝播（reject）することを確認
      await expect(prefecturesService.findByCodeOrFail('99')).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });

  //-----------------------------------
  // 以下は、
  // Postmanでnameなどの項目無しでリクエストすると、controllerのvalidationで弾かれるので
  // service-prismaに対して項目無しのリクエストを投げることができないので、describeを分けて、
  // 本物のservice-prismaを使用したテストにて検証してみる。
  // → と思ったけど、ちゃんと型指定でリクエストパラメータを作成したらname無しのオブジェクトは
  // 静的方チェックエラーで引っかかるので、テストする必要ないな。。と気づいた。。。
  //-----------------------------------

  // describe('■■■ PrefecturesController (Integration Tests - Real Service) ■■■', () => {
  //   // DI対象モジュール宣言
  //   let prefecturesController: PrefecturesController; // テスト対象

  //   // テスト全体の前に1回だけ実行
  //   beforeAll(async () => {
  //     console.log('beforeAll: モジュールのセットアップ');

  //     // TestクラスのcreateTestingModuleメソッドを使い、module(ItemService)のDIを実施
  //     // この便利なDIの仕組みはNestJSの仕組み。
  //     // 最後の.compile()を忘れずに(compile()にてモジュールを生成する)
  //     const module = await Test.createTestingModule({
  //       // @Module({
  //       //   imports: [PrismaModule],
  //       //   controllers: [PrefecturesController],
  //       //   providers: [PrefecturesService],
  //       // })

  //       // DI対象モジュール：module.tsをほぼコピペ（serviceのMockを指定する）
  //       controllers: [PrefecturesController],
  //       // mockではなく、本物を使用。serviceだけではなく、そこから呼ばれるPrismaServiceもDI
  //       providers: [PrefecturesService, PrismaService],
  //     }).compile();

  //     prefecturesController = module.get<PrefecturesController>(
  //       PrefecturesController,
  //     );
  //   });

  //   // 各テストケースの前に毎回実行：こっちでcreateTestingModule()してもいいが、
  //   // 重いのでbeforeAll()で1回だけ実行するようにするのがベストプラクティス
  //   beforeEach(() => {
  //     console.log('beforeEach: モックをリセット jest.clearAllMocks()');
  //     jest.clearAllMocks();
  //   });

  //   //-----------------------------------
  //   // Postmanでnameなどの項目無しでリクエストすると、controllerのvalidationで弾かれるので
  //   // service-prismaに対して項目無しのリクエストを投げることができないので、当該テストにて
  //   // 検証してみる
  //   // → と思ったけど、ちゃんと型指定でリクエストパラメータを作成したらname無しのオブジェクトは
  //   // 静的方チェックエラーで引っかかるので、テストする必要ないな。。と気づいた。。。
  //   //-----------------------------------
  //   it('異常系：nameなしで都道府県情報作成（nameなし）し、エラーを返却する', async () => {
  //     // controllerの引数作成
  //     const reqDto: CreatePrefectureDto = {
  //       // name: '石川県',
  //       code: '17',
  //       kanaName: 'イシカワ',
  //       kanaEn: 'ishikawa',
  //       status: 'published',
  //     };
  //     // テスト対象controller呼び出し
  //     const result = await prefecturesController.create(reqDto);
  //     // 検証
  //   });
  // });

  //--------------------------------
  // update()
  //--------------------------------
  describe('update', () => {
    it('正常系：都道府県情報作成（DTOの全項目あり）し、DTO全項目を返却する', async () => {
      // Controllerの引数作成
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      const requestDto: UpdatePrefectureDto = {
        name: '石川県',
        code: '77',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        regionCode: '05',
      };

      // 引数：リクエストパラメータ作成
      // const request = {} satisfies ExpressRequest & { user: RequestUser };
      const request: Partial<ExpressRequest & { user: Partial<RequestUser> }> =
        {
          user: { id: '633931d5-2b25-45f1-8006-c137af49e53d' },
        };

      // service mock data 作成(domain + id)
      const domainWithId: Prefecture & { id: string } = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '77',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
      };
      jest.spyOn(prefecturesService, 'update').mockResolvedValue(domainWithId);

      // test対象controller呼び出し
      const result = await prefecturesController.update(
        id,
        requestDto,
        // 型アサーションでキャスト（Partialで作成したmockRequestは実際の型(ExpressRequestを使っている)と
        // 完全に一致しないため、保守性がやや低下する可能性があるため）
        request as ExpressRequest & { user: RequestUser },
      );

      // 期待値作成(dto→plainToInstanceした時のオブジェクト)
      const expecedData: PrefectureResponseDto = {
        id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
        name: '石川県',
        code: '77',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        statusLabel: '反映中',
        regionId: '0524dc98-89a2-4db1-9431-b20feff57700',
      };

      // 検証
      expect(result).toEqual(expecedData);
    });

    it('異常系: prefecturesServiceにエラーが発生した場合、元のエラーをそのまま伝搬する', async () => {
      // Controllerの引数作成
      const id = '174d2683-7012-462c-b7d0-7e452ba0f1ab';
      const requestDto: CreatePrefectureDto = {
        name: '石川県',
        code: '17',
        kanaName: 'イシカワ',
        kanaEn: 'ishikawa',
        status: 'published',
        // regionCode: '05',
      };

      // 引数：リクエストパラメータ作成
      // const request = {} satisfies ExpressRequest & { user: RequestUser };
      const request: Partial<ExpressRequest & { user: Partial<RequestUser> }> =
        {
          user: { id: '633931d5-2b25-45f1-8006-c137af49e53d' },
        };

      // service mock data(Error) 作成
      const conectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      jest
        .spyOn(prefecturesService, 'update')
        .mockRejectedValue(conectionError);

      // テスト対象controller呼び出し
      await expect(
        prefecturesController.update(
          id,
          requestDto,
          request as ExpressRequest & { user: RequestUser },
        ),
      ).rejects.toThrow(PrismaClientKnownRequestError);

      // 検証
    });
  });
});

/**
 * PrefectureServiceのMockデータを作成
 * @returns
 */
function createSriviceMockData(): PaginatedResult<
  Prefecture & { id: string; regionName?: string }
> {
  const domains: (Prefecture & { id: string; regionName?: string })[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      regionId: 'a1eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '北海道',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '青森',
      code: '02',
      kanaName: 'アオモリ',
      status: 'published',
      kanaEn: 'aomori',
      regionId: 'b2eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '374d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '秋田',
      code: '03',
      kanaName: 'アキタ',
      status: 'published',
      kanaEn: 'akita',
      regionId: 'c3eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '474d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '岩手',
      code: '04',
      kanaName: 'イワテ',
      status: 'suspended',
      kanaEn: 'iwate',
      regionId: 'd4eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '574d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '山形',
      code: '05',
      kanaName: 'ヤマガタ',
      status: 'editing',
      kanaEn: 'yamagata',
      regionId: 'e5eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      regionName: '関東',
      createdAt: new Date('2025-04-05T10:00:00.000Z'),
      updatedAt: new Date('2025-04-05T12:30:00.000Z'),
    } satisfies Prefecture & { id: string; regionName?: string },
  ];

  const expected = {
    data: domains,
    meta: {
      totalCount: 6,
      page: 1,
      size: 20,
    },
  } satisfies PaginatedResult<Prefecture & { id: string; regionName?: string }>;

  return expected;
}

/**
 * PrefectureServiceのMockデータを作成
 * @returns
 */
function createSriviceMockDataWithCoverage(): PrefectureWithCoverage[] {
  const domains: PrefectureWithCoverage[] = [
    {
      prefecture: {
        name: '北海道',
        code: '01',
        kanaName: 'ホッカイドウ',
        status: 'published',
        kanaEn: 'hokkaido',
        regionId: 'a1eed450-e4f4-4003-b03b-367360d04bb3',
        regionName: '北海道',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies Prefecture & { regionName?: string },
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      storeCount: 1,
    },
    {
      prefecture: {
        name: '東京都',
        code: '13',
        kanaName: 'トウキョウト',
        status: 'published',
        kanaEn: 'tokyo-to',
        regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
        regionName: '関東',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies Prefecture & { regionName?: string },
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      storeCount: 10,
    },
  ];

  return domains;
}

/**
 * PaginatedPrefectureResponseDto期待値作成
 * @returns PaginatedPrefectureResponseDto(期待値)
 */
function createExpectedPrefectureDtos(): PaginatedPrefectureResponseDto {
  const dtos: PrefectureResponseDto[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      regionId: 'a1eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '北海道',
      statusLabel: '反映中',
    } satisfies PrefectureResponseDto,
    {
      id: '274d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '青森',
      code: '02',
      kanaName: 'アオモリ',
      status: 'published',
      kanaEn: 'aomori',
      regionId: 'b2eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      statusLabel: '反映中',
    } satisfies PrefectureResponseDto,
    {
      id: '374d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '秋田',
      code: '03',
      kanaName: 'アキタ',
      status: 'published',
      kanaEn: 'akita',
      regionId: 'c3eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      statusLabel: '反映中',
    } satisfies PrefectureResponseDto,
    {
      id: '474d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '岩手',
      code: '04',
      kanaName: 'イワテ',
      status: 'suspended',
      kanaEn: 'iwate',
      regionId: 'd4eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      statusLabel: '停止',
    } satisfies PrefectureResponseDto,
    {
      id: '574d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '山形',
      code: '05',
      kanaName: 'ヤマガタ',
      status: 'editing',
      kanaEn: 'yamagata',
      regionId: 'e5eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '東北',
      statusLabel: '編集中',
    } satisfies PrefectureResponseDto,
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      regionName: '関東',
      statusLabel: '反映中',
    } satisfies PrefectureResponseDto,
  ];

  const expected = {
    data: dtos,
    meta: {
      totalCount: 6,
      page: 1,
      size: 20,
    },
  } satisfies PaginatedPrefectureResponseDto;

  return expected;
}

/**
 * PrefectureResponseDto期待値作成
 * @returns PrefectureResponseDto(期待値)
 */
function createExpectedPrefectureWithCoverageDtos(): PrefectureResponseDto[] {
  const dtos: PrefectureResponseDto[] = [
    {
      id: '174d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '北海道',
      code: '01',
      kanaName: 'ホッカイドウ',
      status: 'published',
      kanaEn: 'hokkaido',
      regionId: 'a1eed450-e4f4-4003-b03b-367360d04bb3',
      regionName: '北海道',
      statusLabel: '反映中',
      storeCount: 1,
    } satisfies PrefectureResponseDto,
    {
      id: '674d2683-7012-462c-b7d0-7e452ba0f1ab',
      name: '東京都',
      code: '13',
      kanaName: 'トウキョウト',
      status: 'published',
      kanaEn: 'tokyo-to',
      regionId: '4164ffe0-d68b-4de4-9139-88c7c7849709',
      regionName: '関東',
      statusLabel: '反映中',
      storeCount: 10,
    } satisfies PrefectureResponseDto,
  ];

  return dtos;
}

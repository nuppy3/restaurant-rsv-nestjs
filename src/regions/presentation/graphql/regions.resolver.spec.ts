import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { RegionStatus } from '../../../regions/domain/regions.model';
import { RegionListReadModel } from '../../../regions/query/read-model/region-list.read-model';
import { RegionsQueryService } from '../../../regions/query/regions.query.service';
import { RegionQueryReturnType } from './object-types/region.object-type';
import { RegionsResolver } from './regions.resolver';

const mockRegionsQueryService = {
  findAllPaginated: jest.fn(),
};

describe('■■■　RegionsResolver TEST ■■■　', () => {
  let regionsResolver: RegionsResolver;
  // mockRegionsQueryServiceを使うのでコメント
  // let regionsQueryService: RegionsQueryService;

  // テスト全体の前に1回だけ実行
  beforeAll(async () => {
    // ・regions.module.ts
    // @Module({
    //   imports: [PrismaModule],
    //   controllers: [RegionsController],
    //   providers: [
    //     RegionsService,
    //     RegionsDomainService,
    //     RegionsQueryService,
    //     {
    //       provide: REGION_REPOSITORY_PORT,
    //       useClass: RegionRepository,
    //     },
    //     RegionsResolver,
    //   ],
    //   exports: [RegionsService, RegionsQueryService],
    // })

    const module: TestingModule = await Test.createTestingModule({
      // DI対象モジュール：module.tsをほぼコピペ
      // RegionsResolverもprovidersに設定：nest g resolver で作成するとセットされてる
      providers: [
        RegionsResolver,
        {
          provide: RegionsQueryService,
          useValue: mockRegionsQueryService,
        },
      ],
    }).compile();

    regionsResolver = module.get<RegionsResolver>(RegionsResolver);
    // mockRegionsQueryServiceを使うのでコメント
    // regionsQueryService = module.get<RegionsQueryService>(RegionsQueryService);
  });

  // 各テストケースの前に毎回実行：こっちでcreateTestingModule()してもいいが、
  // 重いのでbeforeAll()で1回だけ実行するようにするのがベストプラクティス
  beforeEach(() => {
    // console.log('beforeEach: モックをリセット jest.clearAllMocks()');
    jest.clearAllMocks();
  });

  //--------------------------------
  // regionsPaginated()
  //--------------------------------
  describe('regionsPaginated', () => {
    it('正常系：ObjectType配列(全項目)が返却される', async () => {
      // mock data セット
      mockRegionsQueryService.findAllPaginated.mockResolvedValue(
        createQueryServiceMockPaginatedResult(),
      );

      // test 対象 Resolve 呼び出し
      const result = await regionsResolver.regionsPaginated();

      // 期待値：RegionQueryReturnType[]
      const expected = [
        {
          id: 'b96509f2-0ba4-447c-8a98-473aa26e457a',
          name: '北海道',
          code: '01',
          kanaName: 'ほっかいどう',
          status: 'published',
          kanaEn: 'hokkaidou',
          prefectureCount: 1,
        } satisfies RegionQueryReturnType,
        {
          id: 'ad24dc98-89a2-4db1-9431-b20feff57700',
          name: '東北',
          code: '02',
          kanaName: 'とうほく',
          status: 'published',
          kanaEn: 'tohoku',
          prefectureCount: 2,
        } satisfies RegionQueryReturnType,
        {
          id: '4164ffe0-d68b-4de4-9139-88c7c7849709',
          name: '関東',
          code: '03',
          kanaName: 'かんとう',
          status: 'editing',
          kanaEn: 'kanto',
          prefectureCount: 3,
        } satisfies RegionQueryReturnType,
        {
          id: '7a7adc8a-20bc-4323-9ff1-6aebc48f847c',
          name: '沖縄',
          code: '10',
          kanaName: '沖縄',
          status: RegionStatus.SUSPENDED,
          kanaEn: 'okinawa',
          prefectureCount: 4,
        } satisfies RegionQueryReturnType,
      ];

      // 検証
      expect(result).toEqual(expected);
    });

    it('正常系：取得データ0件、ObjectType[]の空配列が返却される', async () => {
      // mock data セット
      mockRegionsQueryService.findAllPaginated.mockResolvedValue({
        data: [],
        meta: {
          totalCount: 0,
          page: 1,
          size: 20,
        },
      } satisfies PaginatedResult<RegionListReadModel>);

      // test 対象 Resolve 呼び出し
      const result = await regionsResolver.regionsPaginated();

      // 検証
      expect(result).toEqual([]);
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
    it('異常系： DB接続エラー', async () => {
      // Errorをmock化してquery serviceにセット
      const connectionError = new PrismaClientKnownRequestError(
        "Can't reach database server",
        { code: 'P1001', clientVersion: '5.0.0' },
      );
      mockRegionsQueryService.findAllPaginated.mockRejectedValue(
        connectionError,
      );

      // Resolverがエラーをそのまま伝播（reject）することを確認
      await expect(regionsResolver.regionsPaginated()).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
    });
  });
});

/**
 * region query service mock data (ページネーションされたRegionListReadModel[]) 作成
 *
 * @returns region query service mock data
 */
function createQueryServiceMockPaginatedResult() {
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

  // ReadModelをページネーション化
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

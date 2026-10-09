import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prefecture as PrismaPrefecture } from 'generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreStatus } from '../../stores/stores.model';
import type { PrefectureRepositoryPort } from '../domain/prefecture.repository.port';
import { PREFECTURE_REPOSITORY_PORT } from '../domain/prefecture.repository.port';
import { Prefecture } from '../domain/prefectures.model';
import { PrefectureFilter } from './prefecture.filter';
import { PrefectureCoveredReadModel } from './read-model/prefecture-covered.read-model';
import { PrefectureDetailReadModel } from './read-model/prefecture-detail.read-model';
import { PrefectureListReadModel } from './read-model/prefecture-list.read-model';

/**
 * Prismaから取得した都道府県レコード(地方名をinclude)
 */
type PrismaPrefectureWithRegion = PrismaPrefecture & {
  region: { name: string } | null;
};

/**
 * Prefecture QueryService(参照系)
 * 画面都合のRead ModelをPrismaから直接組み立てて返す(CQRS)
 * 更新系はApplication層のPrefecturesServiceが担う
 */
@Injectable()
export class PrefecturesQueryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    @Inject(PREFECTURE_REPOSITORY_PORT)
    private readonly prefectureRepository: PrefectureRepositoryPort,
  ) {}

  /**
   * 都道府県一覧をページネーションで取得する(code昇順)
   */
  async findAllPaginated(
    filters: PrefectureFilter = {},
  ): Promise<PaginatedResult<PrefectureListReadModel>> {
    // take句作成(ページサイズ): 1〜2000
    // デフォルト値設定（sizeが指定されていない場合、環境変数REGION_DEFAULT_PAGE_SIZEを参照し、未設定の場合は20件）
    const defaultSize =
      this.configService.get<number>('PREFECTURE_DEFAULT_PAGE_SIZE') ?? 20;
    // 1〜2000の範囲に制限
    // momo: なぜ、「.env」にPAGE_SIZEを定義しているのに(すればいいのに)、PAGINATION.MIN_PAGE_SIZE
    //       のように定数を別で定義しているかはpagination.constants.tsクラスのコメントを参照
    const size = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(PAGINATION.MIN_PAGE_SIZE, filters.size ?? defaultSize),
    );

    // skip句作成(offset)
    // page指定が無ければデフォルト設定(1〜10000)
    const defaultPage =
      this.configService.get<number>('PREFECTURE_DEFAULT_PAGE') ?? 1;
    const page = Math.min(
      PAGINATION.MAX_PAGE,
      Math.max(PAGINATION.MIN_PAGE, filters.page ?? defaultPage),
    );

    // prisma経由でPrefecture情報配列とRegionの名前を取得
    // 「Promise.all」を使って複数の非同期処理(findMany()とcount())を並列実行
    // Promise.allは結果を[findMany()の結果, count()の結果]というタプル型(配列)で返すので
    // 分割代入で一発取得するとシンプル
    const [records, count] = await Promise.all([
      this.prismaService.prefecture.findMany({
        include: { region: { select: { name: true } } },
        orderBy: { code: 'asc' },
        take: size,
        skip: (page - 1) * size,
      }),
      this.prismaService.prefecture.count(),
    ]);

    // prisma[] → Read Model[]の変換
    const readModels = records.map((record) => this.toListReadModel(record));

    // ReadModelをページネーション化
    return {
      data: readModels,
      meta: { totalCount: count, page, size },
    } satisfies PaginatedResult<PrefectureListReadModel>;
  }

  /**
   * 公開中の店舗が1件以上ある都道府県を、公開中の店舗数とともに取得する(code昇順)
   *
   * @returns Prefecture配列(公開中店舗有りの都道府県情報と紐づく店舗数/昇順)
   */
  async findCovered(): Promise<PrefectureCoveredReadModel[]> {
    // 店舗(Store)のstatus条件
    const publishedStore = { status: StoreStatus.PUBLISHED };

    // prisma経由でPrefecture情報配列取得（アクティブ店舗のあるPrefecture）
    const records = await this.prismaService.prefecture.findMany({
      where: { store: { some: publishedStore } },
      include: {
        region: { select: { name: true } },
        _count: { select: { store: { where: publishedStore } } },
      },
      orderBy: { code: 'asc' },
    });

    // 🗒：Prisma[] → PrefectureCoveredReadModel[] 変換は以下の２パターンある
    //
    // 案① Object.assign()で ReadModel + { storeCount: n } を作成
    // const readModels = records.map(
    //   (record) =>
    //     Object.assign({}, this.toListReadModel(record), {
    //       storeCount: record._count.store,
    //     }) satisfies PrefectureCoveredReadModel,
    // ) satisfies PrefectureCoveredReadModel[];

    // 案② スプレッド構文で ＋ ReadModel + { storeCount: n } を作成
    const readModels = records.map(
      (record) =>
        ({
          ...this.toListReadModel(record),
          storeCount: record._count.store,
        }) satisfies PrefectureCoveredReadModel,
    ) satisfies PrefectureCoveredReadModel[];

    // return records.map((record) => ({
    //   ...this.toListReadModel(record),
    //   storeCount: record._count.store,
    // }));

    return readModels;
  }

  /**
   * idに紐づく都道府県の詳細を取得する。存在しない場合はNotFoundException
   *
   * @param id 都道府県ID(取得対象id)
   * @returns 都道府県情報詳細
   */
  async getDetailByIdOrThrow(id: string): Promise<PrefectureDetailReadModel> {
    // 都道府県情報 + 地方情報（名前）取得
    const record = await this.prismaService.prefecture.findUnique({
      where: { id },
      include: { region: { select: { name: true } } },
    });

    // 都道府県情報が無ければ
    if (!record) {
      throw new NotFoundException(
        `idに関連する都道府県情報が存在しません!! prefectureId: ${id}`,
      );
    }

    // prisma → ReadModel
    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都道府県の詳細を取得する。存在しない場合はNotFoundException
   *
   * @param code 都道府県コード
   * @returns 都道府県情報詳細
   */
  async getDetailByCodeOrThrow(
    code: string,
  ): Promise<PrefectureDetailReadModel> {
    // 都道府県情報 + 地方情報（名前）取得
    const record = await this.prismaService.prefecture.findUnique({
      where: { code },
      include: { region: { select: { name: true } } },
    });

    if (!record) {
      throw new NotFoundException(
        `codeに関連する都道府県情報が存在しません!! code: ${code}`,
      );
    }

    // prisma → ReadModel
    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都道府県をdomainで取得する(他モジュール(Store)からの参照用)
   * 存在しない場合はNotFoundException
   *
   * @param code 都道府県コード
   * @returns 都道府県情報
   */
  async findByCodeOrFail(code: string): Promise<Prefecture & { id: string }> {
    return this.prefectureRepository.findByCodeOrFail(code);
  }

  /**
   * Prismaレコード → 一覧用Read Model
   * DBのnullはRead Modelではundefinedとして扱う(レスポンスで項目ごと省略されるため)
   */
  private toListReadModel(
    record: PrismaPrefectureWithRegion,
  ): PrefectureListReadModel {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      kanaName: record.kanaName,
      kanaEn: record.kanaEn,
      status: record.status,
      regionId: record.regionId ?? undefined,
      regionName: record.region?.name ?? undefined,
    } satisfies PrefectureListReadModel;
  }

  /**
   * Prismaレコード → 詳細用Read Model
   */
  private toDetailReadModel(
    record: PrismaPrefectureWithRegion,
  ): PrefectureDetailReadModel {
    return {
      ...this.toListReadModel(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

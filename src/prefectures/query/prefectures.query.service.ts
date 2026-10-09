import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prefecture as PrismaPrefecture } from 'generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
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
    //
    const page = Math.min(
      PAGINATION.MAX_PAGE,
      Math.max(PAGINATION.MIN_PAGE, filters.page ?? defaultPage),
    );

    const [records, count] = await Promise.all([
      this.prismaService.prefecture.findMany({
        include: { region: { select: { name: true } } },
        orderBy: { code: 'asc' },
        take: size,
        skip: (page - 1) * size,
      }),
      this.prismaService.prefecture.count(),
    ]);

    return {
      data: records.map((record) => this.toListReadModel(record)),
      meta: { totalCount: count, page, size },
    } satisfies PaginatedResult<PrefectureListReadModel>;
  }

  /**
   * 公開中の店舗が1件以上ある都道府県を、公開中の店舗数とともに取得する(code昇順)
   */
  async findCovered(): Promise<PrefectureCoveredReadModel[]> {
    // 店舗(Store)のstatus条件。Prefectureのstatusではない点に注意
    const publishedStore = { status: 'published' as const };

    const records = await this.prismaService.prefecture.findMany({
      where: { store: { some: publishedStore } },
      include: {
        region: { select: { name: true } },
        _count: { select: { store: { where: publishedStore } } },
      },
      orderBy: { code: 'asc' },
    });

    return records.map((record) => ({
      ...this.toListReadModel(record),
      storeCount: record._count.store,
    }));
  }

  /**
   * idに紐づく都道府県の詳細を取得する。存在しない場合はNotFoundException
   */
  async getDetailByIdOrThrow(id: string): Promise<PrefectureDetailReadModel> {
    const record = await this.prismaService.prefecture.findUnique({
      where: { id },
      include: { region: { select: { name: true } } },
    });

    if (!record) {
      throw new NotFoundException(
        `idに関連する都道府県情報が存在しません!! prefectureId: ${id}`,
      );
    }

    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都道府県の詳細を取得する。存在しない場合はNotFoundException
   */
  async getDetailByCodeOrThrow(
    code: string,
  ): Promise<PrefectureDetailReadModel> {
    const record = await this.prismaService.prefecture.findUnique({
      where: { code },
      include: { region: { select: { name: true } } },
    });

    if (!record) {
      throw new NotFoundException(
        `codeに関連する都道府県情報が存在しません!! code: ${code}`,
      );
    }

    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都道府県をdomainで取得する(他モジュール(Store)からの参照用)
   * 存在しない場合はNotFoundException
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
    };
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

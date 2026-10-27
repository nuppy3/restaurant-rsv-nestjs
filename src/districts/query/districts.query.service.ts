import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { DistrictStatus } from '../domain/districts.model';
import { DistrictFilter } from './district.filter';
import { DistrictDetailReadModel } from './read-model/district-detail.read-model';
import { DistrictListReadModel } from './read-model/district-list.read-model';
import { DistrictOptionReadModel } from './read-model/district-option.read-model';

/**
 * DistrictsQueryService(参照系)
 * 画面都合のRead ModelをPrismaから直接組み立てて返す(CQRS)
 * 更新系はApplication層のDistrictsServiceが担う
 *
 * 参照系はdomainのルールを通す必要がないため、Repository(domain)を経由せず、
 * Prismaで必要な項目を結合して、そのままRead Modelにする。
 */
@Injectable()
export class DistrictsQueryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * findAllPaginated(): 地区一覧をページネーションで取得する(sortOrder昇順 → code昇順)
   *
   * @param filters 検索条件(cityId/page/size)。未指定ならデフォルト値
   * @returns 地区一覧(Read Model)とページ情報(総件数・ページ番号・件数)
   */
  async findAllPaginated(
    filters: DistrictFilter = {},
  ): Promise<PaginatedResult<DistrictListReadModel>> {
    // take句作成(ページサイズ): 1〜2000の範囲に制限
    // 未指定の場合は環境変数 DISTRICT_DEFAULT_PAGE_SIZE、それも無ければ20件
    const defaultSize =
      this.configService.get<number>('DISTRICT_DEFAULT_PAGE_SIZE') ?? 20;
    const size = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(PAGINATION.MIN_PAGE_SIZE, filters.size ?? defaultSize),
    );

    // skip句作成(何件目から取得するか): ページ番号は1〜10000の範囲に制限
    // 未指定の場合は環境変数 DISTRICT_DEFAULT_PAGE、それも無ければ1ページ目
    const defaultPage =
      this.configService.get<number>('DISTRICT_DEFAULT_PAGE') ?? 1;
    const page = Math.min(
      PAGINATION.MAX_PAGE,
      Math.max(PAGINATION.MIN_PAGE, filters.page ?? defaultPage),
    );

    // 地区一覧(都市名付き)と総件数を、Promise.allで並列に取得する
    // 結果は [findMany()の結果, count()の結果] の配列で返るので、分割代入で受け取る
    const [prismaDistricts, count] = await Promise.all([
      this.prismaService.district.findMany({
        // 都市名取得
        include: { city: { select: { name: true } } },
        // 表示順(sortOrder)の昇順。sortOrderが同じ都市どうしの順番がぶれないよう、code昇順を2つ目の条件にする
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: size,
        // offset
        skip: (page - 1) * size,
      }),
      this.prismaService.district.count(),
    ]);

    // prisma[] → Read Model[]の変換
    const readModels = prismaDistricts.map(
      (district) =>
        ({
          id: district.id,
          code: district.code,
          name: district.name,
          kanaName: district.kanaName,
          slug: district.slug,
          status: district.status,
          sortOrder: district.sortOrder,
          cityId: district.cityId,
        }) satisfies DistrictListReadModel,
    );

    // PaginatedResult(ReadModelとページネーション情報)にまとめる
    const paginated = {
      data: readModels,
      meta: {
        totalCount: count,
        page,
        size,
      },
    } satisfies PaginatedResult<DistrictListReadModel>;

    return paginated;
  }

  /**
   * findAll(): 地区情報一覧(全件・ページネーションなし)を取得し、返却します。
   *            ドロップダウンなど、全件を軽量な形で必要とする画面向け。
   *            一覧画面用のfindAllPaginated()とは異なり、件数(count)の算出や
   *            take/skipによる絞り込みは行わない。
   *
   * memo: statusはPUBLISHEDに固定(ハードコード)。編集中・停止中のエリアを
   *       選択肢に出すのは業務的に不自然なため、外部からのfilter引数は受け付けない。
   *
   * @returns 地区情報一覧(DistrictOptionReadModel[])
   */
  async findAll(): Promise<DistrictOptionReadModel[]> {
    const prismaDistricts = await this.prismaService.district.findMany({
      // ステータス：公開中
      where: { status: DistrictStatus.PUBLISHED },
      orderBy: { code: 'asc' },
    });

    // prisma[] → read model[]
    const readModels = prismaDistricts.map(
      (district) =>
        ({
          id: district.id,
          code: district.code,
          name: district.name,
        }) satisfies DistrictOptionReadModel,
    );
    return readModels;
  }

  /**
   * getDetailByIdOrThrow: 指定されたIDの地区情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたIDのDistrictが存在しない場合は `NotFoundException` をスローします。
   *
   * @param id - 取得対象のDistrict ID
   * @returns District Detail Read Model(地区詳細情報)
   * @throws {NotFoundException} 指定されたIDのDistrictが存在しない場合
   */
  async getDetailByIdOrThrow(id: string): Promise<DistrictDetailReadModel> {
    // 地区情報取得
    const prismaDistrict = await this.prismaService.district.findUnique({
      include: { city: { select: { name: true } } },
      where: { id },
    });

    // 存在しなければ404
    if (!prismaDistrict) {
      throw new NotFoundException(
        `idに関連する地区情報が存在しません!! DistrictId: ${id}`,
      );
    }

    // prisma → read model
    return {
      id: prismaDistrict.id,
      code: prismaDistrict.code,
      name: prismaDistrict.name,
      kanaName: prismaDistrict.kanaName,
      slug: prismaDistrict.slug,
      status: prismaDistrict.status,
      sortOrder: prismaDistrict.sortOrder,
      cityId: prismaDistrict.cityId,
      updatedAt: prismaDistrict.updatedAt,
      createdAt: prismaDistrict.createdAt,
    } satisfies DistrictDetailReadModel;
  }

  /**
   * getDetailByCodeOrThrow: 指定されたcodeの地区情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたcodeのDistrictが存在しない場合は `NotFoundException` をスローします。
   *
   * @param code - 取得対象のDistrict code
   * @returns District Detail Read Model(地区詳細情報)
   * @throws {NotFoundException} 指定されたIDのDistrictが存在しない場合
   */
  async getDetailByCodeOrThrow(code: string): Promise<DistrictDetailReadModel> {
    // 地区情報取得
    const prismaDistrict = await this.prismaService.district.findUnique({
      include: { city: { select: { name: true } } },
      where: { code },
    });

    // 存在しなければ404
    if (!prismaDistrict) {
      throw new NotFoundException(
        `codeに関連する地区情報が存在しません!! code: ${code}`,
      );
    }

    // prisma → read model
    return {
      id: prismaDistrict.id,
      code: prismaDistrict.code,
      name: prismaDistrict.name,
      kanaName: prismaDistrict.kanaName,
      slug: prismaDistrict.slug,
      status: prismaDistrict.status,
      sortOrder: prismaDistrict.sortOrder,
      cityId: prismaDistrict.cityId,
      updatedAt: prismaDistrict.updatedAt,
      createdAt: prismaDistrict.createdAt,
    } satisfies DistrictDetailReadModel;
  }
}

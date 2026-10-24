import { ConfigService } from '@nestjs/config';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PrismaService } from '../../prisma/prisma.service';
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

  findAll(): DistrictOptionReadModel {
    return new DistrictOptionReadModel();
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
  getDetailByIdOrThrow(id: string): DistrictDetailReadModel {
    return new DistrictDetailReadModel();
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
  getDetailByCodeOrThrow(code: string): DistrictDetailReadModel {
    return new DistrictDetailReadModel();
  }
}

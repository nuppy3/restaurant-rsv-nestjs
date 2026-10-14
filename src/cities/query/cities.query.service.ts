import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { City as PrismaCity } from 'generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { City } from '../domain/cities.model';
import type { CityRepositoryPort } from '../domain/city.repository.port';
import { CITY_REPOSITORY_PORT } from '../domain/city.repository.port';
import { CityFilter } from './city.filter';
import { CityDetailReadModel } from './read-model/city-detail.read-model';
import { CityListReadModel } from './read-model/city-list.read-model';

/**
 * Prismaから取得した都市レコード(都道府県名をinclude)
 * include した prefecture は、都道府県が未設定の都市では null になる
 */
type PrismaCityWithPrefecture = PrismaCity & {
  prefecture: { name: string } | null;
};

/**
 * City QueryService(参照系)
 * 画面都合のRead ModelをPrismaから直接組み立てて返す(CQRS)
 * 更新系はApplication層のCitiesServiceが担う
 *
 * 参照系はdomainのルールを通す必要がないため、Repository(domain)を経由せず、
 * Prismaで必要な項目(都道府県名など)を結合して、そのままRead Modelにする。
 */
@Injectable()
export class CitiesQueryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    // findByCodeOrFail(他モジュールからdomainで参照する用)だけはRepositoryを使う
    @Inject(CITY_REPOSITORY_PORT)
    private readonly cityRepository: CityRepositoryPort,
  ) {}

  /**
   * 都市一覧をページネーションで取得する(sortOrder昇順 → code昇順)
   *
   * @param filters 検索条件(page / size)。未指定ならデフォルト値
   * @returns 都市一覧(Read Model)とページ情報(総件数・ページ番号・件数)
   */
  async findAllPaginated(
    filters: CityFilter = {},
  ): Promise<PaginatedResult<CityListReadModel>> {
    // take句作成(ページサイズ): 1〜2000の範囲に制限
    // 未指定の場合は環境変数 CITY_DEFAULT_PAGE_SIZE、それも無ければ20件
    const defaultSize =
      this.configService.get<number>('CITY_DEFAULT_PAGE_SIZE') ?? 20;
    const size = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(PAGINATION.MIN_PAGE_SIZE, filters.size ?? defaultSize),
    );

    // skip句作成(何件目から取得するか): ページ番号は1〜10000の範囲に制限
    // 未指定の場合は環境変数 CITY_DEFAULT_PAGE、それも無ければ1ページ目
    const defaultPage =
      this.configService.get<number>('CITY_DEFAULT_PAGE') ?? 1;
    const page = Math.min(
      PAGINATION.MAX_PAGE,
      Math.max(PAGINATION.MIN_PAGE, filters.page ?? defaultPage),
    );

    // 都市一覧(都道府県名付き)と総件数を、Promise.allで並列に取得する
    // 結果は [findMany()の結果, count()の結果] の配列で返るので、分割代入で受け取る
    const [records, count] = await Promise.all([
      this.prismaService.city.findMany({
        // 都道府県は名前だけ取得する(画面表示用)
        include: { prefecture: { select: { name: true } } },
        // 表示順(sortOrder)の昇順。sortOrderが同じ都市どうしの順番がぶれないよう、code昇順を2つ目の条件にする
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: size,
        skip: (page - 1) * size,
      }),
      this.prismaService.city.count(),
    ]);

    // Prismaレコード[] → Read Model[] に変換
    const readModels = records.map((record) => this.toListReadModel(record));

    // Read Modelとページ情報をまとめて返す
    return {
      data: readModels,
      meta: { totalCount: count, page, size },
    } satisfies PaginatedResult<CityListReadModel>;
  }

  /**
   * idに紐づく都市の詳細を取得する。存在しない場合はNotFoundException
   *
   * @param id 都市ID
   * @returns 都市の詳細(Read Model)
   */
  async getDetailByIdOrThrow(id: string): Promise<CityDetailReadModel> {
    // 都市 + 都道府県名を取得(見つからなければnull)
    const record = await this.prismaService.city.findUnique({
      where: { id },
      include: { prefecture: { select: { name: true } } },
    });

    // 存在しなければ404
    if (!record) {
      throw new NotFoundException(
        `idに関連する都市情報が存在しません!! cityId: ${id}`,
      );
    }

    // Prismaレコード → Read Model
    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都市の詳細を取得する。存在しない場合はNotFoundException
   *
   * @param code 都市コード(例: '001')
   * @returns 都市の詳細(Read Model)
   */
  async getDetailByCodeOrThrow(code: string): Promise<CityDetailReadModel> {
    // 都市 + 都道府県名を取得(codeは@uniqueなのでfindUniqueで取得できる)
    const record = await this.prismaService.city.findUnique({
      where: { code },
      include: { prefecture: { select: { name: true } } },
    });

    if (!record) {
      throw new NotFoundException(
        `codeに関連する都市情報が存在しません!! code: ${code}`,
      );
    }

    return this.toDetailReadModel(record);
  }

  /**
   * codeに紐づく都市をdomainで取得する(他モジュールからの参照用)
   * 存在しない場合はNotFoundException
   *
   * 例: 地区(District)を作成するときに、都市コード → 都市ID に解決する用途で使う。
   * domainを返すため、Repositoryに委譲する(Read Modelではない)
   *
   * @param code 都市コード
   * @returns 都市(domain。idはdomain自身が持つ)
   */
  async findByCodeOrFail(code: string): Promise<City> {
    return this.cityRepository.findByCodeOrFail(code);
  }

  /**
   * Prismaレコード → 一覧用Read Model
   * DBのnullはRead Modelではundefinedとして扱う(レスポンスで項目ごと省略されるため)
   */
  private toListReadModel(record: PrismaCityWithPrefecture): CityListReadModel {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      kanaName: record.kanaName,
      slug: record.slug,
      status: record.status,
      sortOrder: record.sortOrder,
      prefectureId: record.prefectureId ?? undefined,
      // 都道府県が未設定ならprefectureはnullなので、?. と ?? で undefined にする
      prefectureName: record.prefecture?.name ?? undefined,
    } satisfies CityListReadModel;
  }

  /**
   * Prismaレコード → 詳細用Read Model
   * 一覧の項目に、作成日時・更新日時を加える
   */
  private toDetailReadModel(
    record: PrismaCityWithPrefecture,
  ): CityDetailReadModel {
    return {
      ...this.toListReadModel(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies CityDetailReadModel;
  }
}

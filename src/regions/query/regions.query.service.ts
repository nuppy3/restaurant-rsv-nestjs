import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegionRepositoryPort } from '../domain/region.repository.port';
import { REGION_REPOSITORY_PORT } from '../domain/region.repository.port';
import { Region, RegionStatus } from '../domain/regions.model';
import { RegionDetailReadModel } from './read-model/region-detail.read-model';
import { RegionListReadModel } from './read-model/region-list.read-model';
import { RegionOptionReadModel } from './read-model/region-option.read-model';
import { RegionFilter, SortBy, SortOrder } from './region.filter';

/**
 * RegionsQueryServiceService: 参照・表示用のQuery Service
 *
 * ＜ CQRS（コマンドクエリ責務分離） という考え方に基づき、参照・表示用のServiceを分ける＞
 * 役割： 画面が必要なデータを最速で取得します。
 * 特徴： ドメインモデルを介さず、直接PrismaやSQLを使用し画面専用のDTOを返却します。
 *       画面が必要な形に合わせて、複数のテーブルをjoin、カウントしたりして、DTOを返却します。
 */
@Injectable()
export class RegionsQueryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    @Inject(REGION_REPOSITORY_PORT)
    private readonly regionRepository: RegionRepositoryPort,
  ) {}

  /**
   * findAllPaginated(): エリア情報リスト取得（全て)し、返却します。
   *            エリア情報リストはページネーション化して返却します。
   *
   * @param filters - 検索条件（すべて省略可能）
   *                  - `status`: ステータス（例: 'editing'）を指定すると、そのステータスに関連するエリアのみを返します
   *                  - 指定がない場合は全エリアを対象とします
   * @example
   * ```ts
   * // ステータスが編集中のエリアのみ取得
   * await this.regionsQueryService.findAllPaginated({ status: 'editing' });
   *
   * // 全エリア取得（フィルタなし）
   * await this.regionsQueryService.findAllPaginated();
   * ```
   * @returns エリア情報一覧(ページネーション化された)
   */
  async findAllPaginated(
    // filtersが存在しない(filters === undefined のとき)場合は{}で初期化
    // memo: filtersがnullの際は{}で初期化されない。が、nullを渡そうとしても
    // 「型 'null' の引数を型 'StoreFilter | undefined' のパラメーターに割り当てることはできません。」
    // で、tslint？が弾いてくれる。
    // また、リクエストパラメータで?name=nullというパラメータがリクエストされたとしても、
    // controllerはname='null'という文字列で受け取るためValidationにてnumberじゃないよと
    // エラーになるため、serviceにnullが渡ってくることはない。
    filters: RegionFilter = {},
  ): Promise<PaginatedResult<RegionListReadModel>> {
    // where句作成
    const commonWhere = this.toWhere(filters);
    // OrderBy句作成
    const orderBy = this.toOrderBy(filters);

    // take句作成(ページサイズ): 1〜2000
    // デフォルト値設定（sizeが指定されていない場合、環境変数REGION_DEFAULT_PAGE_SIZEを参照し、未設定の場合は20件）
    const defaultSize =
      filters.size ??
      this.configService.get<number>('REGION_DEFAULT_PAGE_SIZE') ??
      20;
    // 1〜2000の範囲に制限
    // momo: なぜ、「.env」にPAGE_SIZEを定義しているのに(すればいいのに)、PAGINATION.MIN_PAGE_SIZE
    //       のように定数を別で定義しているかはpagination.constants.tsクラスのコメントを参照
    const size = Math.min(
      Math.max(defaultSize, PAGINATION.MIN_PAGE_SIZE),
      PAGINATION.MAX_PAGE_SIZE,
    );

    // skip句作成(offset)
    // page指定が無ければデフォルト設定(1〜10000)
    let defaultPage =
      filters.page ??
      this.configService.get<number>('REGION_DEFAULT_PAGE') ??
      1;
    defaultPage = Math.min(
      Math.max(defaultPage, PAGINATION.MIN_PAGE),
      PAGINATION.MAX_PAGE,
    );
    // offset計算: (page-1)*size
    const skip = (defaultPage - 1) * size;

    // prisma経由でRegion情報配列と件数を取得
    // 「Promise.all」を使って複数の非同期処理(findMany()とcount())を並列実行
    // Promise.allは結果を[findMany()の結果, count()の結果]というタプル型(配列)で返すので
    // 分割代入で一発取得するとシンプル
    const [prismaRegions, count] = await Promise.all([
      // エリア情報取得
      this.prismaService.region.findMany({
        include: { _count: { select: { prefectures: true } } },
        // Prismaで部分一致（SQLの LIKE '%値%'）をしたい場合は、contains を使う
        // where: { code: filters.code, name: { contains: filters.name } },
        where: commonWhere,
        // サイズ
        take: size,
        // offset(最初のXX件を飛ばす)
        skip: skip,
        // orderBy: { code: 'asc' },
        orderBy: orderBy,
      }),
      this.prismaService.region.count({
        // where: { code: filters.code, name: { contains: filters.name } },
        where: commonWhere,
      }),
    ]);

    // // エリア情報取得
    // const regions = await this.prismaService.region.findMany({
    //   include: { _count: { select: { prefectures: true } } },
    //   orderBy: { code: 'asc' },
    // });

    // // エリア情報の件数
    // const count = await this.prismaService.region.count();

    // prisma → domain
    // .map()は、regionsが空配列の場合も正常に動作し空配列を返却する仕様
    //   const domains: (Region & { id: string })[] = regions.map((region) => ({
    //     id: region.id,
    //     code: region.code,
    //     name: region.name,
    //     kanaName: region.kanaName,
    //     status: region.status,
    //     kanaEn: region.kanaEn,
    //     createdAt: region.createdAt,
    //     updatedAt: region.updatedAt,
    //   }));
    //   return domains;
    // }

    // 20270801: prisma[] → Read Model[] 変換対応のため、以下、コメント
    // // prisma[] → dto[] の 変換ロジック
    // // ⭐️UIを意識して、データ変換などが必要になった際は以下のようなロジックがいい感じ
    // const dtos = regions.map((prismaRegion) => {
    //   // データ変換
    //   const plainObj = {
    //     id: prismaRegion.id,
    //     name: prismaRegion.name,
    //     code: prismaRegion.code,
    //     // kanaName: prismaRegion.kanaName ?? undefined, // 例: nullならundefined
    //     kanaName: prismaRegion.kanaName,
    //     status: prismaRegion.status,
    //     kanaEn: prismaRegion.kanaEn,
    //     prefectureCount: prismaRegion._count.prefectures,
    //     // sortOrder: index + 1, // 例: 連番を画面用に付与
    //   } satisfies Partial<RegionResponseDto>;

    //   // prisma[] → dto[]
    //   return instanceToPlain(
    //     plainToInstance(RegionResponseDto, plainObj, {
    //       // @Expose() がないプロパティは全部消える
    //       // 値が undefined or null の場合、キーごと消える
    //       excludeExtraneousValues: true,
    //     }),
    //   ) as RegionResponseDto;
    // });
    //
    // return dtos;

    // prisma[] → Read Model[]の変換
    const readModels = prismaRegions.map((prismaRegion) => {
      // データ変換
      const readModel = {
        id: prismaRegion.id,
        name: prismaRegion.name,
        code: prismaRegion.code,
        // kanaName: prismaRegion.kanaName ?? undefined, // 例: nullならundefined
        kanaName: prismaRegion.kanaName,
        status: prismaRegion.status,
        kanaEn: prismaRegion.kanaEn,
        prefectureCount: prismaRegion._count.prefectures,
        // sortOrder: index + 1, // 例: 連番を画面用に付与
      } satisfies RegionListReadModel;

      return readModel;
    });

    // ReadModelをページネーション化
    const paginated = {
      data: readModels,
      meta: {
        totalCount: count,
        page: defaultPage,
        size: size,
      },
    } satisfies PaginatedResult<RegionListReadModel>;

    return paginated;
  }

  /**
   * findAll(): エリア情報一覧(全件・ページネーションなし)を取得し、返却します。
   *            ドロップダウンなど、全件を軽量な形で必要とする画面向け。
   *            一覧画面用のfindAllPaginated()とは異なり、件数(count)の算出や
   *            take/skipによる絞り込みは行わない。
   *
   * memo: statusはPUBLISHEDに固定(ハードコード)。編集中・停止中のエリアを
   *       選択肢に出すのは業務的に不自然なため、外部からのfilter引数は受け付けない。
   *
   * @returns エリア情報一覧(RegionOptionReadModel[])
   */
  async findAll(): Promise<RegionOptionReadModel[]> {
    const where = this.toWhere({ status: RegionStatus.PUBLISHED });
    const orderBy = this.toOrderBy({});

    const prismaRegions = await this.prismaService.region.findMany({
      where,
      orderBy,
    });

    // 短縮形：アロー関数の暗黙的return(オブジェクトリテラルなので()で囲む)
    return prismaRegions.map(
      (prismaRegion) =>
        ({
          id: prismaRegion.id,
          code: prismaRegion.code,
          name: prismaRegion.name,
        }) satisfies RegionOptionReadModel,
    );
  }

  /**
   * ※未公開のメソッド。
   * 詳細情報の取得はQuery ServiceのgetDettailByIdOrThrow()を参照。
   *
   * findOne: 指定されたIDのエリア情報(Domain(Entity))を取得します。
   *
   * 指定されたIDのRegionが存在しない場合は `NotFoundException` をスローします。
   *
   * @param id - 取得対象のRegion ID
   * @returns Regionドメインオブジェクト（id付き）
   * @throws {NotFoundException} 指定されたIDのRegionが存在しない場合
   */
  async findOne(id: string): Promise<Region & { id: string }> {
    // DBから更新対象のRegionを取得(なければ404) ---
    // Region取得(DB) → domain (reconstitute)
    return await this.regionRepository.findByIdOrFail(id);
  }

  /**
   * ※未公開のメソッド。
   * findByCodeOrFail(): 指定されたcodeに関連するエリア情報をDBから取得し、返却します。
   *                     指定されたcodeに関連する店舗情報が存在しない場合はNotFoundExceptionとします。
   *
   * @param code エリアコード
   * @returns エリア情報
   */
  async findByCodeOrFail(code: string): Promise<Region & { id: string }> {
    // エリア情報取得 : 以下をRepositoryへ移管
    // const prismaRegion = await this.prismaService.region.findUnique({
    //   where: { code }, // カラム名とパラメータがイコールなら省略可能(code: code)
    // });
    // if (!prismaRegion) {
    //   throw new NotFoundException(
    //     `codeに関連するエリア情報が存在しません!! code: ${code}`,
    //   );
    // }
    // // prisma → domain
    // const domain = RegionMapper.toDomain(prismaRegion);
    // return domain;

    // DBから更新対象のRegionを取得(なければ404) ---
    // Region取得(DB) → domain (reconstitute)
    return await this.regionRepository.findByCodeOrFail(code);
  }

  /**
   * getDetailByIdOrThrow: 指定されたIDのエリア情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたIDのRegionが存在しない場合は `NotFoundException` をスローします。
   *
   * @param id - 取得対象のRegion ID
   * @returns Region Detail Read Model(エリア詳細情報)
   * @throws {NotFoundException} 指定されたIDのRegionが存在しない場合
   */
  async getDetailByIdOrThrow(id: string): Promise<RegionDetailReadModel> {
    // DBからRegionを取得
    const prismaRegion = await this.prismaService.region.findUnique({
      include: { _count: { select: { prefectures: true } } },
      where: { id },
    });

    // エリア情報が無ければ
    if (!prismaRegion) {
      throw new NotFoundException(
        `idに関連するエリア情報が存在しません!! regionId: ${id}`,
      );
    }
    // region(DB) → Read Model
    const readModel = {
      id: prismaRegion.id,
      code: prismaRegion.code,
      name: prismaRegion.name,
      kanaName: prismaRegion.kanaName,
      kanaEn: prismaRegion.kanaEn,
      status: prismaRegion.status,
      prefectureCount: prismaRegion._count.prefectures,
      createdAt: prismaRegion.createdAt,
      updatedAt: prismaRegion.updatedAt,
    } satisfies RegionDetailReadModel;

    return readModel;
  }

  /**
   * getDetailByCodeOrThrow: 指定されたcodeのエリア情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたcodeのRegionが存在しない場合は `NotFoundException` をスローします。
   *
   * @param code - 取得対象のRegion code
   * @returns Region Detail Read Model(エリア詳細情報)
   * @throws {NotFoundException} 指定されたcodeのRegionが存在しない場合
   */
  async getDetailByCodeOrThrow(code: string): Promise<RegionDetailReadModel> {
    // DBからRegionを取得
    const prismaRegion = await this.prismaService.region.findUnique({
      include: { _count: { select: { prefectures: true } } },
      where: { code },
    });

    // エリア情報が無ければ
    if (!prismaRegion) {
      throw new NotFoundException(
        `codeに関連するエリア情報が存在しません!! regionCode: ${code}`,
      );
    }
    // region(DB) → Read Model
    const readModel = {
      id: prismaRegion.id,
      code: prismaRegion.code,
      name: prismaRegion.name,
      kanaName: prismaRegion.kanaName,
      kanaEn: prismaRegion.kanaEn,
      status: prismaRegion.status,
      prefectureCount: prismaRegion._count.prefectures,
      createdAt: prismaRegion.createdAt,
      updatedAt: prismaRegion.updatedAt,
    } satisfies RegionDetailReadModel;

    return readModel;
  }

  /**
   * findMany,countのWhere句を作成します。（共通部分）
   *
   * where: 基本はオブジェクト（AND条件）： Prisma.RegionWhereInput
   *        複数条件をORで結合したい時： Prisma.RegionWhereInput[] (配列)
   *        { OR: [...] } や配列をORキーに入れる
   *
   * @param filters 検索条件
   * @returns where句（共通部分)
   */
  private toWhere(filters: RegionFilter): Prisma.RegionWhereInput {
    // where句はOrder byのように配列ではなく、オブジェクトで作成することが多い。
    // where句は基本的にはAND条件になるので。ORの条件がある場合は、配列にする。
    // const where: Prisma.RegionWhereInput[] = [];
    const where = {
      // ---------------------------------------------------------------------
      // Prisma仕様：値が undefined のプロパティは、クエリ（Where句）から自動的に除外されるという
      // 非常に便利な性質があります。
      // filters.code がundefinedの場合、Prismaはその検索条件を無視してくれる！

      // (スプレッド構文)...( 条件A && {条件Aが満たされたら展開してほしいコード}) で、
      // この条件が満たされたら、このオブジェクトを展開して追加してね
      // codeがtruthy(null/undefined/''/数値の0/false 以外)の場合

      // Prismaのwhere句の実装では以下の三項演算子ではなくスプレッド構文が有益！！
      // ...(filters.code && { code: filters.code }),
      //
      //  where: filters.code
      //   ? { regon: { code: filters.code } }
      //   : {},
      // ---------------------------------------------------------------------

      // 以下のcodeなどと同様に...(filters.code && {をカマしても同様のクエリが作成されるが
      // codeのケースのように単純な条件の場合は以下でもいい
      // code: filters.code,
      // → 念の為、こっちを採用
      ...(filters.code && { code: filters.code }),

      // 📖メモ：
      // ...(filters.name && { をカマさず、上記のcodeと同様に「name: { contains: filters.name }」
      // と実装してしまうと、注意が必要 → もし filters.name が undefined だった場合、
      // Prismaは { name: { contains: undefined } } と解釈しようとして、エラーを投げるか
      // 意図しない挙動になるバージョンがあります

      // Prismaで部分一致（SQLの LIKE '%値%'）をしたい場合は、contains を使う
      ...(filters.name && { name: { contains: filters.name } }),
      ...(filters.status && { status: filters.status }),
    } satisfies Prisma.RegionWhereInput;

    return where;
  }

  /**
   * findMany,countのorderBy句を作成します。
   *
   * default:
   *  codeのASC(昇順)
   *
   * findMany()のorderBy句は
   *  型：
   *    Prisma.RegionOrderByWithRelationInputと
   *    Prisma.RegionOrderByWithRelationInput[] の両方を許容しているので[]配列版で生成。
   *
   * @param filters 検索条件
   * @returns orderBy句
   */
  private toOrderBy(
    filters: RegionFilter,
  ): Prisma.RegionOrderByWithRelationInput[] {
    // OrderBy句作成： デフォルト code: asc
    const sortField = filters.sortBy ?? SortBy.CODE;
    const sortOrder = filters.sortOrder ?? SortOrder.ASC;

    // Order By 条件の構築
    // RegionOrderByWithRelationInput: Prismaが自動生成する型で、「Regionモデルを
    // ソート（orderBy）するときに使える条件の型」
    const orderBy = [
      {
        // memo: [sortField]の[]はcomputed property names（算出プロパティ名） という構文
        // []で囲わず {sortField: sortOrder} と記述すると文字通り、'sortField'として扱われ
        // てしまう。→ [] で囲むことで、「中身をキー名として評価してね」という意味になります。
        [sortField]: sortOrder,
      },
    ] satisfies Prisma.RegionOrderByWithRelationInput[];

    return orderBy;
  }
}

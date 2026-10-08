import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'generated/prisma';
import { PAGINATION } from '../common/constants/pagination.constants';
import { Region } from '../regions/domain/regions.model';
import { RegionsQueryService } from '../regions/query/regions.query.service';
import { PaginatedResult } from './../common/interfaces/paginated-result.interface';
import { PrismaService } from './../prisma/prisma.service';
import { CreatePrefectureDto } from './dto/prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';
import {
  Prefecture,
  PrefectureFilter,
  PrefectureWithCoverage,
} from './prefectures.model';

@Injectable()
export class PrefecturesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    // private readonly regionsService: RegionsService,
    private readonly regionsQueryService: RegionsQueryService,
  ) {}

  /**
   * Prefecture配列を返却します。(昇順)
   * @returns Prefecture配列
   */
  async findAll(
    // filtersが存在しない(filterts === undefinedのとき)場合は{}で初期化
    // memo: filtersがnullの際は{}で初期化されない。が、nullを渡そうとしても、プログラム上は
    // 「型'null'の引数を型’PrefectureFIlter | undefined'のパラメーターに割り当てることはできません。」
    // とtsLint？で警告が出る。
    // また、リクエストパラメーターで?name=nullというパラメータがリクエストされたとしてもControllerの
    // Validationにてnumberじゃないよ！とエラーになる。のでserviceにnullが渡ることはない。
    filters: PrefectureFilter = {},
  ): Promise<
    PaginatedResult<Prefecture & { id: string; regionName?: string }>
  > {
    // ページネーション計算
    // size: default: 20, 1〜2000の範囲内(マイナスはNG)
    const defaultSize =
      this.configService.get<number>('PREFECTURE_DEFAULT_PAGE_SIZE') ?? 20;
    const size = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(PAGINATION.MIN_PAGE_SIZE, filters.size ?? defaultSize),
    );

    // page: default:1 1〜10000の範囲(マイナスはNG)
    const defaultPage =
      this.configService.get<number>('PREFECTURE_DEFAULT_PAGE') ?? 1;
    const page = Math.min(
      PAGINATION.MAX_PAGE,
      Math.max(PAGINATION.MIN_PAGE, filters.page ?? defaultPage),
    );

    // skip = offset(最初のXX件を飛ばす)
    const skip = (page - 1) * size;

    // prisma経由でPrefecture情報配列と件数を取得
    // 「Promise.all」を使って複数の非同期処理(findMany()とcount())を並列実行
    // Promise.allは結果を[findMany()の結果, count()の結果]というタプル型(配列)で返すので
    // 分割代入で一発取得するとシンプル
    const [prismaPrefectures, count] = await Promise.all([
      // findMany()
      this.prismaService.prefecture.findMany({
        orderBy: { code: 'asc' },
        // limit
        take: size,
        // Offset (最初のXX件を飛ばす)
        skip: skip,
        // エリア名
        include: {
          // schema.prismaにてリレーションを張っているとwhere句でのid突合は不要
          // ↓ 以下のようにRegionを指定するだけでOK
          region: {
            select: {
              name: true,
            },
          },
        },
      }),
      // count(): prefectureの総件数
      this.prismaService.prefecture.count(),
    ]);

    // 以下をコメント：Promise.allでfindMany()とcount()の両方を非同期実行するため
    // const prismaPrefectures = await this.prismaService.prefecture.findMany({
    //   orderBy: { code: 'asc' },
    // });
    // const count = await this.prismaService.prefecture.count();

    // prisma→domain
    // prefectures.map()は、prefecturesが空配列の場合も正常に動作し空配列を返却する仕様
    // 20260624: 都道府県に紐づくエリア名追加対応によりregionNameを追加（一旦、Type定義していない）
    const domains: (Prefecture & { id: string; regionName?: string })[] =
      prismaPrefectures.map(
        (prefecture) =>
          ({
            // ...prefecture,
            // regionId: prefecture.regionId ?? undefined,

            // 上記スプレッド構文で全展開だと限界が訪れたので、必要項目をチクチクセットするように修正
            id: prefecture.id,
            code: prefecture.code,
            name: prefecture.name,
            kanaName: prefecture.kanaName,
            status: prefecture.status,
            kanaEn: prefecture.kanaEn,
            createdAt: prefecture.createdAt,
            updatedAt: prefecture.updatedAt,
            regionId: prefecture.regionId ?? undefined,
            regionName: prefecture.region?.name ?? undefined,
          }) satisfies Prefecture & { id: string; regionName?: string },
      );

    // 返却オブジェクト: ページネーションされたPrefectureドメイン情報
    const paginated: PaginatedResult<
      Prefecture & { id: string; regionName?: string }
    > = {
      data: domains,
      meta: {
        totalCount: count,
        page: page,
        size: size,
      },
    };

    return paginated;
  }

  /**
   * Prefecture配列を返却します。(店舗有りの都道府県情報と紐づく店舗数/昇順)
   *
   * @returns Prefecture配列(店舗有りの都道府県情報と紐づく店舗数/昇順)
   */
  async findAllWithStoreCount(): Promise<PrefectureWithCoverage[]> {
    // prisma経由でPrefecture情報配列取得（アクティブ店舗のあるPrefecture）
    const prefectures = await this.prismaService.prefecture.findMany({
      where: {
        store: { some: { status: 'published' } },
      },
      include: {
        _count: {
          select: {
            store: { where: { status: 'published' } },
          },
        },
        // エリア名
        region: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // prisma→domain
    // prefectures.map()は、prefecturesが空配列の場合も正常に動作し空配列を返却する仕様
    const domains: PrefectureWithCoverage[] = prefectures.map((prefecture) => ({
      prefecture: {
        code: prefecture.code,
        name: prefecture.name,
        kanaName: prefecture.kanaName,
        status: prefecture.status,
        kanaEn: prefecture.kanaEn,
        createdAt: prefecture.createdAt,
        updatedAt: prefecture.updatedAt,
        regionId: prefecture.regionId ?? undefined,
        regionName: prefecture.region?.name ?? undefined,
      } satisfies Prefecture & { regionName?: string },
      id: prefecture.id,
      storeCount: prefecture._count.store,
    }));

    return domains;
  }

  /**
   * 都道府県情報作成
   *
   * @param createPrefectureDto 都道府県情報（作成対象）
   * @param userId ユーザーID
   * @returns 都道府県情報（作成後）
   */
  async create(
    createPrefectureDto: CreatePrefectureDto,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // dto取得
    const { name, code, kanaName, status, kanaEn, regionCode } =
      createPrefectureDto;

    // dto → domain の詰め替えスキップ

    // regionCodeの妥当性チェク
    let region: (Region & { id: string }) | undefined = undefined;
    if (regionCode) {
      // 妥当性チェックいおいて、Prismaを使って別テーブル（Region）を覗きに行くのは、CA/DDDの
      // 観点から考えると設計上「お作法破り」です!!
      // ドメインの侵害: Prefecture のロジックが Region のデータ構造（テーブル名やカラム名）に
      // 依存してしまいます。
      // バリデーションの重複: もし Region の有効性を判定するルール（例：削除フラグが立っているものは無効、など）が
      // 変更された場合、直接 Prisma を叩いている箇所をすべて直して回る必要が出てきます。
      // → Region側でfindByCode()を作成し、こちらからそのメソッドを呼び出すのがBP
      //   ↓ をコメント化
      // const prismaRegion = await this.prismaService.region.findUnique({
      //   where: { code: regionCode },
      // });

      // regionCodeに紐づくエリア情報取得
      region = await this.regionsQueryService.findByCodeOrFail(regionCode);
    }

    // domain → prismaインプットパラメータ
    const prismaInput = {
      name,
      code,
      kanaName,
      status,
      kanaEn,
      userId,
      // 以下だと、regionがundefinedの可能性があるからなのか、region.と打ってもidが補完されないので
      // やめて、久しぶりに...(スプレッド構文)で、regionオプジェクトを展開して追加。
      // region?.id;
      // ちみに、satisfies Prisma.RegionUpdateInputで型を指定したら、
      // region: { connect: { id: regionId } },のようなセットの仕方が必要
      ...(region && { regionId: region.id }),
      // memo: updatedAt をセットしてないが、、schema.prismaにて@updatedAt @db.Timestamp(0)を
      //       指定しているので、create()のタイミングで自動設定される。
    };

    try {
      // 都道府県情報の登録
      const created = await this.prismaService.prefecture.create({
        data: prismaInput,
      });

      // prisma → domain
      const domain: Prefecture & { id: string } = {
        code: created.code,
        name: created.name,
        kanaName: created.kanaName,
        status: created.status,
        kanaEn: created.kanaEn,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        // regionIdだけで、紐づくRegionが自動で関連付けされ、セットされる
        regionId: created.regionId ?? undefined,
        id: created.id,
      } satisfies Prefecture & { id: string };

      return domain;
      // e:unknownはPrismaClientKnownRequestErrorのinstansof問題対策のBP
      // 詳細は、以下のトラブルシューティングを参照
      // https://nuppy3.atlassian.net/wiki/spaces/~712020c7a7ba463a644114a22001124373f0fc/pages/60162052/03_99
    } catch (e: unknown) {
      // Prismaの既知のリクエストエラーであるかをチェック

      // eはanyなので、instansof PrismaClientKnownRequestErrorでeの型ガードを行なっているが、
      // instanceof は Prisma 5.x/6.x では信頼性が低い問題のため、削除
      // if (e instanceof PrismaClientKnownRequestError) {
      if (e && typeof e === 'object' && 'code' in e && 'meta' in e) {
        // P2002:一意制約エラー
        if (e.code === 'P2002') {
          const meta = e.meta as { target?: string[] } | undefined;
          const field = meta?.target?.join(', ') || '不明なフィールド';
          // 409 Conflictをスローし、コントローラーとNestJSのエラーハンドリング層でキャッチされる
          throw new ConflictException(`指定された ${field} は既に存在します。`);
        } else {
          throw e;
        }
      }

      throw e;
    }
  }

  /**
   * findOne(): idに関連する都道府県情報を取得します。
   *
   * @param id 都道府県ID
   * @returns 都道府県情報
   */
  async findOne(
    id: string,
  ): Promise<Prefecture & { id: string; regionName?: string }> {
    const domainWithId = await this.findByIdOrFail(id);
    return domainWithId;
  }

  /**
   * findByIdOrFail():
   *
   * prefectureIdを元に都道府県情報を取得し返却します。
   * 存在しない場合はNotFoundExceptionを投げます。
   *
   * @param id prefecture ID
   * @returns 都道府県情報(Prefectureドメイン＋id)
   * @throws NotFoundException 該当する都道府県が見つからない場合
   */
  async findByIdOrFail(
    id: string,
  ): Promise<Prefecture & { id: string; regionName?: string }> {
    // Prefectureを取得
    const prefecture = await this.prismaService.prefecture.findUnique({
      where: { id },
      include: {
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    // codeに紐づく都道府県情報が無い場合
    if (!prefecture) {
      throw new NotFoundException(
        `idに関連する都道府県情報が存在しません!! id: ${id}`,
      );
    }

    // Prefecture(Prisma) → domain
    const domain: Prefecture & { id: string; regionName?: string } = {
      id: prefecture.id,
      name: prefecture.name,
      code: prefecture.code,
      kanaName: prefecture.kanaName,
      kanaEn: prefecture.kanaEn,
      status: prefecture.status,
      createdAt: prefecture.createdAt,
      updatedAt: prefecture.updatedAt,
      regionId: prefecture.regionId ?? undefined,
      regionName: prefecture.region?.name ?? undefined,
    };

    return domain;
  }

  /**
   * prefectureコードを元に都道府県情報を取得し返却します。
   * 存在しない場合はNotFoundExceptionを投げます。
   *
   * @param code prefectureコード
   * @returns 都道府県情報(Prefectureドメイン＋id)
   * @throws NotFoundException 該当する都道府県が見つからない場合
   */
  async findByCodeOrFail(code: string): Promise<Prefecture & { id: string }> {
    // Prefectureを取得
    const prefecture = await this.prismaService.prefecture.findUnique({
      where: { code },
    });

    // codeに紐づく都道府県情報が無い場合
    if (!prefecture) {
      throw new NotFoundException(
        `codeに関連する都道府県情報が存在しません!! code: ${code}`,
      );
    }

    // Prefecture(Prisma) → domain
    const domain: Prefecture & { id: string } = {
      id: prefecture.id,
      name: prefecture.name,
      code: prefecture.code,
      kanaName: prefecture.kanaName,
      kanaEn: prefecture.kanaEn,
      status: prefecture.status,
      createdAt: prefecture.createdAt,
      updatedAt: prefecture.updatedAt,
      regionId: prefecture.regionId ?? undefined,
    };

    return domain;
  }

  /**
   * update(): 都道府県情報を更新します。
   *
   * @param id prefectureId(key)
   * @param updatePrefectureDto 更新対象DTO
   * @param userId ユーザーID
   * @returns Prefecture Domain(更新結果)
   */
  async update(
    id: string,
    updatePrefectureDto: UpdatePrefectureDto,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // 更新対象の都道府県情報を取得(なければ404)
    const prefecture = await this.prismaService.prefecture.findUnique({
      where: { id },
    });

    if (!prefecture) {
      throw new NotFoundException(
        `idに関連する都道府県情報が存在しません!! prefectureId: ${id}`,
      );
    }

    // regionCodeの妥当性チェク
    let prismaRegion: (Region & { id: string }) | undefined = undefined;
    if (updatePrefectureDto.regionCode) {
      // prismaRegion = await this.prismaService.region.findUnique({
      //   where: { code: updatePrefectureDto.regionCode },
      // });
      // regionCodeに紐づくエリア情報取得
      prismaRegion = await this.regionsQueryService.findByCodeOrFail(
        updatePrefectureDto.regionCode,
      );

      // codeに関連するRegionが存在しない場合はExceptionをスローしてもいい
    }

    // dto → prismaInput : nullの場合undefinedに書き換え(not-null項目)
    const prismaInput = {
      name: updatePrefectureDto.name ?? undefined,
      code: updatePrefectureDto.code ?? undefined,
      kanaName: updatePrefectureDto.kanaName ?? undefined,
      status: updatePrefectureDto.status ?? undefined,
      kanaEn: updatePrefectureDto.kanaEn ?? undefined,
      user: { connect: { id: userId } },
      // ‼️ 「オブジェクト展開（スプレッド）」のテクニック：
      // prismaRegion が存在する(true)場合のみ、regionオブジェクトを合体させる
      ...(prismaRegion && { region: { connect: { id: prismaRegion.id } } }),
      // memo: updatedAt をセットしてないが、、schema.prismaにて@updatedAt @db.Timestamp(0)を
      //       指定しているので、update()のタイミングで自動設定される。
    } satisfies Prisma.PrefectureUpdateInput;

    // 更新（永続化)
    const updated = await this.prismaService.prefecture.update({
      data: prismaInput,
      where: { id },
    });

    // prisma → domain
    const domainWithId = {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      kanaName: updated.kanaName,
      status: updated.status,
      kanaEn: updated.kanaEn,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      regionId: updated.regionId ?? undefined,
    } satisfies Prefecture & { id: string };

    return domainWithId;
  }

  remove(id: number) {
    return `This action removes a #${id} prefecture`;
  }

  /**
   * countByRegionId(): regionIdに関連する都道府県情報をカウントし、カウント結果を返却します。
   *
   * @param regionId エリアID
   * @returns （regionIdに関連する）都道府県情報の件数
   */
  async countByRegionId(regionId: string): Promise<number> {
    return await this.prismaService.prefecture.count({ where: { regionId } });
  }
}

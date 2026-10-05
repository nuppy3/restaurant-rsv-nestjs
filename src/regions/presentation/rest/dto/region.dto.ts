import { Expose, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginatedResult } from '../../../../common/interfaces/paginated-result.interface';
import { PaginationMetaDto } from '../../../../stores/dto/store.dto';
import { Region, RegionStatus } from '../../../domain/regions.model';
import { SortBy, SortOrder } from '../../../query/region.filter';

/**
 * エリア情報検索クエリDTO(フィルター/ソート順などのクエリパラメータDTO)
 */
export class FindAllRegionsQueryDto {
  // エリアコード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(2) // 任意項目だが入力された際のValidation
  code?: string;

  // エリアコード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(40) // 任意項目だが入力された際のValidation
  name?: string;

  // ステータス
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsEnumを無視)
  @IsEnum(RegionStatus, {
    message: `RegionStatus must be one of: ${RegionStatus.EDITING}, ${RegionStatus.PUBLISHED}, ${RegionStatus.SUSPENDED}`,
  })
  status?: RegionStatus;

  // ページ(ページネーション)
  @IsOptional()
  @IsInt() // 整数のみ許容：一方IsNumberは少数OKになってしまう
  @Min(1) // 1以上
  // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  @Max(10000)
  // string → number 変換
  // main.tsにてグローバルでValidationPipe({transform: true})としてtransformを有効化
  // していれば、@IsNumber()がついていれば、個別でNumber変換(@Type()での型変換)は不要。
  // であるが、main.tsはtransform: tureがなかったので、個別で@Typeにて変換。
  // → 個別でやることが多いらしい。
  @Type(() => Number)
  page?: number;

  // 1ページあたりの件数
  @IsOptional()
  @IsInt() // 整数のみ許容：一方IsNumberは少数OKになってしまう
  @Min(1) // 1以上
  @Max(2000) // numberの場合はMax()を使う
  // string → number 変換
  @Type(() => Number)
  size?: number;

  // ソートフィールド
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsEnumを無視)
  @IsEnum(SortBy, {
    message: `sortBy must be one of: ${SortBy.CODE}, ${SortBy.NAME}`,
  })
  sortBy?: SortBy;

  // ソートオーダー
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsEnumを無視)
  @IsEnum(SortOrder, {
    message: `sortOrder must be one of: ${SortOrder.ASC}, ${SortOrder.DESC}`,
  })
  sortOrder?: SortOrder;
}

/**
 * CreateRegionDto
 *
 * 【特記事項】tsconfig.jsonに「"strictPropertyInitialization": true,」を指定すると
 * オブジェクト(DTOなどのclass)の初期化を促すチェックが入る（constructorなどで初期化しないと
 * 必須項目であってもnullやundefinedがセットされ、xxxx.nameのようにプロパティにアクセスすると
 * エラーが発生する可能性あると判断される）
 *
 * 一般的には、constructoreを用意し、初期化すればいいのだが、リクエストパラメータを受け取る際の
 * DTOはNestJSが new するので、「!」 を使って「フレームワークに任せるぜ」と宣言するのがBP。
 *
 * strictPropertyInitialization は true のままにする。
 * DTO の必須プロパティには ! をつける。（例: name!: string;）
 * DTO の任意プロパティには ? をつける。（例: kanaName?: string;）
 * constructor は無しでOK！
 */
export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaName!: string;

  // PrefectureStatusは厳密なEnumではない（modern Enum=union)だが@IsEnum()が効くみたい！
  @IsEnum(RegionStatus, {
    message: `StoreStatus must be one of: ${RegionStatus.PUBLISHED}, ${RegionStatus.SUSPENDED}`,
  })
  status!: RegionStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaEn!: string;

  // constructor不要：上記の特記事項参照
  // constructor(
  //   name: string,
  //   code: string,
  //   kanaName: string,
  //   status: RegionStatus,
  //   kanaEn: string,
  // ) {
  //   this.name = name;
  //   this.code = code;
  //   this.kanaName = kanaName;
  //   this.status = status;
  //   this.kanaEn = kanaEn;
  // }
}

// -------------------------------------------------
// ResopnseDTO: 型安全なRegionドメインのサブセット
// -------------------------------------------------
export const RegionResponseKeys = [
  'name',
  'code',
  'kanaName',
  'kanaEn',
  'status',
] satisfies (keyof Region)[];

/**
 * RegionResponseの輪郭(Region domainをベースに)
 */
export type RegionResponseShape = Pick<
  Region,
  (typeof RegionResponseKeys)[number]
>;

/**
 * エリア情報レスポンスDTO
 * RegionドメインのサブセットDTO
 *
 * 特記事項：StoreResponseDto implements StoreResponseShapeは「最低限これらは持ってるよ」
 * という約束でしかないらしい。。→ それ以上のプロパティ（testとか、hogeとか）を書いても型エラーにならない（仕様）
 *
 * @Expose() をつけると、plainToInstance の変換対象になります。
 * 返却項目を明示（@Expose）
 * 不要な項目を除外（@Exclude）
 * 値の変換（@Transform）
 */
export class RegionResponseDto implements RegionResponseShape {
  // ドメインにidは不要。ResponseDtoにidを付与。→ベストプラクティス!!
  @Expose()
  readonly id!: string;

  @Expose()
  name!: string;

  @Expose()
  code!: string;

  @Expose()
  kanaName!: string;

  @Expose()
  status!: RegionStatus;

  @Expose()
  get statusLabel(): string {
    switch (this.status) {
      case RegionStatus.PUBLISHED:
        return '掲載中';
      case RegionStatus.EDITING:
        return '編集中';
      case RegionStatus.SUSPENDED:
        return '停止';
      default:
        return '';
    }
  }

  @Expose()
  kanaEn!: string;

  @Expose()
  prefectureCount?: number;

  // constructor不要：上記の特記事項参照
  // constructor(
  //   id: string,
  //   name: string,
  //   code: string,
  //   kanaName: string,
  //   status: RegionStatus,
  //   kanaEn: string,
  // ) {
  //   this.id = id;
  //   this.name = name;
  //   this.code = code;
  //   this.kanaName = kanaName;
  //   this.status = status;
  //   this.kanaEn = kanaEn;
  // }
}

// -------------------------------------------------
// ResponseDTO(ドロップダウン選択肢用): 型安全なRegionドメインのサブセット
// -------------------------------------------------
export const RegionOptionResponseKeys = [
  'name',
  'code',
] satisfies (keyof Region)[];

export type RegionOptionResponseShape = Pick<
  Region,
  (typeof RegionOptionResponseKeys)[number]
>;

/**
 * エリア選択肢(ドロップダウン)用レスポンスDTO
 * RegionドメインのサブセットDTO(一覧用のRegionResponseDtoより項目を絞った軽量版)
 */
export class RegionOptionResponseDto implements RegionOptionResponseShape {
  @Expose()
  readonly id!: string;

  @Expose()
  name!: string;

  @Expose()
  code!: string;
}

/**
 * ページネーション情報DTO(metaデータ)
 */
export class PagenationMetaDto {
  // 総件数
  totalCount: number;
  // ページ
  page: number;
  // 1ページあたりの件数
  size: number;

  constructor(totalCount: number, page: number, size: number) {
    this.totalCount = totalCount;
    this.page = page;
    this.size = size;
  }
}

/**
 * ページネーション化されたRegionレスポンスDTO
 *
 * @Type: plain object → クラスインスタンスへの変換を正確に行うための型ヒント。
 *        ネストしたオブジェクトの変換に必須。
 *        ネストしたDTO（data が StoreResponseDto[] の場合など）で変換を正しくしたいとき。
 *
 * なぜ必要か？
 * plainToInstance や ValidationPipe（transform: true時）が動くときに、ネスト部分を
 * 正しくクラスに変換するため
 * 例：{ data: [{ id: "1", name: "店A" }, ...] } → data[0] が
 * StoreResponseDto インスタンスになる
 * これがないと、getter（statusLabel, holidaysLabel）が呼ばれなかったり、ネストした
 * バリデーションが効かなかったりする
 *
 * → が、不要な気がする。。
 * 実際はRegionResponseDtoをplainToInstanceして、PaginatedRegionResponseDtoのdataに
 * セットしており、PaginatedRegionResponseDtoを直接plainToInstanceしているわけではないため。
 *
 */
export class PaginatedRegionResponseDto implements PaginatedResult<RegionResponseDto> {
  @Type(() => RegionResponseDto)
  data: RegionResponseDto[];

  @Type(() => PaginationMetaDto)
  meta: PagenationMetaDto;

  constructor(data: RegionResponseDto[], meta: PagenationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}

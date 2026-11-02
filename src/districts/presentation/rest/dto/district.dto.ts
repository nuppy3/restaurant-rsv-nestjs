import { Expose, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import {
  District,
  DistrictStatus,
} from '../../../../districts/domain/districts.model';

/**
 * 地区一覧の検索条件DTO(クエリパラメータ: GET /districts?page=1&size=20)
 * クエリパラメータは文字列で届くため、@Type(() => Number)で数値に変換してからチェックする
 */
export class FindAllDistrictsQueryDto {
  // エリア名
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(40) // 任意項目だが入力された際のValidation
  name?: string;

  // ステータス
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsEnumを無視)
  @IsEnum(DistrictStatus, {
    message: `DistrictStatus must be one of: ${DistrictStatus.EDITING}, ${DistrictStatus.PUBLISHED}, ${DistrictStatus.SUSPENDED}`,
  })
  status?: DistrictStatus;

  // 都市コード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(3) // 任意項目だが入力された際のValidation
  cityCode?: string;

  // ページ(ページネーション)
  @IsOptional()
  @IsInt() // 整数のみ許容：一方IsNumberは少数OKになってしまう
  @Min(PAGINATION.MIN_PAGE) // 1以上
  // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  @Max(PAGINATION.MAX_PAGE)
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
  @Min(PAGINATION.MIN_PAGE_SIZE) // 1以上
  @Max(PAGINATION.MIN_PAGE_SIZE) // numberの場合はMax()を使う
  // string → number 変換
  @Type(() => Number)
  size?: number;
}

// -------------------------------------------------
// ResopnseDTO: 型安全なDistrictドメインのサブセット
// -------------------------------------------------
export const DistrictResponseKeys = [
  'id',
  'code',
  'name',
  'kanaName',
  'slug',
  'status',
  'sortOrder',
  'cityId',
] satisfies (keyof District)[];

/**
 * DistrictResponseの輪郭(District domainをベースに)
 */
export type DistrictResponseShape = Pick<
  District,
  (typeof DistrictResponseKeys)[number] // [] → union('id' | 'code' | 'name' | ... )
>;

/**
 * 地区情報レスポンスDTO
 * DistrictドメインのサブセットDTO
 *
 * 特記事項：DistrictResponseDto implements StoreResponseShapeは「最低限これらは持ってるよ」
 * という約束でしかないらしい。。→ それ以上のプロパティ（testとか、hogeとか）を書いても型エラーにならない（仕様）
 *
 * @Expose() をつけると、plainToInstance の変換対象になります。
 * 返却項目を明示（@Expose）
 * 不要な項目を除外（@Exclude）
 * 値の変換（@Transform）
 */
export class DistrictResponseDto implements DistrictResponseShape {
  @Expose()
  readonly id!: string;

  @Expose()
  code!: string;

  @Expose()
  name!: string;

  @Expose()
  kanaName!: string;

  @Expose()
  slug!: string;

  @Expose()
  status!: DistrictStatus;

  @Expose()
  get statusLabel(): string {
    switch (this.status) {
      case DistrictStatus.PUBLISHED:
        return '反映中';
      case DistrictStatus.EDITING:
        return '編集中';
      case DistrictStatus.SUSPENDED:
        return '停止';
      default:
        return '';
    }
  }

  @Expose()
  sortOrder!: number;

  @Expose()
  cityId!: string;
}

/**
 * ページネーション情報DTO(metaデータ)
 */
export class PaginationMetaDto {
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
 * ページネーション化されたDistrictレスポンスDTO
 *
 * @Type: plain object → クラスインスタンスへの変換を正確に行うための型ヒント。
 *        ネストしたDTOをクラスインスタンスに変換するための型ヒント(getterのstatusLabelを有効にするため)
 *        ネストしたDTO（data が DistrictResponseDto[] の場合など）で変換を正しくしたいとき。
 *
 * なぜ必要か？
 * plainToInstance や ValidationPipe（transform: true時）が動くときに、ネスト部分を
 * 正しくクラスに変換するため
 * 例：{ data: [{ id: "1", name: "店A" }, ...] } → data[0] が
 * DistrictResponseDto インスタンスになる
 * これがないと、getter（statusLabel, holidaysLabel）が呼ばれなかったり、ネストした
 * バリデーションが効かなかったりする
 *
 * → が、不要な気がする。。
 * 実際はDistrictResponseDtoをplainToInstanceして、PaginatedDistrictResponseDtoのdataに
 * セットしており、PaginatedDistrictResponseDtoを直接plainToInstanceしているわけではないため。
 *
 */
export class PaginatedDistrictResponseDto implements PaginatedResult<DistrictResponseDto> {
  @Type(() => DistrictResponseDto)
  data: DistrictResponseDto[];

  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;

  constructor(data: DistrictResponseDto[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}

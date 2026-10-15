import { Expose, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import { PaginatedResult } from '../../../../common/interfaces/paginated-result.interface';
import { CityStatus } from '../../../domain/cities.model';
import { CityFilter } from '../../../query/city.filter';

/**
 * slugの形式: 半角英小文字・数字を、単語区切りのハイフン(1つ)でつないだもの
 * 例) OK: tokyo / new-york / area1   NG: Tokyo(大文字) / -tokyo(先頭ハイフン) / tokyo--a(連続ハイフン) / 東京
 * URL(例: /cities/tokyo)に使うため、URLにそのまま使える文字に限定する
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 都市作成リクエストDTO
 * statusは作成時に編集中(editing)固定のため受け付けない(状態遷移はpublish等の専用エンドポイントで行う)
 * 都道府県は都道府県コード(prefectureCode)で指定する
 *
 * class-validatorのデコレーターで入力をチェックし、違反した場合はValidationPipeが400を返す
 * (最大文字数はDBの列の長さ(schema.prismaのVarChar)に合わせている)
 */
export class CreateCityDto {
  // 都市コード(例: '001')。DBはVarChar(3)
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  code!: string;

  // 都市名(例: 東京)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  // 都市名のカナ(例: トウキョウ)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  kanaName!: string;

  // URL用の識別子(例: tokyo)。形式違反は400。重複はDBの一意制約で409(Repository)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(SLUG_PATTERN, {
    message:
      'slugは半角英小文字・数字と、単語区切りのハイフンのみ使用できます(例: tokyo, new-york)',
  })
  slug!: string;

  // 表示順(小さいほど先に表示する)。0以上の整数
  @IsInt() // 整数のみ許容(IsNumberは小数を許容してしまう)
  @Min(0)
  sortOrder!: number;

  // 都道府県コード(例: '13' = 東京都)。任意
  @IsOptional()
  @IsString()
  @MaxLength(2)
  prefectureCode?: string;
}

/**
 * 都市レスポンスDTO
 * domain(作成・更新・状態遷移の結果)とRead Model(一覧・詳細)の両方をこの形で返す
 * @Expose()を付けた項目のみ返却する(excludeExtraneousValues)
 * ※ domainにはprefectureNameが無いため、作成・更新などのレスポンスではprefectureNameは省略される
 */
export class CityResponseDto {
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
  status!: CityStatus;

  // statusの表示用の文言(Prefectureと同じ)
  // getterなので、plainToInstanceでクラスのインスタンスにしたときに値が計算される
  @Expose()
  get statusLabel(): string {
    switch (this.status) {
      case CityStatus.PUBLISHED:
        return '反映中';
      case CityStatus.EDITING:
        return '編集中';
      case CityStatus.SUSPENDED:
        return '停止';
      default:
        return '';
    }
  }

  @Expose()
  sortOrder!: number;

  @Expose()
  prefectureId?: string;

  @Expose()
  prefectureName?: string;
}

/**
 * ページネーション情報DTO(metaデータ)
 */
export class CityPaginationMetaDto {
  totalCount: number;
  page: number;
  size: number;

  constructor(totalCount: number, page: number, size: number) {
    this.totalCount = totalCount;
    this.page = page;
    this.size = size;
  }
}

/**
 * ページ化された都市レスポンスDTO(data / meta)
 * @Type: ネストしたDTOをクラスインスタンスに変換するための型ヒント(getterのstatusLabelを有効にするため)
 */
export class PaginatedCityResponseDto implements PaginatedResult<CityResponseDto> {
  @Type(() => CityResponseDto)
  data: CityResponseDto[];

  @Type(() => CityPaginationMetaDto)
  meta: CityPaginationMetaDto;

  constructor(data: CityResponseDto[], meta: CityPaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * 都市一覧の検索条件DTO(クエリパラメータ: GET /cities?page=1&size=20)
 * クエリパラメータは文字列で届くため、@Type(() => Number)で数値に変換してからチェックする
 */
export class FindAllCityQueryDto implements CityFilter {
  @IsOptional()
  @IsInt() // 整数のみ許容(IsNumberは小数を許容してしまう)
  @Min(PAGINATION.MIN_PAGE_SIZE)
  @Max(PAGINATION.MAX_PAGE_SIZE)
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsInt()
  @Min(PAGINATION.MIN_PAGE)
  @Max(PAGINATION.MAX_PAGE)
  @Type(() => Number)
  page?: number;
}

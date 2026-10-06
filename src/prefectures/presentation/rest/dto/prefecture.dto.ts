import { Expose, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PAGINATION } from '../../../../common/constants/pagination.constants';
import { PaginatedResult } from '../../../../common/interfaces/paginated-result.interface';
import { PrefectureStatus } from '../../../domain/prefectures.model';
import { PrefectureFilter } from '../../../query/prefecture.filter';

/**
 * 都道府県作成リクエストDTO
 * statusは作成時に編集中(editing)固定のため受け付けない(状態遷移はpublish等の専用エンドポイントで行う)
 * 地方は地方コード(regionCode)で指定する
 */
export class CreatePrefectureDto {
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  regionCode?: string;
}

/**
 * 都道府県レスポンスDTO
 * domain(作成・更新・状態遷移の結果)とRead Model(一覧・詳細・covered)の両方をこの形で返す
 * @Expose()を付けた項目のみ返却する(excludeExtraneousValues)
 */
export class PrefectureResponseDto {
  @Expose()
  readonly id!: string;

  @Expose()
  name!: string;

  @Expose()
  code!: string;

  @Expose()
  kanaName!: string;

  @Expose()
  status!: PrefectureStatus;

  @Expose()
  get statusLabel(): string {
    switch (this.status) {
      case PrefectureStatus.PUBLISHED:
        return '反映中';
      case PrefectureStatus.EDITING:
        return '編集中';
      case PrefectureStatus.SUSPENDED:
        return '停止';
      default:
        return '';
    }
  }

  @Expose()
  kanaEn!: string;

  @Expose()
  storeCount?: number;

  @Expose()
  regionId?: string;

  @Expose()
  regionName?: string;
}

/**
 * ページネーション情報DTO(metaデータ)
 */
export class PrefecturePaginationMetaDto {
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
 * ページ化された都道府県レスポンスDTO(data / meta)
 * @Type: ネストしたDTOをクラスインスタンスに変換するための型ヒント(getterのstatusLabelを有効にするため)
 */
export class PaginatedPrefectureResponseDto implements PaginatedResult<PrefectureResponseDto> {
  @Type(() => PrefectureResponseDto)
  data: PrefectureResponseDto[];

  @Type(() => PrefecturePaginationMetaDto)
  meta: PrefecturePaginationMetaDto;

  constructor(
    data: PrefectureResponseDto[],
    meta: PrefecturePaginationMetaDto,
  ) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * 都道府県一覧の検索条件DTO(クエリパラメータ)
 */
export class FindAllPrefectureQueryDto implements PrefectureFilter {
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

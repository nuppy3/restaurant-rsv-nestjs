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
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PAGINATION } from '../../common/constants/pagination.constants';
import { Prefecture, PrefectureStatus } from '../prefectures.model';
import { PrefectureFilter } from './../prefectures.model';

/**
 * CreatePrefectureDto
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

  // PrefectureStatusは厳密なEnumではない（modern Enum=union)のだが@IsEnum()が効くみたい！
  @IsEnum(PrefectureStatus, {
    message: `StoreStatus must be one of: ${PrefectureStatus.PUBLISHED}, ${PrefectureStatus.SUSPENDED}`,
  })
  status!: PrefectureStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  regionCode?: string;

  // constructorは不要：上記の特記事項参照
  // constructor(
  //   name: string,
  //   code: string,
  //   kanaName: string,
  //   status: PrefectureStatus,
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
// ResopnseDTO: 型安全なPrerectureドメインのサブセット
// -------------------------------------------------
export const PrefectureResponseKeys = [
  'name',
  'code',
  'kanaName',
  'status',
  'kanaEn',
] satisfies (keyof Prefecture)[];

export type PrefectureResponseShape = Pick<
  Prefecture,
  (typeof PrefectureResponseKeys)[number]
>;

/**
 * 都道府県情報レスポンスDTO
 * PrefectureドメインのサブセットDTO
 *
 * 特記事項：StoreResponseDto implements StoreResponseShapeは「最低限これらは持ってるよ」
 * という約束でしかないらしい。。→ それ以上のプロパティ（testとか、hogeとか）を書いても型エラーにならない（仕様）
 *
 * @Expose() をつけると、plainToInstance の変換対象になります。
 * 返却項目を明示（@Expose）
 * 不要な項目を除外（@Exclude）
 * 値の変換（@Transform）
 */
export class PrefectureResponseDto implements PrefectureResponseShape {
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

  // constructor不要:上記の特記事項参照
  // constructor(
  //   name: string,
  //   code: string,
  //   kanaName: string,
  //   status: PrefectureStatus,
  //   kanaEn: string,
  // ) {
  //   this.name = name;
  //   this.code = code;
  //   this.kanaName = kanaName;
  //   this.status = status;
  //   this.kanaEn = kanaEn;
  // }
}

/**
 * ページネーション情報DTO(metaデータ)
 */
export class PrefecturePaginationMetaDto {
  // 総件数
  totalCount: number;
  // ページ
  page: number;
  // 1ページあたりの件数
  size: number;

  constructor(totaldCount: number, page: number, size: number) {
    this.totalCount = totaldCount;
    this.page = page;
    this.size = size;
  }
}

/**
 * ページ化されたStoreレスポンスDTO
 * ページ全体を表すラッパーDTO：data/metaでStoreDTOとMetaDTOを持つ
 *
 * 補足memo: インターフェース(PaginatedResult)をimplementsできるのはclassだけ。
 *          従って、PaginatedPrefectureResponseDtoをtypeで定義してPaginatedResultを
 *          implementsすることはできない。(PaginatedResultをtypeで宣言するしかない)
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
 */
export class PaginatedPrefectureResponseDto implements PaginatedResult<PrefectureResponseDto> {
  // @Type: plain object → クラスインスタンスへの変換を正確に行うための型ヒント
  @Type(() => PrefectureResponseDto)
  data: PrefectureResponseDto[];

  // @Type: plain object → クラスインスタンスへの変換を正確に行うための型ヒント
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
 * 都道府県情報検索フィルターDTO：リクエスト(クエリ)パラメータセット用
 * リクエストパラメータのValidationを行う。
 */
export class FindAllPrefectureQueryDto implements PrefectureFilter {
  @IsOptional()
  @IsInt() // 整数のみ許容: 一方IsNumberは少数を許容してしまう
  @Min(1) // 0以上
  // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  @Max(PAGINATION.MAX_PAGE_SIZE)
  // string → number 変換
  // main.tsにてグローバルでValidationPipe({transform: true})としてtransformを有効化
  // していれば、@IsNumber()がついていれば、個別でNumber変換(@Type()での型変換)は不要。
  // であるが、main.tsはtransform: tureがなかったので、個別で@Typeにて変換。
  // → 個別でやることが多いらしい。
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsInt() // 整数のみ許容: 一方IsNumberは少数を許容してしまう
  @Min(1) // 0以上
  @Max(PAGINATION.MAX_PAGE) // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  // string → number 変換
  @Type(() => Number)
  page?: number;
}

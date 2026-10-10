import { Expose, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { type Prefecture } from '../../prefectures/prefectures.model';
import {
  SortBy,
  SortOrder,
  Store,
  StoreFilter,
  StoreStatus,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type Weekday,
} from '../stores.model';

/**
 * CreateStoreDto
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
export class CreateStoreDto {
  // idはリクエストパラメーターで取得しない
  // id: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(40) // 任意項目だが入力された際のValidation
  kanaName?: string;

  // StoreStatusは厳密なEnumではない（modern Enum=union)のだが@IsEnum()が効くみたい！
  @IsEnum(StoreStatus, {
    message: `StoreStatus must be one of: ${StoreStatus.EDITING}, ${StoreStatus.PUBLISHED}, ${StoreStatus.SUSPENDED}`,
  })
  status!: StoreStatus;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  zipCode?: string; // 郵便番号

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  prefectureCode?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(13)
  phoneNumber!: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  businessHours?: string; // 営業時間 例："10:00〜20:00"

  @IsOptional()
  @IsArray()
  @ArrayUnique() // 重複禁止
  @IsIn(WEEKDAYS, {
    // union型のチェック。enumは別のdecoretor
    each: true, // 各要素がWEEKDAYS内の文字列であることをチェック
    message: `holiday must be one of: ${WEEKDAYS.join(', ')}`,
  })
  holidays?: Weekday[]; // 休日は複数の曜日なので配列型

  // constructore不要：上記の特記事項参照
  // constructor(
  //   name: string,
  //   status: StoreStatus,
  //   email: string,
  //   phoneNumber: string,
  // ) {
  //   this.name = name;
  //   this.status = status;
  //   this.email = email;
  //   this.phoneNumber = phoneNumber;
  // }
}

// ------------------------------------
// 型安全なサブセット(全体の一部）DTOの抽出)
// ------------------------------------
// StoreドメインをベースとしたKeySet
export const StoreResponseKeys = [
  // Storeドメイン（Entity)にid(uuid)は持たせない。
  // 'id',
  'code',
  'name',
  'kanaName',
  'status',
  'zipCode',
  'email',
  'address',
  'phoneNumber',
  'businessHours',
  'holidays',
  'prefectureId',
  // satisfiesは配列が(keyof Store)[]型に一致するか確認
  // 要するに、配列内の各要素がStore型のkeyのみであることを強制
] satisfies (keyof Store)[];

// 型安全なStoreのサブセット(全体の一部）DTOを作成
// Storeの中から上記要素(キー名)だけをPick
export type StoreResponseShape = Pick<
  Store,
  (typeof StoreResponseKeys)[number]
>;

/**
 * 店舗情報レスポンスDTO
 * StoreドメインのサブセットDTO
 *
 * 特記事項：StoreResponseDto implements StoreResponseShapeは「最低限これらは持ってるよ」
 * という約束でしかないらしい。。→ それ以上のプロパティ（testとか、hogeとか）を書いても型エラーにならない（仕様）
 *
 * @Expose() をつけると、plainToInstance の変換対象になります。
 * 返却項目を明示（@Expose）
 * 不要な項目を除外（@Exclude）
 * 値の変換（@Transform）
 */
export class StoreResponseDto implements StoreResponseShape {
  // Storeドメインにidは不要。ResponseDtoにidを付与。→ベストプラクティス!!
  @Expose()
  readonly id: string;

  @Expose()
  name: string;
  @Expose()
  kanaName?: string;
  @Expose()
  status: StoreStatus;
  // ステータスを日本語に変換（@Transformではなくgetterで）
  @Expose()
  get statusLabel(): string {
    switch (this.status) {
      case StoreStatus.PUBLISHED:
        return '営業中';
      case StoreStatus.EDITING:
        return '編集中';
      case StoreStatus.SUSPENDED:
        return '閉店';
      default:
        return '';
    }
  }

  @Expose()
  code?: string;
  @Expose()
  zipCode?: string;
  @Expose()
  email: string;
  @Expose()
  address?: string;
  @Expose()
  phoneNumber: string;
  @Expose()
  businessHours?: string;

  // 休日
  @Expose()
  holidays?: Weekday[];

  // ※ @Transformよりも以下のgetterの方がスマートらしいので削除
  // 休日を日本語['月', '火', ...] の形式で返す。
  // @Expose()
  // @Transform(({ value }) => (value as Weekday[])?.map((w) => WEEKDAY_LABELS[w]))
  // holidaysLabel?: string[];

  /**
   * 休日を日本語['日', '月', ...] の形式で返すゲッター
   * 変換ロジックをゲッター内に持つことで、instanceToPlain時に実行される。
   */
  @Expose() // JSONに出力するため、ゲッターにも @Expose() が必要
  get holidaysLabel(): string[] | undefined {
    // // holidaysプロパティが既に plainToInstance によって設定されていることを前提とする
    // if (!this.holidays || this.holidays.length === 0) {
    //   return undefined; // 値がない場合は undefined を返す
    // }

    // WEEKDAY_LABELS を使用して変換を実行
    return this.holidays?.map((w) => WEEKDAY_LABELS[w]);
  }

  @Expose()
  readonly createdAt: Date;
  @Expose()
  readonly updatedAt: Date;

  @Expose()
  readonly prefecture?: Prefecture;

  // 重要!! コンストラクタ：domain → DTO 変換するコンストラクタ
  // domainはあくまで「ビジネスルール」だけ持つべきであり、idやcreatedAt、updatedAtなどはDTO
  // で持つ。
  // あれ??、でもplainToInstanceでdomain→dto変換してるから、このconstructor使われてなくね？
  // constructor(domain: Store, id: string) {
  //   this.id = id;
  //   Object.assign(this, domain);
  // }
  constructor(
    id: string,
    name: string,
    status: StoreStatus,
    email: string,
    phoneNumber: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.email = email;
    this.phoneNumber = phoneNumber;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
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
 * ページ化されたStoreレスポンスDTO
 * ページ全体を表すラッパーDTO：data/metaでStoreDTOとMetaDTOを持つ
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
 */
export class PaginatedStoreResponseDto implements PaginatedResult<StoreResponseDto> {
  // @Type: plain object → クラスインスタンスへの変換を正確に行うための型ヒント
  @Type(() => StoreResponseDto)
  data: StoreResponseDto[];

  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;

  constructor(data: StoreResponseDto[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * 店舗情報検索フィルターDTO
 */
export class FindAllStoresQueryDto implements StoreFilter {
  // 店舗コード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(5) // 任意項目だが入力された際のValidation
  code?: string;

  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  // ↓空文字が来た場合、空文字で検索しに行くため、IsNotEmpty()は不要
  // @IsNotEmpty()
  @MaxLength(40) // 任意項目だが入力された際のValidation
  name?: string;

  // エリアコード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(2) // 任意項目だが入力された際のValidation
  regionCode?: string;

  // 都道府県コード
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(2) // 任意項目だが入力された際のValidation
  prefectureCode?: string;

  // StoreStatusは厳密なEnumではない（modern Enum=union)のだが@IsEnum()が効くみたい！
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsEnumを無視)
  @IsEnum(StoreStatus, {
    message: `StoreStatus must be one of: ${StoreStatus.EDITING}, ${StoreStatus.PUBLISHED}, ${StoreStatus.SUSPENDED}`,
  })
  status?: StoreStatus;

  @IsOptional()
  @IsEnum(SortBy, {
    message: `SortOrder must be one of: ${SortBy.KANANAME}, ${SortBy.ID}, ${SortBy.CODE}`,
  })
  sortBy?: SortBy;

  @IsOptional()
  @IsEnum(SortOrder, {
    message: `SortOrder must be one of: ${SortOrder.ASC}, ${SortOrder.DESC}`,
  })
  sortOrder?: SortOrder;

  @IsOptional()
  @IsInt() // 整数のみ許容：一方IsNumberは少数OKになってしまう
  @Min(1) // 0以上
  // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  // @MaxLength(3)
  @Max(10000)
  // string → number 変換
  // main.tsにてグローバルでValidationPipe({transform: true})としてtransformを有効化
  // していれば、@IsNumber()がついていれば、個別でNumber変換(@Type()での型変換)は不要。
  // であるが、main.tsはtransform: tureがなかったので、個別で@Typeにて変換。
  // → 個別でやることが多いらしい。
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt() // 整数のみ許容：一方IsNumberは少数OKになってしまう
  @Min(1) // 0以上
  // @MaxLength()は文字列にのみ有効なので、numberの場合はMax()を使う
  @Max(2000)
  // string → number 変換
  @Type(() => Number)
  size?: number;
}

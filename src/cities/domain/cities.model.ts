/**
 * Cities domain 全属性(完全な状態)
 *
 * 都道府県(Prefecture)は別集約のため、オブジェクトではなくID(prefectureId)で参照する。
 * 都道府県が未設定の都市も存在するため任意項目。
 */
export interface CityState {
  // Entityの識別子(同一性はidで決まる)
  // DBではなくdomain(createNew)で採番するため、保存前から必ず値を持つ(必須項目)
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kanaName: string;
  // URL用の識別子(例: tokyo)。半角英小文字・数字・ハイフンのみ
  readonly slug: string;
  readonly status: CityStatus;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // PrefectureId(Prefectureとの紐付け関連(任意。例: 東京 → 東京都、横浜 → 神奈川県))
  readonly prefectureId?: string;
}

/**
 * City（都市）domain
 *
 * ### Domain Behavior(ドメインの振る舞い)
 * - createNew(): 新しいCityを作成する（ファクトリメソッド）
 * - reconstitute(): Cityの再構築（DB等から再構築)
 * - toSnapshot(): Cityのスナップショットに変換
 * - update(): Cityの情報を更新する
 * - publish(): Cityを公開する
 * - unpublish(): Cityを非公開(編集中)にする
 * - suspend(): Cityを停止中にする
 */
export class City {
  private readonly _id: string;
  private _code: string;
  private _name: string;
  private _kanaName: string;
  // URL用の識別子(例: /tokyo)であり、業務上の属性のためdomainとして保持。
  // 例えば管理画面から登録・変更する際、domain が持っていないと保存できない
  private _slug: string;
  private _status: CityStatus;
  private _sortOrder: number;
  private _createdAt: Date;
  private _updatedAt: Date;
  // PrefectureId(Prefectureとの紐付け関連(任意。例: 東京 → 東京都、横浜 → 神奈川県))
  private _prefectureId?: string;

  private constructor(
    id: string,
    code: string,
    name: string,
    kanaName: string,
    slug: string,
    status: CityStatus,
    sortOrder: number,
    prefectureId: string | undefined,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._id = id;
    this._code = code;
    this._name = name;
    this._kanaName = kanaName;
    this._slug = slug;
    this._status = status;
    this._sortOrder = sortOrder;
    this._prefectureId = prefectureId;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }
}

// modern enumパターン（union)
// as const は リテラルの型を固定する魔法のような構文
// このオブジェクトを元に以下のmodern enum（union) 型を作成する
export const CityStatus = {
  PUBLISHED: 'published', // 掲載中
  EDITING: 'editing', // 編集中
  SUSPENDED: 'suspended', // 停止中
} as const;

/**
 * CityStatus（モダンenum=union）の型を定義()
 *
 * 上記の 「const CityStatus」はあくまでconstオブジェクト(値)であり、CityStatusという型
 * ではないのでtype CityStatusとして型を定義している。
 *
 * type CityStatus = "published" | "editing" | "suspended"
 */
export type CityStatus = (typeof CityStatus)[keyof typeof CityStatus];

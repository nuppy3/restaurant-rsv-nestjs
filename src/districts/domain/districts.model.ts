/**
 * District(地区) domain
 *
 * ### Domain Behavior(ドメインの振る舞い)
 * - createNew(): 新しいCityを作成する（ファクトリメソッド）
 * - reconstitute(): Cityの再構築（DB等から再構築)
 * - toSnapshot(): Cityのプロパティをスナップショットに変換
 * - update(): Cityの情報を更新する
 * - publish(): Cityを公開する
 * - unpublish(): Cityを非公開(編集中)にする
 * - suspend(): Cityを停止中にする
 */
export class District {
  private readonly _id: string;
  private _code: string;
  private _name: string;
  private _kanaName: string;
  // URL用の識別子(例: /tokyo)であり、業務上の属性のためdomainとして保持。
  // 例えば管理画面から登録・変更する際、domain が持っていないと保存できない
  private _slug: string;
  private _status: DistrictStatus;
  private _sortOrder: number;
  private _createdAt: Date;
  private _updatedAt: Date;
  // PrefectureId(Prefectureとの紐付け関連(任意。例: 東京 → 東京都、横浜 → 神奈川県))
  private _cityId: string;

  private constructor(
    id: string,
    code: string,
    name: string,
    kanaName: string,
    slug: string,
    status: DistrictStatus,
    sortOrder: number,
    cityId: string,
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
    this._cityId = cityId;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }
}

// modern enumパターン(union)
export const DistrictStatus = {
  PUBLISHED: 'published', // 掲載中
  EDITING: 'editing', // 編集中
  SUSPENDED: 'suspended', // 停止中
} as const;

/**
 * DistrictStatus（モダンenum=union）の型を定義()
 *
 * 上記の 「const DistrictStatus」はあくまでconstオブジェクト(値)であり、CityStatusという型
 * ではないのでtype DistrictStatusとして型を定義している。
 *
 * type DistrictStatus = "published" | "editing" | "suspended"
 */
export type DistrictStatus =
  (typeof DistrictStatus)[keyof typeof DistrictStatus];

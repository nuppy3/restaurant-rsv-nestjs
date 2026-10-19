import { randomUUID } from 'crypto';
/**
 * District domain 全属性(完全な状態)
 *
 * 都市(City)は別集約のため、オブジェクトではなくID(CityId)で参照する。
 * 都市が未設定の地区は存在させないため、必須項目としている。
 */
export interface DistrictState {
  // Entityの識別子(同一性はidで決まる)
  // DBではなくdomain(createNew)で採番するため、保存前から必ず値を持つ(必須項目)
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kanaName: string;
  // URL用の識別子(例: ginza/ebisu/roppongi/shibuya)。半角英小文字・数字・ハイフンのみ
  readonly slug: string;
  readonly status: DistrictStatus;
  readonly sortOrder: number;
  // 必須
  readonly cityId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 【新規作成用プロパティ】
 * District domain作成時に必要なプロパティを型として定義
 * 外部から入力される項目のみ(id、statusや日付は内部で生成するため除外)
 */
export type CreateDistrictProps = Omit<
  DistrictState,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * 【更新用プロパティ】
 * District domain更新時に必要なプロパティを型として定義
 * id・日付・status以外は更新対象(任意項目).idはEntityの識別子のため変更不可
 * statusの変更はpublish / unpublish / suspendの専用メソッドでのみ行う(Regionとの差分)
 */
export type UpdateDistrictProps = Partial<
  Omit<DistrictState, 'id' | 'status' | 'createdAt' | 'updatedAt'>
>;

/**
 * 【再構成用】
 * DB等から戻ってくる全項目
 */
export type ReconstituteDistrictProps = DistrictState;

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

  /**
   * 新しいDistrict(地区)を作成する（ファクトリメソッド）
   *
   * @param props District domain作成に必要なプロパティ
   * @returns District domain
   */
  createNew(props: CreateDistrictProps): District {
    return new District(
      // idはdomainで採番する(DBの@default(uuid())には頼らない)
      randomUUID(),
      // createdAt,updatedAtはデフォルトでdomain作成時時刻
      // ステータスは強制的に「編集中」= EDITING
      props.code,
      props.name,
      props.kanaName,
      props.slug,
      DistrictStatus.EDITING,
      props.sortOrder,
      props.cityId,
      new Date(),
      new Date(),
    );
  }

  /**
   * Districtの再構築（DB等から再構築（すでに日付がある場合））
   *
   * @param props District domain再構築用項目(DB全項目)
   * @returns District domain
   */
  Reconstitute(props: ReconstituteDistrictProps): District {
    return new District(
      props.id,
      props.code,
      props.name,
      props.kanaName,
      props.slug,
      props.status,
      props.sortOrder,
      props.cityId,
      props.createdAt,
      props.updatedAt,
      // memo: 以下のようにスプレッド構文はNG（理由がちょっと深いのでmemoしておく
      // ...props,
      //
      // ・オブジェクトの複製（これはOK）
      // const newObj = { ...props };
      // これは「新しいオブジェクトの中に、プロパティをコピーする」という意味なので通ります。
      //
      // ・関数の引数への展開（これがNG）
      // new Region(...props);
      // これは「props の中身を、1番目の引数、2番目の引数…として順番に渡す」という意味になります。
      // オブジェクトには「1番目」という概念がないため、エラーになります。
    );
  }

  /**
   * District domain のプロパティをスナップショット(DistrictState)に変換する。
   * Date型は外部での書き換えが内部に波及しないよう防御的コピーを返す。
   *
   * ドメインエンティティの内部状態（プライベート変数）を、DistrictState インターフェースの形に
   * 綺麗にコピーして出力するだけのシンプルな関数。
   *
   * ポイントは、外部に渡したデータが勝手に書き換えられても、エンティティ内部の状態（オリジナル）が
   * 汚染されないように、安全にディープコピー（またはインスタンスの複製）を行うことです。
   *
   */
  toSnapshot(): DistrictState {
    return {
      id: this._id,
      code: this._code,
      name: this._name,
      kanaName: this._kanaName,
      slug: this._slug,
      status: this._status,
      sortOrder: this._sortOrder,
      cityId: this._cityId,
      // ⚠️ Date型などの参照型オブジェクトは、
      // 外部で書き換えられると内部まで変わってしまう（参照透過性の破壊）ため、
      // 必ず new Date() で新しいインスタンスにしてコピー（防御的コピー）を返します。
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
    } satisfies DistrictState;
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

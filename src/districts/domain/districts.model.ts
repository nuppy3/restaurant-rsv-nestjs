import { randomUUID } from 'crypto';
import {
  DistrictAlreadyEditedException,
  DistrictAlreadyPublishedException,
  DistrictAlreadySuspendedException,
} from './errors/districts.exceptions';
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
 * - createNew(): 新しいDistrictを作成する（ファクトリメソッド）
 * - reconstitute(): Districtの再構築（DB等から再構築)
 * - toSnapshot(): Districtのプロパティをスナップショットに変換
 * - update(): Districtの情報を更新する
 * - publish(): Districtを公開する
 * - unpublish(): Districtを非公開(編集中)にする
 * - suspend(): Districtを停止中にする
 */
export class District {
  private readonly _id: string;
  private _code: string;
  private _name: string;
  private _kanaName: string;
  // URL用の識別子(例: /ginza)であり、業務上の属性のためdomainとして保持。
  // 例えば管理画面から登録・変更する際、domain が持っていないと保存できない
  private _slug: string;
  private _status: DistrictStatus;
  private _sortOrder: number;
  private _createdAt: Date;
  private _updatedAt: Date;
  // 都市(City)との紐付け関連(必須。例: 銀座 → 東京)
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
  static createNew(props: CreateDistrictProps): District {
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
  static reconstitute(props: ReconstituteDistrictProps): District {
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

  /**
   * domain update: domainの更新
   * updateロジックを集約（serviceなどに漏らさない)
   * 掲載中(published)の場合は更新不可。undefinedの項目は更新しない。
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・updateしてもいいかの判定
   *  例：
   *  - ステータスが掲載中の場合は更新不可(エラーを投げる）
   * ・各プロパティ(基本情報)の更新（＝各プロパティ / updateAtの更新)
   *
   * @param props 更新対象のプロパティ
   */
  update(props: UpdateDistrictProps): void {
    // ドメインルール： 更新可能か判定(ガード節)
    this.validateCanUpdate();

    // プロパティ更新
    //
    // props.codeがnullの場合は、そのままnullでupdateさせる仕様のためundefinedのみ判定
    // ちなみに、リクエストパラメータでcodeの項目が無ければundefinedで渡される。
    // JSONリクエストボディで項目自体を省略した場合（例: { "code": "JP" } のように name を
    // 書かない場合）：
    // class-transformer（ValidationPipeのtransform: true時）がDTOインスタンスを
    // 作成する際に、存在しないプロパティは undefined として扱われる。
    if (props.code !== undefined) {
      this._code = props.code;
    }
    if (props.name !== undefined) {
      this._name = props.name;
    }
    if (props.kanaName !== undefined) {
      this._kanaName = props.kanaName;
    }
    if (props.slug !== undefined) {
      this._slug = props.slug;
    }
    if (props.sortOrder !== undefined) {
      this._sortOrder = props.sortOrder;
    }
    if (props.cityId !== undefined) {
      this._cityId = props.cityId;
    }

    // 更新日付
    this._updatedAt = new Date();
  }

  /**
   * publish(): domainを掲載中に更新
   * publishロジックを集約（serviceなどに漏らさない)
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・掲載中にしてもいいかの判定
   *  例：
   *  - すでに掲載中状態の場合は掲載中に更新しない(エラーを投げる）
   * ・ステータス更新（＝status: 掲載中/ updateAtの更新)
   */
  publish(): void {
    // ドメインルール： 更新可能か判定(ガード節)
    this.validateCanPublish();

    // ステータス・更新日付 更新
    this._status = DistrictStatus.PUBLISHED;
    this._updatedAt = new Date();
  }

  /**
   * unpublish(): domainを編集中に更新
   * unpublishロジックを集約（serviceなどに漏らさない)
   * 掲載を取り下げて編集中(editing)に戻す
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・編集中にしてもいいかの判定
   *  例：
   *  - すでに掲載中状態の場合は掲載中に更新しない(エラーを投げる）
   * ・ステータス更新（＝status: 編集中/ updateAtの更新)
   */
  unpublish(): void {
    // 編集中に更新可能か判定(ガード節): ドメインルール
    this.validateCanUnpublish();

    // ステータス・更新日付 更新
    this._status = DistrictStatus.EDITING;
    this._updatedAt = new Date();
  }

  /**
   * domain delete(ソフトデリート)
   * deleteロジックを集約（serviceなどに漏らさない)
   * 論理削除: 利用停止(suspended)にする
   * 店舗が紐づいているかの判定は集約をまたぐため DistrictsDomainService で行う
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・デリートしてもいいかの判定
   *  例：
   *  - すでに利用停止状態の場合は削除しない(エラーを投げる）
   *  - 紐づく地区が存在する場合は削除しない → Domain Serviceにて実施
   * ・ソフトデリート（＝status: 停止/ updateAtの更新)
   */
  suspend(): void {
    // 停止中に更新可能か判定(ガード節): ドメインルール
    this.validateCanSuspend();

    // ステータス・更新日付 更新
    this._status = DistrictStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  /**
   * 更新が可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   *
   * 外部から「削除ボタンを表示するかどうか」の判定にも使えるよう public にするのもアリです
   */
  private validateCanUpdate(): void {
    // ルール①：ステータスが掲載中の場合
    if (this._status === DistrictStatus.PUBLISHED) {
      throw new DistrictAlreadyPublishedException(this._name);
    }
    // ルール② 例： 紐づく地区が存在するか(prefectureIdが存在するか）
    // ルール③ 例：ビジネスルール（例: 現在キャンペーン実施中は削除不可）
    // ルール④ 例：北陸地方（code:05）の場合、特定の期間中は削除不可
  }

  /**
   * 掲載中に更新可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   */
  private validateCanPublish(): void {
    // ルール①：ステータスが掲載中の場合
    if (this._status === DistrictStatus.PUBLISHED) {
      throw new DistrictAlreadyPublishedException(this._name);
    }

    // ルール② 例： 紐づく地区が存在するか(prefectureIdが存在するか）
    // ルール③ 例：ビジネスルール（例: 現在キャンペーン実施中は削除不可）
    // ルール④ 例：北陸地方（code:05）の場合、特定の期間中は削除不可
  }

  /**
   * 編集中に更新可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   */
  private validateCanUnpublish(): void {
    // ルール①：ステータスが編集中の場合
    if (this._status === DistrictStatus.EDITING) {
      throw new DistrictAlreadyEditedException(this._name);
    }

    // ルール② 例： 紐づく地区が存在するか(prefectureIdが存在するか）
    // ルール③ 例：ビジネスルール（例: 現在キャンペーン実施中は削除不可）
    // ルール④ 例：北陸地方（code:05）の場合、特定の期間中は削除不可
  }

  /**
   * 削除（利用停止）が可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   *
   * 外部から「削除ボタンを表示するかどうか」の判定にも使えるよう public にするのもアリです
   */
  private validateCanSuspend(): void {
    // ルール①：既に停止中の場合
    if (this._status === DistrictStatus.SUSPENDED) {
      throw new DistrictAlreadySuspendedException(this._name);
    }
  }

  /**
   * Getter 定義
   * コンストラクタの引数名（内部変数名）に'_'(アンダースコア)をつけて手を加え、
   * 外部に見せる名前（Getter）を綺麗な 変数名（code、name、、） に保つのが一般的。
   *
   * なぜ _（アンダースコア）がよく使われるのか？
   * 多くのエンジニアが private readonly _code: string と書く理由は、
   * **「外部に公開するプロパティ名（Getter名）を、一番自然な code という名前にしたいから」**です。
   * 内部: _code（ちょっと汚くてもいい、隠れているから）
   * 公開: code（利用者が使いやすい、綺麗な名前）
   */
  // getterのみ(setterなし)のため、外部からidを書き換えることはできない
  get id(): string {
    return this._id;
  }
  get code(): string {
    return this._code;
  }
  get name(): string {
    return this._name;
  }
  get kanaName(): string {
    return this._kanaName;
  }
  get slug(): string {
    return this._slug;
  }
  get status(): DistrictStatus {
    return this._status;
  }
  get sortOrder(): number {
    return this._sortOrder;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get cityId(): string {
    return this._cityId;
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
 * 上記の 「const DistrictStatus」はあくまでconstオブジェクト(値)であり、DistrictStatusという型
 * ではないのでtype DistrictStatusとして型を定義している。
 *
 * type DistrictStatus = "published" | "editing" | "suspended"
 */
export type DistrictStatus =
  (typeof DistrictStatus)[keyof typeof DistrictStatus];

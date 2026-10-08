import {
  PrefectureAlreadyEditedException,
  PrefectureAlreadyPublishedException,
  PrefectureAlreadySuspendedException,
  PrefectureRegionNotAssignedException,
} from './errors/prefectures.exceptions';

/**
 * Prefecture domain 全属性(完全な状態)
 *
 * 地方(Region)は別集約のため、オブジェクトではなくID(regionId)で参照する。
 * 地方が未設定の都道府県も存在するため任意項目。
 */
export interface PrefectureState {
  readonly code: string;
  readonly name: string;
  readonly kanaName: string;
  readonly kanaEn: string;
  readonly status: PrefectureStatus;
  // region（VO：Value Obect 値オブジェクト）ではなく、regionIdとしてID参照に留めるのがBP
  // 都道府県が所属するエリアはあくまでラベルであり、Prefectureドメイン(マスター）が責任を持つというより
  // 地理マスターが責任を持つべき。という考え方。
  readonly regionId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 【新規作成用】
 * Prefecture domain作成時に必要なプロパティを型として定義
 * 外部から入力される項目のみ（statusや日付は内部で生成するため除外）
 */
export type CreatePrefectureProps = Omit<
  PrefectureState,
  'status' | 'createdAt' | 'updatedAt'
>;

/**
 * 【更新用】
 * Prefecture domain更新時に必要なプロパティを型として定義
 * 日付・status以外は更新対象(任意項目)
 * statusの変更はpublish / unpublish / removeの専用メソッドでのみ行う(Regionとの差分)
 */
export type UpdatePrefectureProps = Partial<
  Omit<PrefectureState, 'status' | 'createdAt' | 'updatedAt'>
>;

/**
 * 【再構成用】
 * DB等から戻ってくる全項目
 */
export type ReconstitutePrefectureProps = PrefectureState;

/**
 * Prefecture domain
 */
export class Prefecture {
  private _code: string;
  private _name: string;
  private _kanaName: string;
  private _kanaEn: string;
  private _status: PrefectureStatus;
  private _regionId?: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  // constructorを private にして外部からの new を禁止する
  private constructor(
    code: string,
    name: string,
    kanaName: string,
    kanaEn: string,
    status: PrefectureStatus,
    regionId: string | undefined,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this._code = code;
    this._name = name;
    this._kanaName = kanaName;
    this._kanaEn = kanaEn;
    this._status = status;
    this._regionId = regionId;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規作成用の静的メソッド（factory method）
   * domain新規作成時のルールを実装
   * ステータスは強制的に「編集中」、createdAt / updatedAt は作成時刻
   */
  static createNew(props: CreatePrefectureProps): Prefecture {
    return new Prefecture(
      // createdAt,updatedAtはデフォルトでdomain作成時時刻
      // ステータスは強制的に「編集中」= EDITING
      props.code,
      props.name,
      props.kanaName,
      props.kanaEn,
      PrefectureStatus.EDITING,
      props.regionId,
      new Date(),
      new Date(),
    );
  }

  /**
   * domainの再構築（DB等からの再構築用（すでに日付がある場合））
   */
  static reconstitute(props: ReconstitutePrefectureProps): Prefecture {
    return new Prefecture(
      props.code,
      props.name,
      props.kanaName,
      props.kanaEn,
      props.status,
      props.regionId,
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
   * Prefecture domain のプロパティをスナップショット(PrefectureState)に変換する。
   * Date型は外部での書き換えが内部に波及しないよう防御的コピーを返す。
   *
   * ドメインエンティティの内部状態（プライベート変数）を、PrefectureState インターフェースの形に
   * 綺麗にコピーして出力するだけのシンプルな関数。
   *
   * ポイントは、外部に渡したデータが勝手に書き換えられても、エンティティ内部の状態（オリジナル）が
   * 汚染されないように、安全にディープコピー（またはインスタンスの複製）を行うことです。
   *
   * @returns Prefecture domain propertie のスナップショット
   */
  toSnapshot(): PrefectureState {
    return {
      code: this._code,
      name: this._name,
      kanaName: this._kanaName,
      kanaEn: this._kanaEn,
      status: this._status,
      regionId: this._regionId,
      // ⚠️ Date型などの参照型オブジェクトは、
      // 外部で書き換えられると内部まで変わってしまう（参照透過性の破壊）ため、
      // 必ず new Date() で新しいインスタンスにしてコピー（防御的コピー）を返します。
      createdAt: new Date(this._createdAt.getTime()),
      updatedAt: new Date(this._updatedAt.getTime()),
    };
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
   *  - 紐づく都道府県が存在する場合は更新しない
   *
   * @param props 更新対象のプロパティ
   */
  update(props: UpdatePrefectureProps): void {
    // ドメインルール： 更新可能か判定(ガード節)
    this.validateCanUpdate();

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
    if (props.kanaEn !== undefined) {
      this._kanaEn = props.kanaEn;
    }
    if (props.regionId !== undefined) {
      this._regionId = props.regionId;
    }

    this._updatedAt = new Date();
  }

  /**
   * publish(): domainを掲載中に更新
   * publishロジックを集約（serviceなどに漏らさない)
   * 地方が未設定の場合は掲載できない
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・掲載中にしてもいいかの判定
   *  例：
   *  - すでに掲載中状態の場合は掲載中に更新しない(エラーを投げる）
   *  - 紐づく都道府県が存在する場合は削除しない
   * ・ソフトデリート（＝status: 停止/ updateAtの更新)
   */
  publish(): void {
    // 掲載中に更新可能か判定(ガード節)：ドメインルール
    this.validateCanPublish();

    // ステータス更新と更新日付セット
    this._status = PrefectureStatus.PUBLISHED;
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
   *  - 紐づく都道府県が存在する場合は削除しない
   * ・ソフトデリート（＝status: 停止/ updateAtの更新)
   */
  unpublish(): void {
    // 編集中(非公開)に更新可能か判定(ガード節)：ドメインルール
    this.validateCanUnpublish();

    // ステータス更新と更新日付セット
    this._status = PrefectureStatus.EDITING;
    this._updatedAt = new Date();
  }

  /**
   * domain delete(ソフトデリート)
   * deleteロジックを集約（serviceなどに漏らさない)
   * 論理削除: 利用停止(suspended)にする
   * 店舗が紐づいているかの判定は集約をまたぐため PrefecturesDomainService で行う
   *
   * 当該メソッドは、すでに存在する「特定のデータ（自分自身の状態）」を持つオブジェクトに対して
   * 命令を下すメソッドなので、staticではなく、インスタンスメソッド。
   *
   * ・デリートしてもいいかの判定
   *  例：
   *  - すでに利用停止状態の場合は削除しない(エラーを投げる）
   *  - 紐づく都道府県が存在する場合は削除しない
   * ・ソフトデリート（＝status: 停止/ updateAtの更新)
   */
  remove(): void {
    // 削除可能か判定(ガード節)：ドメインルール
    this.validateCanDelete();

    // ステータス更新と更新日付セット
    this._status = PrefectureStatus.SUSPENDED;
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
    if (this._status === PrefectureStatus.PUBLISHED) {
      throw new PrefectureAlreadyPublishedException(this._name);
    }
  }

  /**
   * 掲載中に更新が可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   */
  private validateCanPublish(): void {
    // ルール①：ステータスが掲載中の場合
    if (this._status === PrefectureStatus.PUBLISHED) {
      throw new PrefectureAlreadyPublishedException(this._name);
    }
    // 紐づく地方が存在するか(regionIdが存在するか）
    // 自身の状態(regionId)だけで判定できるルールなので、DomainServiceではなくEntityに置く
    if (!this._regionId) {
      throw new PrefectureRegionNotAssignedException(this._name);
    }

    // TODO // ルール② 例：紐づく都道府県が存在する場合は削除不可（参照整合性）

    // TODO // ルール③ 例：ビジネスルール（例: 現在キャンペーン実施中は削除不可）

    // TODO // ルール④ 例：北陸地方（code:05）の場合、特定の期間中は削除不可
  }

  /**
   * 編集中に更新が可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   */
  private validateCanUnpublish(): void {
    // ルール①：既に編集中の場合
    if (this._status === PrefectureStatus.EDITING) {
      throw new PrefectureAlreadyEditedException(this._name);
    }
  }

  /**
   * 削除（利用停止）が可能かどうかのビジネスルールを判定
   * 判定NGの場合はエラーをスロー(ガード節)
   *
   * 外部から「削除ボタンを表示するかどうか」の判定にも使えるよう public にするのもアリです
   */
  private validateCanDelete(): void {
    // ルール①：既に停止中の場合
    if (this._status === PrefectureStatus.SUSPENDED) {
      throw new PrefectureAlreadySuspendedException(this._name);
    }

    // ルール② 例：紐づく都道府県が存在する場合は削除不可（参照整合性）
    // → 判定に必要な「紐づく都道府県の件数」をdomainで保持するのは不自然なので、domain内で
    //   当該判定は実施しない。service内で実施する。
    //   _prefectureIds を持たせるのは「間違いではないが、もっと良い（DDD/CAらしい）方法がある」
    //
    // DDDの原則に照らすと、以下の懸念が出てきます。
    // 整合性の維持が困難: Prefecture が増えたり減ったりするたびに、Region 側の _prefectureIds も
    //                  更新しなければなりません。データが二重管理になり、バグの温床になります。
    // 不自然な依存: 本来、都道府県（Prefecture）が地方（Region）を参照する形が自然です。
    //             地方がわざわざ「自分の子供たちの名簿」を常に抱えているのは、ドメインモデルが
    //             重くなりすぎる原因になります。
    //
    // 「外部から教えてもらう（引数）」か「詳しい人に聞く（Domain Service）」のどちらかを選ぶことで、
    //  Region モデルを軽く、美しく保つことができますよ！
    //
    // 結論：
    // 「Aを消す時にBが存在するか」というチェックは、集約を跨ぐ操作なので Domain Service に
    // 書くのが最も一般的。
    // Bの情報をApplicationのserviceで取得し、Domain Serviceに渡して、DomainService内で
    // 判定か、Domain Service内で、port経由(repository)でBを取得して判定か、どちらでもいい。
  }

  // Getterを定義
  /**
   * Getter
   * コンストラクタの引数名（内部変数名）に'_'(アンダースコア)をつけて手を加え、
   * 外部に見せる名前（Getter）を綺麗な 変数名（code、name、、） に保つのが一般的。
   *
   * なぜ _（アンダースコア）がよく使われるのか？
   * 多くのエンジニアが private readonly _code: string と書く理由は、
   * **「外部に公開するプロパティ名（Getter名）を、一番自然な code という名前にしたいから」**です。
   * 内部: _code（ちょっと汚くてもいい、隠れているから）
   * 公開: code（利用者が使いやすい、綺麗な名前）
   */
  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get kanaName(): string {
    return this._kanaName;
  }

  get kanaEn(): string {
    return this._kanaEn;
  }

  get status(): PrefectureStatus {
    return this._status;
  }

  get regionId(): string | undefined {
    return this._regionId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

// modern enumパターン（union)
export const PrefectureStatus = {
  PUBLISHED: 'published', // 掲載中
  EDITING: 'editing', // 編集中
  SUSPENDED: 'suspended', // 停止中
} as const;

// PrefectureStatus（モダンenum=union）の型を定義()
// 上記の 「const PrefectureStatus」はあくまでconstオブジェクト(値)であり、PrefectureStatusという型ではないので
// type PrefectureStatusとして型を定義している。
export type PrefectureStatus =
  (typeof PrefectureStatus)[keyof typeof PrefectureStatus];

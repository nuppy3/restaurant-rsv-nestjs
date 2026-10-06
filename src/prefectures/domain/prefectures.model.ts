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
  readonly regionId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 【新規作成用】
 * 外部から入力される項目のみ（statusや日付は内部で生成するため除外）
 */
export type CreatePrefectureProps = Omit<
  PrefectureState,
  'status' | 'createdAt' | 'updatedAt'
>;

/**
 * 【更新用】
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
   * ステータスは強制的に「編集中」、createdAt / updatedAt は作成時刻
   */
  static createNew(props: CreatePrefectureProps): Prefecture {
    return new Prefecture(
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
    );
  }

  /**
   * Prefecture domain のプロパティをスナップショット(PrefectureState)に変換する。
   * Date型は外部での書き換えが内部に波及しないよう防御的コピーを返す。
   */
  toSnapshot(): PrefectureState {
    return {
      code: this._code,
      name: this._name,
      kanaName: this._kanaName,
      kanaEn: this._kanaEn,
      status: this._status,
      regionId: this._regionId,
      createdAt: new Date(this._createdAt.getTime()),
      updatedAt: new Date(this._updatedAt.getTime()),
    };
  }

  /**
   * domain update: 基本情報の更新
   * 掲載中(published)の場合は更新不可。undefinedの項目は更新しない。
   */
  update(props: UpdatePrefectureProps): void {
    this.validateCanUpdate();

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
   * 掲載中(published)にする
   * 地方が未設定の場合は掲載できない
   */
  publish(): void {
    this.validateCanPublish();
    this._status = PrefectureStatus.PUBLISHED;
    this._updatedAt = new Date();
  }

  /**
   * 掲載を取り下げて編集中(editing)に戻す
   */
  unpublish(): void {
    this.validateCanUnpublish();
    this._status = PrefectureStatus.EDITING;
    this._updatedAt = new Date();
  }

  /**
   * 論理削除: 利用停止(suspended)にする
   * 店舗が紐づいているかの判定は集約をまたぐため PrefecturesDomainService で行う
   */
  remove(): void {
    this.validateCanDelete();
    this._status = PrefectureStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  private validateCanUpdate(): void {
    if (this._status === PrefectureStatus.PUBLISHED) {
      throw new PrefectureAlreadyPublishedException(this._name);
    }
  }

  private validateCanPublish(): void {
    if (this._status === PrefectureStatus.PUBLISHED) {
      throw new PrefectureAlreadyPublishedException(this._name);
    }
    // 自身の状態(regionId)だけで判定できるルールなので、DomainServiceではなくEntityに置く
    if (!this._regionId) {
      throw new PrefectureRegionNotAssignedException(this._name);
    }
  }

  private validateCanUnpublish(): void {
    if (this._status === PrefectureStatus.EDITING) {
      throw new PrefectureAlreadyEditedException(this._name);
    }
  }

  private validateCanDelete(): void {
    if (this._status === PrefectureStatus.SUSPENDED) {
      throw new PrefectureAlreadySuspendedException(this._name);
    }
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

export const PrefectureStatus = {
  PUBLISHED: 'published', // 掲載中
  EDITING: 'editing', // 編集中
  SUSPENDED: 'suspended', // 停止中
} as const;

export type PrefectureStatus =
  (typeof PrefectureStatus)[keyof typeof PrefectureStatus];

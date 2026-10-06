import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * 都道府県がすでに利用停止状態(suspended)の場合の例外
 */
export class PrefectureAlreadySuspendedException extends DomainException {
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'PREFECTURE_ALREADY_SUSPENDED';

  constructor(prefectureName: string) {
    super(`この都道府県はすでに利用停止状態です。都道府県： ${prefectureName}`);
    this.name = 'PrefectureAlreadySuspendedException';
  }
}

/**
 * 都道府県が掲載中(published)のため操作できない場合の例外
 */
export class PrefectureAlreadyPublishedException extends DomainException {
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'PREFECTURE_ALREADY_PUBLISHED';

  constructor(prefectureName: string) {
    super(
      `この都道府県は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 都道府県： ${prefectureName}`,
    );
    this.name = 'PrefectureAlreadyPublishedException';
  }
}

/**
 * 都道府県がすでに編集中(editing)の場合の例外
 */
export class PrefectureAlreadyEditedException extends DomainException {
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'PREFECTURE_ALREADY_EDITED';

  constructor(prefectureName: string) {
    super(
      `この都道府県は既に編集中のため、更新できません。 都道府県： ${prefectureName}`,
    );
    this.name = 'PrefectureAlreadyEditedException';
  }
}

/**
 * 地方(Region)が未設定のため掲載中にできない場合の例外
 */
export class PrefectureRegionNotAssignedException extends DomainException {
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'PREFECTURE_REGION_NOT_ASSIGNED';

  constructor(prefectureName: string) {
    super(
      `地方が設定されていないため、この都道府県は「掲載中」にできません。都道府県： ${prefectureName}`,
    );
    this.name = 'PrefectureRegionNotAssignedException';
  }
}

/**
 * 店舗が紐づいているため削除(利用停止)できない場合の例外
 */
export class PrefectureHasStoresException extends DomainException {
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'PREFECTURE_HAS_STORES';

  constructor(prefectureId: string) {
    super(
      `店舗が登録されているため、この都道府県は削除できません。prefectureId: ${prefectureId}`,
    );
    this.name = 'PrefectureHasStoresException';
  }
}

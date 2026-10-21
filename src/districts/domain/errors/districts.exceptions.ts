import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * 地区が掲載中(published)のため操作できない場合の例外
 */
export class DistrictAlreadyPublishedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'DISTRICT_ALREADY_PUBLISHED';

  constructor(districtName: string) {
    super(
      `この地区は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地区： ${districtName}`,
    );
    this.name = 'DistrictAlreadyPublishedException';
  }
}

/**
 * 地区が編集中(editing)のため操作できない場合の例外
 */
export class DistrictAlreadyEditedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'DISTRICT_ALREADY_EDITED';

  constructor(districtName: string) {
    super(`この地区は編集中のため、更新できません。地区： ${districtName}`);
    this.name = 'DistrictAlreadyEditedException';
  }
}

/**
 * 地区が停止中(suspend)のため操作できない場合の例外
 */
export class DistrictAlreadySuspendedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'DISTRICT_ALREADY_SUSPENDED';

  constructor(districtName: string) {
    super(`この地区は停止中のため、更新できません。地区： ${districtName}`);
    this.name = 'DistrictAlreadySuspendedException';
  }
}

/**
 * 親の都市が公開中でないため、操作できないための例外
 */
export class DistrictCityNotPublishedException extends DomainException {
  // オーバーライド（httpステータスコード/エラーコード）
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'DISTRICT_CITY_NOT_PUBLISHED';

  constructor(districtName: string, cityName: string) {
    super(
      `この地区に紐づく都市が公開中ではないため、公開できません。 地区： ${districtName} 都市： ${cityName}`,
    );
    this.name = 'DistrictCityNotPublishedException';
  }
}

/**
 * 店舗が紐づく地区は削除できない場合の例外
 */
export class DistrictHasStoresException extends DomainException {
  // オーバーライド（httpステータスコード/エラーコード）
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'DISTRICT_HAS_STORES';

  constructor(name: string) {
    super(
      `この地区は店舗が紐づいているため、停止中にできません。 地区： ${name}`,
    );
    this.name = 'DistrictHasStoresException';
  }
}

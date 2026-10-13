import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * 都市が掲載中(published)のため操作できない場合の例外
 */
export class CityAlreadyPublishedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_PUBLISHED';

  constructor(cityName: string) {
    super(
      `この都市は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 都市： ${cityName}`,
    );
    this.name = 'CityAlreadyPublishedException';
  }
}

/**
 * 都市が編集中(editing)のため操作できない場合の例外
 */
export class CityAlreadyEditedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_EDITED';

  constructor(cityName: string) {
    super(`この都市は編集中のため、更新できません。都市： ${cityName}`);
    this.name = 'CityAlreadyEditedException';
  }
}

/**
 * 都市が停止中(suspended)のため操作できない場合の例外
 */
export class CityAlreadySuspendedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_SUSPENDED';

  constructor(cityName: string) {
    super(`この都市は停止中のため、更新できません。都市： ${cityName}`);
    this.name = 'CityAlreadySuspendedException';
  }
}

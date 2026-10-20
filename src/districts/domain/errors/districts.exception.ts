import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * 地区が掲載中(published)のため操作できない場合の例外
 */
export class DistrictAreadyPublishedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_PUBLISHED';

  constructor(districtName: string) {
    super(
      `この地区は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地区： ${districtName}`,
    );
    this.name = 'DistrictAreadyPublishedException';
  }
}

/**
 * 地区が編集中(editing)のため操作できない場合の例外
 */
export class DistrictAreadyEditedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_EDITED';

  constructor(districtName: string) {
    super(`この地区は編集中のため、更新できません。地区： ${districtName}`);
    this.name = 'DistrictAreadyEditedException';
  }
}

export class DistrictAlreadySuspendedException extends DomainException {
  // 🗒override修飾子が無くてもオーバーライドは可能であるが、付与するとTypeScript が
  // 「親クラスに本当にその名前があるか」をチェックしてくれる
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'CITY_ALREADY_SUSPENDED';

  constructor(districtName: string) {
    super(`この地区は停止中のため、更新できません。地区： ${districtName}`);
    this.name = 'DistrictAlreadySuspendedException';
  }
}

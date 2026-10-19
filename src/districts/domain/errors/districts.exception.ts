import { HttpStatus } from '@nestjs/common';
import { DomainException } from 'src/common/domain/errors/domain.exception';

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

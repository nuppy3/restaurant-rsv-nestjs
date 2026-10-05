import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * regions.exceptions.ts： 実用性を意識し、一つのファイルにドメイン固有のException
 * クラスをまとめて定義。(1ファイル:Nクラス)
 *
 * 1ファイル:1クラスが責務の明確化（単一責任原則）に則っているが、今回は実用性を有線した。
 * AI曰く、1:Nでも問題ないとのこと。（BPの１つ）
 *
 */

/**
 * エリアドメイン特有の例外: エリアが既に利用停止中
 */
export class RegionAlreadySuspendedException extends DomainException {
  // ステータスを上書き
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'REGION_ALREADY_SUSPENDED';

  constructor(regionName: string) {
    super(`この地域はすでに利用停止状態です。地域： ${regionName}`);
    this.name = 'RegionAlreadySuspendedException';
  }
}

/**
 * エリアドメイン特有の例外: エリアが既に掲載中
 */
export class RegionAlreadyPublishedException extends DomainException {
  // ステータスを上書き
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'REGION_ALREADY_PUBLISHED';

  constructor(regionName: string) {
    super(
      `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： ${regionName}`,
    );
    this.name = 'RegionAlreadyPublishedException';
  }
}

/**
 * エリアドメイン特有の例外: エリアが既に編集中
 */
export class RegionAlreadyEditedException extends DomainException {
  // ステータスを上書き
  override readonly status: number = HttpStatus.CONFLICT;
  override readonly errorCode: string = 'REGION_ALREADY_EDITED';

  constructor(regionName: string) {
    super(`この地域は既に編集中のため、更新できません。 地域： ${regionName}`);
    this.name = 'RegionAlreadyEditedException';
  }
}

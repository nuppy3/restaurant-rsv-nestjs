import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrefectureHasStoresException } from './errors/prefectures.exceptions';

/**
 * Prefecture DomainService
 * 集約(Prefecture)単体では判定できない、他集約(Store)をまたぐルールを扱う
 * ※ 自身の状態だけで判定できるルール(地方の設定有無など)はEntity(Prefecture)側に置く
 */
@Injectable()
export class PrefecturesDomainService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * 削除(利用停止)可能か判定する
   * 店舗が1件でも紐づいている場合は削除できない
   *
   * @param id 都道府県ID
   */
  async assertDeletable(id: string): Promise<void> {
    const count = await this.prismaService.store.count({
      where: { prefectureId: id },
    });

    if (count > 0) {
      throw new PrefectureHasStoresException(id);
    }
  }
}

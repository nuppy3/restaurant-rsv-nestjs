import { Injectable } from '@nestjs/common';
import { City, CityStatus } from '../../cities/domain/cities.model';
import { PrismaService } from '../../prisma/prisma.service';
import { District } from './districts.model';
import {
  DistrictCityNotPublishedException,
  DistrictHasStoresException,
} from './errors/districts.exceptions';

/**
 * Districts Domain Serivce:
 * Domainの審判・専門家。複雑なドメインルールの判定などを行います。
 * 例： 紐づく店舗が存在する場合は削除不可（参照整合性）
 *      判定に必要な「紐づく店舗の件数」をDistrict Domainで保持するのは不自然なので
 *      Domain Serviceで当判定の専門家として、判定を行う。
 *      Store(店舗)のRepositoryを呼び出し、判定する。
 *      District domainはStore domainに依存せず、何も知らないので、専門家に聞くような
 *      イメージの役割分担。
 *
 * Districtは関連する都市のステータスがどうかは知らないから専門家に聞く
 *     ↓        ↑
 * District Domain Service（専門家は都市のことを調べて、調査結果を返す)
 *     ↓        ↑
 * City Repository
 */
@Injectable()
export class DistrictsDomainService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * assertPublishable: 公開中に更新可能か判定します。
   *
   * 親の都市が公開中でなければ、地区は公開できない
   * City は Application が取得して渡す(このメソッドは I/O をしない)
   *
   * @param district 地区ドメイン
   * @param city 都市ドメイン
   */
  assertPublishable(district: District, city: City): void {
    if (city.status !== CityStatus.PUBLISHED) {
      throw new DistrictCityNotPublishedException(district.name, city.name);
    }
  }

  /**
   * assertDeletable: 削除可能か判定します。他のドメインに依存する判定を行います。
   *
   * 店舗が紐づく地区は削除できない(Prefecture の assertDeletable と同じ形)
   *
   * @param district 地区ドメイン
   */
  async assertDeletable(district: District): Promise<void> {
    // TODO:
    // 店舗の件数を数えるための Store の Port は、まだありません。
    // Store の DDD 化（Step1-3）で、Port 経由に直すかを検討します。
    const count = await this.prismaService.store.count({
      where: { districtId: district.id },
    });
    if (count > 0) throw new DistrictHasStoresException(district.name);
  }
}

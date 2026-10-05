import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Regions Domain Serivce:
 * Domainの審判・専門家。複雑なドメインルールの判定などを行います。
 * 例： 紐づく都道府県が存在する場合は削除不可（参照整合性）
 *      判定に必要な「紐づく都道府県の件数」をRegion Domainで保持するのは不自然なので
 *      Domain Serviceで当判定の専門家として、判定を行う。
 *      Prefecture(都道府県)のRepositoryを呼び出し、判定する。
 *      Region domainはPrefecture domainに依存せず、何も知らないので、専門家に聞くような
 *      イメージの役割分担。
 *
 * Regionは関連する都道府県が何件あるか知らないから専門家に聞く
 *     ↓        ↑
 * Resion Domain Service（専門家は都道府県のことを調べて、調査結果を返す)
 *     ↓        ↑
 * Prefecture Repository
 */
@Injectable()
export class RegionsDomainService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * assertPublishable(): 公開中に更新可能か判定します。他のドメインに依存する判定を行います。
   * 🗒 ステータスを公開中に更新可能であることを保証します。
   *
   * ① エリアに紐づく都道府県が1つも存在しない場合は更新不可
   * ② XXXXXに場合は削除不可
   *
   * ⭐️本来は、Prefectureでinfrastructure/repository を呼ぶが、PrefectureはDDD/CAではなく
   *   いわゆる三層アーキテクチャーなので、Prefecture Serviceを呼んでいる。
   *   → 暫定でprismaService.prefecture()を呼んでいる。理由詳細は以下。
   *
   * @param id 都道府県ID
   */
  async assertPublishable(id: string): Promise<void> {
    // memo: 本来はprefecturesにRepositoryを作成して、region/domain/配下にrepositoryの
    // interface(prefecturesRepositoryPort)を作成し、prefecturesRepositoryPort(抽象)経由で
    // countを取得するのばBP。だが、PrefecturesはDDD/CAではなく3層アーキテクチャを実装しているため
    // Repositoryをあえて作成していない。そのため、Regionから以下のprefecturesServiceを
    // 呼ぶことで、効率的かと思っていたが、依存の循環が発生してしまいエラーになった件、、
    // → 本来はprefecturesRepositoryPort(抽象)を実装すべきであるが、暫定で、直接Prismaを
    //   使ってcountを取得する。
    // const count = await this.prefecturesService.countByRegionId(id);
    const count = await this.prismaService.prefecture.count({
      where: { regionId: id },
    });
    if (count === 0) {
      // 例外
      throw new ConflictException(
        `都道府県が登録されていないため、この地域は「掲載中」にできません。regionId: ${id}`,
      );
    }
  }

  /**
   * assertUnpublishable(): 編集中に更新可能か判定します。他のドメインに依存する判定を行います。
   * 🗒 ステータスを編集中に更新可能であることを保証します。
   *
   * ⭐️現状、編集中(非公開)へのステータス更新時の他ドメインに依存するロジックなし。
   *   一旦、暫定実装はしている。
   * 例：
   * ① エリアに紐づく都道府県が存在する場合は非公開にさせない
   * ② XXXXXに場合は削除不可
   *
   * @param id 都道府県ID
   */
  async assertUnpublishable(id: string): Promise<void> {
    // エリアに紐づく都道府県の件数を取得
    const count = await this.prismaService.prefecture.count({
      where: { regionId: id },
    });
    if (count > 0) {
      // // 例外
      // throw new ConflictException(
      //   `掲載中の都道府県が登録されているため、この地域は「編集中」にできません。regionId: ${id}`,
      // );
    }
  }

  /**
   * assertDeletable(): 削除可能か判定します。他のドメインに依存する判定を行います。
   * 🗒 ステータスを削除に更新可能であることを保証します。
   *
   * ① エリアに紐づく都道府県が1つでもある場合は削除不可
   * ② XXXXXに場合は削除不可
   *
   * ⭐️本来は、Prefectureでinfrastructure/repository を呼ぶが、PrefectureはDDD/CAではなく
   *   いわゆる三層アーキテクチャーなので、Prefecture Serviceを呼んでいる。
   *
   * @param id 都道府県ID
   */
  async assertDeletable(id: string): Promise<void> {
    // memo: 本来はprefecturesにRepositoryを作成して、region/domain/配下にrepositoryの
    // interface(prefecturesRepositoryPort)を作成し、prefecturesRepositoryPort(抽象)経由で
    // countを取得するのばBP。だが、PrefecturesはDDD/CAではなく3層アーキテクチャを実装しているため
    // Repositoryをあえて作成していない。そのため、Regionから以下のprefecturesServiceを
    // 呼ぶことで、効率的かと思っていたが、依存の循環が発生してしまいエラーになった件、、
    // → 本来はprefecturesRepositoryPort(抽象)を実装すべきであるが、暫定で、直接Prismaを
    //   使ってcountを取得する。
    // const count = await this.prefecturesService.countByRegionId(id);
    const count = await this.prismaService.prefecture.count({
      where: { regionId: id },
    });
    if (count > 0) {
      // 例外
      throw new ConflictException(
        `都道府県が登録されているため、この地域は削除できません。regionId: ${id}`,
      );
    }
  }
}

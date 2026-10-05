import { Prisma, Region as PrismaRegion } from 'generated/prisma';
import { ReconstituteRegionProps, Region } from '../domain/regions.model';

/**
 * RegionMapperクラス
 *
 * 【📌 役割】
 * infrastructureに位置し、prisma⇔domain間のデータ変換を担う
 * 外部の世界（データベース、Web、UI）からユースケースとdomain(エンティティ）への変換を行う。
 * 責務が最も明確に分かれる層。infrastructureのrepository(DB接続担当)から呼ばれる。
 *
 * ・Domain → Prisma(input) の変換
 * ・Prisma → Domain の変換
 */
export class RegionMapper {
  /**
   * domain → prismaInput(Create用のprismaInput)に変換します。
   * 戻り値の型(Prisma.RegionCreateInput)はPrismaが自動生成した型（Prisma.XXXCreateInput）
   *
   * @param domain Region domain
   * @param userId ユーザーID
   * @returns Prisma.RegionCreateInput（Prisma Region create用のinputデータ)
   */
  static toPrismaCreate(
    domain: Region,
    userId: string,
  ): Prisma.RegionCreateInput {
    // domainからすべてのデータをプレーンオブジェクトとして一括取得
    const snapshot = domain.toSnapshot();

    // createのパラメータ-
    const prismaInput = {
      // ⚠️ domain.xxxのようにgetter経由で取得する実装はカプセル化の防御
      // が弱いので、ロジック漏洩リスクが高まるため、domainをtoSnapshot()経由で取得するのがBP
      // 本当は以下のようにスプレッド構文一発でセットしたいが、createdAtが不要なので、一つ一つ
      // セットしていく。
      // ...snapshot,
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      status: snapshot.status,
      kanaEn: snapshot.kanaEn,
      createdAt: snapshot.createdAt,

      // code: domain.code,
      // name: domain.name,
      // kanaName: domain.kanaName,
      // status: domain.status,
      // kanaEn: domain.kanaEn,
      // createdAt: domain.createdAt,

      // userId: userId, ← 型エラーになる。以下のtoPrismaUpdate()を参照
      // userId: userId,
      user: { connect: { id: userId } },
    } satisfies Prisma.RegionCreateInput;
    return prismaInput;
  }

  /**
   * domain → prismaInput(Update用のprismaInput)に変換します。
   * 戻り値の型(Prisma.RegionCreateInput)はPrismaが自動生成した型（Prisma.XXXCreateInput）
   *
   * @param domain Region domain
   * @param userId ユーザーID
   * @returns Prisma.RegionUpdateInput（Prisma Region Update用のinputデータ)
   */
  static toPrismaUpdate(
    domain: Region & { id: string },
    userId: string,
  ): Prisma.RegionUpdateInput {
    // domainからすべてのデータをプレーンオブジェクトとして一括取得
    const snapshot = domain.toSnapshot();

    // Updateのパラメータ-
    const prismaInput = {
      // ⚠️ domain.xxxのようにgetter経由で取得する実装はカプセル化の防御
      // が弱いので、ロジック漏洩リスクが高まるため、domainをtoSnapshot()経由で取得するのがBP
      // 本当は以下のようにスプレッド構文一発でセットしたいが、createdAtが不要なので、一つ一つ
      // セットしていく。
      // ...snapshot,
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      status: snapshot.status,
      kanaEn: snapshot.kanaEn,
      updatedAt: snapshot.updatedAt,

      // code: domain.code,
      // name: domain.name,
      // kanaName: domain.kanaName,
      // status: domain.status,
      // kanaEn: domain.kanaEn,
      // updatedAt: domain.updatedAt,

      // userId: userId, ← 型エラーになる
      // ⭐️ userIdは外部キーであるが、Prisma.RegionUpdateInputは型安全のため
      //  直接userIdをセットできない型となっている。(userIdが無い)
      //  非チェック版のUncheckedCreateInputという型がありこちらは外部キーであるuserIdを
      //  保持しているためuserIdをセット可能であるが、非推奨。
      //  → 通常は RegionCreateInput + connect を使う。
      //    connect は、Prismaで既存のレコードをリレーション（関連付け）するための特別な操作。
      //    なぜ connect が必要なのか？
      //    RegionCreateInput では user というリレーション項目がありますが、userId は
      //    直接書けません（RegionCreateInput には userId がありません）。
      //    その代わりに、既存のUserを「接続（connect）」 する形で指定します。
      //
      //  例：
      //   const newRegion = await prisma.region.create({
      //     data: {
      //       code: "JP",
      //        name: "日本",
      //        kanaName: "にほん",
      //        kanaEn: "Nihon",
      //        user: {
      //          connect: {          // ← ここが connect
      //            id: "user-12345"  // すでに存在するUserのIDを指定
      //          }
      //        }
      //      }
      //    });
      user: { connect: { id: userId } },
    } satisfies Prisma.RegionUpdateInput;

    return prismaInput;
  }

  /**
   * Prisma Data → Region Domain に変換
   *
   * メソッド名をtoDomainにしているが、API→Domainなどのケースが発生したら
   * リネームする（prismaToDomainなど）
   *
   * @param record Prisma Region情報
   * @returns Region Domain + id
   */
  static toDomain(record: PrismaRegion): Region & { id: string } {
    // prisma → domain
    const domain = Region.reconstitute({
      code: record.code,
      name: record.name,
      kanaName: record.kanaName,
      status: record.status,
      kanaEn: record.kanaEn,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies ReconstituteRegionProps);

    // domain + id
    // 以下のような詰め替え方でsatisfiesするとRegionインスタンスじゃないので（メソッドが無かったり）
    // チェックNGになる。
    // const domainWithId = {
    //   id: record.id,
    //   code: domain.code,
    //   name: domain.name,
    //   kanaName: domain.kanaName,
    //   status: domain.status,
    //   kanaEn: domain.kanaEn,
    //   createdAt: domain.createdAt,
    //   updatedAt: domain.updatedAt,
    // } satisfies Region & { id: string };

    // domain + id
    const domainWithId = Object.assign(domain, { id: record.id });

    return domainWithId;
  }
}

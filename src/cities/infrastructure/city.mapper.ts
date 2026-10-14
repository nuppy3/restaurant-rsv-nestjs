import { City as PrismaCity, Prisma } from 'generated/prisma';
import { City, ReconstituteCityProps } from '../domain/cities.model';

/**
 * City Mapper (prisma ⇄ domain)
 * Prisma(Infrastructure層)のレコード/入力型と、City domain の相互変換を担う。
 * 層の境界での変換をここに集約し、Domain層がPrismaの型に依存しないようにする。
 */
export class CityMapper {
  /**
   * domain → Prisma作成用入力
   * 都道府県(prefectureId)が設定されている場合のみ、Prefectureとのリレーションをconnectする
   */
  static toPrismaCreate(domain: City, userId: string): Prisma.CityCreateInput {
    // domainの状態を、永続化用のデータ(CityState)としてまとめて取り出す
    // (getterでも読めるが、Region / Prefecture のMapperと揃えて toSnapshot() を使う)
    const snapshot = domain.toSnapshot();

    return {
      // idはdomainで採番済みの値をそのまま使う(DBの@default(uuid())は使わない)
      // → upsertのwhere(id)と、作成されるレコードのidが一致する
      id: snapshot.id,
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      slug: snapshot.slug,
      status: snapshot.status,
      sortOrder: snapshot.sortOrder,
      // 日付もdomainの値をそのまま保存する(createNew()で設定した作成時刻)
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      // 作成者(User)とのリレーション
      //
      // 🗒 connect とは:
      //    Prismaの「リレーションの書き込み」の指定方法の1つで、
      //    「すでにDBにある関連レコード(ここではUser)に、このレコードを紐づける」という意味。
      //    ・{ connect: { id: userId } } → idがuserIdのUserを探し、City.userId(外部キー)にそのidをセットする
      //    ・指定したidのレコードが存在しない場合は、Prismaがエラー(P2025)を投げる
      //      (外部キーに存在しないidを入れてしまうことを防げる)
      //
      //   ⭐️ CreateInput / UpdateInput では、外部キー(userId)を直接書くのではなく、
      //    リレーションのフィールド(user)に connect を書いて紐づけるのがPrismaの書き方。
      //    userId: userId, ← 型エラーになる
      //    userIdは外部キーであるが、Prisma.CityCreateInputは型安全のため
      //    直接userIdをセットできない型となっている。(userIdが無い)
      //    非チェック版のUncheckedCreateInputという型がありこちらは外部キーであるuserIdを
      //    保持しているためuserIdをセット可能であるが、非推奨。
      //    → 通常は CityCreateInput + connect を使う。
      //      connect は、Prismaで既存のレコードをリレーション（関連付け）するための特別な操作。
      //      なぜ connect が必要なのか？
      //      CityCreateInput では user というリレーション項目がありますが、userId は
      //      直接書けません（CityCreateInput には userId がありません）。
      //      その代わりに、既存のUserを「接続（connect）」 する形で指定します。
      user: { connect: { id: userId } },
      // 都道府県は任意項目のため、設定されている場合だけprefectureキーを追加する
      // ・prefectureIdがある → { prefecture: { connect: { id } } } が展開されて追加される
      //                       (connectで既存の都道府県に紐づける。意味は上のuserと同じ)
      // ・prefectureIdがない → undefined を展開することになり、何も追加されない
      // 新規作成なので、紐づけが無いときは「何も指定しない」でよい(disconnectは不要)
      ...(snapshot.prefectureId && {
        prefecture: { connect: { id: snapshot.prefectureId } },
      }),
      // satisfies: 戻り値の型を広げずに、Prisma.CityCreateInputの形を満たしているかをコンパイル時にチェックする
      // (項目名のタイプミスや、必須項目の漏れがあればエラーになる)
    } satisfies Prisma.CityCreateInput;
  }

  /**
   * domain → Prisma更新用入力
   * domainの状態をそのままDBに反映するため、都道府県が未設定(undefined)の場合はdisconnectする
   * idは更新対象外(where句で使う識別子)、createdAtは作成時から変わらないため含めない
   */
  static toPrismaUpdate(domain: City, userId: string): Prisma.CityUpdateInput {
    // toPrismaCreate()と同じく、domainの状態をCityStateの形で取り出す
    const snapshot = domain.toSnapshot();

    return {
      // id・createdAt は含めない(更新しない項目)
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      slug: snapshot.slug,
      status: snapshot.status,
      sortOrder: snapshot.sortOrder,
      // domainのupdate() / publish() などで更新した時刻
      updatedAt: snapshot.updatedAt,
      // 更新者として、操作ユーザーに紐づけ直す(connectの意味はtoPrismaCreate()のコメントを参照)
      user: { connect: { id: userId } },
      // 都道府県はcreateと違い、未設定のときに明示的にdisconnectする
      // ・connect           → 指定した都道府県に紐づける(別の都道府県に紐づいていた場合は付け替わる)
      // ・disconnect: true  → 今の紐づけを外す(City.prefectureId(外部キー)をnullにする)
      //                       ※ prefectureは任意のリレーション(Prefecture?)なので外せる。必須のリレーションには使えない
      // DBに既存の紐づけが残っている場合でも、domainの状態(未設定)に合わせて外すため
      prefecture: snapshot.prefectureId
        ? { connect: { id: snapshot.prefectureId } }
        : { disconnect: true },
    } satisfies Prisma.CityUpdateInput;
  }

  /**
   * Prismaレコード → domain
   * DBのnullはdomainではundefinedとして扱う
   * idもreconstituteで復元する(domain自身がidを持つため)
   */
  static toDomain(record: PrismaCity): City {
    // DBから取得した値でdomainを復元する
    // createNew()ではなくreconstitute()を使う(idの採番やstatusの初期化をせず、DBの値をそのまま使うため)
    return City.reconstitute({
      id: record.id,
      code: record.code,
      name: record.name,
      kanaName: record.kanaName,
      slug: record.slug,
      // Prismaのenum(CityStatus)とdomainのCityStatus(modern enum)は値が同じ文字列なので、そのまま渡せる
      status: record.status,
      sortOrder: record.sortOrder,
      // DBの未設定はnull、domainの未設定はundefinedで表すため、?? で変換する
      prefectureId: record.prefectureId ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      // satisfies: reconstituteに渡す全項目(ReconstituteCityProps)が揃っているかをコンパイル時にチェックする
    } satisfies ReconstituteCityProps);
  }
}

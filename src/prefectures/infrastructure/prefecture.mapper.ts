import { Prisma, Prefecture as PrismaPrefecture } from 'generated/prisma';
import {
  Prefecture,
  ReconstitutePrefectureProps,
} from '../domain/prefectures.model';

/**
 * Prefecture Mapper
 * Prisma(Infrastructure層)のレコード/入力型と、Prefecture domain の相互変換を担う。
 * 層の境界での変換をここに集約し、Domain層がPrismaの型に依存しないようにする。
 */
export class PrefectureMapper {
  /**
   * domain → Prisma作成用入力
   * 地方(regionId)が設定されている場合のみ、Regionとのリレーションをconnectする
   */
  static toPrismaCreate(
    domain: Prefecture,
    userId: string,
  ): Prisma.PrefectureCreateInput {
    const snapshot = domain.toSnapshot();

    return {
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      kanaEn: snapshot.kanaEn,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      user: { connect: { id: userId } },
      ...(snapshot.regionId && {
        region: { connect: { id: snapshot.regionId } },
      }),
    } satisfies Prisma.PrefectureCreateInput;
  }

  /**
   * domain → Prisma更新用入力
   * domainの状態をそのままDBに反映するため、地方が未設定(undefined)の場合はdisconnectする
   */
  static toPrismaUpdate(
    domain: Prefecture,
    userId: string,
  ): Prisma.PrefectureUpdateInput {
    const snapshot = domain.toSnapshot();

    return {
      code: snapshot.code,
      name: snapshot.name,
      kanaName: snapshot.kanaName,
      kanaEn: snapshot.kanaEn,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      user: { connect: { id: userId } },
      region: snapshot.regionId
        ? { connect: { id: snapshot.regionId } }
        : { disconnect: true },
    } satisfies Prisma.PrefectureUpdateInput;
  }

  /**
   * Prismaレコード → domain(ID付き)
   * DBのnullはdomainではundefinedとして扱う
   */
  static toDomain(record: PrismaPrefecture): Prefecture & { id: string } {
    const domain = Prefecture.reconstitute({
      code: record.code,
      name: record.name,
      kanaName: record.kanaName,
      kanaEn: record.kanaEn,
      status: record.status,
      regionId: record.regionId ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies ReconstitutePrefectureProps);

    return Object.assign(domain, { id: record.id });
  }
}

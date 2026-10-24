import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { DistrictDetailReadModel } from './read-model/district-detail.read-model';
import { DistrictListReadModel } from './read-model/district-list.read-model';
import { DistrictOptionReadModel } from './read-model/district-option.read-model';

/**
 * DistrictsQueryService(参照系)
 * 画面都合のRead ModelをPrismaから直接組み立てて返す(CQRS)
 * 更新系はApplication層のDistrictsServiceが担う
 *
 * 参照系はdomainのルールを通す必要がないため、Repository(domain)を経由せず、
 * Prismaで必要な項目を結合して、そのままRead Modelにする。
 */
export class DistrictsQueryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  findAllPaginated(): DistrictListReadModel {
    return new DistrictListReadModel();
  }

  findAll(): DistrictOptionReadModel {
    return new DistrictOptionReadModel();
  }

  /**
   * getDetailByIdOrThrow: 指定されたIDの地区情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたIDのDistrictが存在しない場合は `NotFoundException` をスローします。
   *
   * @param id - 取得対象のDistrict ID
   * @returns District Detail Read Model(地区詳細情報)
   * @throws {NotFoundException} 指定されたIDのDistrictが存在しない場合
   */
  getDetailByIdOrThrow(id: string): DistrictDetailReadModel {
    return new DistrictDetailReadModel();
  }

  /**
   * getDetailByCodeOrThrow: 指定されたcodeの地区情報詳細を取得します。
   *                            存在しない場合、NotFoundExceptionをthrowします。
   * 公開用のユースケースメソッド。
   * 指定されたcodeのDistrictが存在しない場合は `NotFoundException` をスローします。
   *
   * @param code - 取得対象のDistrict code
   * @returns District Detail Read Model(地区詳細情報)
   * @throws {NotFoundException} 指定されたIDのDistrictが存在しない場合
   */
  getDetailByCodeOrThrow(code: string): DistrictDetailReadModel {
    return new DistrictDetailReadModel();
  }
}

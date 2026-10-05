import { Query, Resolver } from '@nestjs/graphql';
import { RegionsQueryService } from '../../../regions/query/regions.query.service';
import {
  RegionObjectType,
  RegionQueryReturnType,
} from './object-types/region.object-type';

@Resolver()
export class RegionsResolver {
  constructor(private readonly queryService: RegionsQueryService) {}

  /**
   * regionsPaginated: エリア情報一覧(ページネーションあり)を取得するGraphQL Query
   *
   * ※戻り値のstatusLabelはこのメソッドでは設定していない。
   *   @ResolveField()側で別途解決されるため、ここではRegionQueryReturnType
   *   (Omit<RegionObjectType, 'statusLabel'>)を返す。
   *
   * memo: regionsPaginatedの件数(count)は返さない
   *       配列がそのまま「全部」を表しているので、data.regionsPaginated.lengthをクライアント側で
   *       計算すれば、それが即ち総件数。わざわざサーバー側で別途countフィールドを用意しても
   *       同じ情報を二重に持つだけで意味がない。これが主流。
   *       もし将来「件数だけを軽く知りたい(全データを転送せずに)」というニーズが出てきた場合、
   *       それはregionsPaginatedに手を加えるのではなく、regionsCount: Intのような別の専用クエリを
   *       用意するのが一般的です(配列全部を取得するコストをかけずに、件数だけ欲しい場合の最適化)。
   *
   * @returns エリア情報一覧(statusLabelを除いたRegionObjectType[])
   */
  @Query(() => [RegionObjectType], {
    description: 'エリア情報一覧を取得',
    // nullableに'items'を付与すると、空配列を許容 = [RegionObjectType]!
    // nullable: 'items',
  })
  async regionsPaginated(): Promise<RegionQueryReturnType[]> {
    // エリア情報[] 取得 (ページネーション化されたRegion情報)
    const paginated = await this.queryService.findAllPaginated({});

    // ReadModel[] → ObjectType[]
    const objectType = paginated.data.map(
      (readModel) =>
        ({
          id: readModel.id,
          code: readModel.code,
          name: readModel.name,
          kanaName: readModel.kanaName,
          kanaEn: readModel.kanaEn,
          status: readModel.status,
          prefectureCount: readModel.prefectureCount,
          // statusLabelは@ResolverFieldなので除外
        }) satisfies Omit<RegionObjectType, 'statusLabel'>,
    );

    return objectType;
  }
}

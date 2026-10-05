import { CreateRegionProps, Region } from './regions.model';

/**
 * RegionドメインのFactory
 *
 * // dto → domain （DDDの依存方向を考慮しdto → domainを以下に修正
 * props → domain
 */
export class RegionFactory {
  static from(props: CreateRegionProps) {
    // Region作成
    return Region.createNew({
      code: props.code,
      name: props.name,
      kanaName: props.kanaName,
      // status: props.status,
      kanaEn: props.kanaEn,
    } satisfies CreateRegionProps);
  }
}

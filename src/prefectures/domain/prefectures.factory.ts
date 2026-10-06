import { CreatePrefectureProps, Prefecture } from './prefectures.model';

/**
 * Prefecture domain の生成を担うFactory
 */
export class PrefectureFactory {
  static from(props: CreatePrefectureProps): Prefecture {
    return Prefecture.createNew({
      code: props.code,
      name: props.name,
      kanaName: props.kanaName,
      kanaEn: props.kanaEn,
      regionId: props.regionId,
    } satisfies CreatePrefectureProps);
  }
}

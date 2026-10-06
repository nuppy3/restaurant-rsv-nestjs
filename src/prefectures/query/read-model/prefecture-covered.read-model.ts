import { PrefectureListReadModel } from './prefecture-list.read-model';

/**
 * 公開中の店舗がある都道府県一覧(GET /prefectures/covered)用のRead Model
 * 一覧の項目に公開中(published)の店舗数を加えたもの
 */
export type PrefectureCoveredReadModel = PrefectureListReadModel & {
  storeCount: number;
};

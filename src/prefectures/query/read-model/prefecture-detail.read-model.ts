import { PrefectureListReadModel } from './prefecture-list.read-model';

/**
 * 都道府県詳細(GET /prefectures/:id, GET /prefectures/code/:code)用のRead Model
 * 一覧の項目に作成日時・更新日時を加えたもの
 */
export type PrefectureDetailReadModel = PrefectureListReadModel & {
  createdAt: Date;
  updatedAt: Date;
};

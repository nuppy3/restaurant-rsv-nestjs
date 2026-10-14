/**
 * 【更新用】Application層の入力(Command)
 * 基本情報のみ更新対象(すべて任意項目。未指定(undefined)の項目は更新しない)
 * statusは publish / unpublish / remove の専用ユースケースで変更するため含めない
 *
 * 都道府県は外部(API)から都道府県コード(prefectureCode)で指定され、Application ServiceでprefectureIdに解決する
 */
export type UpdateCityCommand = {
  code?: string;
  name?: string;
  kanaName?: string;
  slug?: string;
  sortOrder?: number;
  prefectureCode?: string;
};

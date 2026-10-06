/**
 * 【更新用】Application層の入力(Command)
 * 基本情報のみ更新対象(任意項目)。statusは publish / unpublish / remove の専用ユースケースで変更する
 *
 * 地方は外部(API)から地方コード(regionCode)で指定され、Application ServiceでregionIdに解決する
 */
export type UpdatePrefectureCommand = {
  code?: string;
  name?: string;
  kanaName?: string;
  kanaEn?: string;
  regionCode?: string;
};

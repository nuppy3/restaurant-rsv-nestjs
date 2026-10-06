/**
 * 都道府県一覧取得(findAllPaginated)の検索条件
 * 現状はページネーションのみ(並び順はcode昇順固定)
 */
export type PrefectureFilter = {
  page?: number;
  size?: number;
};

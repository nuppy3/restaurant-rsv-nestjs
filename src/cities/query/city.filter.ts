/**
 * 都市一覧取得(CitiesQueryService.findAllPaginated)の検索条件
 * 現状はページネーションのみ(並び順は sortOrder 昇順 → code 昇順で固定)
 *
 * @example
 * ```ts
 * // 2ページ目を10件ずつ取得
 * await this.citiesQueryService.findAllPaginated({ page: 2, size: 10 });
 *
 * // 条件なし(1ページ目、件数は既定値)
 * await this.citiesQueryService.findAllPaginated();
 * ```
 */
export type CityFilter = {
  // ページ番号(1始まり)。未指定ならデフォルト値
  page?: number;
  // 1ページあたりの件数。未指定ならデフォルト値
  size?: number;
};

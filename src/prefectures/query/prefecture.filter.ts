/**
 * 都道府県一覧取得(findAllPaginated)の検索条件
 * 現状はページネーションのみ(並び順はcode昇順固定)
 *
 * エリア一覧取得（findAll service)で使用するフィルタ条件
 *
 * @example
 * ```ts
 * // ステータスが編集中のエリアのみ取得
 * await this.regionsQueryService.findAll({ status: 'editing' });
 *
 * // 全エリア取得（フィルタなし）
 * await this.regionsQueryService.findAll();
 * ```
 */
export type PrefectureFilter = {
  page?: number;
  size?: number;
};

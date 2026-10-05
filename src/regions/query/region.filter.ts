import { RegionStatus } from '../domain/regions.model';

/**
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
export type RegionFilter = {
  // エリアコード
  // 本来、codeでフィルタは不要（findByCode()を使うべき）
  code?: string;

  // エリア名
  name?: string;

  // ステータス
  status?: RegionStatus;

  // ページ(ページネーション)
  page?: number;

  // 1ページあたりの件数
  size?: number;

  // ソートフィールド
  sortBy?: SortBy;

  // ソートオーダー
  sortOrder?: SortOrder;
};

// ソートフィールド
export const SortBy = {
  CODE: 'code',
  NAME: 'name',
} as const;
// SortOrder（モダンenum=union）の型定義
export type SortBy = (typeof SortBy)[keyof typeof SortBy];

// ソートオーダー(昇順/降順)
export const SortOrder = {
  ASC: 'asc', // 昇順
  DESC: 'desc', // 降順
} as const;
// SortOrder（モダンenum=union）の型定義
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

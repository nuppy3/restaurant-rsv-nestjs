import { DistrictStatus } from '../domain/districts.model';

export type DistrictFilter = {
  // エリア名
  name?: string;

  // ステータス
  status?: DistrictStatus;

  // 都市コード
  cityCode?: string;

  // ページ(ページネーション)
  page?: number;

  // 1ページあたりの件数
  size?: number;
};

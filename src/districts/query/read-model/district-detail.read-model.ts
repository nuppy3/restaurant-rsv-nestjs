import { DistrictStatus } from '../../../districts/domain/districts.model';

export type DistrictDetailReadModel = {
  id: string;
  code: string;
  name: string;
  kanaName: string;
  // URL用の識別子(例: ginza/ebisu/roppongi/shibuya)。半角英小文字・数字・ハイフンのみ
  slug: string;
  status: DistrictStatus;
  sortOrder: number;
  // 必須
  cityId: string;
  // 都市の名前(例: 東京)。Cityテーブルをincludeして取得する
  cityName: string;
  createdAt: Date;
  updatedAt: Date;
};

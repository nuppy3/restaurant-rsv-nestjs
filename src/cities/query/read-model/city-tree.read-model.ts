import { CityStatus } from '../../../cities/domain/cities.model';

/**
 * 都市Tree(GET /cities/tree)用のRead Model
 *
 * Read Modelは参照(Query)専用のデータの形。domain(City)とは別物で、画面やAPIが必要とする形に整える。
 * ここでは画面表示用に、「都市 → 地区」の木構造を返す。
 * 地区が未設定の都市は、districtsは undefined(レスポンスでは項目ごと省略される。
 */
export type CityTreeReadModel = {
  id: string;
  code: string;
  name: string;
  kanaName: string;
  slug: string;
  status: CityStatus;
  sortOrder: number;
  prefectureId?: string;
  // 地区(例: 銀座、恵比寿...)リスト。districtテーブルをincludeして取得する
  districts?: {
    id: string;
    code: string;
    name: string;
    slug: string;
    sortOrder: number;
  }[];
};

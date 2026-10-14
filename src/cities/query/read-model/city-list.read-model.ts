import { CityStatus } from '../../domain/cities.model';

/**
 * 都市一覧(GET /cities)用のRead Model
 *
 * Read Modelは参照(Query)専用のデータの形。domain(City)とは別物で、画面やAPIが必要とする形に整える。
 * ここでは画面表示用に、都市が所属する都道府県の名前(prefectureName)を含める。
 * 都道府県が未設定の都市は、prefectureId / prefectureName ともに undefined(レスポンスでは項目ごと省略される)
 *
 * 🗒 CityState(domainの状態)から Pick などで派生させず、明示的に定義している(CQRS)
 *    ・Read Modelは「画面・APIが欲しい形」、CityStateは「domainの状態」で目的が違う
 *      (domainに無い prefectureName を持ち、一覧では createdAt / updatedAt を返さない)
 *    ・domainの項目を追加・変更しても、APIのレスポンスの形が勝手に変わらないようにするため
 *    status の型(CityStatus)だけは、書き込み側と同じ値でないと困る業務の言葉なのでdomainから参照する
 */
export type CityListReadModel = {
  id: string;
  code: string;
  name: string;
  kanaName: string;
  slug: string;
  status: CityStatus;
  sortOrder: number;
  prefectureId?: string;
  // 都道府県の名前(例: 東京都)。Prefectureテーブルをincludeして取得する
  prefectureName?: string;
};

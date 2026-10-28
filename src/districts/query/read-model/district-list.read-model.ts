import { DistrictStatus } from '../../../districts/domain/districts.model';

/**
 * 一覧画面専用のRead Model
 * 画面/APIに都合よく整形された、読み取り専用のModel
 *
 * 用途：Query ServiceにてDBからのデータを当Modelに詰め替えてControllerへ返却する。
 * メモ：Domainとたまたま同等のプロパティだったとしても(将来変わる可能性もあるし）、
 * Domainルールは流出させたくないので、Read Modelに詰め替えるのがBPとされる。
 */
export type DistrictListReadModel = {
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
  // 都市の名前(例: 東京)。Cityテーブルをincludeして取得する(cityId は必須なので、都市名も必ずある)
  cityName: string;
  // createdAt: Date;
  // updatedAt: Date;
};

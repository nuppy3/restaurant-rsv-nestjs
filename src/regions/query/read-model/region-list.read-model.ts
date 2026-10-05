import { RegionStatus } from '../../domain/regions.model';

/**
 * 一覧画面専用のRead Model
 * 画面/APIに都合よく整形された、読み取り専用のModel
 *
 * 用途：Query ServiceにてDBからのデータを当Modelに詰め替えてControllerへ返却する。
 * メモ：Domainとたまたま同等のプロパティだったとしても(将来変わる可能性もあるし）、Domainルールは
 *.     流出させたくないので、Read Modelに詰め替えるのがBPとされる。
 */
export type RegionListReadModel = {
  id: string;
  code: string;
  name: string;
  kanaName: string;
  kanaEn: string;
  status: RegionStatus;
  // createdAt: Date;
  // updatedAt: Date;
  prefectureCount?: number;
};

import { StoreStatus } from 'generated/prisma';
import { Prefecture } from '../../prefectures/prefectures.model';
import { Weekday } from '../stores.model';

/**
 * 店舗情報参照専用モデル(Query(読み取り)専用に設計されたモデル)
 *
 * 揮発性の高い、UI/APIなどの要件変更の際、都度修正します。
 * 画面やAPIが必要とする形に自由に整形して返却します。（他集約の情報を結合してもよい）
 * CQRSを意識し、データを画面や外部に返すためだけに最適化された、書き込み用のドメインモデルとは
 * 別物の型/構造です。
 */
export type StoreReadModel = {
  id: string;
  code?: string;
  name: string;
  kanaName?: string;
  status: StoreStatus;
  zipCode?: string;
  email: string;
  address?: string;
  phoneNumber: string;
  businessHours?: string;
  holidays?: Weekday[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  // prefecture?: {
  //   code: string;
  //   name: string;
  //   kanaName: string;
  //   kanaEn: string;
  //   status: PrefectureStatus;
  // };
  prefecture?: Prefecture;
};

/**
 * 都道府県情報 （Domainモデル)
 */
export interface Prefecture {
  // id(uuid)は「技術的識別子」であり、ビジネスルールには関係がない。
  // Storeドメイン(entity)にはid(uuid)を持たせない！id(uuid)はDB、infra管轄：idに依存しない純粋なドメイン
  //「作成時は id なし、取得時(レスポンス)は id あり（別型）」＝ 完全に正しい設計むしろこれが「本物のドメイン駆動設計」
  // が、実務的に、idを持たせてもいいっぽいが、厳密にidを除外してみる。
  // id: string;
  name: string;
  code: string;
  kanaName: string;
  status: PrefectureStatus;
  kanaEn: string;
  createdAt: Date;
  updatedAt: Date;
  // region（VO：Value Obect 値オブジェクト）ではなく、regionIdとしてID参照に留めるのがBP
  // 都道府県が所属するエリアはあくまでラベルであり、Prefectureドメイン(マスター）が責任を持つというより
  // 地理マスターが責任を持つべき。という考え方。
  regionId?: string;
}

/**
 * 都道府県情報 （Domain専用モデル(Domain層のモデル))
 *
 * Prisma(DB)から取得したDBデータ→domain→controllerする際に、domainで抱えきれないDBデータを
 * 取得するような要件が発生した場合（CA/DDDを意識するとdomainをシンプルに設計する必要がある）、
 * Domain専用モデルというDomain Entity（例: Prefecture）だけでは表現しきれないが、
 * ドメインのビジネスロジックやユースケースに必要な情報をまとめたモデルを使用することがある。
 *
 * 当該Domain専用モデルではPrefectureドメインに加え、storeCountを保持している。
 */
export interface PrefectureWithCoverage {
  readonly prefecture: Prefecture & { regionName?: string };
  readonly id: string;
  readonly storeCount: number; //
}

// modern enumパターン（union)
export const PrefectureStatus = {
  PUBLISHED: 'published', // 掲載中
  EDITING: 'editing', // 編集中
  SUSPENDED: 'suspended', // 停止中
} as const;
// PrefectureStatus（モダンenum=union）の型を定義()
// 上記の 「const PrefectureStatus」はあくまでconstオブジェクト(値)であり、PageStatusという型ではないので
// type PageStatusとして型を定義している。
export type PrefectureStatus =
  (typeof PrefectureStatus)[keyof typeof PrefectureStatus];

export interface PrefectureFilter {
  // 1ページあたりの件数
  size?: number;

  // ページ（ページネーション）
  page?: number;
}

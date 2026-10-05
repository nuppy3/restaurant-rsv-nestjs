import { RegionState } from '../../../regions/domain/regions.model';

/**
 * 【新規作成用】
 * Region domain作成時に必要なプロパティを型として定義
 * 外部から入力される項目のみ（statusや日付は内部で生成するため除外）
 *
 * memo:現状、regions.model.ts(domain)のCreateRegionPropsと全く同じ型定義となっている。
 * これは、どちらもdomain作成用のEntityの型なので、DomainのStateをベースに作成しているので
 * 自然な現象。「レイヤー境界の翻訳コスト」として想定内の現象。
 *
 * ⭐️依存方向的には Application → Domain の依存は許されるので、当該Comanndは作成せずにDomain
 * のCreateRegionPropsを使ってもいいが、厳密なDDDを体感するために当該typeを定義している。
 * 注意：RegionStateをベースに型を定義しているが、RegionStateにpublishedAtやdeleteAtなど
 *      が追加されたら影響が出てしまうので、少し冗長的だがプロパティはOmitするより明示的に記述する
 *      方が安全といえる。
 */
export type CreateRegionCommand = Omit<
  RegionState,
  'status' | 'createdAt' | 'updatedAt'
>;

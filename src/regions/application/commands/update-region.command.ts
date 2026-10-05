import { RegionState } from '../../../regions/domain/regions.model';

/**
 * 【更新用】
 * Region domain更新時に必要なプロパティを型として定義
 * 日付以外は更新対象
 *
 * 型はRegionStateをベースとした任意項目：
 *  ・Partial<Omit<RegionState, '' | '' | ''>>
 *
 * memo:現状、regions.model.ts(domain)のUpdateRegionPropsと全く同じ型定義となっている。
 * これは、どちらもdomain作成用のEntityの型なので、DomainのStateをベースに作成しているので
 * 自然な現象。「レイヤー境界の翻訳コスト」として想定内の現象。
 *
 * ⭐️依存方向的には Application → Domain の依存は許されるので、当該Comanndは作成せずにDomain
 * のUpdateRegionPropsを使ってもいいが、厳密なDDDを体感するために当該typeを定義している。
 */
export type UpdateRegionCommand = Partial<
  Omit<RegionState, 'updatedAt' | 'createdAt'>
>;

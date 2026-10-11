import { Prefecture } from './prefectures.model';

/**
 * Repository Port(依存性逆転のためのinterface)のDIトークン
 * interfaceは実行時に消えるため、Symbolで注入先を識別する
 */
export const PREFECTURE_REPOSITORY_PORT = Symbol('PREFECTURE_REPOSITORY_PORT');

/**
 * Prefecture Repository Port
 * Domain層が定義し、Infrastructure層(Prisma)が実装する
 *
 * Prefecture domain 自身がidを持つため、交差型(Prefecture & { id: string })は使わない
 */
export interface PrefectureRepositoryPort {
  findByIdOrFail(id: string): Promise<Prefecture>;

  findByCodeOrFail(code: string): Promise<Prefecture>;

  /**
   * 都道府県を永続化する(新規作成・更新のどちらもこのメソッド)
   * idはdomainで採番済みのため、DBに同じidが無ければ作成、あれば更新する
   */
  save(prefecture: Prefecture, userId: string): Promise<Prefecture>;
}

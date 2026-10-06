import { Prefecture } from './prefectures.model';

/**
 * Repository Port(依存性逆転のためのinterface)のDIトークン
 * interfaceは実行時に消えるため、Symbolで注入先を識別する
 */
export const PREFECTURE_REPOSITORY_PORT = Symbol('PREFECTURE_REPOSITORY_PORT');

/**
 * Prefecture Repository Port
 * Domain層が定義し、Infrastructure層(Prisma)が実装する
 */
export interface PrefectureRepositoryPort {
  findByIdOrFail(id: string): Promise<Prefecture & { id: string }>;

  findByCodeOrFail(code: string): Promise<Prefecture & { id: string }>;

  save(
    domainWithId: Prefecture & { id: string },
    userId: string,
  ): Promise<Prefecture & { id: string }>;
}

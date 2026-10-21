import { District } from './districts.model';

/**
 * Repository Port(依存性逆転のためのinterface)のDIトークン
 * interfaceは実行時に消えるため、Symbolで注入先を識別する
 */
export const DISTRICT_REPOSITORY_PORT = Symbol('DISTRICT_REPOSITORY_PORT');

/**
 * District Repository Port(依存性逆転のためのinterface)
 * Domain層が定義し、Infrastructure層(Prisma)が実装する
 */
export interface DistrictRepositoryPort {
  /**
   * idに紐づく情報を取得します。
   * 存在しない場合はNotFoundException
   *
   * @param id District ID
   */
  findByIdOrFail(id: string): Promise<District>;

  /**
   * codeに紐づく地区情報を取得します。
   *
   * @param code District Code
   */
  findByCodeOrFail(code: string): Promise<District>;

  /**
   * District domain 情報の永続化します。(新規作成・更新のどちらもこのメソッド)
   * idはdomainで採番済みのため、DBに同じidが無ければ作成、あれば更新する
   *
   * @param district
   * @param userId
   */
  save(district: District, userId: string): Promise<District>;
}

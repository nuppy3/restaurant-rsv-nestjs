import { City } from './cities.model';

/**
 * Repository Port(依存性逆転のためのinterface)のDIトークン
 * interfaceは実行時に消えるため、Symbolで注入先を識別する
 */
export const CITY_REPOSITORY_PORT = Symbol('CITY_REPOSITORY_PORT');

/**
 * City Repository Port(依存性逆転のためのinterface)
 * Domain層が定義し、Infrastructure層(Prisma)が実装する
 */
export interface CityRepositoryPort {
  /**
   * idに紐づく都市情報を取得します。
   * 存在しない場合はNotFoundException
   *
   * @param id City ID
   */
  findByIdOrFail(id: string): Promise<City>;

  /**
   * codeに紐づく都市情報を取得します。
   *
   * @param code City Code
   */
  findByCodeOrFail(code: string): Promise<City>;

  /**
   * City domain 情報の永続化します。(新規作成・更新のどちらもこのメソッド)
   * idはdomainで採番済みのため、DBに同じidが無ければ作成、あれば更新する
   *
   * @param city
   * @param userId
   */
  save(city: City, userId: string): Promise<City>;
}

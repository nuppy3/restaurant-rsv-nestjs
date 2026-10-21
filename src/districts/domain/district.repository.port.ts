import { District } from './districts.model';

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
   * @param District
   * @param userId
   */
  save(district: District, userId: string): Promise<District>;
}

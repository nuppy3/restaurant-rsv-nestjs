import { Region } from './regions.model';

// prefecture-repository.port.ts
export const REGION_REPOSITORY_PORT = Symbol('REGION_REPOSITORY_PORT');

/**
 * Regionドメインを操作・永続化するためのPort
 */
export interface RegionRepositoryPort {
  /**
   * findByIdOrFail(): id(Region ID)に関連するRegion情報を取得し、Region domainに
   *             詰め替えて返却します。(Region + id)
   *
   * 現在のDomainの状態を正しく取得する意味で、Repositoryに配置。
   * findAllなどは、Repositoryではなく、Query Serviceに配置するのが望ましい。
   *
   * @param id Region ID (PK)
   * @returns Region Domain(Region + id)
   */
  findByIdOrFail(id: string): Promise<Region & { id: string }>;

  /**
   * findByIdOrFail(): code(Region code)に関連するRegion情報を取得し、Region domainに
   *             詰め替えて返却します。(Region + id)
   *
   * 現在のDomainの状態を正しく取得する意味で、Repositoryに配置。
   * findAllなどは、Repositoryではなく、Query Serviceに配置するのが望ましい。
   *
   * @param code Region Code
   * @returns Region Domain(Region + id)
   */
  findByCodeOrFail(code: string): Promise<Region & { id: string }>;

  /**
   * save: DB更新（永続化)
   *       新規作成・更新の両方、または保存	Command（状態の変更）
   *       「DBの操作（Insert/Update）」を隠蔽し、「ドメインの状態を保存する場所」 という
   *       抽象的な役割に徹するべきだからです。
   *
   * 「新規作成か更新か」を Application Service 側で判断させないために、Prismaの upsert
   * を使うのがスマートです。
   * これにより、Service側は「状態が変わったから保存して」と save() を呼ぶだけで良くなり、
   * DBの都合（INSERTかUPDATEか）を気にする必要がなくなります。
   *
   * CQRSの Command 側では、Repository は「保存の成功」だけを保証すればよいため、
   * 基本的には値を返さない（void）か、保存した Entity 自体を返します。
   * →今回はEntity自体(domain)を返すようにしている。
   *
   * エリア情報を更新し(DB更新)、結果をdomainに詰め替えて返却します。(Region + id)
   *
   * @param domainWithId Entity (保存対象domain)
   * @param userId ユーザーID
   * @returns 更新後のエリア情報(保存したEntity(domain))
   */
  save(
    domainWithId: Region & { id: string },
    userId: string,
  ): Promise<Region & { id: string }>;
}

import { Inject, Injectable } from '@nestjs/common';
import { RegionsQueryService } from '../../regions/query/regions.query.service';
import type { PrefectureRepositoryPort } from '../domain/prefecture.repository.port';
import { PREFECTURE_REPOSITORY_PORT } from '../domain/prefecture.repository.port';
import { PrefecturesDomainService } from '../domain/prefectures.domain.service';
import { PrefectureFactory } from '../domain/prefectures.factory';
import { Prefecture, UpdatePrefectureProps } from '../domain/prefectures.model';
import { CreatePrefectureCommand } from './commands/create-prefecture.command';
import { UpdatePrefectureCommand } from './commands/update-prefecture.command';

/**
 * Prefecture Application Service(更新系ユースケース)
 * 参照系はPrefecturesQueryServiceが担う(CQRS)
 */
@Injectable()
export class PrefecturesService {
  constructor(
    private readonly prefecturesDomainService: PrefecturesDomainService,
    private readonly regionsQueryService: RegionsQueryService,
    @Inject(PREFECTURE_REPOSITORY_PORT)
    private readonly prefectureRepository: PrefectureRepositoryPort,
  ) {}

  /**
   * 都道府県を新規作成する(status: 編集中)
   *
   * @param command 都道府県の作成内容(地方はコードで指定し、ここでIDに解決する)
   * @param userId 操作ユーザーのID(作成者として保存する)
   * @returns 作成した都道府県のdomain(DBで採番されたidを含む)
   * @throws NotFoundException regionCodeに該当する地方が存在しない場合
   */
  async create(
    command: CreatePrefectureCommand,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // 地方コード → 地方ID に解決
    const regionId = await this.resolveRegionId(command.regionCode);

    // domain生成（command → domain)
    const domain = PrefectureFactory.from({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      kanaEn: command.kanaEn,
      regionId,
    });

    // idが空のdomainをsaveすると新規作成になる
    // TODO: 暫定ロジック: save()の引数が Region & {id:string} なので暫定で''をセット
    const domainWithId = Object.assign(domain, { id: '' });
    return this.prefectureRepository.save(domainWithId, userId);
  }

  /**
   * 都道府県の基本情報を更新する(掲載中は更新不可)
   *
   * @param id 更新対象の都道府県ID
   * @param command 更新内容(未指定(undefined)の項目は更新しない)
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 更新後の都道府県のdomain(id付き)
   * @throws NotFoundException 都道府県、またはregionCodeに該当する地方が存在しない場合
   */
  async update(
    id: string,
    command: UpdatePrefectureCommand,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // Prefecture取得(DB) → domain (reconstitute)
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);
    // 地方コード → 地方ID に解決
    const regionId = await this.resolveRegionId(command.regionCode);

    // command → Domain更新対象のプロパティ
    // domain更新(dtoの項目で更新): ドメインルール（例：特定のステータスなら名前は変えられない等）をチェック
    prefectureWithId.update({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      kanaEn: command.kanaEn,
      regionId,
    } satisfies UpdatePrefectureProps);

    // 永続化（DB更新) → domain(toDomain)
    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県を掲載中にする(地方が未設定の場合はdomainが例外をスロー)
   *
   * 指定のidに関連する都道府県情報を掲載中にします。
   * 都道府県情報のステータスをpublishに更新し、更新した都道府県情報を返却します。
   *
   * @param id 掲載対象の都道府県ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 掲載中(published)になった都道府県のdomain(id付き)
   */
  async publish(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // 都道府県情報取得
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    // domain 更新（ドメインルール実行）
    prefectureWithId.publish();

    // 永続化: ステータス更新 → prisma → domain
    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県の掲載を取り下げ、編集中に戻す
   *
   * 指定のidに関連する都道府県情報を編集中に戻します。
   * 都道府県情報のステータスをeditingに更新し、更新した都道府県情報を返却します。
   *
   * @param id 掲載を取り下げる都道府県ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 編集中(editing)に戻った都道府県のdomain(id付き)
   */
  async unpublish(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // 都道府県情報取得
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    // domain 更新（ドメインルール実行）
    prefectureWithId.unpublish();

    // 永続化: ステータス更新 → prisma → domain
    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県を論理削除(利用停止)する
   * 店舗が紐づいている場合は削除不可(DomainServiceで判定)
   *
   * 指定のidに関連する都道府県情報を削除します。
   * 削除した都道府県情報を返却します。
   *
   * @param id 削除対象の都道府県ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 停止中(suspended)になった都道府県のdomain(id付き)
   */
  async remove(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    // 都道府県情報取得
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    // 削除可能か判定：他のドメインに依存する判定など
    await this.prefecturesDomainService.assertDeletable(id);

    // domain 削除（ドメインルール実行：domain内部ロジックのみ）
    prefectureWithId.remove();

    // 永続化: Region情報削除(ソフトデリート) → prisma → domain
    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 地方コード → 地方ID に解決する。未指定(undefined)の場合はundefinedを返す
   *
   * @param regionCode 地方コード(例: '03' = 関東)。未指定の場合はundefined
   * @returns 地方ID。regionCodeが未指定の場合はundefined
   * @throws NotFoundException regionCodeに該当する地方が存在しない場合
   */
  private async resolveRegionId(
    regionCode: string | undefined,
  ): Promise<string | undefined> {
    if (regionCode === undefined) {
      return undefined;
    }
    // codeをキーに地方情報を取得し、idを返却
    const region = await this.regionsQueryService.findByCodeOrFail(regionCode);
    return region.id;
  }
}

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
   * @throws NotFoundException regionCodeに該当する地方が存在しない場合
   */
  async create(
    command: CreatePrefectureCommand,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    const regionId = await this.resolveRegionId(command.regionCode);

    const domain = PrefectureFactory.from({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      kanaEn: command.kanaEn,
      regionId,
    });

    // idが空のdomainをsaveすると新規作成になる
    const domainWithId = Object.assign(domain, { id: '' });
    return this.prefectureRepository.save(domainWithId, userId);
  }

  /**
   * 都道府県の基本情報を更新する(掲載中は更新不可)
   *
   * @throws NotFoundException 都道府県、またはregionCodeに該当する地方が存在しない場合
   */
  async update(
    id: string,
    command: UpdatePrefectureCommand,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);
    const regionId = await this.resolveRegionId(command.regionCode);

    prefectureWithId.update({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      kanaEn: command.kanaEn,
      regionId,
    } satisfies UpdatePrefectureProps);

    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県を掲載中にする(地方が未設定の場合はdomainが例外をスロー)
   */
  async publish(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    prefectureWithId.publish();

    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県の掲載を取り下げ、編集中に戻す
   */
  async unpublish(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    prefectureWithId.unpublish();

    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 都道府県を論理削除(利用停止)する
   * 店舗が紐づいている場合は削除不可(DomainServiceで判定)
   */
  async remove(
    id: string,
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    const prefectureWithId = await this.prefectureRepository.findByIdOrFail(id);

    await this.prefecturesDomainService.assertDeletable(id);
    prefectureWithId.remove();

    return this.prefectureRepository.save(prefectureWithId, userId);
  }

  /**
   * 地方コード → 地方ID に解決する。未指定(undefined)の場合はundefinedを返す
   *
   * @throws NotFoundException regionCodeに該当する地方が存在しない場合
   */
  private async resolveRegionId(
    regionCode: string | undefined,
  ): Promise<string | undefined> {
    if (regionCode === undefined) {
      return undefined;
    }
    const region = await this.regionsQueryService.findByCodeOrFail(regionCode);
    return region.id;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { PrefecturesQueryService } from '../../prefectures/query/prefectures.query.service';
import { CityFactory } from '../domain/cities.factory';
import { City, UpdateCityProps } from '../domain/cities.model';
import type { CityRepositoryPort } from '../domain/city.repository.port';
import { CITY_REPOSITORY_PORT } from '../domain/city.repository.port';
import { CreateCityProps } from './../domain/cities.model';
import { CreateCityCommand } from './commands/create-city.command';
import { UpdateCityCommand } from './commands/update-city.command';

/**
 * City Application Service(更新系ユースケース)
 * 参照系はCitiesQueryServiceが担う(CQRS)
 *
 * Application Serviceの役割は「ユースケースの流れ(手順)を組み立てること」。
 * ・Repositoryからdomainを取得する / 新しく作る
 * ・外部の値(都道府県コード)をdomainが扱う形(prefectureId)に変換する
 * ・domainのメソッド(update / publish など)を呼ぶ ← ルールの判定はdomainの中で行う
 * ・Repositoryで保存する
 * ※ 他集約をまたぐルールが今は無いため、DomainServiceは使わない
 *   (「地区が紐づく都市は削除不可」は SI-770 で CitiesDomainService として追加する)
 */
@Injectable()
export class CitiesService {
  constructor(
    // 都道府県コード → 都道府県ID の解決に使う(Prefectureモジュールの参照系)
    private readonly prefecturesQueryService: PrefecturesQueryService,
    // Repositoryはinterface(Port)に依存する。実装(CityRepository)はmoduleのDIでトークンに紐づける
    @Inject(CITY_REPOSITORY_PORT)
    private readonly cityRepository: CityRepositoryPort,
  ) {}

  /**
   * 都市を新規作成する(status: 編集中)
   *
   * @param command 都市の作成内容(都道府県はコードで指定し、ここでIDに解決する)
   * @param userId 操作ユーザーのID(作成者として保存する)
   * @returns 作成した都市のdomain(idはdomainで採番済み)
   * @throws NotFoundException prefectureCodeに該当する都道府県が存在しない場合
   */
  async create(command: CreateCityCommand, userId: string): Promise<City> {
    // 都道府県コード → 都道府県ID に解決(未指定ならundefined)
    const prefectureId = await this.resolvePrefectureId(command.prefectureCode);

    // domain生成(command → domain)
    // id・status(編集中)・日付はdomain(createNew)の中で決まるため、ここでは渡さない
    const city = CityFactory.from({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      slug: command.slug,
      sortOrder: command.sortOrder,
      prefectureId,
    } satisfies CreateCityProps);

    // 永続化(DBに同じidが無いため新規作成になる) → domain(toDomain)
    return this.cityRepository.save(city, userId);
  }

  /**
   * 都市の基本情報を更新する(掲載中は更新不可)
   *
   * @param id 更新対象の都市ID
   * @param command 更新内容(未指定(undefined)の項目は更新しない)
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 更新後の都市のdomain
   * @throws NotFoundException 都市、またはprefectureCodeに該当する都道府県が存在しない場合
   * @throws CityAlreadyPublishedException 掲載中の場合(domainのルール)
   */
  async update(
    id: string,
    command: UpdateCityCommand,
    userId: string,
  ): Promise<City> {
    // City(DB) → domain(reconstitute)に再構築。存在しなければ404
    const city = await this.cityRepository.findByIdOrFail(id);

    // 都道府県コード → 都道府県ID に解決(未指定ならundefined = 都道府県は更新しない)
    const prefectureId = await this.resolvePrefectureId(command.prefectureCode);

    // command → domain更新対象のプロパティ
    // 掲載中なら更新不可、などのルールはdomainのupdate()の中で判定される
    city.update({
      code: command.code,
      name: command.name,
      kanaName: command.kanaName,
      slug: command.slug,
      sortOrder: command.sortOrder,
      prefectureId,
    } satisfies UpdateCityProps);

    // 永続化(DB更新) → domain(toDomain)
    return this.cityRepository.save(city, userId);
  }

  /**
   * 都市を掲載中にする
   *
   * @param id 掲載対象の都市ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 掲載中(published)になった都市のdomain
   * @throws NotFoundException 都市が存在しない場合
   * @throws CityAlreadyPublishedException すでに掲載中の場合(domainのルール)
   */
  async publish(id: string, userId: string): Promise<City> {
    // City取得（DBから再構築)
    const city = await this.cityRepository.findByIdOrFail(id);

    // domain更新(ドメインルール実行: すでに掲載中なら例外)
    city.publish();

    // 永続化: ステータス更新 → prisma → domain
    return this.cityRepository.save(city, userId);
  }

  /**
   * 都市の掲載を取り下げ、編集中に戻す
   *
   * @param id 掲載を取り下げる都市ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 編集中(editing)に戻った都市のdomain
   * @throws NotFoundException 都市が存在しない場合
   * @throws CityAlreadyEditedException すでに編集中の場合(domainのルール)
   */
  async unpublish(id: string, userId: string): Promise<City> {
    // City取得（DBから再構築)
    const city = await this.cityRepository.findByIdOrFail(id);

    // domain更新(ドメインルール実行: すでに編集中なら例外)
    city.unpublish();

    // 永続化: ステータス更新 → prisma → domain
    return this.cityRepository.save(city, userId);
  }

  /**
   * 都市を論理削除(利用停止)する
   *
   * ユースケースとしては「削除」(API: DELETE /cities/:id)だが、
   * ドメインで実際に起きることは「停止(suspended)」なので、domainのsuspend()を呼ぶ。
   *
   * @param id 削除対象の都市ID
   * @param userId 操作ユーザーのID(更新者として保存する)
   * @returns 停止中(suspended)になった都市のdomain
   * @throws NotFoundException 都市が存在しない場合
   * @throws CityAlreadySuspendedException すでに停止中の場合(domainのルール)
   */
  async remove(id: string, userId: string): Promise<City> {
    // City取得（DBから再構築)
    const city = await this.cityRepository.findByIdOrFail(id);

    // TODO(SI-770): 地区が紐づく都市は削除不可(CitiesDomainService.assertDeletable)をここで呼ぶ

    // domain更新(ドメインルール実行: すでに停止中なら例外)
    city.suspend();

    // 永続化: ステータス更新(ソフトデリート) → prisma → domain
    return this.cityRepository.save(city, userId);
  }

  /**
   * 都道府県コード → 都道府県ID に解決する。未指定(undefined)の場合はundefinedを返す
   *
   * @param prefectureCode 都道府県コード(例: '13' = 東京都)。未指定の場合はundefined
   * @returns 都道府県ID。prefectureCodeが未指定の場合はundefined
   * @throws NotFoundException prefectureCodeに該当する都道府県が存在しない場合
   */
  private async resolvePrefectureId(
    prefectureCode: string | undefined,
  ): Promise<string | undefined> {
    // 未指定なら問い合わせない(都道府県なしで作成 / 都道府県は更新しない)
    if (prefectureCode === undefined) {
      return undefined;
    }
    // codeをキーに都道府県を取得し、idを返却(存在しなければ404がそのまま投げられる)
    const prefecture =
      await this.prefecturesQueryService.findByCodeOrFail(prefectureCode);
    return prefecture.id;
  }
}

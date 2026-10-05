import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegionRepositoryPort } from '../domain/region.repository.port';
import { REGION_REPOSITORY_PORT } from '../domain/region.repository.port';
import { RegionsDomainService } from '../domain/regions.domain.service';
import { RegionFactory } from '../domain/regions.factory';
import { Region, UpdateRegionProps } from '../domain/regions.model';
import { PublishRegionDto } from '../presentation/rest/dto/publish-region.dto';
import { CreateRegionCommand } from './commands/create-region.command';
import { UpdateRegionCommand } from './commands/update-region.command';

@Injectable()
export class RegionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly regionsDomainService: RegionsDomainService,
    // TODO: interface(Port)に切り替える
    @Inject(REGION_REPOSITORY_PORT)
    private readonly regionRepository: RegionRepositoryPort,
  ) {}

  /**
   * エリア情報作成
   *
   * @param command 作成対象のエリア情報(command情報)
   * @param userId ユーザーID
   * @returns 作成されたエリア情報
   */
  async create(
    command: CreateRegionCommand,
    userId: string,
  ): Promise<Region & { id: string }> {
    // dto → domain
    // domain詰め替えはスキップしてもいいが(dtoから直接CreateInputを作成してもいいが)、念の為。
    // RegionFactoryを作成したので、以下のdto展開は不要
    // const { code, name, kanaName, status, kanaEn } = createDto;

    // command → domain
    const domain = RegionFactory.from(command);
    // TODO: 暫定ロジック: save()の引数が Region & {id:string} なので暫定で''をセット
    const domainWithId = Object.assign(domain, { id: '' });

    // 以下のDB永続化 → domain詰め替えを、Repository.save()に移管のため、コメント

    // domain → prisma(input)
    // const prismaInput = RegionMapper.toPrismaCreate(domainWithId, userId);

    // // エリア情報登録（永続化）
    // let created: PrismaRegion;
    // try {
    //   created = await this.prismaService.region.create({
    //     data: prismaInput,
    //   });
    // } catch (e: unknown) {
    //   // e:unknownはPrismaClientKnownRequestErrorのinstansof問題対策のBP
    //   // 詳細は、以下のトラブルシューティングを参照
    //   // https://nuppy3.atlassian.net/wiki/spaces/~712020c7a7ba463a644114a22001124373f0fc/pages/60162052/03_99

    //   // Prismaの既知のリクエストエラーであるかをチェック

    //   // eはanyなので、instansof PrismaClientKnownRequestErrorでeの型ガードを行なっているが、
    //   // instanceof は Prisma 5.x/6.x では信頼性が低い問題のため、削除
    //   // if (e instanceof PrismaClientKnownRequestError) {
    //   if (e && typeof e === 'object' && 'code' in e && 'meta' in e) {
    //     // P2002:一意制約エラー
    //     if (e.code === 'P2002') {
    //       const meta = e.meta as { target?: string[] } | undefined;
    //       const field = meta?.target?.join(', ') || '不明なフィールド';
    //       // 409 Conflictをスローし、コントローラーとNestJSのエラーハンドリング層でキャッチされる
    //       throw new ConflictException(`指定された ${field} は既に存在します。`);
    //     } else {
    //       throw e;
    //     }
    //   }
    //   throw e;
    // }
    // const savedDomain = RegionMapper.toDomain(created);

    // return savedDomain;

    // domain → prisma(永続化) → domain
    return this.regionRepository.save(domainWithId, userId);
  }

  /**
   * update(): エリア情報更新
   *
   * @param id エリア情報のID（更新対象のkey）
   * @param command 更新対象のエリア情報(command)
   * @param userId ユーザーID
   * @returns
   */
  async update(
    id: string,
    command: UpdateRegionCommand,
    userId: string,
  ): Promise<Region & { id: string }> {
    // commnd → Domain 更新対象のプロパティ
    // Tweet：分割代入で展開してみてるけど、直接渡してもいいかも
    const { name, code, kanaName, status, kanaEn } = command;
    const updateProps = {
      name,
      code,
      kanaName,
      status,
      kanaEn,
    } satisfies UpdateRegionProps;

    // DBから更新対象のRegionを取得(なければ404) ---
    // ドメインの整合性を守るため、更新前に現在の状態を取得し、ドメインルールによる検証を行う。
    // 例：「掲載中のRegionは名前などを変更できない」「ステータス遷移ルールがある」など。

    // Region取得(DB) → domain (reconstitute)
    // repositoryではなく、内部functionのfindByIdOrFail()を呼び出すように修正
    // const regionWithId = await this.regionRepository.findByIdOrFail(id);
    const regionWithId = await this.findByIdOrFail(id);

    // domain更新(dtoの項目で更新): ドメインルール（例：特定のステータスなら名前は変えられない等）をチェック
    // regionWithId.update({
    //   name: name ?? undefined,
    //   code: code ?? undefined,
    //   kanaName: kanaName ?? undefined,
    //   status: status ?? undefined,
    //   kanaEn: kanaEn ?? undefined,
    // } satisfies UpdateRegionDto);
    regionWithId.update(updateProps);

    // 永続化（DB更新) → domain(toDomain)
    const saved = await this.regionRepository.save(regionWithId, userId);

    return saved;
  }

  /**
   * publish(): 指定のidに関連するエリア情報を掲載中にします。
   *            エリア情報のステータスをpublishに更新し、更新したエリア情報を返却します。
   *
   * ※引数のdtoは使用していないが、将来的な拡張性を考慮して用意している
   *
   * @param id Region ID (更新対象のエリア情報のキー)
   * @param dto 更新専用DTO
   * @param userId ユーザーID
   * @returns 更新したエリア情報
   */
  async publish(
    id: string,
    dto: PublishRegionDto,
    userId: string,
  ): Promise<Region & { id: string }> {
    // Region情報取得
    const regionWithId = await this.findByIdOrFail(id);

    // 更新可能か判定：他のドメインに依存する判定など
    await this.regionsDomainService.assertPublishable(id);

    // domain 更新（ドメインルール実行：domain内部ロジックのみ）
    regionWithId.publish();

    // 永続化: ステータス更新 → prisma → domain
    const published = await this.regionRepository.save(regionWithId, userId);

    return published;
  }

  /**
   * unpublish(): 指定のidに関連するエリア情報を編集中(非公開/公開停止)に戻します。
   *              エリア情報のステータスをeditingに更新し、更新したエリア情報を返却します。
   *
   * ※引数のdtoは使用していないが、将来的な拡張性を考慮して用意している
   *
   * @param id Region ID (更新対象のエリア情報のキー)
   * @param dto 更新専用DTO
   * @param userId ユーザーID
   * @returns 更新したエリア情報
   */
  async unpublish(
    id: string,
    dto: PublishRegionDto,
    userId: string,
  ): Promise<Region & { id: string }> {
    // Region情報取得
    const regionWithId = await this.findByIdOrFail(id);

    // 更新可能か判定：他のドメインに依存する判定など
    await this.regionsDomainService.assertUnpublishable(id);

    // domain 更新（ドメインルール実行：domain内部ロジックのみ）
    regionWithId.unpublish();

    // 永続化: ステータス更新 → prisma → domain
    const unpublished = await this.regionRepository.save(regionWithId, userId);

    return unpublished;
  }

  /**
   * remove(): 指定のidに関連するエリア情報を削除します。
   *           削除したエリア情報を返却します。
   *
   * @param id Region ID (削除対象のエリア情報のキー)
   * @param userId ユーザーID
   * @returns 削除したエリア情報
   */
  async remove(id: string, userId: string): Promise<Region & { id: string }> {
    // 以下のPrismaからのRegion情報取得処理 → infrastructure/repository へ移動

    // Region情報取得
    // ⭐️当service内のfindOne()を呼ぶのは避けるべき（Service内でServiceを呼ぶのは好ましくない)
    // → 正確には、外部の窓口としているfunction(public)を呼ぶのはNGということ
    //   findOne()を呼ぶのはNG。findOne()は外の都合に振り回される（仕様変更）可能性が高いため。
    //   ただ、内部の共通部品として(private)、findByIdOrFail()などを作成し(Idに関連するオブジェクトが
    //   存在しなければエラーを返)実装し、findOne()の中でその内部の共通部品を呼ぶのはOK。
    //   findOne()もupdate()もremove()も、すべて「まずデータがあること」が前提です。
    //   その共通前提を findByCodeOrFail に集約することで、1箇所修正すればすべてのメソッドに反映されます。
    // const prismaRegion = await this.prismaService.region.findUnique({
    //   where: { id },
    // });

    // if (!prismaRegion) {
    //   throw new NotFoundException(
    //     `idに関連するエリア情報が存在しません!! regionId: ${id}`,
    //   );
    // }

    // // prisma → domain
    // const region = Region.reconstitute({
    //   code: prismaRegion.code,
    //   name: prismaRegion.name,
    //   kanaName: prismaRegion.kanaName,
    //   status: prismaRegion.status,
    //   kanaEn: prismaRegion.kanaEn,
    //   createdAt: prismaRegion.createdAt,
    //   updatedAt: prismaRegion.updatedAt,
    // } satisfies ReconstituteRegionProps);

    // // domain + id
    // const regionWithId = Object.assign(region, {
    //   id: prismaRegion.id,
    // });

    // Region情報取得
    // 当service内のfindOne()を呼ぶのは避けるべき（Service内でServiceを呼ぶのは好ましくない)
    // privateとして作成した内部共通functionは読んでもいいらしい。詳しくは上記の⭐️を参照
    // → repositoryではなく、内部functionのfindByIdOrFail()を呼び出すように修正
    // const regionWithId = await this.regionRepository.findByIdOrFail(id);
    const regionWithId = await this.findByIdOrFail(id);

    // 削除可能か判定：他のドメインに依存する判定など
    await this.regionsDomainService.assertDeletable(id);

    // domain 削除（ドメインルール実行：domain内部ロジックのみ）
    regionWithId.remove();

    // 永続化: Region情報削除(ソフトデリート)
    // repositoryに移動
    // const deleted = await this.prismaService.region.update({
    //   data: {
    //     status: regionWithId.status,
    //     userId: userId,
    //     updatedAt: regionWithId.updatedAt,
    //   },
    //   where: { id: regionWithId.id },
    // });
    const deleted = await this.regionRepository.save(regionWithId, userId);

    // prisma → domain
    // Region domainのプロパティをprivateでカプセル化したことにより、プロパティのアクセスは
    // getter経由になったが、そのgetterなどのメソッドが足りないと(差がある)、satisfies Regionで
    // 怒られてしまう。「Region クラスと全く同じ構造（メソッドも含めて）を持っているか？」を
    // チェックするため、「メソッドが足りない！」と怒られてしまいます。(domainのルールであるremove()も
    // ない）
    // →
    // const domain = { ... } satisfies Region は、メソッドが含まれないため失敗する。
    // 結論：単純にオブジェクト{}にcode,nameなどのプロパティ値をセットして、satisfiesでチェック
    //      するとNGになるので、prisma→domainの値だけの詰め替えは実施しない。
    //      必ず Region.reconstitute(...) を使って、クラスのインスタンス(new Region())として
    //      生成する。
    //      そうすることで、domain.remove() などのメソッドも正しく使えるようになります。
    //      インスタンス(メソッドが含まれている）に対してsatisfies すると問題ないので
    //      決してsatisfiesが悪いわけではない。
    //
    // 以下をコメント化し、Region.reconstitute()に切り替え
    // const domain = {
    //   id: deleted.id,
    //   code: deleted.code,
    //   name: deleted.name,
    //   kanaName: deleted.kanaName,
    //   status: deleted.status,
    //   kanaEn: deleted.kanaEn,
    //   createdAt: deleted.createdAt,
    //   updatedAt: deleted.updatedAt,
    // } satisfies Region & { id: string };

    // prisma → domain (最新の状態をドメイン形式に変換)
    // region = Region.reconstitute(
    //   deleted.code,
    //   deleted.name,
    //   deleted.kanaName,
    //   deleted.status,
    //   deleted.kanaEn,
    //   deleted.createdAt,
    //   deleted.updatedAt,
    // );

    // // domain + id
    // regionWithId = Object.assign(region, { id: deleted.id });

    // 20260402: 上記の詰め替え処理をMapperに移管
    // prisma → domain (最新の状態をドメイン形式に変換)
    // return RegionMapper.toDomain(deleted);
    // 20260512: Repository内でtoDomain()を実施しているので、そのままreturn。
    return deleted;
  }

  /**
   * findByIdOrFail: 指定されたIDのRegionをDBから取得します（内部用）
   *                 永続化されたRegion Domainを返却します。
   *
   * Service層内の共通取得メソッド。
   * Repositoryの `findByIdOrFail` をラップし、存在しない場合は `NotFoundException` を投げます。
   * 更新・削除などのユースケースから内部的に使用されます。
   *
   * @param id - 取得対象のRegion ID
   * @returns Regionドメインオブジェクト（id付き）
   * @throws {NotFoundException} 指定されたIDのRegionが存在しない場合
   */
  private async findByIdOrFail(id: string): Promise<Region & { id: string }> {
    // DBから更新対象のRegionを取得(なければ404) ---
    // Region取得(DB) → domain (reconstitute)
    return await this.regionRepository.findByIdOrFail(id);
  }
}

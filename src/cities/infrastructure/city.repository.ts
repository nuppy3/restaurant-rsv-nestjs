import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { City } from '../domain/cities.model';
import { CityRepositoryPort } from '../domain/city.repository.port';
import { CityMapper } from './city.mapper';

/**
 * City Repository(Prisma実装)
 * Domain層が定義したCityRepositoryPortを実装する
 *
 * Application層はPort(interface)にだけ依存し、この実装クラスはmoduleのDIで
 * CITY_REPOSITORY_PORTトークンに紐づけて注入する(依存性逆転)。
 */
@Injectable()
export class CityRepository implements CityRepositoryPort {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * idに紐づく都市を取得する。存在しない場合はNotFoundException
   */
  async findByIdOrFail(id: string): Promise<City> {
    // findUnique: 一意な項目(id)で1件取得する。見つからなければnullを返す(例外にはならない)
    const record = await this.prismaService.city.findUnique({
      where: { id },
    });

    // nullの場合は404にする(「OrFail」= 見つからなければ例外、というメソッド名の約束)
    if (!record) {
      throw new NotFoundException(
        `idに関連する都市情報が存在しません!! cityId: ${id}`,
      );
    }

    // Prismaのレコード → domain(Mapperを経由して変換する。Repositoryの外にPrismaの型を出さない)
    return CityMapper.toDomain(record);
  }

  /**
   * codeに紐づく都市を取得する。存在しない場合はNotFoundException
   */
  async findByCodeOrFail(code: string): Promise<City> {
    // codeもschemaで@uniqueのため、findUniqueで取得できる
    const record = await this.prismaService.city.findUnique({
      where: { code },
    });

    if (!record) {
      throw new NotFoundException(
        `codeに関連する都市情報が存在しません!! code: ${code}`,
      );
    }

    return CityMapper.toDomain(record);
  }

  /**
   * 都市を永続化する
   * DBに同じidが無ければcreate、あればupdateを行う(upsert)
   *
   * idはdomain(createNew)で採番済みで、新規作成でも常に値があるため、
   * 「idが空ならcreate」という判定はできない。そのためupsertでDB側に判定させる。
   *
   * @throws ConflictException code・slugが重複している場合(Prisma: P2002)
   */
  async save(city: City, userId: string): Promise<City> {
    try {
      // upsert = update + insert
      // ・where : このidのレコードがDBにあるかを探す
      // ・create: 無かった場合に作成する内容(idを含む)
      // ・update: あった場合に更新する内容(id・createdAtは含まない)
      // create / update の中身はMapperで組み立てる
      const record = await this.prismaService.city.upsert({
        where: { id: city.id },
        create: CityMapper.toPrismaCreate(city, userId),
        update: CityMapper.toPrismaUpdate(city, userId),
      });

      // 保存後のレコード → domain(DBに保存された状態で返す)
      return CityMapper.toDomain(record);
    } catch (e: unknown) {
      // P2002: 一意制約違反(@uniqueの項目が重複した)
      // City では code と slug が @unique なので、どちらかが既存の都市と重複すると発生する → 409にする
      //
      // 🗒 instanceof PrismaClientKnownRequestError を使わない理由(Region / Prefecture と同じ):
      //    PrismaClientを generated/prisma に出力しているため、本体のエラークラスと、
      //    テスト等で @prisma/client から読み込んだエラークラスが別物になり、instanceof が false になることがある。
      //    そのため、エラーが持つプロパティ(code / meta)を1つずつ確かめる書き方(ダックタイピング)で判定する。
      //
      // catchのeはunknown型なので、プロパティを読む前に次の順で型を絞り込む
      // ・e && typeof e === 'object' → null / 文字列などではなく、オブジェクトであること
      // ・'code' in e / 'meta' in e  → Prismaのエラーが持つプロパティがあること
      // ・e.code === 'P2002'         → 一意制約違反のエラーコードであること
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        'meta' in e &&
        e.code === 'P2002'
      ) {
        // どの項目が重複したかは meta.target に配列で入っている(例: ['slug'])
        const meta = e.meta as { target?: string[] } | undefined;
        const field = meta?.target?.join(', ') || '不明なフィールド';
        throw new ConflictException(`指定された ${field} は既に存在します。`);
      }
      // P2002以外(DB接続エラー、connect先のUser・都道府県が存在しない(P2025)など)は、
      // 握りつぶさずにそのまま投げる(グローバルのExceptionFilterで500などになる)
      throw e;
    }
  }
}

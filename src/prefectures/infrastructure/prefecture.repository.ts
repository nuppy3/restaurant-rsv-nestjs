import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrefectureRepositoryPort } from '../domain/prefecture.repository.port';
import { Prefecture } from '../domain/prefectures.model';
import { PrefectureMapper } from './prefecture.mapper';

/**
 * Prefecture Repository(Prisma実装)
 * Domain層が定義したPrefectureRepositoryPortを実装する
 */
@Injectable()
export class PrefectureRepository implements PrefectureRepositoryPort {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * idに紐づく都道府県を取得する。存在しない場合はNotFoundException
   */
  async findByIdOrFail(id: string): Promise<Prefecture & { id: string }> {
    const record = await this.prismaService.prefecture.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(
        `idに関連する都道府県情報が存在しません!! prefectureId: ${id}`,
      );
    }

    return PrefectureMapper.toDomain(record);
  }

  /**
   * codeに紐づく都道府県を取得する。存在しない場合はNotFoundException
   */
  async findByCodeOrFail(code: string): Promise<Prefecture & { id: string }> {
    const record = await this.prismaService.prefecture.findUnique({
      where: { code },
    });

    if (!record) {
      throw new NotFoundException(
        `codeに関連する都道府県情報が存在しません!! code: ${code}`,
      );
    }

    return PrefectureMapper.toDomain(record);
  }

  /**
   * 都道府県を永続化する
   * idが空(新規作成)の場合はcreate、それ以外はupdateを行う
   * (Regionのようにダミーidでupsertせず、意図を明示的に分ける)
   *
   * @throws ConflictException codeが重複している場合(Prisma: P2002)
   */
  async save(
    domainWithId: Prefecture & { id: string },
    userId: string,
  ): Promise<Prefecture & { id: string }> {
    try {
      const record = !domainWithId.id
        ? await this.prismaService.prefecture.create({
            data: PrefectureMapper.toPrismaCreate(domainWithId, userId),
          })
        : await this.prismaService.prefecture.update({
            where: { id: domainWithId.id },
            data: PrefectureMapper.toPrismaUpdate(domainWithId, userId),
          });

      return PrefectureMapper.toDomain(record);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        'meta' in e &&
        e.code === 'P2002'
      ) {
        const meta = e.meta as { target?: string[] } | undefined;
        const field = meta?.target?.join(', ') || '不明なフィールド';
        throw new ConflictException(`指定された ${field} は既に存在します。`);
      }
      throw e;
    }
  }
}

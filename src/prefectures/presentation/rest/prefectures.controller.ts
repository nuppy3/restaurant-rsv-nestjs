import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Request as ExpressRequest } from 'express';
import { RequestUser } from '../../../types/requestUser';
import { CreatePrefectureCommand } from '../../application/commands/create-prefecture.command';
import { UpdatePrefectureCommand } from '../../application/commands/update-prefecture.command';
import { PrefecturesService } from '../../application/prefectures.service';
import { PrefectureFilter } from '../../query/prefecture.filter';
import { PrefecturesQueryService } from '../../query/prefectures.query.service';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
  PaginatedPrefectureResponseDto,
  PrefectureResponseDto,
} from './dto/prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';

/**
 * 都道府県 REST API
 * 参照系はPrefecturesQueryService、更新系はApplication層のPrefecturesServiceを呼び出す(CQRS)
 */
@Controller('prefectures')
export class PrefecturesController {
  constructor(
    private readonly prefecturesService: PrefecturesService,
    private readonly prefecturesQueryService: PrefecturesQueryService,
  ) {}

  /**
   * 都道府県一覧取得API(ページネーション)
   */
  @Get()
  async findAllPaginated(
    @Query() query: FindAllPrefectureQueryDto,
  ): Promise<PaginatedPrefectureResponseDto> {
    const filters = {
      page: query.page,
      size: query.size,
    } satisfies PrefectureFilter;

    const paginated =
      await this.prefecturesQueryService.findAllPaginated(filters);

    const data = instanceToPlain(
      plainToInstance(PrefectureResponseDto, paginated.data, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto[];

    return new PaginatedPrefectureResponseDto(data, paginated.meta);
  }

  /**
   * 公開中の店舗がある都道府県一覧取得API(店舗数付き)
   * ※ ':id'より前に定義する(ルートの評価順のため)
   */
  @Get('covered')
  async findCovered(): Promise<PrefectureResponseDto[]> {
    const readModels = await this.prefecturesQueryService.findCovered();

    return this.toResponseDto(readModels) as PrefectureResponseDto[];
  }

  /**
   * 都道府県詳細取得API(code指定)
   */
  @Get('code/:code')
  async findByCode(
    @Param('code') code: string,
  ): Promise<PrefectureResponseDto> {
    const readModel =
      await this.prefecturesQueryService.getDetailByCodeOrThrow(code);

    return this.toResponseDto(readModel) as PrefectureResponseDto;
  }

  /**
   * 都道府県詳細取得API(id指定)
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrefectureResponseDto> {
    const readModel =
      await this.prefecturesQueryService.getDetailByIdOrThrow(id);

    return this.toResponseDto(readModel) as PrefectureResponseDto;
  }

  /**
   * 都道府県作成API(status: 編集中)
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() dto: CreatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      kanaEn: dto.kanaEn,
      regionCode: dto.regionCode,
    } satisfies CreatePrefectureCommand;

    const domain = await this.prefecturesService.create(command, req.user.id);

    return this.toResponseDto(domain) as PrefectureResponseDto;
  }

  /**
   * 都道府県の基本情報更新API(掲載中は更新不可)
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      kanaEn: dto.kanaEn,
      regionCode: dto.regionCode,
    } satisfies UpdatePrefectureCommand;

    const domain = await this.prefecturesService.update(
      id,
      command,
      req.user.id,
    );

    return this.toResponseDto(domain) as PrefectureResponseDto;
  }

  /**
   * 都道府県公開API(編集中/停止中 → 掲載中)
   */
  @Post('/:id/publish')
  @UseGuards(AuthGuard('jwt'))
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const domain = await this.prefecturesService.publish(id, req.user.id);

    return this.toResponseDto(domain) as PrefectureResponseDto;
  }

  /**
   * 都道府県非公開API(掲載中/停止中 → 編集中)
   */
  @Post('/:id/unpublish')
  @UseGuards(AuthGuard('jwt'))
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const domain = await this.prefecturesService.unpublish(id, req.user.id);

    return this.toResponseDto(domain) as PrefectureResponseDto;
  }

  /**
   * 都道府県削除API(論理削除: 停止中にする。店舗が紐づいている場合は不可)
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const domain = await this.prefecturesService.remove(id, req.user.id);

    return this.toResponseDto(domain) as PrefectureResponseDto;
  }

  /**
   * domain / Read Model → レスポンス(plain object)
   * @Expose()の項目のみ返却し、undefinedの項目(地方未設定など)はレスポンスから省略する
   */
  private toResponseDto(source: object | object[]): unknown {
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, source, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    );
  }
}

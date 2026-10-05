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
import { UpdateRegionCommand } from '../../../regions/application/commands/update-region.command';
import { RequestUser } from '../../../types/requestUser';
import { RegionsService } from '../../application/regions.service';
import { RegionsQueryService } from '../../query/regions.query.service';
import { CreateRegionCommand } from './../../application/commands/create-region.command';
import { RegionFilter } from './../../query/region.filter';
import { PublishRegionDto } from './dto/publish-region.dto';
import {
  CreateRegionDto,
  FindAllRegionsQueryDto,
  PaginatedRegionResponseDto,
  RegionOptionResponseDto,
  RegionResponseDto,
} from './dto/region.dto';
import { UnpublishRegionDto } from './dto/unpublish-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Controller('regions')
export class RegionsController {
  constructor(
    private readonly regionsService: RegionsService,
    private readonly regionsQueryService: RegionsQueryService,
  ) {}

  /**
   * エリア情報リスト取得： エリア情報の一覧(ページネーション化された)を取得します。
   *
   * @param query エリア情報検索クエリDTO(フィルター項目/ソート順など)
   * @returns エリア情報一覧(ページネーション化されたエリア情報一覧)
   */
  @Get()
  async findAllPaginated(
    @Query() query: FindAllRegionsQueryDto,
  ): Promise<PaginatedRegionResponseDto> {
    // QueryDTO → filter 変換
    // ⭐️memo:
    // HTTPSのリクエストパラメーターについてnullって送れるの？unndefindって送れるの？
    // という疑問が、定期的に降りてくる。。。ので腰を据えて調べてみた。
    // 上記の疑問に関連し、以下のようにnull or undefinedの場合にundefinedに変換するロジックを
    // 多用しているが(要は初期化)、これって意味あるのか？という疑問もある。
    // 結論：
    // ・nullはほぼ不可能。JavaScriptのnullという値を、HTTPのクエリパラメータとして
    // そのまま送る手段が、そもそも存在しない
    //  → POST/PUTのJSON Body経由であれば可能。将来@Body()を使うようならnullは意識しておく
    // がGETの場合はnullはこない。なので、以下の変換はほぼ無意味。。
    // ・undefinedは可能
    // ?size= → query.size は '' (空文字列)
    // ?size=null → query.size は 'null'
    // (sizeを付けない) → query.size は undefined
    //
    const filters = {
      code: query.code ?? undefined,
      name: query.name ?? undefined,
      status: query.status ?? undefined,
      page: query.page ?? undefined,
      size: query.size ?? undefined,
      sortOrder: query.sortOrder ?? undefined,
      sortBy: query.sortBy ?? undefined,
    } satisfies RegionFilter;

    // エリア情報[] 取得 (ページネーション化されたRegion情報)
    const paginated = await this.regionsQueryService.findAllPaginated(filters);

    // read model → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    // plainToInstanceは以下のように配列(readModels[]→dto[])にも使えるよ!!
    const data = instanceToPlain(
      plainToInstance(RegionResponseDto, paginated.data, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
      // 値が undefined or null の場合、キーごと消える
      { exposeUnsetFields: false },
    ) as RegionResponseDto[];

    // 以下でも問題無いが、new PaginatedRegionResponseDto()でコンストラクタを使用する。
    //  return {
    //     data: data,
    //     meta: {
    //       totalCount: paginated.meta.totalCount,
    //       page: paginated.meta.page,
    //       size: paginated.meta.size,
    //     },
    //   } satisfies PaginatedRegionResponseDto;

    // PaginatedRegionResponseDtoに変換
    return new PaginatedRegionResponseDto(data, paginated.meta);
  }

  /**
   * エリア情報選択肢取得： ドロップダウンなどの選択肢用に、エリア情報一覧
   *                     (全件・ページネーションなし、PUBLISHEDのみ)を取得します。
   *
   * @returns エリア情報選択肢一覧
   */
  @Get('options')
  async findAll(): Promise<RegionOptionResponseDto[]> {
    // エリア情報[] 取得(全件、ページネーションなし)
    const regions = await this.regionsQueryService.findAll();

    // read model → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    const data = instanceToPlain(
      plainToInstance(RegionOptionResponseDto, regions, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as RegionOptionResponseDto[];

    return data;
  }

  /**
   * エリア情報詳細取得： エリアIDに関連するエリア情報詳細を取得し返却します。
   *                   存在しない場合は404。
   * @param id エリア情報
   * @returns エリア情報詳細(IDに関連する)
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RegionResponseDto> {
    // エリア情報取得
    const region = await this.regionsQueryService.getDetailByIdOrThrow(id);
    // domain → dto
    const dto = instanceToPlain(
      plainToInstance(RegionResponseDto, region, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }) satisfies RegionResponseDto,
    ) as RegionResponseDto;

    return dto;

    // return this.regionsService.findOne(+id);
  }

  /**
   * findByCode: 指定されたcodeに関連するエリア情報を取得し、返却します。
   *             存在しない場合は404。
   *
   * @param code エリアコード
   * @returns エリア情報（エリアコードに関連する）
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<RegionResponseDto> {
    // エリア情報取得
    const region = await this.regionsQueryService.getDetailByCodeOrThrow(code);
    // domain → dto
    const dto = instanceToPlain(
      plainToInstance(RegionResponseDto, region, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }) satisfies RegionResponseDto,
    ) as RegionResponseDto;

    return dto;
  }

  /**
   * エリア情報登録（永続化）
   *
   * @param createRegionDto エリア登録対象DTO
   * @returns エリア登録後のDTO
   */
  @Post()
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async create(
    @Body() createRegionDto: CreateRegionDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<RegionResponseDto> {
    // DTO → command 変換
    const command = {
      code: createRegionDto.code,
      name: createRegionDto.name,
      kanaName: createRegionDto.kanaName,
      kanaEn: createRegionDto.kanaEn,
    } satisfies CreateRegionCommand;

    // エリア情報登録（永続化）
    const domain = await this.regionsService.create(command, req.user.id);

    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    return instanceToPlain(
      plainToInstance(RegionResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as RegionResponseDto;
  }

  /**
   * update(): エリア情報更新API
   * 役割: 基本情報の変更（名称などの書き換え）用のAPI
   *      今はステータスなど、全てのプロパティを更新可能であるが、アクション指向を意識すると
   *      ステータスの状態更新・遷移はそれぞれのuse case毎にエンドポイント、serviceを分けるの
   *      が望ましい。→ 今後実装する。
   *
   * update()の引数(パラメータ)について
   * IDをURLに含め、更新対象をBodyのDTOから取得する（REST標準）
   * NestJS の CLI（nest g resource）などで自動生成すると、以下のパラメータとなる。
   * update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto)
   *
   * @param id エリアID(キー)
   * @param updateRegionDto エリア情報更新対象DTO
   * @returns エリア情報更新結果オブジェクト
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async update(
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<RegionResponseDto> {
    // DTO → command 変換
    const command = {
      code: updateRegionDto.code ?? undefined,
      name: updateRegionDto.name ?? undefined,
      kanaName: updateRegionDto.kanaName ?? undefined,
      kanaEn: updateRegionDto.kanaEn ?? undefined,
      status: updateRegionDto.status ?? undefined,
    } satisfies UpdateRegionCommand;

    // エリア情報更新
    const updated = await this.regionsService.update(id, command, req.user.id);

    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    return instanceToPlain(
      plainToInstance(RegionResponseDto, updated, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as RegionResponseDto;
  }

  /**
   * エリア情報のステータス更新（永続化）： publish
   *
   * 指定されたidに関連するエリア情報のステータスをpublishにします。
   * POSTパラメータのpublishRegionDtoは基本的に{}(空オブジェクト)であるが、将来的な
   * 拡張を考慮り、専用のDTOを用意している。
   *
   * 拡張例:
   *  reason: 非公開の理由
   *
   * @param Region ID (uuid)
   * @param publishRegionDto エリア情報更新専用(publish専用)DTO
   * @returns エリア更新後のDTO
   */
  @Post('/:id/publish') // /:idの"/"が必要
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() publishRegionDto: PublishRegionDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<RegionResponseDto> {
    // エリア情報登録（永続化）
    const domain = await this.regionsService.publish(
      id,
      publishRegionDto,
      req.user.id,
    );

    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    return instanceToPlain(
      plainToInstance(RegionResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as RegionResponseDto;
  }

  /**
   * エリア情報のステータス更新（永続化）： edit(編集中)
   *
   * 指定されたidに関連するエリア情報のステータスをeditにします。
   * POSTパラメータのpublishRegionDtoは基本的に{}(空オブジェクト)であるが、将来的な
   * 拡張を考慮り、専用のDTOを用意している。
   *
   * 拡張例:
   *  reason: 非公開の理由
   *
   * @param Region ID (uuid)
   * @param unpublishRegionDto エリア情報更新専用(unpublish専用)DTO
   * @returns エリア更新後のDTO
   */
  @Post('/:id/unpublish') // /:idの"/"が必要
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() unpublishRegionDto: UnpublishRegionDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<RegionResponseDto> {
    // エリア情報登録（永続化）
    const domain = await this.regionsService.unpublish(
      id,
      unpublishRegionDto,
      req.user.id,
    );

    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    return instanceToPlain(
      plainToInstance(RegionResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as RegionResponseDto;
  }

  /**
   * remove(): 指定されたid(Region ID)に関連するエリア情報を削除します。（ソフトデリート）
   *           削除されたエリア情報を返却します。
   * @param id Region ID
   * @param req HTTPリクエスト
   * @returns エリア情報(削除された)
   */
  // @Delete() は 「このメソッドはHTTPのDELETEリクエストを処理する」 という宣言をするデコレーター。
  @Delete(':id')
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<RegionResponseDto> {
    // エリア情報削除
    const deleted = await this.regionsService.remove(id, req.user.id);

    // domain → dto
    return instanceToPlain(
      plainToInstance(RegionResponseDto, deleted, {
        excludeExtraneousValues: true,
      }),
    ) as RegionResponseDto;
  }
}

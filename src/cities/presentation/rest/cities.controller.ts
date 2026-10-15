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
import { CitiesService } from '../../application/cities.service';
import { CreateCityCommand } from '../../application/commands/create-city.command';
import { UpdateCityCommand } from '../../application/commands/update-city.command';
import { CitiesQueryService } from '../../query/cities.query.service';
import { CityFilter } from '../../query/city.filter';
import {
  CityResponseDto,
  CreateCityDto,
  FindAllCityQueryDto,
  PaginatedCityResponseDto,
} from './dto/city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

/**
 * 都市(City) REST API
 *
 * Controllerの役割は「HTTPの入出力の変換」だけ。
 * ・リクエスト(DTO) → Command / Filter に詰め替えて、Application Service / QueryService を呼ぶ
 * ・戻り値(domain / Read Model) → レスポンスDTO に変換して返す
 * ルールの判定や保存はApplication Service・domainの担当なので、ここには書かない。
 *
 * 参照系(GET)は CitiesQueryService、更新系(POST / PATCH / DELETE)は CitiesService を呼ぶ(CQRS)
 * 更新系はJWT認証が必要(AuthGuard('jwt'))。参照系は認証なしで呼べる
 */
@Controller('cities')
export class CitiesController {
  constructor(
    private readonly citiesService: CitiesService,
    private readonly citiesQueryService: CitiesQueryService,
  ) {}

  /**
   * 都市一覧を取得する(ページネーション。sortOrder昇順 → code昇順)
   * GET /cities?page=1&size=20
   */
  @Get()
  async findAllPaginated(
    @Query() query: FindAllCityQueryDto,
  ): Promise<PaginatedCityResponseDto> {
    // クエリパラメータ(DTO) → 検索条件(Filter)に詰め替える
    const filters = {
      page: query.page ?? undefined,
      size: query.size ?? undefined,
    } satisfies CityFilter;

    // 都市一覧情報(Read Model: 都道府県名付き)とページ情報を取得
    const paginated = await this.citiesQueryService.findAllPaginated(filters);

    // Read Model[] → レスポンスDTO[] に変換し、ページ情報と合わせて返す
    const data = this.toResponseDto(paginated.data);
    return new PaginatedCityResponseDto(data, paginated.meta);
  }

  /**
   * codeに紐づく都市の詳細を取得する。存在しない場合は404
   * GET /cities/code/:code
   *
   * ⚠️ GET :id より先に定義すること
   *    NestJSは定義した順にルートを照合するため、:id を先に書くと
   *    /cities/code/001 の「code」が :id として扱われてしまう(ParseUUIDPipeで400になる)
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<CityResponseDto> {
    // 都市の詳細(Read Model: 都道府県名・作成日時・更新日時付き)を取得
    const readModel =
      await this.citiesQueryService.getDetailByCodeOrThrow(code);
    // Read Model → レスポンスDTO
    return this.toResponseDto(readModel);
  }

  /**
   * idに紐づく都市の詳細を取得する。存在しない場合は404
   * GET /cities/:id
   * ParseUUIDPipe: idがUUIDの形式でなければ、Serviceを呼ぶ前に400を返す
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CityResponseDto> {
    // 都市の詳細(Read Model: 都道府県名・作成日時・更新日時付き)を取得
    const readModel = await this.citiesQueryService.getDetailByIdOrThrow(id);
    // Read Model → レスポンスDTO
    return this.toResponseDto(readModel);
  }

  /**
   * 都市を新規作成する(status: 編集中)
   * POST /cities
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() dto: CreateCityDto,
    // JWT認証を通過すると、req.user にログインユーザーの情報が入る
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<CityResponseDto> {
    // リクエスト(DTO) → Command に詰め替える(Application層はDTOに依存しない)
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      prefectureCode: dto.prefectureCode,
    } satisfies CreateCityCommand;

    // 作成(ログインユーザーを作成者として保存する) → domain
    const domain = await this.citiesService.create(command, req.user.id);
    return this.toResponseDto(domain);
  }

  /**
   * 都市の基本情報を更新する(掲載中は409)
   * PATCH /cities/:id
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCityDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<CityResponseDto> {
    // 未指定の項目はundefinedのまま渡す(Application / domain側で「更新しない」として扱う)
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      slug: dto.slug,
      sortOrder: dto.sortOrder,
      prefectureCode: dto.prefectureCode,
    } satisfies UpdateCityCommand;

    const domain = await this.citiesService.update(id, command, req.user.id);
    return this.toResponseDto(domain);
  }

  /**
   * 都市を掲載中にする(すでに掲載中なら409)
   * POST /cities/:id/publish
   */
  @Post('/:id/publish')
  @UseGuards(AuthGuard('jwt'))
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<CityResponseDto> {
    const domain = await this.citiesService.publish(id, req.user.id);
    return this.toResponseDto(domain);
  }

  /**
   * 都市の掲載を取り下げ、編集中に戻す(すでに編集中なら409)
   * POST /cities/:id/unpublish
   */
  @Post('/:id/unpublish')
  @UseGuards(AuthGuard('jwt'))
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<CityResponseDto> {
    const domain = await this.citiesService.unpublish(id, req.user.id);
    return this.toResponseDto(domain);
  }

  /**
   * 都市を削除する(論理削除: 停止中にする。すでに停止中なら409)
   * DELETE /cities/:id
   * 物理削除はせず、停止中(suspended)にした都市を返す
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<CityResponseDto> {
    const domain = await this.citiesService.remove(id, req.user.id);
    return this.toResponseDto(domain);
  }

  /**
   * domain / Read Model → レスポンス(plain object)
   * @Expose()の項目のみ返却し、undefinedの項目(都道府県未設定など)はレスポンスから省略する
   *
   * オーバーロード: 引数が配列なら配列、1件なら1件の型が返る(呼び出し側で as が不要になる)
   * ① シグネチャ(呼び出し側から見える型の約束) / ② 実装(①の両方を満たす型で書く)
   */
  // ① オーバーロードのシグネチャ
  private toResponseDto(source: object[]): CityResponseDto[];
  private toResponseDto(source: object): CityResponseDto;

  // ② 実装
  private toResponseDto(
    source: object | object[],
  ): CityResponseDto | CityResponseDto[] {
    // plainToInstance: domain / Read Model → CityResponseDto のインスタンスに変換する
    //   ・excludeExtraneousValues: @Expose() が無い項目(userId / createdAt など)は捨てる
    //   ・domainはgetter(city.name など)から値が読まれる
    // instanceToPlain: インスタンス → plain object に戻す
    //   ・getter(statusLabel)の値がここで計算されてレスポンスに含まれる
    //   ・exposeUnsetFields: false で、値が undefined の項目はキーごと省略する
    return instanceToPlain(
      plainToInstance(CityResponseDto, source, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as CityResponseDto | CityResponseDto[];
  }
}

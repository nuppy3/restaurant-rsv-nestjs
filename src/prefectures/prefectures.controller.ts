import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Request as ExpressRequest } from 'express';
import { RequestUser } from 'src/types/requestUser';
import {
  CreatePrefectureDto,
  FindAllPrefectureQueryDto,
  PaginatedPrefectureResponseDto,
  PrefectureResponseDto,
} from './dto/prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';
import { PrefecturesService } from './prefectures.service';

@Controller('prefectures')
export class PrefecturesController {
  constructor(private readonly prefecturesService: PrefecturesService) {}

  /**
   * 都道府県情リスト報取得（店舗の有無関係なし）
   *
   * @returns 都道府県情報一覧
   */
  @Get()
  async findAll(
    // クエリパラメータをDTOにて受け取り: クエリパラメータ無しの場合、queryは{}空オブジェクトが渡される
    @Query() query: FindAllPrefectureQueryDto,
  ): Promise<PaginatedPrefectureResponseDto> {
    // 検索フィルター取得: validation(dto)で入力チェック済みなので、そのままセット。
    const filters = query;
    // Prefecture情報[]取得(ページネーションされたPrefecture情報)
    const paginated = await this.prefecturesService.findAll(filters);
    // domain → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    // plainToInstanceは以下のように配列(store[]→dto[])にも使えるよ!!
    const plainPrefecture = instanceToPlain(
      plainToInstance(PrefectureResponseDto, paginated.data, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
      // 値が undefined or null の場合、キーごと消える
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto[];

    // ページ全体のDTO(plain object): {data/meta} を作成

    // 以下のようにコンストラクタ経由でセットしないやり方はベストではない。
    // ↓new PaginatedPrefectureResponseDto()でコンストラクタ経由でDTOを生成するように修正
    // const responsDto: PaginatedPrefectureResponseDto = {
    //   data: plainPrefecture,
    //   meta: {
    //     totalCount: paginated.meta.totalCount,
    //     page: paginated.meta.page,
    //     size: paginated.meta.size,
    //   },
    // };

    const responsDto = new PaginatedPrefectureResponseDto(plainPrefecture, {
      totalCount: paginated.meta.totalCount,
      page: paginated.meta.page,
      size: paginated.meta.size,
    });

    return responsDto;
  }

  /**
   * 都道府県情報取得（店舗有りの都道府県のみ）
   * findAllWithStoreCountという名前について：「店舗が存在する都道府県をすべてと、紐づく店舗数を
   * 取得する」というユースケースそのものを表現している。
   *
   * controllerのfindCoveredはURLが /covered であることはHTTP表現の都合。
   *
   * @returns 都道府県情報（店舗有りの都道府県のみ）
   */
  @Get('covered')
  async findCovered(): Promise<PrefectureResponseDto[]> {
    // Prefecture情報[]取得()
    const domains = await this.prefecturesService.findAllWithStoreCount();

    // domain専用モデル(PrefectureWithCoverage)→POJO(プレーンデータ)
    const plains = domains.map((domain) => ({
      id: domain.id,
      name: domain.prefecture.name,
      code: domain.prefecture.code,
      kanaName: domain.prefecture.kanaName,
      status: domain.prefecture.status,
      kanaEn: domain.prefecture.kanaEn,
      regionId: domain.prefecture.regionId,
      regionName: domain.prefecture.regionName,
      createdAt: domain.prefecture.createdAt,
      updatedAt: domain.prefecture.updatedAt,
      storeCount: domain.storeCount,
    }));

    // domain(POJO) → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    // plainToInstanceは以下のように配列(store[]→dto[])にも使えるよ!!
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, plains, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as PrefectureResponseDto[];
  }

  /**
   * 都道府県情報を作成します。
   *
   * @param createPrefectureDto 都道府県情報(作成対象)
   * @param req Request情報 & RequestUser(tokenから取得したユーザIDなど)
   * @returns
   */
  @Post()
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async create(
    @Body() createPrefectureDto: CreatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // Prefecture作成
    const domain = await this.prefecturesService.create(
      createPrefectureDto,
      req.user.id,
    );
    // domain → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
    ) as PrefectureResponseDto;
  }

  /**
   * findOne(): 都道府県idに関連する都道府県情報を取得します。
   *
   * @param id 都道府県id(key)
   * @returns 都道府県情報
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PrefectureResponseDto> {
    const domain = await this.prefecturesService.findOne(id);

    // domain → dto
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
      // 値が undefined or null の場合、キーごと消える
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto;
  }

  /**
   * findByCode(): コードに関連する都道府県情報を取得します。
   *
   * @param code 都道府県コード
   * @returns 都道府県情報
   */
  @Get('code/:code')
  async findByCode(
    @Param('code') code: string,
  ): Promise<PrefectureResponseDto> {
    // prefecture取得
    const domain = await this.prefecturesService.findByCodeOrFail(code);

    // domain → dto
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
      // 値が undefined or null の場合、キーごと消える
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto;
  }

  /**
   * update(): 都道府県情報更新API
   *
   * update()の引数(パラメータ)について
   * IDをURLに含め、更新対象をBODYのDTOから取得する（REST標準）
   * NestJs の CLI(nest g resource)などで自動生成すると、以下のパラメータとなる。
   * update(@Param('id') id: string, @Body() updatePrefectureDto: UpdatePrefectureDto)
   *
   * @param id 都道府県ID(キー)
   * @param updatePrefectureDto 都道府県情報更新対象DTO
   * @param req リクエストパラメータ
   * @returns
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt')) // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  async update(
    @Param('id') id: string,
    @Body() updatePrefectureDto: UpdatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    const domain = await this.prefecturesService.update(
      id,
      updatePrefectureDto,
      req.user.id,
    );

    // domain → dto
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, domain, {
        // @Expose() がないプロパティは全部消える
        // 値が undefined or null の場合、キーごと消える
        excludeExtraneousValues: true,
      }),
      // 値が undefined or null の場合、キーごと消える
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prefecturesService.remove(+id);
  }
}

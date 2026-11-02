import { Controller, Get, Query } from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { DistrictFilter } from '../../../districts/query/district.filter';
import { DistrictsQueryService } from './../../query/districts.query.service';
import {
  DistrictOptionResponseDto,
  DistrictResponseDto,
  FindAllDistrictsQueryDto,
  PaginatedDistrictResponseDto,
} from './dto/district.dto';

@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsQueryService: DistrictsQueryService) {}

  /**
   * 地区情報リスト取得： 地区情報の一覧(ページネーション化された)を取得します。
   *
   * @param query 地区情報検索クエリDTO(フィルター項目/ソート順など)
   * @returns 地区情報一覧(ページネーション化されたエリア情報一覧)
   */
  @Get()
  async findAllPaginated(
    @Query() query: FindAllDistrictsQueryDto,
  ): Promise<PaginatedDistrictResponseDto> {
    // queryDto → filter
    // memo: HTTPSのリクエストパラメーターについてnullって送れるの？unndefindって送れるの？
    // regions.controller.tsを参照
    //
    const filters = {
      name: query.name ?? undefined,
      status: query.status ?? undefined,
      cityCode: query.cityCode ?? undefined,
      page: query.page ?? undefined,
      size: query.size ?? undefined,
    } satisfies DistrictFilter;

    // 地区一覧取得(ページネーション化されたRead Model)
    const paginated =
      await this.districtsQueryService.findAllPaginated(filters);

    // Model[] → DTO[] に変換し、ページ情報と合わせて返す
    // plainToInstance()からのinstanceToPlain()
    return new PaginatedDistrictResponseDto(
      this.toResponseDto(paginated.data),
      paginated.meta,
    );
  }

  /**
   * 地区情報選択肢取得： ドロップダウンなどの選択肢用に、地区情報一覧
   *                   (全件・ページネーションなし、PUBLISHEDのみ)を取得します。
   *
   * @returns 地区情報選択肢一覧
   */
  @Get('options')
  async findAll(): Promise<DistrictOptionResponseDto[]> {
    // 地区一覧取得(Read Model[])
    const readModels = await this.districtsQueryService.findAll();

    // read model → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    const data = instanceToPlain(
      plainToInstance(DistrictOptionResponseDto, readModels, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as DistrictOptionResponseDto[];

    return data;
  }

  /**
   * domain / Read Model → レスポンス(plain object)
   * @Expose()の項目のみ返却し、undefinedの項目はレスポンスから省略する
   *
   * オーバーロード: 引数が配列なら配列、1件なら1件の型が返る(呼び出し側で as が不要になる)
   * ① シグネチャ(呼び出し側から見える型の約束) / ② 実装(①の両方を満たす型で書く)
   */
  // ① オーバーロードのシグネチャ
  private toResponseDto(source: object[]): DistrictResponseDto[];
  private toResponseDto(source: object): DistrictResponseDto;

  // ② 実装
  private toResponseDto(
    source: object | object[],
  ): DistrictResponseDto | DistrictResponseDto[] {
    // plainToInstance: domain / Read Model → CityResponseDto のインスタンスに変換する
    //   ・excludeExtraneousValues: @Expose() が無い項目(userId / createdAt など)は捨てる
    //   ・domainはgetter(city.name など)から値が読まれる
    // instanceToPlain: インスタンス → plain object に戻す
    //   ・getter(statusLabel)の値がここで計算されてレスポンスに含まれる
    //   ・exposeUnsetFields: false で、値が undefined の項目はキーごと省略する
    return instanceToPlain(
      plainToInstance(DistrictResponseDto, source, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as DistrictResponseDto | DistrictResponseDto[];
  }
}

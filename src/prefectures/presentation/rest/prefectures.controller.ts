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
   *
   * @param query 都道府県情報検索クエリDTO(フィルター項目/ソート順など)
   * @returns 都道府県情報一覧(ページネーション化された都道府県情報一覧)
   */
  @Get()
  async findAllPaginated(
    // クエリパラメータをDTOにて受け取り: クエリパラメータ無しの場合、queryは{}空オブジェクトが渡される
    @Query() query: FindAllPrefectureQueryDto,
  ): Promise<PaginatedPrefectureResponseDto> {
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
      page: query.page ?? undefined,
      size: query.size ?? undefined,
    } satisfies PrefectureFilter;

    // 都道府県情報[] 取得 (ページネーション化されたRegion情報)
    const paginated =
      await this.prefecturesQueryService.findAllPaginated(filters);

    // ⭐️ 以下をコメント化：dto(plain)への変換を共通function化
    // read model → dto
    // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
    // plainToInstanceは以下のように配列(readModels[]→dto[])にも使えるよ!!
    // const data = instanceToPlain(
    //   plainToInstance(PrefectureResponseDto, paginated.data, {
    //     // @Expose() がないプロパティは全部消える
    //     // 値が undefined or null の場合、キーごと消える
    //     excludeExtraneousValues: true,
    //   }),
    //   // 値が undefined or null の場合、キーごと消える
    //   { exposeUnsetFields: false },
    // ) as PrefectureResponseDto[];

    // 以下でも問題無いが、new PaginatedPrefectureResponseDto()でコンストラクタを使用する。
    //  return {
    //     data: data,
    //     meta: {
    //       totalCount: paginated.meta.totalCount,
    //       page: paginated.meta.page,
    //       size: paginated.meta.size,
    //     },
    //   } satisfies PaginatedRegionResponseDto;

    // read model[] → dto
    // memo:  as PrefectureResponseDto[]は不要(toResposeDto()にて型毎のシグネチャを
    // オーバーライドしているため)
    const data = this.toResponseDto(paginated.data);

    // PaginatedPrefectureResponseDtoに変換
    return new PaginatedPrefectureResponseDto(data, paginated.meta);
  }

  /**
   * 公開中の店舗がある都道府県一覧取得API(店舗数付き)
   * ※ ':id'より前に定義する(ルートの評価順のため)
   *
   * @returns 公開中の店舗がある都道府県一覧
   */
  @Get('covered')
  async findCovered(): Promise<PrefectureResponseDto[]> {
    // 都道府県一覧取得（公開中の店舗がある都道府県）
    const readModels = await this.prefecturesQueryService.findCovered();

    // read model[] → dto
    // memo:  as PrefectureResponseDto[]は不要(toResposeDto()にて型毎のシグネチャを
    // オーバーライドしているため)
    return this.toResponseDto(readModels);
  }

  /**
   * 都道府県詳細取得API(code指定)
   *
   * 指定されたcodeに関連する都道府県情報を取得し、返却します。
   * 存在しない場合は404。
   *
   * @param code 都道府県コード
   * @returns 都道府県情報詳細(コードに関連する)
   */
  @Get('code/:code')
  async findByCode(
    @Param('code') code: string,
  ): Promise<PrefectureResponseDto> {
    // 都道府県情報取得
    const readModel =
      await this.prefecturesQueryService.getDetailByCodeOrThrow(code);
    // read model → dto
    return this.toResponseDto(readModel);
  }

  /**
   * 都道府県詳細取得API(id指定)
   *
   * 都道府県IDに関連する都道府県情報詳細を取得し返却します。
   * 存在しない場合は404。
   *
   * @param id 都道府県ID
   * @returns 都道府県情報詳細(IDに関連する)
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrefectureResponseDto> {
    // 都道府県情報取得
    const readModel =
      await this.prefecturesQueryService.getDetailByIdOrThrow(id);
    // read model → dto
    return this.toResponseDto(readModel);
  }

  /**
   * 都道府県作成API(status: 編集中)（永続化）
   *
   * @param dto 都道府県情報登録対象DTO
   * @param req リクエストパラメータ
   * @returns 都道府県情報登録後のDTO
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() dto: CreatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // DTO → command 変換
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      kanaEn: dto.kanaEn,
      regionCode: dto.regionCode,
    } satisfies CreatePrefectureCommand;

    // 都道府県情報登録（永続化)
    const domain = await this.prefecturesService.create(command, req.user.id);

    // domain → dto
    return this.toResponseDto(domain);
  }

  /**
   * 都道府県の基本情報更新API(掲載中は更新不可)
   *
   * 役割: 基本情報の変更（名称などの書き換え）用のAPI
   *      今はステータスなど、全てのプロパティを更新可能であるが、アクション指向を意識すると
   *      ステータスの状態更新・遷移はそれぞれのuse case毎にエンドポイント、serviceを分けるの
   *      が望ましい。
   *
   * update()の引数(パラメータ)について
   * IDをURLに含め、更新対象をBodyのDTOから取得する（REST標準）
   * NestJS の CLI（nest g resource）などで自動生成すると、以下のパラメータとなる。
   * update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto)
   *
   * @param id 都道府県ID(キー)
   * @param dto 都道府県情報更新対象DTO
   * @param req リクエストパラメータ
   * @returns 都道府県情報更新結果オブジェクト
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrefectureDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // DTO → command 変換
    const command = {
      code: dto.code,
      name: dto.name,
      kanaName: dto.kanaName,
      kanaEn: dto.kanaEn,
      regionCode: dto.regionCode,
    } satisfies UpdatePrefectureCommand;

    // 都道府県情報更新
    const domain = await this.prefecturesService.update(
      id,
      command,
      req.user.id,
    );

    // domain → dto
    return this.toResponseDto(domain);
  }

  /**
   * 都道府県公開API(編集中/停止中 → 掲載中)： publish
   *
   * 指定されたidに関連する都道府県情報のステータスをpublishにします。
   *
   * 拡張例:
   *  reason: 非公開の理由
   *
   * @param id 都道府県ID（更新対象）
   * @param req リクエストパラメータ
   * @returns 都道府県情報更新結果オブジェクト
   */
  @Post('/:id/publish')
  @UseGuards(AuthGuard('jwt'))
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // ステータス更新（永続化）
    const domain = await this.prefecturesService.publish(id, req.user.id);
    // domain → dto
    return this.toResponseDto(domain);
  }

  /**
   * 都道府県非公開API(掲載中/停止中 → 編集中): edit
   *
   * 指定されたidに関連する都道府県情報のステータスをeditにします。
   *
   * 拡張例:
   *  reason: 非公開の理由
   *
   * @param id 都道府県ID（更新対象）
   * @param req リクエストパラメータ
   * @returns 都道府県情報更新結果オブジェクト
   */
  @Post('/:id/unpublish')
  @UseGuards(AuthGuard('jwt'))
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // ステータス更新（永続化）
    const domain = await this.prefecturesService.unpublish(id, req.user.id);

    // domain → dto
    return this.toResponseDto(domain);
  }

  /**
   * 都道府県削除API(論理削除: 停止中にする。店舗が紐づいている場合は不可)
   *
   * 指定されたidに関連する都道府県情報を削除します。（ソフトデリート）
   * 削除された都道府県情報を返却します。
   *
   * @param id 都道府県ID
   * @param req HTTPリクエスト
   * @returns 都道府県情報(削除された)
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<PrefectureResponseDto> {
    // 都道府県情報削除（永続化）
    const domain = await this.prefecturesService.remove(id, req.user.id);

    // domain → dto
    return this.toResponseDto(domain);
  }

  // 以下でもいいしが、よりモダンな実装を目指し、以降のオーバーライド方式に変更のためコメント化。
  /**
   * domain / Read Model → レスポンス(plain object)
   * @Expose()の項目のみ返却し、undefinedの項目(地方未設定など)はレスポンスから省略する
   *
   * 🗒 memo: 返却値の型をunknownの理由
   *          unknownは型が不明。使う側で型を絞り込むかasが必要。このルールを守れば、ESLint
   *          のエラーはでないし、正当なunknownの使い方である。
   *          objectでもいいが、unknown にしたのは「中身の形は呼び出し側で決めてください」
   *          という意図を表すためで、機能の差はほぼありません。
   *
   * @param source 変換元。Application Serviceが返すdomain(Prefecture & { id })、
   *               またはQueryServiceが返すRead Model。配列を渡した場合は配列で変換する
   * @returns PrefectureResponseDtoの@Expose()項目のみを持つplain object(配列を渡した場合はその配列)。
   *          型はunknownのため、呼び出し側でPrefectureResponseDto(または配列)にasして使う
   */
  // private toResponseDto(source: object | object[]): unknown {
  //   // read model → dto
  //   // instanceToPlain()を咬まさないと、DTOのgetter(statusLabelなど)が機能しなかったので追加している。
  //   // plainToInstanceは以下のように配列(readModels[]→dto[])にも使えるよ!!
  //   return instanceToPlain(
  //     plainToInstance(PrefectureResponseDto, source, {
  //       // @Expose() がないプロパティは全部消える
  //       // 値が undefined or null の場合、キーごと消える
  //       excludeExtraneousValues: true,
  //     }),
  //     // 値が undefined or null の場合、キーごと消える
  //     { exposeUnsetFields: false },
  //   );
  // }

  /**
   * domain / Read Model → レスポンス(plain object)
   * @Expose()の項目のみ返却し、undefinedの項目(地方未設定など)はレスポンスから省略する
   *
   * 🗒 memo: オーバーロードにより、上記のunknownの型を返却して、元でasで型指定する実装をやめて
   *          よりモダンな実装を可能にする。（as xxxが複数発生するのを防止）
   *          オーバーロードは、「呼び出し側に見せる型の約束（シグネチャ）」と
   *          「実際の処理（実装）」を分けて書く TypeScript の仕組みです
   *
   *
   * ⭐️ ポイント
   *        ② の実装シグネチャは外から見えません。 呼び出し側が使えるのは ① の2つだけです。
   *        ② は ① の両方を満たすように、入力も出力も和集合（|）で書きます。
   *
   * 変更前
   *  return this.toResponseDto(readModels) as PrefectureResponseDto[];
   *  return this.toResponseDto(domain) as PrefectureResponseDto;
   *
   * 変更後(戻り値の型は引数から自動で決まる)
   *  return this.toResponseDto(readModels); // readModels は配列 → PrefectureResponseDto[]
   *  return this.toResponseDto(domain);     // domain は1件 → PrefectureResponseDto
   *
   * @param source 変換元。Application Serviceが返すdomain(Prefecture & { id })、
   *               またはQueryServiceが返すRead Model。配列を渡した場合は配列で変換する
   * @returns PrefectureResponseDtoの@Expose()項目のみを持つplain object(配列を渡した場合はその配列)。
   *          型はunknownのため、呼び出し側でPrefectureResponseDto(または配列)にasして使う
   */
  // ① オーバーロードのシグネチャ(呼び出し側から見える型の約束)
  private toResponseDto(source: object[]): PrefectureResponseDto[];
  private toResponseDto(source: object): PrefectureResponseDto;

  // ② 実装(呼び出し側からは見えない。①の両方の約束を満たす型で書く)
  private toResponseDto(
    source: object | object[],
  ): PrefectureResponseDto | PrefectureResponseDto[] {
    return instanceToPlain(
      plainToInstance(PrefectureResponseDto, source, {
        excludeExtraneousValues: true,
      }),
      { exposeUnsetFields: false },
    ) as PrefectureResponseDto | PrefectureResponseDto[];
  }
}

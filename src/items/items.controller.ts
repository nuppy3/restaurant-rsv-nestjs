import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
// import type { Item } from './items.model';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest } from 'express';
import { RequestUser } from 'src/types/requestUser';
import { Item } from '../../generated/prisma'; // Prismaのmodel(リレーション)で定義したItem
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  // DI:ItemsService
  constructor(private readonly itemsService: ItemsService) {}

  /**
   * findAll API
   * @returns items: Itemオブジェクトの配列
   */
  @Get()
  async findAll(): Promise<Item[]> {
    return await this.itemsService.findAll();
  }

  /**
   * findByID API
   * ParseUUIDPipeを適用してValidationを実施。
   * @param id ID ItemテーブルのPK(uuid型)
   * @returns Itemオブジェクト
   */
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Item> {
    return await this.itemsService.findById(id);
  }

  /**
   * create API
   *
   * 「@Body()」:リクエストBodyからパラメータを取得→CreateItemDtoにセット
   * @param id ID ItemテーブルのPK(uuid型)
   * @param name 名前
   * @param price 価格
   * @param description 概要
   * @param req httpリクエスト+認証ミドルウェアが追加したユーザー情報（RequestUser型）
   * @returns Itemオブジェクト DBに登録したItemテーブルのデータ
   */
  @Post()
  // Guard機能を使ってJWT認証を適用：JWT認証の実装はAuthModuleにて実施
  // エンドポイント(controller)でJwtStrategyを呼ぶ際に渡す文字列を'jwt'と指定するとJwtModule
  // のJwtStrategyがデフォルトで呼ばれる(正確には’jwt’を指定しているのでPassportがJwtStrategyを正しく見つけられる)
  // NestJS 公式ドキュメントにもストラテジー名を明示（AuthGuard('jwt')）すれば動くと書いてる。
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() createItemDto: CreateItemDto,
    @Request() req: ExpressRequest & { user: RequestUser },
  ): Promise<Item> {
    return await this.itemsService.create(createItemDto, req.user.id);
  }

  /**
   * updateStatus API
   *
   * @param id ItemテーブルのPK(uuid型)
   * @param req httpリクエスト+認証ミドルウェアが追加したユーザー情報（RequestUser型）
   * @returns Itemテーブルの更新結果データ
   */
  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ) {
    return await this.itemsService.updateStatus(id, req.user.id);
  }

  /**
   * delete API
   *
   * @param id ItemテーブルのPK(uuid型)
   */
  // @Delete() は 「このメソッドはHTTPのDELETEリクエストを処理する」 という宣言をするデコレーター。
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: RequestUser },
  ) {
    await this.itemsService.delete(id, req.user.id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
// import { Item } from './items.model';
import { Item, ItemStatus } from '../../generated/prisma'; // Prismaのmodel(リレーション)で定義したItem

@Injectable()
export class ItemsService {
  constructor(private readonly prismaService: PrismaService) {}
  // DBから取得するため削除
  // private items: Item[] = [];

  /**
   * findAll
   * @returns Item[] Itemテーブルのデータ全量
   */
  // ちなみに、findManyについては、Prismaが正確な型推論をしてくれるので、戻り値の型のPromise<Item[]>は
  // 無くても100%推論してくれるそう。
  async findAll(): Promise<Item[]> {
    return await this.prismaService.item.findMany();
    // select句とorder by句の入れ方
    // prisma.contact.findMany({ select: { id:true, name:true, price:true },
    // orderBy: {createdAt: 'desc'} })
  }

  /**
   * findById
   * @param id ItemテーブルのPK(uuid型)
   * @returns Item DBから取得したidに紐づくItemテーブルデータ
   */
  async findById(id: string): Promise<Item> {
    // DBから値を取得するため、削除
    // const resultItem = this.items.find((obj) => obj.id === id);
    // if (!resultItem) {
    //   throw new NotFoundException('TODOが存在しません');
    // }
    const resultItem = await this.prismaService.item.findUnique({
      where: {
        id,
      },
    });

    if (!resultItem) {
      throw new NotFoundException('Itemが存在しません');
    }
    return resultItem;
  }

  /**
   * create
   * @param createItemDto リクエストパラメータ（DB登録対象データ)
   * @param userId 登録ユーザーID
   * @returns Item DBに登録したItemテーブルのデータ
   */
  async create(createItemDto: CreateItemDto, userId: string): Promise<Item> {
    // 以下を削除し、DBへデータを登録するように修正
    // const item: Item = {
    //   // uuidで自動採番
    //   id: uuid(),
    //   ...createItemDto,
    //   status: 'ON_SALE',
    // };
    // this.items.push(item);
    // return item;

    // Dto(リクエストパラメーター)から中身(プロパティ)を取得(分割代入)
    const { name, price, description } = createItemDto;
    // DBに登録
    // Itemモデルに対しての操作は、PrismaService.item.xxxxxを呼び出す。
    // 例：Userモデルに対しての操作： PrismaService.user.xxxx
    // 備考：id, createdAt, updatedAt は、modelにてデフォルト値(@default)や設定値を
    //      設定しているので、以下の実装には不要
    return await this.prismaService.item.create({
      // id: string;
      // name: string;
      // price: number;
      // description: string | null;
      // status: $Enums.ItemStatus;
      // createdAt: Date;
      // updatedAt: Date;
      // userId: string;
      // Insert対象のデータ
      data: {
        name,
        price,
        description,
        status: ItemStatus.ON_SALE,
        userId,
      },
    });
  }

  /**
   * updateStatus
   * @param id ItemテーブルのPK(uuid型)
   * @param userId ユーザーID（bearerトークンのpayloadから取得したuserId)
   * @returns Item Itemテーブルの更新結果データ
   */
  async updateStatus(id: string, userId: string): Promise<Item> {
    return await this.prismaService.item.update({
      data: { status: 'SOLD_OUT', userId }, // update対象のデータ
      where: { id }, // 条件（idがイコール）
    });
  }

  /**
   * Delete
   * @param id  ItemテーブルのPK(uuid型)
   * @param userId ユーザーID（bearerトークンのpayloadから取得したuserId)
   */
  async delete(id: string, userId: string): Promise<void> {
    // DB情報に切り替えるため削除
    // this.items = this.items.filter((obj) => obj.id !== id);
    await this.prismaService.item.delete({
      where: {
        id,
        userId,
      },
    });
  }
}

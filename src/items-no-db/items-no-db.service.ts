import { Injectable, NotFoundException } from '@nestjs/common';
import { Item } from './item-no-db.model';

@Injectable()
export class ItemsNoDbService {
  // Itemオブジェクト配列
  private items: Item[] = [];

  findAll(): Item[] {
    return this.items;
  }

  findById(id: string): Item {
    const resultItem = this.items.find((item) => item.id === id);
    if (!resultItem) {
      throw new NotFoundException('TODOが存在しません');
    }
    return resultItem;
  }

  create(item: Item): Item {
    this.items.push(item);
    return item;
  }

  updateStatus(id: string) {
    const item = this.findById(id);
    item.status = 'SOLD_OUT';
    return item;
  }

  delete(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import type { Item } from './item-no-db.model';
import { ItemsNoDbService } from './items-no-db.service';

@Controller('items-no-db')
export class ItemsNoDbController {
  constructor(private readonly itemsNoDbService: ItemsNoDbService) {}

  @Get()
  findAll(): Item[] {
    return this.itemsNoDbService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): Item {
    return this.itemsNoDbService.findById(id);
  }

  @Post()
  create(
    @Body('id') id: string,
    @Body('name') name: string,
    @Body('price') price: number,
    @Body('description') description: string,
  ): Item {
    const item: Item = {
      id,
      name,
      price,
      description,
      status: 'ON_SALE',
    };
    return this.itemsNoDbService.create(item);
  }

  @Put(':id')
  update(@Param('id') id: string) {
    return this.itemsNoDbService.updateStatus(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemsNoDbService.delete(id);
  }
}

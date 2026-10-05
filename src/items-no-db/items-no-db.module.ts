import { Module } from '@nestjs/common';
import { ItemsNoDbService } from './items-no-db.service';
import { ItemsNoDbController } from './items-no-db.controller';

@Module({
  controllers: [ItemsNoDbController],
  providers: [ItemsNoDbService],
})
export class ItemsNoDbModule {}

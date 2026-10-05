/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  // Prismaを使用するため追加 nushi add
  // 認証を行うため、自作のAuthMoculeを追加
  imports: [PrismaModule, AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}

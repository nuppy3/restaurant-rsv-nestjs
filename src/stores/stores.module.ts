/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrefecturesModule } from '../prefectures/prefectures.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  // Prismaを使用するため追加 nushi add
  // 認証を行うため、自作のAuthMoculeを追加
  imports: [PrismaModule, AuthModule, PrefecturesModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}

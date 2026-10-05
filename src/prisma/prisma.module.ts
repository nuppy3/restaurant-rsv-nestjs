/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  // 外部呼び出しの許可 nushi add
  exports: [PrismaService],
})
export class PrismaModule {}

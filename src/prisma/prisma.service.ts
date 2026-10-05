import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

/**
 * PrismaServiceは以下のPrismaドキュメントのサンプルコードをコピーしている。
 * サンプルコードはそのままで、PrismaClientのimport文を修正しているだけ。
 *
 * url:https://docs.nestjs.com/recipes/prisma#use-prisma-client-in-your-nestjs-services
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // onModuleInitはDBとの接続を確立するメソッド
  // このメソッドを通じて、アプリケーション起動時にDB接続が確立される
  async onModuleInit() {
    await this.$connect();
  }
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
// swqggrのAPIドキュメント生成用パッケージ
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORSの設定(FEからのアクセスを許可)
  app.enableCors();
  // app.enableCors({
  //   origin: ['http://example.com:1234'],
  //   methods: ['GET', 'POST'],
  // });
  // nushi add: class validationをグローバルに適用
  // transform: trueにすることで、controllerへのパラメータに対して型変換を行う。
  // 例： Dtoに@Type(() => Number とするとstring → number に自動変換される
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 🔹 Swagger 設定
  const config = new DocumentBuilder()
    .setTitle('My API：Fleamarket API')
    .setDescription('NestJS APIドキュメント(フリーマーケットAPI)')
    .setVersion('1.0.0')
    .addServer('http://localhost:4000') // ← NestJS API のポート(Docusaurusはデフォルト3000になるので)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // --- (1) Nestアプリ内でSwagger UIを提供 ---
  SwaggerModule.setup('api-docs', app, document);

  // --- (2) Docusaurus用にswagger.jsonを静的ファイルとして出力 ---
  // ※このファイルをDocusaurusの `static/swagger.json` にコピー or CIで自動反映
  writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  console.log('✅ Swagger JSON exported to ./swagger.json');

  // ポートを3000→4000に変更
  await app.listen(process.env.PORT ?? 4000);
  console.log(`🚀 Application is running on: http://localhost:4000`);
  console.log(`📘 Swagger UI available at: http://localhost:4000/api-docs`);

  // http://localhost:4000/graphql
  console.log(`📘 GraphQL UI Starts at: http://localhost:4000/graphql`);
}

bootstrap();

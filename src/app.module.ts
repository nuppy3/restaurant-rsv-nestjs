import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { DomainExceptionFilter } from './common/presentation/filters/domain-exception.filter';
import { ItemsNoDbModule } from './items-no-db/items-no-db.module';
import { ItemsModule } from './items/items.module';
import { PrefecturesModule } from './prefectures/prefectures.module';
import { RegionsModule } from './regions/regions.module';
import { StoresModule } from './stores/stores.module';
import { TodoItemsModule } from './todo-items/todo-items.module';

@Module({
  // featureモジュール(子モジュール)、外部モジュールの登録
  // 例：
  // nest.jsのlib（service)を使う場合もimportsに追加するだけ
  // providersに登録不要
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // GraphQLモジュール（ApolloServierを使用）
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: false, // 非推奨の古いPlaygroundは明示的に無効化
      graphiql: true, // 代わりにNestJS公式のGraphQL UIを使う
      // コードファーストの際に自動生成されるスキーマファイルのパスを設定
      //  process.cwd()はノードが実行されるフルパスが返るので ＋ /src/schema.gqlで絶対パスを生成
      //  join()は配列のすべての要素を指定した区切り文字（セパレータ）で結合
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      // Code Firstで自動生成されるschema.gql内の型定義をアルファベット順に並べ替える設定
      // 不要であれば消す
      sortSchema: true,
    }),
    ItemsModule,
    TodoItemsModule,
    ItemsNoDbModule,
    AuthModule,
    StoresModule,
    PrefecturesModule,
    RegionsModule,
  ],
  // コントローラー
  controllers: [],
  // DI対象
  // NestJSでのDomainExceptionFilterのグローバル設定(main.tsでの設定も可能であるが、
  // app.module.tsでの設定がよい)
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter, // 自作のフィルターを指定
    },
  ],
})
export class AppModule {}

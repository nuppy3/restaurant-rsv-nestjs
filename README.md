<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Preparation for environment construction 
### .envファイルの設定

```bash
$ vi .env

# 以下を追加
DATABASE_URL="postgresql://ユーザー名:パスワード@localhost:5432/データベース名"
JWT_SECRET="ランダムな文字列"
```

#### DATABASE_URLの設定内容
- ユーザー名: docker-compose.ymlのpostgres/environmentのPOSTGRES_USERの値
- パスワード: docker-compose.ymlのpostgres/environmentのPOSTGRES_PASSWORDの値
- データベース名: docker-compose.ymlのpostgres/environmentのPOSTGRES_DBの値

#### JWT_SECRET:秘密鍵の生成方法
opensslコマンドを使用し、秘密鍵を作成する
opensslコマンド：SSL/TLS通信の証明書作成、秘密鍵・公開鍵の管理、データの暗号化・復号化など、様々な暗号化関連の操作を行うためのコマンド

```bash
$ openssl rand -hex 32

# 以下のようなランダムな文字列が出力されるのでコピーして.envにセット
78da1d5d5cf074z0901111b9w47xa96c2gghb13c3a52725664981r889258914c
```

## Project setup
依存関係のインストール

```bash
$ npm install
```

## DB setup (Docker:postgres、TBL作成、Prismaクライアント生成など)
- Docker Desktop を起動し、Dockerデーモンを立ち上げる
- docker-composeにて、postgresコンテナを立ち上げる
```bash
$ docker compose up -d
```
- DB作成 (schema.prismaを元にDBマイグレーション）
```bash
$ npx prisma migrate dev
```
- Prismaクライアントの生成
```bash
$ npx prisma generate
```

## Compile and run the project
rootディレクトリにて以下を実行する

```bash
# watch mode
# npm run start:dev は 開発モードでの自動再起動付き実行（--watch付き）
$ npm run start:dev

# development
$ npm run start

# production mode
# npm run build + npm run startと同意
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
## Swagger UI / Docusaurus
### ローカル環境

```bash
# npm run start:dev 実施後、swagger.jsonが出力されるのでdocs/static配下にコピー
cp swagger.json docs/static/swagger.json

# Docusaurus ドキュメント起動
cd docs
npm run star

# Swagger UI URL
http://localhost:3000/nestjs-fleamarket/api
```


### 本番環境 GitHub Pages

```bash
cd docs
npm run build 　　　#ビルドを実行：build/ フォルダ作成し、静的ファイル生成 （省略可）
npm run deploy 　　 #ビルド実行 ＋ GitHub Pages へ自動デプロイ 

# Swagger UI URL
https://nuppy3.github.io/nestjs-fleamarket/api

```

## GraphQL

`npm run start:dev`実施後、ブラウザで以下にアクセスするとGraphiQL UI(クエリを実際に試せる画面)が開く。

```
http://localhost:4000/graphql
```

Code First方式のため、スキーマ定義(`src/schema.gql`)はアプリ起動時に自動生成される(手動編集不可、`DO NOT MODIFY`コメント付き)。

現在実装済みのQuery:
- `regions`: エリア情報一覧(ページネーション化)

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# nestjs-fleamarket

### NestJSを使用したフリーマーケットAPIプロジェクト（ItemのCRUD）

DBを使用した/items、DBを使用していない/items-no-db、フリーマケット以外のtodo管理管理ようの/todo-itemsなどが含まれる。

/itemsについては、[Prisma](https://www.prisma.io/docs/orm)を使用してPostgresSQLにアクセスしている。  
また、/itemsのAPIを利用する際、create、updateStatus、deleteについては、Jwt認証を行なっている。（/authにて、認証処理を行なっている）

## アーキテクチャ・技術的な特徴

設計・実装パターンの学習を目的に、以下のような技術要素を取り入れている。

- **DDD(ドメイン駆動設計)**: `regions`モジュールはDomain層(Entity/Factory/Repository Port)・Application層(Command)・Infrastructure層まで含めたフルDDD構成。`prefectures`/`stores`は、MVC3層にドメイン概念を加えた「DDD-Lite」構成で、両者を意図的に比較できる設計にしている
- **CQRS(コマンドクエリ責務分離)**: 更新系(`RegionsService`)と参照系(`RegionsQueryService`)のServiceを分離し、参照系は画面都合のRead Modelを返却する
- **REST + GraphQLの並存**: 同一のApplication/Domain/Query層をRESTコントローラーとGraphQL Resolverの両方から利用し、プレゼンテーション層だけをAPI方式ごとに切り替える構成
- **Prisma + PostgreSQL**: スキーマ駆動のDBマイグレーション、型安全なクエリ構築
- **JWT認証**: 全てのcreate・updateStatus・deleteなど、更新系APIに認証を適用

＜URL＞

- REST API: http://localhost:4000
- Swagger UI: http://localhost:4000/api-docs
- GraphQL (GraphiQL): http://localhost:4000/graphql

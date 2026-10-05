# restaurant-rsv-nestjs

レストラン予約サイトのバックエンドAPI(NestJS)。

フロントエンド restaurant-rsv-cowork-nextjs(Next.js)から呼び出すAPIを提供する。
DDD学習用リポジトリ [nestjs-fleamarket](https://github.com/nuppy3/nestjs-fleamarket) をベースに、フリマ固有のモジュール(items等)を除き、汎用的な店舗マスタ(Region/Prefecture/Store)を引き継いで開発している。

## 環境構築

### 1. .envファイルの設定

```bash
$ vi .env

# 以下を追加
DATABASE_URL="postgresql://ユーザー名:パスワード@localhost:5433/データベース名"
JWT_SECRET="ランダムな文字列"
STORE_DEFAULT_PAGE_SIZE="20"
STORE_DEFAULT_PAGE="1"
PREFECTURE_DEFAULT_PAGE_SIZE="20"
PREFECTURE_DEFAULT_PAGE="1"
REGION_DEFAULT_PAGE_SIZE="20"
REGION_DEFAULT_PAGE="1"
```

#### DATABASE_URLの設定内容
- ユーザー名: docker-compose.ymlのpostgres/environmentのPOSTGRES_USERの値
- パスワード: docker-compose.ymlのpostgres/environmentのPOSTGRES_PASSWORDの値
- データベース名: docker-compose.ymlのpostgres/environmentのPOSTGRES_DBの値
- ポート: docker-compose.ymlのportsのホスト側の値(`5433`)

#### JWT_SECRET:秘密鍵の生成方法
opensslコマンドでランダムな文字列を生成し、.envにセットする

```bash
$ openssl rand -hex 32
```

### 2. 依存関係のインストール

```bash
$ npm install
```

### 3. DBのセットアップ

```bash
# Postgresコンテナ起動(Docker Desktopを起動しておくこと)
$ docker compose up -d

# schema.prismaの内容をDBに反映(Prismaクライアントも生成される)
$ npx prisma db push

# 初期データ投入(地方8件・都道府県47件・店舗10件・seedユーザー1件)
$ npx prisma db seed
```

- Postgresコンテナはプロジェクト専用(`restaurant-rsv-postgres`、ホスト側ポート`5433`)。nestjs-fleamarketのコンテナ(`postgres`、`5432`)と同時に起動できる
- seedはupsertのため何度実行しても同じ結果になる。DBを初期状態に戻す場合は `npx prisma db push --force-reset && npx prisma db seed`
- seedデータの定義は `prisma/seed.ts` と `prisma/seed-data/` 配下
- 開発用のseedユーザー: `seed@example.com` / `Passw0rd!`(環境変数 `SEED_USER_PASSWORD` で変更可)

#### DB運用方針(db push)

開発初期はスキーマ変更が頻繁なため、マイグレーション履歴を持たない `prisma db push` で運用する。
スキーマが固まり本番デプロイ(Docker/EKS)に入る段階で、その時点のスキーマを `0_init` としてbaseline化し、`prisma migrate` 運用に切り替える。

### 4. 起動

```bash
# watch mode
$ npm run start:dev

# production mode
$ npm run build && npm run start:prod
```

| 用途 | URL |
| --- | --- |
| REST API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/api-docs |
| GraphQL (GraphiQL) | http://localhost:4000/graphql |

GraphQLはCode First方式のため、スキーマ定義(`src/schema.gql`)はアプリ起動時に自動生成される(手動編集不可)。

現在実装済みのQuery:
- `regionsPaginated`: エリア情報一覧(ページネーション化)

## テスト

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov
```

## APIドキュメント(Docusaurus)

```bash
# npm run start:dev 実施後に出力される swagger.json を docs/static 配下にコピー
$ cp swagger.json docs/static/swagger.json

# ローカル起動
$ cd docs && npm install && npm run start
# Swagger UI: http://localhost:3000/restaurant-rsv-nestjs/api

# GitHub Pages へデプロイ(ビルド + gh-pagesブランチへのpush)
$ cd docs && npm run deploy
# Swagger UI: https://nuppy3.github.io/restaurant-rsv-nestjs/api
```

## アーキテクチャ

- **DDD(ドメイン駆動設計)**: `regions` モジュールは Domain層(Entity/Factory/Repository Port)・Application層(Command)・Infrastructure層まで含めたフルDDD構成。`prefectures` / `stores` は MVC3層にドメイン概念を加えた「DDD-Lite」構成(Step1でフルDDD化する)
- **CQRS(コマンドクエリ責務分離)**: 更新系(`RegionsService`)と参照系(`RegionsQueryService`)のServiceを分離し、参照系は画面都合のRead Modelを返却する
- **REST + GraphQLの並存**: 同一のApplication/Domain/Query層をRESTコントローラーとGraphQL Resolverの両方から利用し、プレゼンテーション層だけをAPI方式ごとに切り替える
- **Prisma + PostgreSQL**: 型安全なクエリ構築
- **JWT認証**: create・update・deleteなど、更新系APIに認証を適用(`/auth`)

## ロードマップ

- **Step1**: Region のフルDDDパターン(Command / Props / Factory / Repository Port / 層境界での明示的な変換)を土台に、Prefecture → Store の順にフルDDD化する。あわせて Store をレストランの店舗情報として整理し、予約・席・時間帯などのドメインを追加する
- **Step2**: restaurant-rsv-nestjs と restaurant-rsv-cowork-nextjs を1つのモノレポに統合する。ただし密結合にはしない
  - FE/BE はディレクトリを分け、それぞれ独立した Dockerfile を持つ
  - 個別にビルドし、個別のコンテナ(例: AWS EKS 上の別Pod)としてデプロイできるようにする
  - モノレポ化の目的はソースツリーの一体管理と横断変更のしやすさであり、デプロイ単位の統合ではない

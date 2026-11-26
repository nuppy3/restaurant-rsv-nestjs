import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CityStatus } from '../src/cities/domain/cities.model';
import {
  CityPaginationMetaDto,
  CityResponseDto,
  CityTreeResponseDto,
  PaginatedCityResponseDto,
} from '../src/cities/presentation/rest/dto/city.dto';

describe('■■■ Cities API (e2e) ■■■', () => {
  // テストで起動する Nest のアプリを入れておく変数
  let app: INestApplication<App>;

  // ポイント：
  // createNestApplication() は main.ts を通らないので、ValidationPipe を自分で付けます。
  // 付けないと、400 のテストが通りません。
  beforeAll(async () => {
    // ①テスト用のモジュールを組み立てる(DI コンテナを作る)
    // 本物の AppModule でアプリ(テスト用モジュール)を組み立てる
    // (モックは使わない。DB は .env.test の e2e 用 DB)
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // ②createNestApplication():
    // テスト用に組み立てたモジュールから、本物の Nest アプリ（HTTP サーバー付き）を作る
    app = moduleRef.createNestApplication();

    // ③設定を足して、起動の準備をする
    // main.ts の設定は自動では入らないので、同じものをここで付ける
    // → class validationをグローバルに適用
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    // DB 接続などを閉じる(閉じないと jest が終わらない)
    await app.close();
  });

  //---------------------------------------------
  // GET /cities TEST(findAllPaginated)
  //---------------------------------------------
  describe('GET /cities', () => {
    it('正常系： ページネーション化された都市一覧がsortOrdr順(asc)で返却されること', async () => {
      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath
        .get('/cities')
        // ③ ステータス検証
        .expect(200);

      // res.body は any 型なので、as でlintエラー防止
      const body = res.body as PaginatedCityResponseDto;
      // 1. ルートが配列で、期待する件数（8都市）であること
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(8);

      // 2. body 検証
      // toMatchObject: 期待値に書いた項目だけを比べる(書いていない項目は無視)
      // 配列は件数・並び順も一致する必要がある(8件・sortOrder 順の検証にもなる)
      expect(res.body as PaginatedCityResponseDto).toMatchObject(
        createExpectedPaginatedCityResponseDto(),
      );
    });

    // ?page=2&size=3 で3件(code 004〜006)	skip / take の計算
    it('正常系： クエリーパラメーターの通り、ページネーション化された都市一覧が返却されること', async () => {
      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath
        .get('/cities')
        // クエリパラメータ(GET /cities?page=2&size=3になる)
        // 🗒パスに直接書いても同じ意味（.get('/cities?page=2&size=3')）
        .query({ page: 2, size: 3 })
        // ③ ステータス検証
        .expect(200);

      // res.body は any 型なので、as でlintエラー防止
      const body = res.body as PaginatedCityResponseDto;
      // 検証：ルートが配列で、期待する件数（8都市）であること
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(3);

      // 期待値作成: body
      const expecetedCityDto = createExpectedCityResponseDto().slice(3, 6);

      // 検証: body
      expect(res.body as PaginatedCityResponseDto).toMatchObject(
        createExpectedPaginatedCityResponseDto(expecetedCityDto, {
          page: 2,
          size: 3,
        }),
      );
    });

    // ?size=0・?page=0・?size=abc で 400(it.each)	ValidationPipe(UT では動かない)
  });

  //---------------------------------------------
  // GET /cities/tree TEST
  //---------------------------------------------
  describe('GET /cities/tree', () => {
    it('正常系： 公開中の都市一覧(districts付き全項目)がsortOrdr順(asc)で返却されること', async () => {
      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath
        .get('/cities/tree')
        // ③ ステータス検証
        .expect(200);

      // res.body は any 型なので、as でlintエラー防止
      const body = res.body as CityTreeResponseDto;

      // 1. ルートが配列で、期待する件数（8都市）であること
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(8);

      // 2. 先頭要素（東京）とその配下 districts の検証
      // 🗒以下の様にチクチク検証もありだけど、やっぱ、サクッと検証したいのでコメント
      //
      // const tokyo = body[0];
      // expect(tokyo).toMatchObject({
      //   code: '001',
      //   name: '東京',
      //   kanaName: 'トウキョウ',
      //   slug: 'tokyo',
      //   status: 'published',
      //   sortOrder: 1,
      // });

      // expect(tokyo.districts).toHaveLength(7);
      // if (!tokyo.districts) {
      //   return;
      // }
      // expect(tokyo.districts[0]).toEqual({
      //   id: expect.any(String) as string,
      //   code: '00001',
      //   name: '銀座',
      //   slug: 'ginza',
      //   sortOrder: 1,
      // });
      // expect(tokyo.districts.map((d) => d.name)).toEqual([
      //   '銀座',
      //   '恵比寿',
      //   '広尾',
      //   '代官山',
      //   '六本木',
      //   '神楽坂',
      //   '渋谷',
      // ]);

      // 2. body 検証 ⭐️現状、東京以外はdistricts無し
      // toMatchObject: 期待値に書いた項目だけを比べる(書いていない項目は無視)
      // 配列は件数・並び順も一致する必要がある(8件・sortOrder 順の検証にもなる)
      expect(res.body as CityTreeResponseDto[]).toMatchObject(
        createExpectedCityTreeDto(),
      );
    });
  });
});

/**
 * 期待値：City Response DTO (CityResponseDto) [] 作成 ※findAllPaginated()用
 *
 * ※id・prefectureId は seed 実行時に DB で決まる UUID のため、値ではなく
 * 「文字列であること」だけを検証する
 *
 * @returns City Response DTO []
 */
const createExpectedCityResponseDto = (): CityResponseDto[] =>
  [
    // 東京
    {
      // id・prefectureId は seed 実行時に DB で決まる UUID のため、値ではなく「文字列であること」だけを検証する
      id: expect.any(String) as string,
      code: '001',
      name: '東京',
      kanaName: 'トウキョウ',
      slug: 'tokyo',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 1,
      // 文字列であることの検証
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 大阪
    {
      id: expect.any(String) as string,
      code: '002',
      name: '大阪',
      kanaName: 'オオサカ',
      slug: 'osaka',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 2,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 京都
    {
      id: expect.any(String) as string,
      code: '003',
      name: '京都',
      kanaName: 'キョウト',
      slug: 'kyoto',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 3,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 名古屋
    {
      id: expect.any(String) as string,
      code: '004',
      name: '名古屋',
      kanaName: 'ナゴヤ',
      slug: 'nagoya',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 4,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 横浜
    {
      id: expect.any(String) as string,
      code: '005',
      name: '横浜',
      kanaName: 'ヨコハマ',
      slug: 'yokohama',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 5,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 福岡
    {
      id: expect.any(String) as string,
      code: '006',
      name: '福岡',
      kanaName: 'フクオカ',
      slug: 'fukuoka',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 6,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 札幌
    {
      id: expect.any(String) as string,
      code: '007',
      name: '札幌',
      kanaName: 'サッポロ',
      slug: 'sapporo',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 7,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // 沖縄
    {
      id: expect.any(String) as string,
      code: '008',
      name: '沖縄',
      kanaName: 'オキナワ',
      slug: 'okinawa',
      status: CityStatus.PUBLISHED,
      statusLabel: '反映中',
      sortOrder: 8,
      prefectureId: expect.any(String) as string,
    } satisfies CityResponseDto,
    // {} satisfies CityTreeReadModel,
  ] satisfies CityResponseDto[];

/**
 * 期待値：Paginated City Response DTO (PaginatedCityResponseDto) [] 作成 ※findAllPaginated()用
 *
 * ※id・prefectureId は seed 実行時に DB で決まる UUID のため、値ではなく
 * 「文字列であること」だけを検証する
 *
 * @param overrides 項目の上書きパラメーター
 * @returns Paginated City Response DTO []
 */
const createExpectedPaginatedCityResponseDto = (
  dto?: CityResponseDto[],
  overrides: Partial<{ page: number; size: number }> = {},
): PaginatedCityResponseDto => {
  if (!dto) {
    dto = createExpectedCityResponseDto();
  }

  console.log('createExpectedPaginatedCityResponseDto: return DTO =>', {
    data: dto,
    meta: {
      totalCount: 8,
      page: 1,
      size: 20,
      ...overrides,
    } satisfies CityPaginationMetaDto,
  } satisfies PaginatedCityResponseDto);

  return {
    data: dto,
    meta: {
      totalCount: 8,
      page: 1,
      size: 20,
      ...overrides,
    } satisfies CityPaginationMetaDto,
  } satisfies PaginatedCityResponseDto;
};

/**
 * 期待値：City Tree Response DTO (CityTreeResponseDto) [] 作成 ※findTree()用
 *
 * ※id・prefectureId は seed 実行時に DB で決まる UUID のため、値ではなく
 * 「文字列であること」だけを検証する
 *
 * @returns City Tree Response DTO []
 */
const createExpectedCityTreeDto = (): CityTreeResponseDto[] =>
  [
    // 東京
    {
      // id・prefectureId は seed 実行時に DB で決まる UUID のため、値ではなく「文字列であること」だけを検証する
      id: expect.any(String) as string,
      code: '001',
      name: '東京',
      kanaName: 'トウキョウ',
      slug: 'tokyo',
      status: CityStatus.PUBLISHED,
      sortOrder: 1,
      // 文字列であることの検証
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [
        {
          // 文字列であることの検証
          id: expect.any(String) as string,
          code: '00001',
          name: '銀座',
          slug: 'ginza',
          sortOrder: 1,
        },
        {
          id: expect.any(String) as string,
          code: '00002',
          name: '恵比寿',
          slug: 'ebisu',
          sortOrder: 2,
        },
        {
          id: expect.any(String) as string,
          code: '00003',
          name: '広尾',
          slug: 'hiroo',
          sortOrder: 3,
        },
        {
          id: expect.any(String) as string,
          code: '00004',
          name: '代官山',
          slug: 'daikanyama',
          sortOrder: 4,
        },
        {
          id: expect.any(String) as string,
          code: '00005',
          name: '六本木',
          slug: 'roppongi',
          sortOrder: 5,
        },
        {
          id: expect.any(String) as string,
          code: '00006',
          name: '神楽坂',
          slug: 'kagurazaka',
          sortOrder: 6,
        },
        {
          id: expect.any(String) as string,
          code: '00007',
          name: '渋谷',
          slug: 'shibuya',
          sortOrder: 7,
        },
      ],
    } satisfies CityTreeResponseDto,
    // 大阪
    {
      id: expect.any(String) as string,
      code: '002',
      name: '大阪',
      kanaName: 'オオサカ',
      slug: 'osaka',
      status: CityStatus.PUBLISHED,
      sortOrder: 2,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 京都
    {
      id: expect.any(String) as string,
      code: '003',
      name: '京都',
      kanaName: 'キョウト',
      slug: 'kyoto',
      status: CityStatus.PUBLISHED,
      sortOrder: 3,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 名古屋
    {
      id: expect.any(String) as string,
      code: '004',
      name: '名古屋',
      kanaName: 'ナゴヤ',
      slug: 'nagoya',
      status: CityStatus.PUBLISHED,
      sortOrder: 4,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 横浜
    {
      id: expect.any(String) as string,
      code: '005',
      name: '横浜',
      kanaName: 'ヨコハマ',
      slug: 'yokohama',
      status: CityStatus.PUBLISHED,
      sortOrder: 5,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 福岡
    {
      id: expect.any(String) as string,
      code: '006',
      name: '福岡',
      kanaName: 'フクオカ',
      slug: 'fukuoka',
      status: CityStatus.PUBLISHED,
      sortOrder: 6,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 札幌
    {
      id: expect.any(String) as string,
      code: '007',
      name: '札幌',
      kanaName: 'サッポロ',
      slug: 'sapporo',
      status: CityStatus.PUBLISHED,
      sortOrder: 7,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // 沖縄
    {
      id: expect.any(String) as string,
      code: '008',
      name: '沖縄',
      kanaName: 'オキナワ',
      slug: 'okinawa',
      status: CityStatus.PUBLISHED,
      sortOrder: 8,
      prefectureId: expect.any(String) as string,
      // 地区[]
      districts: [],
    } satisfies CityTreeResponseDto,
    // {} satisfies CityTreeReadModel,
  ] satisfies CityTreeResponseDto[];

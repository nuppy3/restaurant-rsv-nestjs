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
      // test対象API呼び出し
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
      // test対象API呼び出し
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
    // $testCase: it.each にオブジェクトの行を渡すと、テスト名の $xxx に行の値が入る
    it.each([
      { testCase: 'size が最小値(1)未満', query: { size: 0 }, field: 'size' },
      { testCase: 'page が最小値(1)未満', query: { page: 0 }, field: 'page' },
      { testCase: 'size が数値でない', query: { size: 'abc' }, field: 'size' },
    ])(
      '異常系： $testCase の場合、400(Bad Request)が返却されること',
      async ({ query, field }) => {
        // test対象API呼び出し
        // ValidationPipe が FindAllCityQueryDto のチェックで弾くので、Controller は呼ばれない
        const res = await request(app.getHttpServer())
          .get('/cities')
          .query(query)
          .expect(400);

        // 検証: ValidationPipe のエラー形式({ statusCode, message: string[], error })で、
        // 違反した項目名がメッセージに含まれること(どの項目で弾かれたかの確認)
        const body = res.body as { statusCode: number; message: string[] };
        expect(body.statusCode).toBe(400);
        expect(body.message).toEqual(
          expect.arrayContaining([expect.stringContaining(field)]),
        );
      },
    );
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

  //---------------------------------------------
  // GET /cities/code/:code TEST(findByCode)
  //---------------------------------------------
  describe('GET /cities/code/:code', () => {
    // 001 で東京(statusLabel・prefectureName 付き)
    it('正常系： code に紐づく都市の詳細が返却されること', async () => {
      // パラメーター
      const code = '001';

      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath(GET /cities/code/:code の :code に '001' を入れる)
        // .get('/cities/code/001')
        .get(`/cities/code/${code}`)
        // ③ ステータス検証
        .expect(200);

      // res.body は any 型なので、as でlintエラー防止
      const body = res.body as CityResponseDto;

      // 検証: body
      // toMatchObject: 期待値に書いた項目だけを比べる(書いていない項目は無視)
      expect(body).toMatchObject(
        createExpectedPaginatedCityResponseDto().data.find(
          (cityDto) => cityDto.code === code,
        )!,
      );
    });

    // code/999 で 404	例外 → HTTP 404
    it('異常系： 不正パラメーターのため、該当する都市が存在しないエラー(404)が発生すること', async () => {
      // パラメーター
      const code = '999';

      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath
        // .get('/cities/code/999')
        .get(`/cities/code/${code}`)
        // ③ ステータス検証
        .expect(404);

      // 検証: ValidationPipe のエラー形式({ statusCode, message: string[], error })で、
      // 違反した項目名がメッセージに含まれること(どの項目で弾かれたかの確認)
      const body = res.body as { statusCode: number; message: string[] };
      expect(body.statusCode).toBe(404);
      expect(body.message).toEqual(
        `codeに関連する都市情報が存在しません!! code: ${code}`,
      );
    });
  });

  //---------------------------------------------
  // GET /cities/:id TEST(findOne)
  //---------------------------------------------
  describe('GET /cities/:id', () => {
    // 東京の id(seed 実行時に DB で採番されるため、固定値では書けない)
    const tokyoCode = '001';
    let tokyoId: string;
    const NOT_EXIST_ID = '8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

    // 前準備: code(seed で固定の '001')から、東京の id を取得しておく
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/cities/code/${tokyoCode}`)
        .expect(200);
      tokyoId = (res.body as CityResponseDto).id;
    });

    // 001 で東京(statusLabel・prefectureName 付き)
    it('正常系： id に紐づく都市の詳細が返却されること', async () => {
      // test対象API呼び出し
      // HTTP サーバーにリクエストを送って、レスポンスを検証するためのテスト用ライブラリ
      // ① request(app.getHttpServer()): どのサーバーに送るか
      const res = await request(app.getHttpServer())
        // ② メソッドとPath(GET /cities/code/:code の :code に '001' を入れる)
        // .get('/cities/code/001')
        .get(`/cities/${tokyoId}`)
        // ③ ステータス検証
        .expect(200);

      // res.body は any 型なので、as でlintエラー防止
      const body = res.body as CityResponseDto;

      // 期待値作成： body
      // ⭐️このコードいいね： dto[]からdtoを取得して、...dtoで{}にdtoを展開して、idを上書き
      // 期待値作成： body(東京の期待値を取り出し、id だけ API で取得した値に差し替える)
      const expectedCityDto = {
        ...createExpectedCityResponseDto().find(
          (cityDto) => cityDto.code === tokyoCode,
        )!,
        id: tokyoId,
      };

      // 検証: body
      // toMatchObject: 期待値に書いた項目だけを比べる(書いていない項目は無視)
      expect(body).toMatchObject(expectedCityDto);
    });

    it('異常系： 存在しない id(UUID 形式)の場合、404(Not Found)が返却されること', async () => {
      await request(app.getHttpServer())
        .get(`/cities/${NOT_EXIST_ID}`)
        .expect(404);

      // 🗒e2eでmessageまでは検証しなくていいか。UTでやってるし。
      //
      // const body = res.body as { statusCode: number; message: string[] };
      // expect(body.statusCode).toBe(404);
      // expect(body.message).toEqual(
      //   `idに関連する都市情報が存在しません!! id: ${NOT_EXIST_ID}`,
      // );
    });

    it('異常系： id が UUID 形式でない場合、400(Bad Request)が返却されること', async () => {
      // ParseUUIDPipe が弾くので、QueryService は呼ばれない(UT では確認できなかった部分)
      await request(app.getHttpServer()).get('/cities/abc').expect(400);
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

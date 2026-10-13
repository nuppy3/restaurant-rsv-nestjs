// City domain(Entity)のテスト
// domainはDBやPrisma、NestJSのDIに依存しない純粋なクラスなので、モックもDIも不要。
// domainを作って、メソッドを呼んで、状態(プロパティ)や例外を検証するだけでテストできる。

import { CityFactory } from './cities.factory';
import {
  City,
  CityState,
  CityStatus,
  CreateCityProps,
  ReconstituteCityProps,
  UpdateCityProps,
} from './cities.model';
import {
  CityAlreadyEditedException,
  CityAlreadyPublishedException,
  CityAlreadySuspendedException,
} from './errors/cities.exceptions';

// ※ テストで使う共通データ(prefectureID など)とヘルパー(buildCity)はファイル末尾に定義している
describe('■■■ City Domain Test ■■■', () => {
  // -----------------------------
  // createNew() test
  // -----------------------------
  // createNew: 新規作成用のファクトリーメソッド。statusと日付はdomainの中で決まる
  describe('------ createNew() test ------', () => {
    it('正常系: statusが編集中(editing)、createdAt/updatedAtが作成時刻で生成されること', () => {
      // 実行直前の時刻を記録しておく
      // (createdAt / updatedAt は new Date() で作られるため、ミリ秒単位の正確な値は検証できない。
      //  代わりに「実行直前の時刻以降になっていること」で、作成時刻が入っていることを確認する)
      const before = new Date();

      // test対象メソッド呼び出し(statusや日付は渡せない)
      const city = City.createNew({
        code: '13',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
      } satisfies CreateCityProps);

      // 検証: idがdomainでUUID形式で採番されていること(値は毎回変わるので形式で検証する)
      expect(city.id).toMatch(UUID_PATTERN);
      // 検証: 渡した項目がそのまま設定されていること
      expect(city.code).toBe('13');
      expect(city.name).toBe('東京');
      expect(city.kanaName).toBe('トウキョウ');
      expect(city.slug).toBe('tokyo');
      // 検証: 新規作成時のstatusは必ず編集中(editing)
      expect(city.status).toBe(CityStatus.EDITING);
      expect(city.sortOrder).toBe(1);
      expect(city.prefectureId).toBe(PREFECTURE_ID);

      // 検証: createdAt / updatedAt が作成時刻(実行直前の時刻以降)になっていること
      // updateAT・createdAt > 現在時刻
      expect(city.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(city.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('正常系: prefectureIdを指定しない場合、都道府県未設定(undefined)で生成されること', () => {
      // test対象メソッド呼び出し(prefectureIdは任意項目なので省略する)
      const city = City.createNew({
        code: '13',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
        // prefectureId: PREFECTURE_ID,
      } satisfies CreateCityProps);

      // 検証: 都道府県未設定(undefined)で生成されること
      expect(city.prefectureId).toBeUndefined();
    });

    it('正常系: createNewを呼ぶたびに異なるidが採番されること', () => {
      // test対象メソッド呼び出し(同じ内容で2回作成する)
      const props: CreateCityProps = {
        code: '13',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        sortOrder: 1,
      } satisfies CreateCityProps;

      const first = City.createNew(props);
      const second = City.createNew(props);

      // 検証: 内容が同じでもidは別物であること(Entityの同一性は内容ではなくidで決まる)
      expect(first.id).not.toBe(second.id);
    });
  });

  // -----------------------------
  // CityFactory.from() test
  //
  // ※serviceのUTで本物のFactoryを呼ぶので、CityFactory個別のUTはしなくてもいいが
  //  念ため実施。
  // -----------------------------
  // Factory: Application層がdomainを新規作成するときの入口。中でcreateNew()を呼んでいる
  describe('------ CityFactory.from() test ------', () => {
    it('正常系: createNewと同様に編集中(editing)のdomainが生成されること', () => {
      // test対象メソッド呼び出し
      const city = CityFactory.from({
        code: '27',
        name: '大阪',
        kanaName: 'オオサカ',
        slug: 'osaka',
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
      } satisfies CreateCityProps);

      // 検証: City(domain)のインスタンスが返ること
      expect(city).toBeInstanceOf(City);
      // 検証: 渡した項目がそのまま設定され、statusは編集中(createNewと同じ)であること
      expect(city.code).toBe('27');
      expect(city.name).toBe('大阪');
      expect(city.kanaName).toBe('オオサカ');
      expect(city.slug).toBe('osaka');
      expect(city.prefectureId).toBe(PREFECTURE_ID);
      expect(city.status).toBe(CityStatus.EDITING);
    });
  });

  // -----------------------------
  // reconstitute() と toSnapshot() を合わせた test
  // -----------------------------
  // reconstitute: DBから取得したデータでdomainを復元する(statusや日付もそのまま使う)
  // toSnapshot:   domainの状態を CityState(読み取り専用のデータ)として取り出す
  describe('------ reconstitute() / toSnapshot() test ------', () => {
    it('正常系: 再構築したdomainのプロパティがCityStateの形で返却されること', () => {
      // domain 作成: 掲載中の東京(reconstitute() で復元)
      const city = buildCity({
        status: CityStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し
      const snapshot = city.toSnapshot();

      // 検証: 復元時に渡した値が、そのままスナップショットに入っていること
      // (satisfies CityState: 期待値の形が CityState と一致しているかもコンパイル時にチェック)
      // (idもDBの値がそのまま復元されること = createNewのように新しく採番されないこと)
      expect(snapshot).toEqual({
        id: CITY_ID,
        code: '13',
        name: '東京',
        kanaName: 'トウキョウ',
        slug: 'tokyo',
        status: CityStatus.PUBLISHED,
        sortOrder: 1,
        prefectureId: PREFECTURE_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      } satisfies CityState);
    });

    it('正常系: スナップショットの日付を書き換えても、domain内部の日付は変わらないこと(防御的コピー)', () => {
      // domain 作成: 編集中の東京
      const city = buildCity();

      // test対象メソッド呼び出し → 取り出したスナップショットの日付を書き換える
      // (Date は参照型なので、domain内部の Date をそのまま返していると、外から内部の値を書き換えられてしまう)
      const snapshot = city.toSnapshot();
      snapshot.createdAt.setFullYear(2000);
      snapshot.updatedAt.setFullYear(2000);

      // 検証: domain内部の日付は元のままであること
      // (toSnapshot が new Date(...) で新しいインスタンスを作って返している = 防御的コピー)
      expect(city.createdAt).toEqual(CREATED_AT);
      expect(city.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // update() test
  // -----------------------------
  // update: 基本情報の更新。掲載中(published)は更新不可。statusは更新対象外
  describe('------ update() test ------', () => {
    it('正常系: 編集中の場合、全項目が更新され、updatedAtが更新されること', () => {
      // 引数作成
      const props = {
        code: '27',
        name: '大阪',
        kanaName: 'オオサカ',
        slug: 'osaka',
        sortOrder: 10,
        prefectureId: '0e78a64a-537e-4807-8234-5ed4252eb554',
      } satisfies UpdateCityProps;

      // domain 作成: 編集中の東京
      const city = buildCity();

      // 実行直前の時刻を記録しておく(updatedAt の検証用)
      const before = new Date();

      // test対象メソッド呼び出し(全項目を更新)
      city.update(props);

      // 検証: 全項目が更新されていること
      expect(city.code).toBe('27');
      expect(city.name).toBe('大阪');
      expect(city.kanaName).toBe('オオサカ');
      expect(city.slug).toBe('osaka');
      expect(city.sortOrder).toBe(10);
      expect(city.prefectureId).toBe('0e78a64a-537e-4807-8234-5ed4252eb554');
      // idは更新対象外(Entityの識別子)なので変わらない
      expect(city.id).toBe(CITY_ID);
      // statusは変わらない
      expect(city.status).toBe(CityStatus.EDITING);
      // 検証: updatedAt が更新時刻(実行直前の時刻以降)になっていること
      expect(city.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      // createdAtは変わらない
      expect(city.createdAt).toEqual(CREATED_AT);
    });

    it('正常系: 停止中(suspended)の場合も更新できること', () => {
      // domain 作成: 停止中の東京都
      const city = buildCity({
        status: CityStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し
      city.update({ name: '東京' });

      // 検証: 更新でき、statusは停止中のままであること(更新不可なのは掲載中だけ)
      expect(city.name).toBe('東京');
      expect(city.status).toBe(CityStatus.SUSPENDED);
    });

    it('正常系: undefinedの項目は更新されず、元の値が維持されること', () => {
      // domain 作成: 編集中の東京
      const city = buildCity();

      // test対象メソッド呼び出し(name だけを指定。他の項目は undefined)
      city.update({ name: '東京都市' });

      // 検証: name だけが更新され、指定していない項目は元の値のままであること
      expect(city.name).toBe('東京都市');
      expect(city.code).toBe('13');
      expect(city.kanaName).toBe('トウキョウ');
      expect(city.slug).toBe('tokyo');
      expect(city.sortOrder).toBe(1);
      expect(city.status).toBe(CityStatus.EDITING);
      expect(city.prefectureId).toBe(PREFECTURE_ID);
    });

    it('異常系: 掲載中(published)の場合、CityAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const city = buildCity({
        status: CityStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証
      // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
      //   city.update() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
      // ・toThrow(new Xxx(...)) で、例外の型とメッセージを一度に検証する
      expect(() => city.update({ name: '大阪' })).toThrow(
        new CityAlreadyPublishedException('東京'),
      );
      // 更新されていないこと(nameもupdatedAtも元のまま)
      expect(city.name).toBe('東京');
      expect(city.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // publish() test
  // -----------------------------
  // publish: 掲載中(published)にする。すでに掲載中
  describe('------ publish() test ------', () => {
    // it.each: 同じテストを、配列の値ごとに繰り返し実行する
    // (テスト名の %s に値が入る → 「editing の場合…」「suspended の場合…」の2件のテストになる)
    // ここでは「掲載中にできる遷移元のstatus」を並べている
    it.each([CityStatus.EDITING, CityStatus.SUSPENDED])(
      '正常系: %s の場合、掲載中(published)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / suspended)の東京都
        const city = buildCity({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        city.publish();

        // 検証: 掲載中になり、updatedAt が更新されていること
        expect(city.status).toBe(CityStatus.PUBLISHED);
        expect(city.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに掲載中(published)の場合、CityAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const city = buildCity({
        status: CityStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証(二重に掲載中にはできない)
      expect(() => city.publish()).toThrow(
        new CityAlreadyPublishedException('東京'),
      );
    });
  });

  // -----------------------------
  // unpublish() test
  // -----------------------------
  // unpublish: 掲載を取り下げて編集中(editing)に戻す。すでに編集中の場合は不可
  describe('------ unpublish() test ------', () => {
    // 「編集中に戻せる遷移元のstatus」を並べて、それぞれでテストする(it.each)
    it.each([CityStatus.PUBLISHED, CityStatus.SUSPENDED])(
      '正常系: %s の場合、編集中(editing)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(published / suspended)の東京都
        const city = buildCity({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        city.unpublish();

        // 検証: 編集中になり、updatedAt が更新されていること
        expect(city.status).toBe(CityStatus.EDITING);
        expect(city.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに編集中(editing)の場合、CityAlreadyEditedExceptionをスローすること', () => {
      // domain 作成: 編集中の東京都
      const city = buildCity();

      // test対象メソッド呼び出し、結果検証(二重に編集中にはできない)
      expect(() => city.unpublish()).toThrow(
        new CityAlreadyEditedException('東京'),
      );
    });
  });

  // -----------------------------
  // suspend() test
  // -----------------------------
  // suspend: 論理削除。停止中(suspended)にする。すでに停止中の場合は不可
  // ※ 地区が紐づいているかのチェックは他集約(District)をまたぐため、DomainService(assertDeletable)の担当
  describe('------ suspend() test ------', () => {
    // 「停止中にできる遷移元のstatus」を並べて、それぞれでテストする(it.each)
    it.each([CityStatus.EDITING, CityStatus.PUBLISHED])(
      '正常系: %s の場合、停止中(suspended)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / published)の東京都
        const city = buildCity({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        city.suspend();

        // 検証: 停止中になり、updatedAt が更新されていること
        expect(city.status).toBe(CityStatus.SUSPENDED);
        expect(city.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに停止中(suspended)の場合、CityAlreadySuspendedExceptionをスローすること', () => {
      // domain 作成: 停止中の東京都
      const city = buildCity({
        status: CityStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し、結果検証(二重に停止中にはできない)
      expect(() => city.suspend()).toThrow(
        new CityAlreadySuspendedException('東京'),
      );
      expect(() => city.suspend()).toThrow(CityAlreadySuspendedException);
    });
  });
});

// テストデータ: 都道府県(関東)に紐づく東京都
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const PREFECTURE_ID = '0f2133bc-1d3c-4094-9acd-85587fcfbc20';
// UUID形式(8-4-4-4-12桁の16進数)の正規表現。createNewで採番されるidの検証用
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * 任意のstatusでCity domainを再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
 *
 * 基本形は「編集中(editing)・都道府県(東京都)ありの東京」。
 * 引数で一部の項目だけを上書きできる。
 *
 *   例) buildCity()                                 → 編集中の東京
 *       buildCity({ status: CityStatus.PUBLISHED }) → 掲載中の東京
 *       buildCity({ prefectureId: undefined })          → 都道府県未設定の東京
 */
const buildCity = (overrides: Partial<ReconstituteCityProps> = {}): City =>
  City.reconstitute({
    id: CITY_ID,
    code: '13',
    name: '東京',
    kanaName: 'トウキョウ',
    slug: 'tokyo',
    status: CityStatus.EDITING,
    sortOrder: 1,
    prefectureId: PREFECTURE_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    // 引数で渡された項目だけ、上の値を上書きする
    ...overrides,
  } satisfies ReconstituteCityProps);

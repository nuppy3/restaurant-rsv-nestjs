import {
  PrefectureAlreadyEditedException,
  PrefectureAlreadyPublishedException,
  PrefectureAlreadySuspendedException,
  PrefectureRegionNotAssignedException,
} from './errors/prefectures.exceptions';
import { PrefectureFactory } from './prefectures.factory';
import {
  CreatePrefectureProps,
  Prefecture,
  PrefectureState,
  PrefectureStatus,
  ReconstitutePrefectureProps,
} from './prefectures.model';

// Prefecture domain(Entity)のテスト
// domainはDBやPrisma、NestJSのDIに依存しない純粋なクラスなので、モックもDIも不要。
// domainを作って、メソッドを呼んで、状態(プロパティ)や例外を検証するだけでテストできる。
// ※ テストで使う共通データ(REGION_ID など)とヘルパー(buildPrefecture)はファイル末尾に定義している
describe('□□□ Prefecture Domain Test □□□', () => {
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
      const prefecture = Prefecture.createNew({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        regionId: REGION_ID,
      } satisfies CreatePrefectureProps);

      // 検証: 渡した項目がそのまま設定されていること
      expect(prefecture.code).toBe('13');
      expect(prefecture.name).toBe('東京都');
      expect(prefecture.kanaName).toBe('トウキョウト');
      expect(prefecture.kanaEn).toBe('Tokyo-to');
      expect(prefecture.regionId).toBe(REGION_ID);
      // 検証: 新規作成時のstatusは必ず編集中(editing)
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
      // 検証: createdAt / updatedAt が作成時刻(実行直前の時刻以降)になっていること
      // updateAT・createdAt > 現在時刻
      expect(prefecture.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('正常系: regionIdを指定しない場合、地方未設定(undefined)で生成されること', () => {
      // test対象メソッド呼び出し(regionIdは任意項目なので省略する)
      const prefecture = Prefecture.createNew({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
      });

      // 検証: 地方未設定(undefined)で生成されること
      expect(prefecture.regionId).toBeUndefined();
    });
  });

  // -----------------------------
  // PrefectureFactory.from() test
  // -----------------------------
  // Factory: Application層がdomainを新規作成するときの入口。中でcreateNew()を呼んでいる
  describe('------ PrefectureFactory.from() test ------', () => {
    it('正常系: createNewと同様に編集中(editing)のdomainが生成されること', () => {
      // test対象メソッド呼び出し
      const prefecture = PrefectureFactory.from({
        code: '27',
        name: '大阪府',
        kanaName: 'オオサカフ',
        kanaEn: 'Osaka-fu',
        regionId: REGION_ID,
      });

      // 検証: Prefecture(domain)のインスタンスが返ること
      expect(prefecture).toBeInstanceOf(Prefecture);
      // 検証: 渡した項目がそのまま設定され、statusは編集中(createNewと同じ)であること
      expect(prefecture.code).toBe('27');
      expect(prefecture.name).toBe('大阪府');
      expect(prefecture.kanaName).toBe('オオサカフ');
      expect(prefecture.kanaEn).toBe('Osaka-fu');
      expect(prefecture.regionId).toBe(REGION_ID);
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
    });
  });

  // -----------------------------
  // reconstitute() / toSnapshot() test
  // -----------------------------
  // reconstitute: DBから取得したデータでdomainを復元する(statusや日付もそのまま使う)
  // toSnapshot:   domainの状態を PrefectureState(読み取り専用のデータ)として取り出す
  describe('------ reconstitute() / toSnapshot() test ------', () => {
    it('正常系: 再構築したdomainのプロパティがPrefectureStateの形で返却されること', () => {
      // domain 作成: 掲載中の東京都(reconstitute で復元)
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し
      const snapshot = prefecture.toSnapshot();

      // 検証: 復元時に渡した値が、そのままスナップショットに入っていること
      // (satisfies PrefectureState: 期待値の形が PrefectureState と一致しているかもコンパイル時にチェック)
      expect(snapshot).toEqual({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        status: 'published',
        regionId: REGION_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      } satisfies PrefectureState);
    });

    it('正常系: スナップショットの日付を書き換えても、domain内部の日付は変わらないこと(防御的コピー)', () => {
      // domain 作成: 編集中の東京都
      const prefecture = buildPrefecture();

      // test対象メソッド呼び出し → 取り出したスナップショットの日付を書き換える
      // (Date は参照型なので、domain内部の Date をそのまま返していると、外から内部の値を書き換えられてしまう)
      const snapshot = prefecture.toSnapshot();
      snapshot.createdAt.setFullYear(2000);
      snapshot.updatedAt.setFullYear(2000);

      // 検証: domain内部の日付は元のままであること
      // (toSnapshot が new Date(...) で新しいインスタンスを作って返している = 防御的コピー)
      expect(prefecture.createdAt).toEqual(CREATED_AT);
      expect(prefecture.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // update() test
  // -----------------------------
  // update: 基本情報の更新。掲載中(published)は更新不可。statusは更新対象外
  describe('------ update() test ------', () => {
    it('正常系: 編集中の場合、全項目が更新され、updatedAtが更新されること', () => {
      // domain 作成: 編集中の東京都
      const prefecture = buildPrefecture();
      // 更新後の地方ID(別の地方)
      const newRegionId = '0e78a64a-537e-4807-8234-5ed4252eb554';
      // 実行直前の時刻を記録しておく(updatedAt の検証用)
      const before = new Date();

      // test対象メソッド呼び出し(全項目を更新)
      prefecture.update({
        code: '27',
        name: '大阪府',
        kanaName: 'オオサカフ',
        kanaEn: 'Osaka-fu',
        regionId: newRegionId,
      });

      // 検証: 全項目が更新されていること
      expect(prefecture.code).toBe('27');
      expect(prefecture.name).toBe('大阪府');
      expect(prefecture.kanaName).toBe('オオサカフ');
      expect(prefecture.kanaEn).toBe('Osaka-fu');
      expect(prefecture.regionId).toBe(newRegionId);
      // statusは変わらない
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
      // 検証: updatedAt が更新時刻(実行直前の時刻以降)になっていること
      expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      // createdAtは変わらない
      expect(prefecture.createdAt).toEqual(CREATED_AT);
    });

    it('正常系: 停止中(suspended)の場合も更新できること', () => {
      // domain 作成: 停止中の東京都
      const prefecture = buildPrefecture({
        status: PrefectureStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し
      prefecture.update({ name: '東京' });

      // 検証: 更新でき、statusは停止中のままであること(更新不可なのは掲載中だけ)
      expect(prefecture.name).toBe('東京');
      expect(prefecture.status).toBe(PrefectureStatus.SUSPENDED);
    });

    it('正常系: undefinedの項目は更新されず、元の値が維持されること', () => {
      // domain 作成: 編集中の東京都
      const prefecture = buildPrefecture();

      // test対象メソッド呼び出し(name だけを指定。他の項目は undefined)
      prefecture.update({ name: '東京' });

      // 検証: name だけが更新され、指定していない項目は元の値のままであること
      expect(prefecture.name).toBe('東京');
      expect(prefecture.code).toBe('13');
      expect(prefecture.kanaName).toBe('トウキョウト');
      expect(prefecture.kanaEn).toBe('Tokyo-to');
      expect(prefecture.regionId).toBe(REGION_ID);
    });

    it('異常系: 掲載中(published)の場合、PrefectureAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証
      // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
      //   prefecture.update() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
      // ・toThrow(new Xxx(...)) で、例外の型とメッセージを一度に検証する
      expect(() => prefecture.update({ name: '東京' })).toThrow(
        new PrefectureAlreadyPublishedException('東京都'),
      );
      // 更新されていないこと(nameもupdatedAtも元のまま)
      expect(prefecture.name).toBe('東京都');
      expect(prefecture.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // publish() test
  // -----------------------------
  // publish: 掲載中(published)にする。すでに掲載中、または地方が未設定の場合は不可
  describe('------ publish() test ------', () => {
    // it.each: 同じテストを、配列の値ごとに繰り返し実行する
    // (テスト名の %s に値が入る → 「editing の場合…」「suspended の場合…」の2件のテストになる)
    // ここでは「掲載中にできる遷移元のstatus」を並べている
    it.each([PrefectureStatus.EDITING, PrefectureStatus.SUSPENDED])(
      '正常系: %s の場合、掲載中(published)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / suspended)の東京都
        const prefecture = buildPrefecture({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        prefecture.publish();

        // 検証: 掲載中になり、updatedAt が更新されていること
        expect(prefecture.status).toBe(PrefectureStatus.PUBLISHED);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに掲載中(published)の場合、PrefectureAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証(二重に掲載中にはできない)
      expect(() => prefecture.publish()).toThrow(
        new PrefectureAlreadyPublishedException('東京都'),
      );
    });

    it('異常系: 地方が未設定の場合、PrefectureRegionNotAssignedExceptionをスローし、statusが変わらないこと', () => {
      // domain 作成: 地方未設定・編集中の東京都
      const prefecture = buildPrefecture({ regionId: undefined });

      // test対象メソッド呼び出し、結果検証(地方が未設定のままでは掲載中にできない)
      expect(() => prefecture.publish()).toThrow(
        new PrefectureRegionNotAssignedException('東京都'),
      );
      // 検証: 例外が発生したので、statusは編集中のままであること
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
    });
  });

  // -----------------------------
  // unpublish() test
  // -----------------------------
  // unpublish: 掲載を取り下げて編集中(editing)に戻す。すでに編集中の場合は不可
  describe('------ unpublish() test ------', () => {
    // 「編集中に戻せる遷移元のstatus」を並べて、それぞれでテストする(it.each)
    it.each([PrefectureStatus.PUBLISHED, PrefectureStatus.SUSPENDED])(
      '正常系: %s の場合、編集中(editing)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(published / suspended)の東京都
        const prefecture = buildPrefecture({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        prefecture.unpublish();

        // 検証: 編集中になり、updatedAt が更新されていること
        expect(prefecture.status).toBe(PrefectureStatus.EDITING);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに編集中(editing)の場合、PrefectureAlreadyEditedExceptionをスローすること', () => {
      // domain 作成: 編集中の東京都
      const prefecture = buildPrefecture();

      // test対象メソッド呼び出し、結果検証(二重に編集中にはできない)
      expect(() => prefecture.unpublish()).toThrow(
        new PrefectureAlreadyEditedException('東京都'),
      );
    });
  });

  // -----------------------------
  // remove() test
  // -----------------------------
  // remove: 論理削除。停止中(suspended)にする。すでに停止中の場合は不可
  // ※ 店舗が紐づいているかのチェックは他集約(Store)をまたぐため、DomainService(assertDeletable)の担当
  describe('------ remove() test ------', () => {
    // 「停止中にできる遷移元のstatus」を並べて、それぞれでテストする(it.each)
    it.each([PrefectureStatus.EDITING, PrefectureStatus.PUBLISHED])(
      '正常系: %s の場合、停止中(suspended)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / published)の東京都
        const prefecture = buildPrefecture({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        prefecture.remove();

        // 検証: 停止中になり、updatedAt が更新されていること
        expect(prefecture.status).toBe(PrefectureStatus.SUSPENDED);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに停止中(suspended)の場合、PrefectureAlreadySuspendedExceptionをスローすること', () => {
      // domain 作成: 停止中の東京都
      const prefecture = buildPrefecture({
        status: PrefectureStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し、結果検証(二重に停止中にはできない)
      expect(() => prefecture.remove()).toThrow(
        new PrefectureAlreadySuspendedException('東京都'),
      );
    });
  });
});

// テストデータ: 地方(関東)に紐づく東京都
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * 任意のstatusでPrefecture domainを再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
 *
 * 基本形は「編集中(editing)・地方(関東)ありの東京都」。引数で一部の項目だけを上書きできる。
 *   例) buildPrefecture()                                     → 編集中の東京都
 *       buildPrefecture({ status: PrefectureStatus.PUBLISHED }) → 掲載中の東京都
 *       buildPrefecture({ regionId: undefined })               → 地方未設定の東京都
 */
const buildPrefecture = (
  overrides: Partial<ReconstitutePrefectureProps> = {},
): Prefecture =>
  Prefecture.reconstitute({
    code: '13',
    name: '東京都',
    kanaName: 'トウキョウト',
    kanaEn: 'Tokyo-to',
    status: PrefectureStatus.EDITING,
    regionId: REGION_ID,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    // 引数で渡された項目だけ、上の値を上書きする
    ...overrides,
  });

import { DistrictFactory } from './districts.factory';
import {
  CreateDistrictProps,
  District,
  DistrictState,
  DistrictStatus,
  ReconstituteDistrictProps,
  UpdateDistrictProps,
} from './districts.model';
import {
  DistrictAlreadyEditedException,
  DistrictAlreadyPublishedException,
  DistrictAlreadySuspendedException,
} from './errors/districts.exception';

describe('■■■ District Domain Test ■■■', () => {
  // -----------------------------
  // createNew() test
  // -----------------------------
  // createNew: 新規作成用のファクトリーメソッド。statusと日付はdomainの中で決まる
  describe('------ createNew() test ------', () => {
    it('正常系: Districtが生成され返却されること(id(uuid)/statusが編集中/日付が作成時刻)', () => {
      // 実行直前の時刻を記録しておく
      // (createdAt / updatedAt は new Date() で作られるため、ミリ秒単位の正確な値は検証できない。
      //  代わりに「実行直前の時刻以降になっていること」で、作成時刻が入っていることを確認する)
      const before = new Date();

      // test対象メソッド呼び出し
      const district = District.createNew({
        code: '00001',
        name: '銀座',
        kanaName: 'ギンザ',
        slug: 'ginza',
        sortOrder: 1,
        cityId: CITY_ID,
      } satisfies CreateDistrictProps);

      // 検証
      // District(domain)のインスタンスが返ること
      expect(district).toBeInstanceOf(District);
      // idがdomainでUUID形式で採番されていること(値は毎回変わるので形式で検証する)
      expect(district.id).toMatch(UUID_PATTERN);
      // 検証: 渡した項目がそのまま設定されていること
      expect(district.code).toBe('00001');
      expect(district.name).toBe('銀座');
      expect(district.kanaName).toBe('ギンザ');
      expect(district.slug).toBe('ginza');
      // 検証: 新規作成時のstatusは必ず編集中(editing)
      expect(district.status).toBe(DistrictStatus.EDITING);
      expect(district.sortOrder).toBe(1);
      expect(district.cityId).toBe(CITY_ID);

      // 検証: createdAt / updatedAt が作成時刻(実行直前の時刻以降)になっていること
      // updateAT・createdAt > 現在時刻
      expect(district.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );

      // 検証 (以下でもいいが、上記の方がシンプルかな)
      // ⭐️toMatchObject()で、期待値の{}にsatisfis Districtしていないので、検証したいプロパティだけ
      //   期待値として定義している。そうなると、やはり、上記の方(toBeで一項目づつ検証)がシンプルか
      expect(district).toMatchObject({
        // id: DISTRICT_ID,
        code: '00001',
        name: '銀座',
        kanaName: 'ギンザ',
        slug: 'ginza',
        cityId: CITY_ID,
        sortOrder: 1,
        status: DistrictStatus.EDITING,
        // createdAt: CREATED_AT,
        // updatedAt: UPDATED_AT,
      });
    });

    it('正常系: createNewを呼ぶたびに異なるidが採番されること', () => {
      const props = {
        code: '00001',
        name: '銀座',
        kanaName: 'ギンザ',
        slug: 'ginza',
        sortOrder: 1,
        cityId: CITY_ID,
      } satisfies CreateDistrictProps;

      const first = District.createNew(props);
      const second = District.createNew(props);

      // 検証: 内容が同じでもidは別物であること(Entityの同一性は内容ではなくidで決まる)
      expect(first.id).not.toBe(second.id);
    });
  });

  // -----------------------------
  // DistrictFactory.from() test
  //
  // ※serviceのUTで本物のFactoryを呼ぶので、DistrictFactory個別のUTはしなくてもいいが
  //  念ため実施。
  // -----------------------------
  // Factory: Application層がdomainを新規作成するときの入口。中でcreateNew()を呼んでいる
  describe('------ DistrictFactory.from() test ------', () => {
    it('正常系: createNewと同様に編集中(editing)のdomainが生成されること', () => {
      // 実行直前の時刻を記録しておく
      // (createdAt / updatedAt は new Date() で作られるため、ミリ秒単位の正確な値は検証できない。
      //  代わりに「実行直前の時刻以降になっていること」で、作成時刻が入っていることを確認する)
      const before = new Date();

      // test対象メソッド呼び出し
      const district = DistrictFactory.from({
        code: '00002',
        name: '恵比寿',
        kanaName: 'エビス',
        slug: 'ebisu',
        sortOrder: 2,
        cityId: CITY_ID,
      } satisfies CreateDistrictProps);

      // 検証: District(domain)のインスタンスが返ること
      expect(district).toBeInstanceOf(District);
      // 検証: 渡した項目がそのまま設定され、statusは編集中(createNewと同じ)であること
      expect(district.code).toBe('00002');
      expect(district.name).toBe('恵比寿');
      expect(district.kanaName).toBe('エビス');
      expect(district.slug).toBe('ebisu');
      expect(district.cityId).toBe(CITY_ID);
      expect(district.status).toBe(DistrictStatus.EDITING);

      // 検証: createdAt / updatedAt が作成時刻(実行直前の時刻以降)になっていること
      // updateAT・createdAt > 現在時刻
      expect(district.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );

      // 検証は以下でもいい
      expect(district).toMatchObject({
        // id: '',
        code: '00002',
        name: '恵比寿',
        kanaName: 'エビス',
        slug: 'ebisu',
        cityId: CITY_ID,
        sortOrder: 2,
        status: DistrictStatus.EDITING,
        // createdAt: CREATED_AT,
        // updatedAt: UPDATED_AT,
      });
    });
  });
  // -----------------------------
  // reconstitute() と toSnapshot() を合わせた test
  // -----------------------------
  // reconstitute: DBから取得したデータでdomainを復元する(statusや日付もそのまま使う)
  // toSnapshot:   domainの状態を DistrictState(読み取り専用のデータ)として取り出す
  describe('------ reconstitute() / toSnapshot() test ------', () => {
    it('正常系: 再構築したdomainのプロパティがDistrictStateの形で返却されること', () => {
      // domain 作成: 掲載中の東京(reconstitute() で復元)
      const district = buildDistrict({
        status: DistrictStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し
      const snapshot = district.toSnapshot();

      // 検証: 復元時に渡した値が、そのままスナップショットに入っていること
      // (satisfies DistrictState: 期待値の形が DistrictState と一致しているかもコンパイル時にチェック)
      // (idもDBの値がそのまま復元されること = createNewのように新しく採番されないこと)
      expect(snapshot).toEqual({
        id: DISTRICT_ID,
        code: '00001',
        name: '銀座',
        kanaName: 'ギンザ',
        slug: 'ginza',
        sortOrder: 1,
        status: DistrictStatus.PUBLISHED,
        cityId: CITY_ID,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      } satisfies DistrictState);
    });

    it('正常系: スナップショットの日付を書き換えても、domain内部の日付は変わらないこと(防御的コピー)', () => {
      // domain 作成: 編集中の東京
      const district = buildDistrict();

      // test対象メソッド呼び出し → 取り出したスナップショットの日付を書き換える
      // (Date は参照型なので、domain内部の Date をそのまま返していると、外から内部の値を書き換えられてしまう)
      const snapshot = district.toSnapshot();
      snapshot.createdAt.setFullYear(2000);
      snapshot.updatedAt.setFullYear(2000);

      // 検証: domain内部の日付は元のままであること
      // (toSnapshot が new Date(...) で新しいインスタンスを作って返している = 防御的コピー)
      expect(district.createdAt).toEqual(CREATED_AT);
      expect(district.updatedAt).toEqual(UPDATED_AT);
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
        code: '00002',
        name: '恵比寿',
        kanaName: 'エビス',
        slug: 'ebisu',
        sortOrder: 2,
        cityId: CITY_ID,
      } satisfies UpdateDistrictProps;

      // domain 作成: 編集中の東京
      const district = buildDistrict();

      // 実行直前の時刻を記録しておく(updatedAt の検証用)
      const before = new Date();

      // test対象メソッド呼び出し(全項目を更新)
      district.update(props);

      // 検証: 全項目が更新されていること
      expect(district.code).toBe('00002');
      expect(district.name).toBe('恵比寿');
      expect(district.kanaName).toBe('エビス');
      expect(district.slug).toBe('ebisu');
      expect(district.sortOrder).toBe(2);
      expect(district.cityId).toBe(CITY_ID);
      // idは更新対象外(Entityの識別子)なので変わらない
      expect(district.id).toBe(DISTRICT_ID);
      // statusは変わらない
      expect(district.status).toBe(DistrictStatus.EDITING);
      // 検証: updatedAt が更新時刻(実行直前の時刻以降)になっていること
      expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      // createdAtは変わらない
      expect(district.createdAt).toEqual(CREATED_AT);
    });

    it('正常系: 停止中(suspended)の場合も更新できること', () => {
      // domain 作成: 停止中の東京都
      const district = buildDistrict({
        status: DistrictStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し
      district.update({ name: '恵比寿' });

      // 検証: 更新でき、statusは停止中のままであること(更新不可なのは掲載中だけ)
      expect(district.name).toBe('恵比寿');
      expect(district.status).toBe(DistrictStatus.SUSPENDED);
    });

    it('正常系: undefinedの項目は更新されず、元の値が維持されること', () => {
      // domain 作成: 編集中の東京
      const district = buildDistrict();

      // test対象メソッド呼び出し(name だけを指定。他の項目は undefined)
      district.update({ name: '戸越銀座' });

      // 検証: name だけが更新され、指定していない項目は元の値のままであること
      expect(district.name).toBe('戸越銀座');
      expect(district.code).toBe('00001');
      expect(district.kanaName).toBe('ギンザ');
      expect(district.slug).toBe('ginza');
      expect(district.sortOrder).toBe(1);
      expect(district.status).toBe(DistrictStatus.EDITING);
      expect(district.cityId).toBe(CITY_ID);
    });

    it('異常系: 掲載中(published)の場合、districtAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const district = buildDistrict({
        status: DistrictStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証
      // ・expect() には「実行せずに関数ごと」渡す(() => ...)。
      //   district.update() と直接書くと、expect に渡す前に例外が発生してテストが失敗してしまう
      // ・toThrow(new Xxx(...)) で、例外の型とメッセージを一度に検証する
      expect(() => district.update({ name: '恵比寿' })).toThrow(
        new DistrictAlreadyPublishedException('銀座'),
      );
      // 更新されていないこと(nameもupdatedAtも元のまま)
      expect(district.name).toBe('銀座');
      expect(district.updatedAt).toEqual(UPDATED_AT);
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
    it.each([DistrictStatus.EDITING, DistrictStatus.SUSPENDED])(
      '正常系: %s の場合、掲載中(published)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / suspended)の東京都
        const district = buildDistrict({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        district.publish();

        // 検証: 掲載中になり、updatedAt が更新されていること
        expect(district.status).toBe(DistrictStatus.PUBLISHED);
        expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに掲載中(published)の場合、districtAlreadyPublishedExceptionをスローすること', () => {
      // domain 作成: 掲載中の東京都
      const district = buildDistrict({
        status: DistrictStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し、結果検証(二重に掲載中にはできない)
      expect(() => district.publish()).toThrow(
        new DistrictAlreadyPublishedException('銀座'),
      );
    });
  });

  // -----------------------------
  // unpublish() test
  // -----------------------------
  // unpublish: 掲載を取り下げて編集中(editing)に戻す。すでに編集中の場合は不可
  describe('------ unpublish() test ------', () => {
    // 「編集中に戻せる遷移元のstatus」を並べて、それぞれでテストする(it.each)
    it.each([DistrictStatus.PUBLISHED, DistrictStatus.SUSPENDED])(
      '正常系: %s の場合、編集中(editing)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(published / suspended)の東京都
        const district = buildDistrict({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        district.unpublish();

        // 検証: 編集中になり、updatedAt が更新されていること
        expect(district.status).toBe(DistrictStatus.EDITING);
        expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに編集中(editing)の場合、districtAlreadyEditedExceptionをスローすること', () => {
      // domain 作成: 編集中の東京都
      const District = buildDistrict();

      // test対象メソッド呼び出し、結果検証(二重に編集中にはできない)
      expect(() => District.unpublish()).toThrow(
        new DistrictAlreadyEditedException('銀座'),
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
    it.each([DistrictStatus.EDITING, DistrictStatus.PUBLISHED])(
      '正常系: %s の場合、停止中(suspended)になり、updatedAtが更新されること',
      (status) => {
        // domain 作成: 遷移元のstatus(editing / published)の東京都
        const district = buildDistrict({ status });
        // 実行直前の時刻を記録しておく(updatedAt の検証用)
        const before = new Date();

        // test対象メソッド呼び出し
        district.suspend();

        // 検証: 停止中になり、updatedAt が更新されていること
        expect(district.status).toBe(DistrictStatus.SUSPENDED);
        expect(district.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに停止中(suspended)の場合、districtAlreadySuspendedExceptionをスローすること', () => {
      // domain 作成: 停止中の東京都
      const district = buildDistrict({
        status: DistrictStatus.SUSPENDED,
      });

      // test対象メソッド呼び出し、結果検証(二重に停止中にはできない)
      expect(() => district.suspend()).toThrow(
        new DistrictAlreadySuspendedException('銀座'),
      );
      expect(() => district.suspend()).toThrow(
        DistrictAlreadySuspendedException,
      );
    });
  });
});

// テストデータ: 都道府県(関東)に紐づく東京都
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
// update で cityId を変えるテスト用(例: 大阪)
// const OTHER_CITY_ID = '3ca1f9a2-dd34-490c-8f2a-22be00b00565';
const DISTRICT_ID = '5b6c7d8e-9f01-4a2b-8c3d-4e5f60718293';
// UUID形式(8-4-4-4-12桁の16進数)の正規表現。createNewで採番されるidの検証用
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * 任意のstatusでDistrict domainを再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
 *
 * 基本形は「編集中(editing)・都道府県(東京都)ありの東京」。
 * 引数で一部の項目だけを上書きできる。
 *
 *   例) buildbuildDistrict()                                 → 編集中の東京
 *       buildbuildDistrict({ status: DistrictStatus.PUBLISHED }) → 掲載中の東京
 *       buildbuildDistrict({ prefectureId: undefined })          → 都道府県未設定の東京
 */
const buildDistrict = (
  overrides: Partial<ReconstituteDistrictProps> = {},
): District =>
  District.reconstitute({
    id: DISTRICT_ID,
    code: '00001',
    name: '銀座',
    kanaName: 'ギンザ',
    slug: 'ginza',
    sortOrder: 1,
    cityId: CITY_ID,
    status: DistrictStatus.EDITING,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    // 引数で渡された項目だけ、上の値を上書きする
    ...overrides,
  } satisfies ReconstituteDistrictProps);

import { DistrictFactory } from './districts.factory';
import {
  CreateDistrictProps,
  District,
  DistrictState,
  DistrictStatus,
  ReconstituteDistrictProps,
} from './districts.model';

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
      // City(domain)のインスタンスが返ること
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

      // 検証: City(domain)のインスタンスが返ること
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
  // toSnapshot:   domainの状態を CityState(読み取り専用のデータ)として取り出す
  describe('------ reconstitute() / toSnapshot() test ------', () => {
    it('正常系: 再構築したdomainのプロパティがDistrictStateの形で返却されること', () => {
      // domain 作成: 掲載中の東京(reconstitute() で復元)
      const district = buildDistrict({
        status: DistrictStatus.PUBLISHED,
      });

      // test対象メソッド呼び出し
      const snapshot = district.toSnapshot();

      // 検証: 復元時に渡した値が、そのままスナップショットに入っていること
      // (satisfies CityState: 期待値の形が CityState と一致しているかもコンパイル時にチェック)
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
});

// テストデータ: 都道府県(関東)に紐づく東京都
// ⭐️memo: ファイル末尾に定義していても、テストから問題なく参照できる。
//         describe() の中の各 it() の処理は「このファイル全体の読み込みが終わった後」に実行されるため、
//         その時点では下の const はすべて初期化済み(TDZ: 宣言前アクセスのエラーにはならない)。
//         ※ ただし describe() の直下(it() の外)で使うと、読み込み中に実行されるためエラーになる
const CITY_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
// update で cityId を変えるテスト用(例: 大阪)
const OTHER_CITY_ID = '3ca1f9a2-dd34-490c-8f2a-22be00b00565';
const DISTRICT_ID = '5b6c7d8e-9f01-4a2b-8c3d-4e5f60718293';
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
 *   例) buildbuildDistrict()                                 → 編集中の東京
 *       buildbuildDistrict({ status: CityStatus.PUBLISHED }) → 掲載中の東京
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

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

// テストデータ: 地方(関東)に紐づく東京都
const REGION_ID = '57a39a4b-921c-48ed-8045-4054be56feee';
const CREATED_AT = new Date('2025-04-05T10:00:00.000Z');
const UPDATED_AT = new Date('2025-04-05T12:30:00.000Z');

/**
 * 任意のstatusでPrefecture domainを再構築するヘルパー
 * createNewではstatusや日付を指定できないため、reconstituteを使う
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
    ...overrides,
  });

describe('□□□ Prefecture Domain Test □□□', () => {
  // -----------------------------
  // createNew() test
  // -----------------------------
  describe('------ createNew() test ------', () => {
    it('正常系: statusが編集中(editing)、createdAt/updatedAtが作成時刻で生成されること', () => {
      const before = new Date();

      const prefecture = Prefecture.createNew({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
        regionId: REGION_ID,
      } satisfies CreatePrefectureProps);

      expect(prefecture.code).toBe('13');
      expect(prefecture.name).toBe('東京都');
      expect(prefecture.kanaName).toBe('トウキョウト');
      expect(prefecture.kanaEn).toBe('Tokyo-to');
      expect(prefecture.regionId).toBe(REGION_ID);
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
      expect(prefecture.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('正常系: regionIdを指定しない場合、地方未設定(undefined)で生成されること', () => {
      const prefecture = Prefecture.createNew({
        code: '13',
        name: '東京都',
        kanaName: 'トウキョウト',
        kanaEn: 'Tokyo-to',
      });

      expect(prefecture.regionId).toBeUndefined();
    });
  });

  // -----------------------------
  // PrefectureFactory.from() test
  // -----------------------------
  describe('------ PrefectureFactory.from() test ------', () => {
    it('正常系: createNewと同様に編集中(editing)のdomainが生成されること', () => {
      const prefecture = PrefectureFactory.from({
        code: '27',
        name: '大阪府',
        kanaName: 'オオサカフ',
        kanaEn: 'Osaka-fu',
        regionId: REGION_ID,
      });

      expect(prefecture).toBeInstanceOf(Prefecture);
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
  describe('------ reconstitute() / toSnapshot() test ------', () => {
    it('正常系: 再構築したdomainのプロパティがPrefectureStateの形で返却されること', () => {
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      const snapshot = prefecture.toSnapshot();

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
      const prefecture = buildPrefecture();

      const snapshot = prefecture.toSnapshot();
      snapshot.createdAt.setFullYear(2000);
      snapshot.updatedAt.setFullYear(2000);

      expect(prefecture.createdAt).toEqual(CREATED_AT);
      expect(prefecture.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // update() test
  // -----------------------------
  describe('------ update() test ------', () => {
    it('正常系: 編集中の場合、全項目が更新され、updatedAtが更新されること', () => {
      const prefecture = buildPrefecture();
      const newRegionId = '0e78a64a-537e-4807-8234-5ed4252eb554';
      const before = new Date();

      prefecture.update({
        code: '27',
        name: '大阪府',
        kanaName: 'オオサカフ',
        kanaEn: 'Osaka-fu',
        regionId: newRegionId,
      });

      expect(prefecture.code).toBe('27');
      expect(prefecture.name).toBe('大阪府');
      expect(prefecture.kanaName).toBe('オオサカフ');
      expect(prefecture.kanaEn).toBe('Osaka-fu');
      expect(prefecture.regionId).toBe(newRegionId);
      // statusは変わらない
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
      expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      // createdAtは変わらない
      expect(prefecture.createdAt).toEqual(CREATED_AT);
    });

    it('正常系: 停止中(suspended)の場合も更新できること', () => {
      const prefecture = buildPrefecture({
        status: PrefectureStatus.SUSPENDED,
      });

      prefecture.update({ name: '東京' });

      expect(prefecture.name).toBe('東京');
      expect(prefecture.status).toBe(PrefectureStatus.SUSPENDED);
    });

    it('正常系: undefinedの項目は更新されず、元の値が維持されること', () => {
      const prefecture = buildPrefecture();

      prefecture.update({ name: '東京' });

      expect(prefecture.name).toBe('東京');
      expect(prefecture.code).toBe('13');
      expect(prefecture.kanaName).toBe('トウキョウト');
      expect(prefecture.kanaEn).toBe('Tokyo-to');
      expect(prefecture.regionId).toBe(REGION_ID);
    });

    it('異常系: 掲載中(published)の場合、PrefectureAlreadyPublishedExceptionをスローすること', () => {
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      expect(() => prefecture.update({ name: '東京' })).toThrow(
        new PrefectureAlreadyPublishedException('東京都'),
      );
      // 更新されていないこと
      expect(prefecture.name).toBe('東京都');
      expect(prefecture.updatedAt).toEqual(UPDATED_AT);
    });
  });

  // -----------------------------
  // publish() test
  // -----------------------------
  describe('------ publish() test ------', () => {
    it.each([PrefectureStatus.EDITING, PrefectureStatus.SUSPENDED])(
      '正常系: %s の場合、掲載中(published)になり、updatedAtが更新されること',
      (status) => {
        const prefecture = buildPrefecture({ status });
        const before = new Date();

        prefecture.publish();

        expect(prefecture.status).toBe(PrefectureStatus.PUBLISHED);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに掲載中(published)の場合、PrefectureAlreadyPublishedExceptionをスローすること', () => {
      const prefecture = buildPrefecture({
        status: PrefectureStatus.PUBLISHED,
      });

      expect(() => prefecture.publish()).toThrow(
        new PrefectureAlreadyPublishedException('東京都'),
      );
    });

    it('異常系: 地方が未設定の場合、PrefectureRegionNotAssignedExceptionをスローし、statusが変わらないこと', () => {
      const prefecture = buildPrefecture({ regionId: undefined });

      expect(() => prefecture.publish()).toThrow(
        new PrefectureRegionNotAssignedException('東京都'),
      );
      expect(prefecture.status).toBe(PrefectureStatus.EDITING);
    });
  });

  // -----------------------------
  // unpublish() test
  // -----------------------------
  describe('------ unpublish() test ------', () => {
    it.each([PrefectureStatus.PUBLISHED, PrefectureStatus.SUSPENDED])(
      '正常系: %s の場合、編集中(editing)になり、updatedAtが更新されること',
      (status) => {
        const prefecture = buildPrefecture({ status });
        const before = new Date();

        prefecture.unpublish();

        expect(prefecture.status).toBe(PrefectureStatus.EDITING);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに編集中(editing)の場合、PrefectureAlreadyEditedExceptionをスローすること', () => {
      const prefecture = buildPrefecture();

      expect(() => prefecture.unpublish()).toThrow(
        new PrefectureAlreadyEditedException('東京都'),
      );
    });
  });

  // -----------------------------
  // remove() test
  // -----------------------------
  describe('------ remove() test ------', () => {
    it.each([PrefectureStatus.EDITING, PrefectureStatus.PUBLISHED])(
      '正常系: %s の場合、停止中(suspended)になり、updatedAtが更新されること',
      (status) => {
        const prefecture = buildPrefecture({ status });
        const before = new Date();

        prefecture.remove();

        expect(prefecture.status).toBe(PrefectureStatus.SUSPENDED);
        expect(prefecture.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
      },
    );

    it('異常系: すでに停止中(suspended)の場合、PrefectureAlreadySuspendedExceptionをスローすること', () => {
      const prefecture = buildPrefecture({
        status: PrefectureStatus.SUSPENDED,
      });

      expect(() => prefecture.remove()).toThrow(
        new PrefectureAlreadySuspendedException('東京都'),
      );
    });
  });
});

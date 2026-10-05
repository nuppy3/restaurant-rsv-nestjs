import {
  RegionAlreadyEditedException,
  RegionAlreadyPublishedException,
  RegionAlreadySuspendedException,
} from './errors/regions.exceptions';
import {
  ReconstituteRegionProps,
  Region,
  RegionState,
  RegionStatus,
  UpdateRegionProps,
} from './regions.model';

describe('□□□ Region Domain Test □□□', () => {
  // -----------------------------
  // toSnapshot() test
  // -----------------------------
  describe('------ toSnapshot() test ------', () => {
    it('正常系: RegionStateの形に整形されたRegion Domainのプロパティを返却すること', () => {
      const domain = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies ReconstituteRegionProps);

      // テスト対象function呼び出し
      const snapshot = domain.toSnapshot();

      // 検証
      expect(snapshot).toEqual({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      } satisfies RegionState);
    });
  });

  // -----------------------------
  // update() test
  // -----------------------------
  describe('------ update() test ------', () => {
    it('正常系: validateCanDeleteを通過し(status:published以外)、プロパティ(全項目)が更新されること', () => {
      // Region domain 生成: createNewでdomainを作成すると、createdAt、updatedAtなどの
      // 日付が指定できないので、reconstitute()を使うのがベスト。
      const region = Region.reconstitute({
        name: '北アメリカ',
        code: '14',
        kanaName: 'キタアメリカ',
        status: 'editing',
        kanaEn: 'kitaamerika',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies UpdateRegionProps;

      // 実行直前の時刻
      const before = new Date();

      // test対象のfunction呼び出し
      region.update(region);

      // 検証
      expect(region.code).toBe('14');
      expect(region.name).toBe('北アメリカ');
      expect(region.kanaName).toBe('キタアメリカ');
      expect(region.status).toBe(RegionStatus.EDITING);
      expect(region.kanaEn).toBe('kitaamerika');

      // 日付、時刻の検証について、誤差を認める方法
      // 「1秒以内に実行されたか」という検証で、Jestの toBeGreaterThan（より大きい）などを使い
      // 実行後の時刻が、実行前よりも未来であることを確認するやり方があるようです。
      // updateAT > 現在時刻
      expect(region.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );

      // setterのカバレッジを通す
      region.code = '99';
      region.name = 'エリア99';
      region.kanaName = 'エリアキューキュー';
      region.kanaEn = 'erea99';
    });

    it('異常系: 削除対象のRegionが掲載中の場合、RegionAlreadyPublishedExceptionをスローする', () => {
      const region = Region.createNew({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // status: RegionStatus.PUBLISHED, // '掲載中'
        kanaEn: 'hokkaidou',
        // createdAt: new Date(),
        // updatedAt: new Date(),
      });

      // status: 掲載中
      region.status = RegionStatus.PUBLISHED;

      // ✅ 実行せずに「リモコン（アロー関数）」だけを渡す
      // 前に region.remove() を単体で書かないこと！
      // region.remove(): 「今すぐ爆弾を起動しろ！」
      // () => region.remove(): 「爆弾を起動するためのリモコンです。どうぞ」
      // expect(() => region.update(region)).toThrow(
      //   `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： ${region.name}`,
      // );

      // DomainExceptionの検証
      expect(() => region.update(region)).toThrow(
        new RegionAlreadyPublishedException(region.name),
      );
      // messageの検証
      expect(() => region.update(region)).toThrow(
        `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： ${region.name}`,
      );
    });
  });

  // -----------------------------
  // publish() test
  // -----------------------------
  describe('------ publish() test ------', () => {
    it('正常系: validateCanPublishを通過し、statusとupdatedAtが更新されること', () => {
      // Region domain 生成
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 編集中
        status: 'editing',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;

      // 実行直前の時刻
      const before = new Date();

      // test対象のfunction呼び出し
      region.publish();

      // 検証
      expect(region.status).toBe(RegionStatus.PUBLISHED);
      // 日付、時刻の検証について、誤差を認める方法
      // 「1秒以内に実行されたか」という検証で、Jestの toBeGreaterThan（より大きい）などを使い
      // 実行後の時刻が、実行前よりも未来であることを確認するやり方があるようです。
      expect(region.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('異常系: 削除対象のRegionが既に掲載中の場合、Errorをスローする', () => {
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: RegionStatus.PUBLISHED, // 'published'
        kanaEn: 'hokkaidou',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ✅ 実行せずに「リモコン（アロー関数）」だけを渡す
      // 前に region.remove() を単体で書かないこと！
      // region.remove(): 「今すぐ爆弾を起動しろ！」
      // () => region.remove(): 「爆弾を起動するためのリモコンです。どうぞ」
      // expect(() => region.remove()).toThrow(
      //   `この地域はすでに利用停止状態です。地域： ${region.name}`,
      // );

      // DomainExceptionの検証
      expect(() => region.publish()).toThrow(
        new RegionAlreadyPublishedException(region.name),
      );
      // messageの検証
      expect(() => region.publish()).toThrow(
        `この地域は掲載状態のため、更新できません。(編集中/停止中のみ更新可) 地域： ${region.name}`,
      );
    });
  });

  // -----------------------------
  // unpublish() test
  // -----------------------------
  describe('------ unpublish() test ------', () => {
    it('正常系: validateCanUnpublishを通過し、statusとupdatedAtが更新されること', () => {
      // Region domain 生成
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        // 掲載中
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;

      // 実行直前の時刻
      const before = new Date();

      // test対象のfunction呼び出し
      region.unpublish();

      // 検証
      expect(region.status).toBe(RegionStatus.EDITING);
      // 日付、時刻の検証について、誤差を認める方法
      // 「1秒以内に実行されたか」という検証で、Jestの toBeGreaterThan（より大きい）などを使い
      // 実行後の時刻が、実行前よりも未来であることを確認するやり方があるようです。
      expect(region.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('異常系: 削除対象のRegionが既に編集中の場合、Errorをスローする', () => {
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: RegionStatus.EDITING, // '編集中'
        kanaEn: 'hokkaidou',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ✅ 実行せずに「リモコン（アロー関数）」だけを渡す
      // 前に region.remove() を単体で書かないこと！
      // region.remove(): 「今すぐ爆弾を起動しろ！」
      // () => region.remove(): 「爆弾を起動するためのリモコンです。どうぞ」
      // expect(() => region.remove()).toThrow(
      //   `この地域はすでに利用停止状態です。地域： ${region.name}`,
      // );

      // DomainExceptionの検証
      expect(() => region.unpublish()).toThrow(
        new RegionAlreadyEditedException(region.name),
      );
      // messageの検証
      expect(() => region.unpublish()).toThrow(
        `この地域は既に編集中のため、更新できません。 地域： 北海道`,
      );
    });
  });

  // -----------------------------
  // remove() test
  // -----------------------------
  describe('------ remove() test ------', () => {
    it('正常系: validateCanDeleteを通過し、statusとupdatedAtが更新されること', () => {
      // Region domain 生成
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: 'published',
        kanaEn: 'hokkaidou',
        createdAt: new Date('2025-04-05T10:00:00.000Z'),
        updatedAt: new Date('2025-04-05T12:30:00.000Z'),
      }) satisfies ReconstituteRegionProps;

      // 実行直前の時刻
      const before = new Date();

      // test対象のfunction呼び出し
      region.remove();

      // 検証
      expect(region.status).toBe(RegionStatus.SUSPENDED);
      // 日付、時刻の検証について、誤差を認める方法
      // 「1秒以内に実行されたか」という検証で、Jestの toBeGreaterThan（より大きい）などを使い
      // 実行後の時刻が、実行前よりも未来であることを確認するやり方があるようです。
      expect(region.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('異常系: 削除対象のRegionが既に停止中の場合、Errorをスローする', () => {
      const region = Region.reconstitute({
        name: '北海道',
        code: '01',
        kanaName: 'ほっかいどう',
        status: RegionStatus.SUSPENDED, // 'suspended'
        kanaEn: 'hokkaidou',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ✅ 実行せずに「リモコン（アロー関数）」だけを渡す
      // 前に region.remove() を単体で書かないこと！
      // region.remove(): 「今すぐ爆弾を起動しろ！」
      // () => region.remove(): 「爆弾を起動するためのリモコンです。どうぞ」
      // expect(() => region.remove()).toThrow(
      //   `この地域はすでに利用停止状態です。地域： ${region.name}`,
      // );

      // DomainExceptionの検証
      expect(() => region.remove()).toThrow(
        new RegionAlreadySuspendedException(region.name),
      );
      // messageの検証
      expect(() => region.remove()).toThrow(
        `この地域はすでに利用停止状態です。地域： ${region.name}`,
      );
    });
  });
});

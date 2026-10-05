// 店舗(Store)のマスタデータ
// nestjs-fleamarket の開発用DBから移植(重複行を除外し、都道府県の紐づけ誤りと店名内のテスト用メモを修正)。
// prefectureCode は seed-data/prefectures.ts のコード。null は都道府県未設定の店舗。
// ※ レストランのダミー店舗(フロントの restaurants.ts)はエリア整理後に追加予定
export interface StoreSeed {
  code: string;
  name: string;
  kanaName: string;
  status: 'published' | 'editing' | 'suspended';
  zipCode: string | null;
  email: string;
  phoneNumber: string;
  holidays: string[];
  prefectureCode: string | null;
}

export const stores: StoreSeed[] = [
  {
    code: '00001',
    name: '山田電気 赤羽店',
    kanaName: 'ヤマダデンキ　アカバネテン',
    status: 'editing',
    zipCode: '115-0042',
    email: 'yamada-akabane@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '13',
  },
  {
    code: '00002',
    name: '山田電気 立川店',
    kanaName: 'ヤマダデンキ　タチカワテン',
    status: 'editing',
    zipCode: null,
    email: 'yamada-akabane@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '13',
  },
  {
    code: '00003',
    name: '山田電気 札幌店',
    kanaName: 'ヤマダデンキ　サッポロテン',
    status: 'editing',
    zipCode: null,
    email: 'yamada-sapporo@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '01',
  },
  {
    code: '00004',
    name: '山田電気 石引店',
    kanaName: 'ヤマダデンキ　イシビキ',
    status: 'editing',
    zipCode: null,
    email: 'yamada-ishibiki@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '17',
  },
  {
    code: '00005',
    name: '山田電気 越前店',
    kanaName: 'ヤマダデンキ　エチゼンテン',
    status: 'editing',
    zipCode: null,
    email: 'yamada-echizen@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '18',
  },
  {
    // 定休日なし(holidaysが空配列)のケース
    code: '00006',
    name: '山田電気 七尾店',
    kanaName: 'ヤマダデンキ　ナナオ',
    status: 'published',
    zipCode: null,
    email: 'yamada-nanao@test.co.jp',
    phoneNumber: '03-1122-9901',
    holidays: [],
    prefectureCode: '17',
  },
  {
    code: '00007',
    name: 'IBREW 恵比寿店',
    kanaName: 'アイブリュー　エビステン',
    status: 'published',
    zipCode: null,
    email: 'ibrew-ebisu@test.co.jp',
    phoneNumber: '03-1122-8901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '13',
  },
  {
    code: '00008',
    name: 'IBREW 秋葉原店',
    kanaName: 'アイブリュー　アキハバラテン',
    status: 'published',
    zipCode: null,
    email: 'ibrew-akihabara@test.co.jp',
    phoneNumber: '03-1122-8901',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '13',
  },
  {
    code: '00009',
    name: '焼肉きんぐ 川口店',
    kanaName: 'ヤキニクキング　カワグチ',
    status: 'published',
    zipCode: null,
    email: 'yakinikuking-kawaguchi@test.co.jp',
    phoneNumber: '03-1299-0034',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: '11',
  },
  {
    // 都道府県未設定のケース
    code: '00010',
    name: '焼肉きんぐ ダミー店舗',
    kanaName: 'ヤキニクキング　ダミー',
    status: 'published',
    zipCode: null,
    email: 'yakinikuking-dummy@test.co.jp',
    phoneNumber: '03-9999-9999',
    holidays: ['WEDNESDAY', 'SUNDAY'],
    prefectureCode: null,
  },
];

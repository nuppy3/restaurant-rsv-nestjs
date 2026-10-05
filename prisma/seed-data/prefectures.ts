// 都道府県(Prefecture)のマスタデータ
// コードはJIS X 0401(全国地方公共団体コードの上2桁)。regionCode は seed-data/regions.ts のコード。
export interface PrefectureSeed {
  code: string;
  name: string;
  kanaName: string;
  kanaEn: string;
  regionCode: string;
}

export const prefectures: PrefectureSeed[] = [
  // 北海道
  { code: '01', name: '北海道', kanaName: 'ホッカイドウ', kanaEn: 'Hokkaido', regionCode: '01' },
  // 東北
  { code: '02', name: '青森県', kanaName: 'アオモリケン', kanaEn: 'Aomori-ken', regionCode: '02' },
  { code: '03', name: '岩手県', kanaName: 'イワテケン', kanaEn: 'Iwate-ken', regionCode: '02' },
  { code: '04', name: '宮城県', kanaName: 'ミヤギケン', kanaEn: 'Miyagi-ken', regionCode: '02' },
  { code: '05', name: '秋田県', kanaName: 'アキタケン', kanaEn: 'Akita-ken', regionCode: '02' },
  { code: '06', name: '山形県', kanaName: 'ヤマガタケン', kanaEn: 'Yamagata-ken', regionCode: '02' },
  { code: '07', name: '福島県', kanaName: 'フクシマケン', kanaEn: 'Fukushima-ken', regionCode: '02' },
  // 関東
  { code: '08', name: '茨城県', kanaName: 'イバラキケン', kanaEn: 'Ibaraki-ken', regionCode: '03' },
  { code: '09', name: '栃木県', kanaName: 'トチギケン', kanaEn: 'Tochigi-ken', regionCode: '03' },
  { code: '10', name: '群馬県', kanaName: 'グンマケン', kanaEn: 'Gunma-ken', regionCode: '03' },
  { code: '11', name: '埼玉県', kanaName: 'サイタマケン', kanaEn: 'Saitama-ken', regionCode: '03' },
  { code: '12', name: '千葉県', kanaName: 'チバケン', kanaEn: 'Chiba-ken', regionCode: '03' },
  { code: '13', name: '東京都', kanaName: 'トウキョウト', kanaEn: 'Tokyo-to', regionCode: '03' },
  { code: '14', name: '神奈川県', kanaName: 'カナガワケン', kanaEn: 'Kanagawa-ken', regionCode: '03' },
  // 中部
  { code: '15', name: '新潟県', kanaName: 'ニイガタケン', kanaEn: 'Niigata-ken', regionCode: '04' },
  { code: '16', name: '富山県', kanaName: 'トヤマケン', kanaEn: 'Toyama-ken', regionCode: '04' },
  { code: '17', name: '石川県', kanaName: 'イシカワケン', kanaEn: 'Ishikawa-ken', regionCode: '04' },
  { code: '18', name: '福井県', kanaName: 'フクイケン', kanaEn: 'Fukui-ken', regionCode: '04' },
  { code: '19', name: '山梨県', kanaName: 'ヤマナシケン', kanaEn: 'Yamanashi-ken', regionCode: '04' },
  { code: '20', name: '長野県', kanaName: 'ナガノケン', kanaEn: 'Nagano-ken', regionCode: '04' },
  { code: '21', name: '岐阜県', kanaName: 'ギフケン', kanaEn: 'Gifu-ken', regionCode: '04' },
  { code: '22', name: '静岡県', kanaName: 'シズオカケン', kanaEn: 'Shizuoka-ken', regionCode: '04' },
  { code: '23', name: '愛知県', kanaName: 'アイチケン', kanaEn: 'Aichi-ken', regionCode: '04' },
  // 近畿
  { code: '24', name: '三重県', kanaName: 'ミエケン', kanaEn: 'Mie-ken', regionCode: '05' },
  { code: '25', name: '滋賀県', kanaName: 'シガケン', kanaEn: 'Shiga-ken', regionCode: '05' },
  { code: '26', name: '京都府', kanaName: 'キョウトフ', kanaEn: 'Kyoto-fu', regionCode: '05' },
  { code: '27', name: '大阪府', kanaName: 'オオサカフ', kanaEn: 'Osaka-fu', regionCode: '05' },
  { code: '28', name: '兵庫県', kanaName: 'ヒョウゴケン', kanaEn: 'Hyogo-ken', regionCode: '05' },
  { code: '29', name: '奈良県', kanaName: 'ナラケン', kanaEn: 'Nara-ken', regionCode: '05' },
  { code: '30', name: '和歌山県', kanaName: 'ワカヤマケン', kanaEn: 'Wakayama-ken', regionCode: '05' },
  // 中国
  { code: '31', name: '鳥取県', kanaName: 'トットリケン', kanaEn: 'Tottori-ken', regionCode: '06' },
  { code: '32', name: '島根県', kanaName: 'シマネケン', kanaEn: 'Shimane-ken', regionCode: '06' },
  { code: '33', name: '岡山県', kanaName: 'オカヤマケン', kanaEn: 'Okayama-ken', regionCode: '06' },
  { code: '34', name: '広島県', kanaName: 'ヒロシマケン', kanaEn: 'Hiroshima-ken', regionCode: '06' },
  { code: '35', name: '山口県', kanaName: 'ヤマグチケン', kanaEn: 'Yamaguchi-ken', regionCode: '06' },
  // 四国
  { code: '36', name: '徳島県', kanaName: 'トクシマケン', kanaEn: 'Tokushima-ken', regionCode: '07' },
  { code: '37', name: '香川県', kanaName: 'カガワケン', kanaEn: 'Kagawa-ken', regionCode: '07' },
  { code: '38', name: '愛媛県', kanaName: 'エヒメケン', kanaEn: 'Ehime-ken', regionCode: '07' },
  { code: '39', name: '高知県', kanaName: 'コウチケン', kanaEn: 'Kochi-ken', regionCode: '07' },
  // 九州(沖縄を含む)
  { code: '40', name: '福岡県', kanaName: 'フクオカケン', kanaEn: 'Fukuoka-ken', regionCode: '08' },
  { code: '41', name: '佐賀県', kanaName: 'サガケン', kanaEn: 'Saga-ken', regionCode: '08' },
  { code: '42', name: '長崎県', kanaName: 'ナガサキケン', kanaEn: 'Nagasaki-ken', regionCode: '08' },
  { code: '43', name: '熊本県', kanaName: 'クマモトケン', kanaEn: 'Kumamoto-ken', regionCode: '08' },
  { code: '44', name: '大分県', kanaName: 'オオイタケン', kanaEn: 'Oita-ken', regionCode: '08' },
  { code: '45', name: '宮崎県', kanaName: 'ミヤザキケン', kanaEn: 'Miyazaki-ken', regionCode: '08' },
  { code: '46', name: '鹿児島県', kanaName: 'カゴシマケン', kanaEn: 'Kagoshima-ken', regionCode: '08' },
  { code: '47', name: '沖縄県', kanaName: 'オキナワケン', kanaEn: 'Okinawa-ken', regionCode: '08' },
];

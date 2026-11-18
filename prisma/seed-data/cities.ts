// 都市(City)のマスタデータ
// フロント(restaurant-rsv-cowork-nextjs)の src/data/areas.ts の8都市を移植したもの。並び順(sortOrder)も areas.ts と同じ。
// ・code: '001'〜(3桁)
// ・status: 全都市 published。都市ツリー API(GET /cities/tree)は公開中の都市だけを返すため。
//   地区(District)が無い都市(東京以外)は、フロントで「準備中」と表示する(districts が空配列)
// ・prefectureCode: 所属する都道府県のコード(JIS X 0401。seed-data/prefectures.ts の code)。
//   都道府県のid(UUID)はseedを実行するまで決まらないため、ここではコードで書いておき、
//   seed.ts の中で作成済みの都道府県のidに置き換える(prefectureId に解決する)
export interface CitySeed {
  code: string;
  name: string;
  kanaName: string;
  slug: string;
  sortOrder: number;
  status: 'published' | 'editing';
  prefectureCode: string;
}

export const cities: CitySeed[] = [
  { code: '001', name: '東京', kanaName: 'トウキョウ', slug: 'tokyo', sortOrder: 1, status: 'published', prefectureCode: '13' }, // 東京都
  { code: '002', name: '大阪', kanaName: 'オオサカ', slug: 'osaka', sortOrder: 2, status: 'published', prefectureCode: '27' }, // 大阪府
  { code: '003', name: '京都', kanaName: 'キョウト', slug: 'kyoto', sortOrder: 3, status: 'published', prefectureCode: '26' }, // 京都府
  { code: '004', name: '名古屋', kanaName: 'ナゴヤ', slug: 'nagoya', sortOrder: 4, status: 'published', prefectureCode: '23' }, // 愛知県
  { code: '005', name: '横浜', kanaName: 'ヨコハマ', slug: 'yokohama', sortOrder: 5, status: 'published', prefectureCode: '14' }, // 神奈川県
  { code: '006', name: '福岡', kanaName: 'フクオカ', slug: 'fukuoka', sortOrder: 6, status: 'published', prefectureCode: '40' }, // 福岡県
  { code: '007', name: '札幌', kanaName: 'サッポロ', slug: 'sapporo', sortOrder: 7, status: 'published', prefectureCode: '01' }, // 北海道
  { code: '008', name: '沖縄', kanaName: 'オキナワ', slug: 'okinawa', sortOrder: 8, status: 'published', prefectureCode: '47' }, // 沖縄県
];

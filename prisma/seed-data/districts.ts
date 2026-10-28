// 地区(District)のマスタデータ
// フロント(restaurant-rsv-cowork-nextjs)の src/data/areas.ts の東京の7地区を移植したもの。並び順(sortOrder)も areas.ts と同じ。
// ・code: '00001'〜(5桁)
// ・status: すべて published(親の都市(東京)が published のため公開できる)
// ・cityCode: 所属する都市のコード(seed-data/cities.ts の code)。
//   都市のid(UUID)はseedを実行するまで決まらないため、ここではコードで書いておき、
//   seed.ts の中で作成済みの都市のidに置き換える(cityId に解決する)
export interface DistrictSeed {
  code: string;
  name: string;
  kanaName: string;
  slug: string;
  sortOrder: number;
  status: 'published' | 'editing';
  cityCode: string;
}

export const districts: DistrictSeed[] = [
  { code: '00001', name: '銀座', kanaName: 'ギンザ', slug: 'ginza', sortOrder: 1, status: 'published', cityCode: '001' }, // 東京
  { code: '00002', name: '恵比寿', kanaName: 'エビス', slug: 'ebisu', sortOrder: 2, status: 'published', cityCode: '001' }, // 東京
  { code: '00003', name: '広尾', kanaName: 'ヒロオ', slug: 'hiroo', sortOrder: 3, status: 'published', cityCode: '001' }, // 東京
  { code: '00004', name: '代官山', kanaName: 'ダイカンヤマ', slug: 'daikanyama', sortOrder: 4, status: 'published', cityCode: '001' }, // 東京
  { code: '00005', name: '六本木', kanaName: 'ロッポンギ', slug: 'roppongi', sortOrder: 5, status: 'published', cityCode: '001' }, // 東京
  { code: '00006', name: '神楽坂', kanaName: 'カグラザカ', slug: 'kagurazaka', sortOrder: 6, status: 'published', cityCode: '001' }, // 東京
  { code: '00007', name: '渋谷', kanaName: 'シブヤ', slug: 'shibuya', sortOrder: 7, status: 'published', cityCode: '001' }, // 東京
];

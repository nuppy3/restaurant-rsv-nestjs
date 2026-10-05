// 地方(Region)のマスタデータ
// 国内の8地方区分(沖縄は九州に含める)。コードは01〜08の連番。
export interface RegionSeed {
  code: string;
  name: string;
  kanaName: string;
  kanaEn: string;
}

export const regions: RegionSeed[] = [
  { code: '01', name: '北海道', kanaName: 'ホッカイドウ', kanaEn: 'hokkaido' },
  { code: '02', name: '東北', kanaName: 'トウホク', kanaEn: 'tohoku' },
  { code: '03', name: '関東', kanaName: 'カントウ', kanaEn: 'kanto' },
  { code: '04', name: '中部', kanaName: 'チュウブ', kanaEn: 'chubu' },
  { code: '05', name: '近畿', kanaName: 'キンキ', kanaEn: 'kinki' },
  { code: '06', name: '中国', kanaName: 'チュウゴク', kanaEn: 'chugoku' },
  { code: '07', name: '四国', kanaName: 'シコク', kanaEn: 'shikoku' },
  { code: '08', name: '九州', kanaName: 'キュウシュウ', kanaEn: 'kyushu' },
];

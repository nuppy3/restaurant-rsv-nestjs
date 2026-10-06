import { PrefectureStatus } from '../../domain/prefectures.model';

/**
 * 都道府県一覧(GET /prefectures)用のRead Model
 * 画面表示用に地方名(regionName)を含める。地方未設定の場合はregionId/regionNameともにundefined
 */
export type PrefectureListReadModel = {
  id: string;
  code: string;
  name: string;
  kanaName: string;
  kanaEn: string;
  status: PrefectureStatus;
  regionId?: string;
  regionName?: string;
};

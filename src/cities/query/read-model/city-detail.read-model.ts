import { CityListReadModel } from './city-list.read-model';

/**
 * 都市詳細(GET /cities/:id, GET /cities/code/:code)用のRead Model
 * 一覧の項目(CityListReadModel)に、作成日時・更新日時を加えたもの
 * (一覧では不要な項目なので、詳細だけで返す)
 */
export type CityDetailReadModel = CityListReadModel & {
  createdAt: Date;
  updatedAt: Date;
};

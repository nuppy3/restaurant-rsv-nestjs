/* istanbul ignore file */
// ↑ moduleはDIの設定だけなので、カバレッジの集計対象から外す
import { Module } from '@nestjs/common';
import { PrefecturesModule } from '../prefectures/prefectures.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CitiesService } from './application/cities.service';
import { CITY_REPOSITORY_PORT } from './domain/city.repository.port';
import { CityRepository } from './infrastructure/city.repository';
import { CitiesController } from './presentation/rest/cities.controller';
import { CitiesQueryService } from './query/cities.query.service';

/**
 * City(都市)モジュール
 */
@Module({
  // PrismaModule: Repository / QueryService がDBを使うため
  // PrefecturesModule: CitiesService が都道府県コード → 都道府県ID の解決に PrefecturesQueryService を使うため
  //                    (PrefecturesModule は PrefecturesQueryService を export している)
  imports: [PrismaModule, PrefecturesModule],
  controllers: [CitiesController],
  providers: [
    CitiesService,
    CitiesQueryService,
    // Repositoryの依存性逆転:
    // Application / Query は interface(CityRepositoryPort)に依存し、@Inject(CITY_REPOSITORY_PORT) で受け取る。
    // ここでトークン(CITY_REPOSITORY_PORT)に実装クラス(CityRepository = Prisma実装)を紐づける
    {
      provide: CITY_REPOSITORY_PORT,
      useClass: CityRepository,
    },
  ],
  // 他モジュール(今後の District など)には参照系(QueryService)のみ公開する
  exports: [CitiesQueryService],
})
export class CitiesModule {}

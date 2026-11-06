/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DistrictsController } from './presentation/rest/districts.controller';
import { DistrictsQueryService } from './query/districts.query.service';

/**
 * District(地区)モジュール
 */
@Module({
  // PrismaModule: Repository / QueryService がDBを使うため
  imports: [PrismaModule],
  controllers: [DistrictsController],
  providers: [
    DistrictsQueryService,
    // Repositoryの依存性逆転:
    // Application / Query は interface(DistrictRepositoryPort)に依存し、@Inject(DISTRICT_REPOSITORY_PORT) で受け取る。
    // ここでトークン(DISTRICT_REPOSITORY_PORT)に実装クラス(DistrictRepository = Prisma実装)を紐づける
    // {
    //   provide: DISTRICT_REPOSITORY_PORT,
    //   useClass: DistrictRepository,
    // },
  ],
  // 他モジュール(今後の District など)には参照系(QueryService)のみ公開する
  exports: [DistrictsQueryService],
})
export class DistrictsModule {}

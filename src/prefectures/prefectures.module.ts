/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RegionsModule } from '../regions/regions.module';
import { PREFECTURE_REPOSITORY_PORT } from './domain/prefecture.repository.port';
import { PrefecturesDomainService } from './domain/prefectures.domain.service';
import { PrefectureRepository } from './infrastructure/prefecture.repository';
import { PrefecturesController } from './prefectures.controller';
import { PrefecturesService } from './prefectures.service';
import { PrefecturesQueryService } from './query/prefectures.query.service';

// TODO(SI-755): 旧PrefecturesService(DDD-lite)をApplication層のPrefecturesServiceに置き換え、
//               controllerもpresentation/restに移す
@Module({
  imports: [PrismaModule, RegionsModule],
  controllers: [PrefecturesController],
  providers: [
    PrefecturesService,
    PrefecturesQueryService,
    PrefecturesDomainService,
    {
      provide: PREFECTURE_REPOSITORY_PORT,
      useClass: PrefectureRepository,
    },
  ],
  // 他モジュール(Store)には参照系(QueryService)のみ公開する
  exports: [PrefecturesQueryService],
})
export class PrefecturesModule {}

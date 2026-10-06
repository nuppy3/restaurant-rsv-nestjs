/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RegionsModule } from '../regions/regions.module';
import { PrefecturesService } from './application/prefectures.service';
import { PREFECTURE_REPOSITORY_PORT } from './domain/prefecture.repository.port';
import { PrefecturesDomainService } from './domain/prefectures.domain.service';
import { PrefectureRepository } from './infrastructure/prefecture.repository';
import { PrefecturesController } from './presentation/rest/prefectures.controller';
import { PrefecturesQueryService } from './query/prefectures.query.service';

// ※ 旧DDD-liteのファイル(prefectures.service.ts / prefectures.controller.ts / prefectures.model.ts /
//    dto/ / entities/)は登録を外しただけで残している(手動で確認のうえ削除予定)
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

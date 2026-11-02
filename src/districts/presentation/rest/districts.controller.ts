import { Controller, Query } from '@nestjs/common';
import { DistrictFilter } from '../../../districts/query/district.filter';
import { DistrictsQueryService } from './../../query/districts.query.service';
import { FindAllDistrictsQueryDto } from './dto/district.dto';

@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsQueryService: DistrictsQueryService) {}

  findAllPaginated(@Query() query: FindAllDistrictsQueryDto) {
    // queryDto → filter
    // memo: HTTPSのリクエストパラメーターについてnullって送れるの？unndefindって送れるの？
    // regions.controller.tsを参照
    //
    const filters = {
      name: query.name ?? undefined,
      status: query.status ?? undefined,
      cityCode: query.cityCode ?? undefined,
      page: query.page ?? undefined,
      size: query.size ?? undefined,
    } satisfies DistrictFilter;

    // 地区一覧取得(ページネーション化された)
    const paginated = this.districtsQueryService.findAllPaginated(filters);
  }
}

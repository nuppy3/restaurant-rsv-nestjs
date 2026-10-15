import { PartialType } from '@nestjs/swagger';
import { CreateCityDto } from './city.dto';

/**
 * 都市更新リクエストDTO
 * CreateCityDtoの全項目を任意にしたもの(PartialType。各項目のバリデーションは引き継がれる)
 * → 指定した項目だけがチェックされ、未指定(undefined)の項目は更新しない
 *   例) { "slug": "Tokyo" } は slug の形式違反で400 / { "name": "東京" } は name だけ更新
 * statusは受け付けない(状態遷移はpublish / unpublish / deleteの専用エンドポイントで行う)
 */
export class UpdateCityDto extends PartialType(CreateCityDto) {}

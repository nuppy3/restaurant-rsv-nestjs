import { PartialType } from '@nestjs/swagger';
import { CreatePrefectureDto } from './prefecture.dto';

/**
 * 都道府県更新リクエストDTO
 * CreatePrefectureDtoの全項目を任意にしたもの(バリデーションは引き継がれる)
 * statusは受け付けない(状態遷移はpublish / unpublish / deleteの専用エンドポイントで行う)
 */
export class UpdatePrefectureDto extends PartialType(CreatePrefectureDto) {}

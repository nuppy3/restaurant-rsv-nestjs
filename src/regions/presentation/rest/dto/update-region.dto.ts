import { PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RegionStatus } from '../../../domain/regions.model';
import { CreateRegionDto } from './region.dto';

/**
 * Update用のDTO
 *
 * region.dto.tsに集約してもよかったのだが、NestJsのinitにて
 * 自動生成されたクラスなので、せっかくなので使用。
 *
 * DTO の必須プロパティには ! をつける。（例: name!: string;）
 * DTO の任意プロパティには ? をつける。（例: kanaName?: string;）
 *
 * memo: PartialTypeはユーティリティ関数で、既存のDTOクラスを継承しつつ、全プロパティを
 *       自動的にoptional(?付き)に変換してくれます。バリデーションデコレーター(@IsStringなど)
 *       ただし実際にはname/code/kanaName/status/kanaEnをUpdateRegionDto内で再度
 *       手書きしていて、PartialType(CreateRegionDto)からの継承と二重になっている状態です
 *       (コメントにある通り、NestJS CLIのinit時の自動生成をそのまま活かした名残)。
 */
export class UpdateRegionDto extends PartialType(CreateRegionDto) {
  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaName?: string;

  @IsOptional()
  // RegionStatusは厳密なEnumではない（modern Enum=union)だが@IsEnum()が効くみたい！
  @IsEnum(RegionStatus, {
    message: `StoreStatus must be one of: ${RegionStatus.PUBLISHED}, ${RegionStatus.SUSPENDED}`,
  })
  status?: RegionStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  kanaEn?: string;
}

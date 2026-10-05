import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Class Validatorを利用するため、class-validatorをnpmにてインストール
// @IsString(),@IsNotEmpryなどはClass Validatorno用のデコレーター
export class CreateItemDto {
  // id: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(1)
  price!: number;

  @IsOptional() // 任意項目デコレーター(渡された値がnullの場合は、以降のIsString、MaxLengthなどを無視する)
  @IsString() // 任意項目だが入力された際のValidation
  @MaxLength(100) // 任意項目だが入力された際のValidation
  description?: string;
}

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { UserStatus } from 'generated/prisma';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  password!: string;

  @IsEnum(UserStatus)
  status!: UserStatus;
}

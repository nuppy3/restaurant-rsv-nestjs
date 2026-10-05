import { PartialType } from '@nestjs/swagger';
import { CreateStoreDto } from './store.dto';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}

import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMenteeDto } from './create-mentee.dto';

export class UpdateMenteeDto extends PartialType(
  OmitType(CreateMenteeDto, ['learnerCategory', 'parentUserId'] as const),
) {}

import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAvailabilityDto } from './create-availability.dto';

export class UpdateAvailabilityDto extends PartialType(
  OmitType(CreateAvailabilityDto, ['dayOfWeek'] as const),
) {}

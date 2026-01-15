import { PartialType } from '@nestjs/swagger';
import { CreateMentorDto } from './create-mentor.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMentorDto extends PartialType(CreateMentorDto) {
  @ApiPropertyOptional({
    description: 'Whether the mentor is currently accepting students',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isAcceptingStudents?: boolean;
}

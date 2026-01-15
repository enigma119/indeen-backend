import { ApiProperty } from '@nestjs/swagger';

export class CompatibilityReasonDto {
  @ApiProperty({
    description: 'Category of the compatibility factor',
    example: 'LEARNER_CATEGORY',
  })
  category: string;

  @ApiProperty({
    description: 'Weight of this factor (max possible points)',
    example: 100,
  })
  weight: number;

  @ApiProperty({
    description: 'Points earned for this factor',
    example: 100,
  })
  score: number;

  @ApiProperty({
    description: 'Human-readable explanation',
    example: 'Mentor teaches adults and mentee is an adult learner',
  })
  reason: string;

  @ApiProperty({
    description: 'Whether this is a match or mismatch',
    example: true,
  })
  isMatch: boolean;
}

export class CompatibilityScoreDto {
  @ApiProperty({
    description: 'Mentor profile ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  mentorId: string;

  @ApiProperty({
    description: 'Mentee profile ID',
    example: '223e4567-e89b-12d3-a456-426614174001',
  })
  menteeId: string;

  @ApiProperty({
    description: 'Overall compatibility score (0-100)',
    example: 85,
  })
  score: number;

  @ApiProperty({
    description: 'Compatibility level based on score',
    example: 'HIGH',
    enum: ['EXCELLENT', 'HIGH', 'MEDIUM', 'LOW', 'POOR'],
  })
  level: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POOR';

  @ApiProperty({
    description: 'Detailed breakdown of compatibility factors',
    type: [CompatibilityReasonDto],
  })
  reasons: CompatibilityReasonDto[];

  @ApiProperty({
    description: 'Whether this mentor is recommended',
    example: true,
  })
  isRecommended: boolean;
}

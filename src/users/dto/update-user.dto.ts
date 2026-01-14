import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+33612345678',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'User gender',
    example: 'male',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'FR',
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'User timezone',
    example: 'Europe/Paris',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'User locale',
    example: 'fr',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({
    description: 'Preferred currency (ISO 4217)',
    example: 'EUR',
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  preferredCurrency?: string;

  @ApiPropertyOptional({
    description: 'Enable email notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notificationEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable SMS notifications',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  notificationSms?: boolean;
}

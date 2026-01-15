import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MentorsService } from './mentors.service';
import {
  CreateMentorDto,
  UpdateMentorDto,
  SearchMentorDto,
  MentorResponseDto,
  MentorStatsDto,
  PaginatedMentorResponseDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { VerificationStatus } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@ApiTags('Mentors')
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Post()
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create mentor profile' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Mentor profile created successfully',
    type: MentorResponseDto,
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'User already has a mentor profile' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only MENTOR role can create profile' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createMentorDto: CreateMentorDto,
  ): Promise<MentorResponseDto> {
    return this.mentorsService.create(user.sub, createMentorDto) as unknown as MentorResponseDto;
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all approved mentors with filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of mentors',
    type: PaginatedMentorResponseDto,
  })
  @ApiQuery({ name: 'languages', required: false, type: [String], description: 'Filter by languages' })
  @ApiQuery({ name: 'specialties', required: false, type: [String], description: 'Filter by specialties' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum hourly rate' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum hourly rate' })
  @ApiQuery({ name: 'minRating', required: false, type: Number, description: 'Minimum rating' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  async findAll(@Query() searchDto: SearchMentorDto): Promise<PaginatedMentorResponseDto> {
    return this.mentorsService.findAll(searchDto, false) as unknown as PaginatedMentorResponseDto;
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Advanced mentor search with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results',
    type: PaginatedMentorResponseDto,
  })
  async search(@Query() searchDto: SearchMentorDto): Promise<PaginatedMentorResponseDto> {
    return this.mentorsService.searchMentors(searchDto) as unknown as PaginatedMentorResponseDto;
  }

  @Get('me')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user mentor profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentor profile',
    type: MentorResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Mentor profile not found' })
  async getMyProfile(@CurrentUser() user: JwtPayload): Promise<MentorResponseDto> {
    const profile = await this.mentorsService.findByUserId(user.sub);
    if (!profile) {
      throw new Error('Mentor profile not found');
    }
    return profile as unknown as MentorResponseDto;
  }

  @Patch('me')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user mentor profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentor profile updated',
    type: MentorResponseDto,
  })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updateMentorDto: UpdateMentorDto,
  ): Promise<MentorResponseDto> {
    const profile = await this.mentorsService.findByUserId(user.sub);
    if (!profile) {
      throw new Error('Mentor profile not found');
    }
    return this.mentorsService.update(
      profile.id,
      user.sub,
      updateMentorDto,
    ) as unknown as MentorResponseDto;
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get mentor profile by ID' })
  @ApiParam({ name: 'id', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentor profile',
    type: MentorResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Mentor not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MentorResponseDto> {
    return this.mentorsService.findByIdOrFail(id, false) as unknown as MentorResponseDto;
  }

  @Get(':id/stats')
  @Public()
  @ApiOperation({ summary: 'Get mentor statistics' })
  @ApiParam({ name: 'id', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentor statistics',
    type: MentorStatsDto,
  })
  async getStats(@Param('id', ParseUUIDPipe) id: string): Promise<MentorStatsDto> {
    return this.mentorsService.getMentorStats(id);
  }

  @Patch(':id/verification')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update mentor verification status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification status updated',
    type: MentorResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
  async updateVerificationStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: VerificationStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<MentorResponseDto> {
    return this.mentorsService.updateVerificationStatus(
      id,
      status,
      user.sub,
    ) as unknown as MentorResponseDto;
  }
}

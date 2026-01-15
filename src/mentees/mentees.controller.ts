import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MenteesService } from './mentees.service';
import {
  CreateMenteeDto,
  UpdateMenteeDto,
  MenteeResponseDto,
  MenteeProgressDto,
  ParentalConsentDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@ApiTags('Mentees')
@Controller('mentees')
@ApiBearerAuth()
export class MenteesController {
  constructor(private readonly menteesService: MenteesService) {}

  @Post()
  @Roles('MENTEE', 'PARENT')
  @ApiOperation({ summary: 'Create mentee profile' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Mentee profile created successfully',
    type: MenteeResponseDto,
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'User already has a mentee profile' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only MENTEE or PARENT role can create profile' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Parent user ID required for minors' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createMenteeDto: CreateMenteeDto,
  ): Promise<MenteeResponseDto> {
    return this.menteesService.create(user.sub, createMenteeDto) as unknown as MenteeResponseDto;
  }

  @Get('me')
  @Roles('MENTEE')
  @ApiOperation({ summary: 'Get current user mentee profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentee profile',
    type: MenteeResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Mentee profile not found' })
  async getMyProfile(@CurrentUser() user: JwtPayload): Promise<MenteeResponseDto> {
    const profile = await this.menteesService.findByUserId(user.sub);
    if (!profile) {
      throw new NotFoundException('Mentee profile not found');
    }
    return profile as unknown as MenteeResponseDto;
  }

  @Patch('me')
  @Roles('MENTEE')
  @ApiOperation({ summary: 'Update current user mentee profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentee profile updated',
    type: MenteeResponseDto,
  })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updateMenteeDto: UpdateMenteeDto,
  ): Promise<MenteeResponseDto> {
    const profile = await this.menteesService.findByUserId(user.sub);
    if (!profile) {
      throw new NotFoundException('Mentee profile not found');
    }
    return this.menteesService.update(
      profile.id,
      user.sub,
      updateMenteeDto,
    ) as unknown as MenteeResponseDto;
  }

  @Get('me/progress')
  @Roles('MENTEE')
  @ApiOperation({ summary: 'Get current user learning progress' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentee progress',
    type: MenteeProgressDto,
  })
  async getMyProgress(@CurrentUser() user: JwtPayload): Promise<MenteeProgressDto> {
    const profile = await this.menteesService.findByUserId(user.sub);
    if (!profile) {
      throw new NotFoundException('Mentee profile not found');
    }
    return this.menteesService.getMenteeProgress(profile.id);
  }

  @Get(':id')
  @Roles('MENTOR', 'PARENT', 'ADMIN')
  @ApiOperation({ summary: 'Get mentee profile by ID' })
  @ApiParam({ name: 'id', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentee profile',
    type: MenteeResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Mentee not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MenteeResponseDto> {
    // Check if user can view this mentee profile
    const canView = await this.menteesService.canViewMenteeProfile(id, user.sub, user.role);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this mentee profile');
    }

    return this.menteesService.findByIdOrFail(id) as unknown as MenteeResponseDto;
  }

  @Get(':id/progress')
  @Roles('MENTOR', 'PARENT', 'ADMIN')
  @ApiOperation({ summary: 'Get mentee learning progress' })
  @ApiParam({ name: 'id', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mentee progress',
    type: MenteeProgressDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MenteeProgressDto> {
    const canView = await this.menteesService.canViewMenteeProfile(id, user.sub, user.role);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this mentee progress');
    }

    return this.menteesService.getMenteeProgress(id);
  }

  @Get(':id/consent')
  @Roles('PARENT', 'ADMIN')
  @ApiOperation({ summary: 'Check parental consent status' })
  @ApiParam({ name: 'id', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Parental consent status',
    type: ParentalConsentDto,
  })
  async checkConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ParentalConsentDto> {
    const mentee = await this.menteesService.findByIdOrFail(id);

    // Only parent or admin can check consent
    if (user.role !== 'ADMIN' && mentee.parentUserId !== user.sub) {
      throw new ForbiddenException('Only the designated parent or admin can check consent status');
    }

    return this.menteesService.checkParentalConsent(id) as unknown as ParentalConsentDto;
  }

  @Post(':id/consent')
  @Roles('PARENT')
  @ApiOperation({ summary: 'Grant parental consent' })
  @ApiParam({ name: 'id', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Parental consent granted',
    type: MenteeResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only designated parent can grant consent' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Consent already granted' })
  async grantConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MenteeResponseDto> {
    return this.menteesService.grantParentalConsent(
      id,
      user.sub,
    ) as unknown as MenteeResponseDto;
  }
}

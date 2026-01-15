import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { AvailabilityService } from './availability.service';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  BulkAvailabilityDto,
  AvailabilityResponseDto,
  AvailableSlotsResponseDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@ApiTags('Availability')
@Controller()
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('mentors/:mentorId/availability')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add availability slot for a mentor' })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Availability slot created',
    type: AvailabilityResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid time range or overlap' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not your mentor profile' })
  async addAvailability(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
    @CurrentUser() user: JwtPayload,
    @Body() createDto: CreateAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    const result = await this.availabilityService.addAvailability(
      mentorId,
      user.sub,
      createDto,
    );
    return this.mapToResponse(result);
  }

  @Get('mentors/:mentorId/availability')
  @Public()
  @ApiOperation({ summary: 'Get all availability slots for a mentor' })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of availability slots',
    type: [AvailabilityResponseDto],
  })
  async getAvailabilities(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
  ): Promise<AvailabilityResponseDto[]> {
    const results = await this.availabilityService.getAvailabilities(mentorId);
    return results.map((r) => this.mapToResponse(r));
  }

  @Get('mentors/:mentorId/available-slots')
  @Public()
  @ApiOperation({ summary: 'Get available booking slots for a specific date' })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2024-01-20' })
  @ApiQuery({ name: 'duration', description: 'Session duration in minutes', example: 60 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available slots',
    type: AvailableSlotsResponseDto,
  })
  async getAvailableSlots(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
    @Query('date') date: string,
    @Query('duration') duration: string,
  ): Promise<AvailableSlotsResponseDto> {
    const durationMinutes = parseInt(duration, 10) || 60;
    const slots = await this.availabilityService.getAvailableSlots(
      mentorId,
      date,
      durationMinutes,
    );

    return {
      mentorId,
      date,
      requestedDuration: durationMinutes,
      slots,
    };
  }

  @Get('mentors/:mentorId/availability/check-conflict')
  @Public()
  @ApiOperation({ summary: 'Check for scheduling conflicts' })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'startTime', description: 'Start time in HH:MM format' })
  @ApiQuery({ name: 'endTime', description: 'End time in HH:MM format' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conflict check result',
  })
  async checkConflict(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ): Promise<{ hasConflict: boolean; conflictingSessions: string[] }> {
    return this.availabilityService.checkConflict(mentorId, date, startTime, endTime);
  }

  @Post('mentors/:mentorId/availability/bulk')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk create weekly availability pattern' })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Weekly availability created',
    type: [AvailabilityResponseDto],
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid pattern or overlaps' })
  async bulkCreateAvailability(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
    @CurrentUser() user: JwtPayload,
    @Body() bulkDto: BulkAvailabilityDto,
  ): Promise<AvailabilityResponseDto[]> {
    const results = await this.availabilityService.bulkCreateWeeklyAvailability(
      mentorId,
      user.sub,
      bulkDto,
    );
    return results.map((r) => this.mapToResponse(r));
  }

  @Patch('availability/:id')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update availability slot' })
  @ApiParam({ name: 'id', description: 'Availability ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability updated',
    type: AvailabilityResponseDto,
  })
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateDto: UpdateAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    const result = await this.availabilityService.updateAvailability(
      id,
      user.sub,
      updateDto,
    );
    return this.mapToResponse(result);
  }

  @Delete('availability/:id')
  @Roles('MENTOR')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete availability slot' })
  @ApiParam({ name: 'id', description: 'Availability ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Availability deleted' })
  async deleteAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.availabilityService.deleteAvailability(id, user.sub);
  }

  private mapToResponse(availability: {
    id: string;
    mentorId: string;
    dayOfWeek: number;
    startTime: Date;
    endTime: Date;
    isRecurring: boolean;
    specificDate: Date | null;
    isAvailable: boolean;
    createdAt: Date;
  }): AvailabilityResponseDto {
    return {
      id: availability.id,
      mentorId: availability.mentorId,
      dayOfWeek: availability.dayOfWeek,
      startTime: availability.startTime.toTimeString().slice(0, 8),
      endTime: availability.endTime.toTimeString().slice(0, 8),
      isRecurring: availability.isRecurring,
      specificDate: availability.specificDate?.toISOString().slice(0, 10),
      isAvailable: availability.isAvailable,
      createdAt: availability.createdAt,
    };
  }
}

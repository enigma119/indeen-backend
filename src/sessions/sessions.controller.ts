import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  CancelSessionDto,
  CompleteSessionDto,
  SessionResponseDto,
  PaginatedSessionsResponseDto,
  CancellationResultDto,
  SessionAvailabilityCheckDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser } from '../common/decorators';
import type { SessionStatus } from '@prisma/client';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles('MENTEE')
  @ApiOperation({
    summary: 'Book a session with a mentor',
    description: 'Only mentees can book sessions. Validates mentor availability and approval status.',
  })
  @ApiResponse({
    status: 201,
    description: 'Session booked successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Mentor not available or not approved' })
  @ApiResponse({ status: 404, description: 'Mentor not found' })
  @ApiResponse({ status: 409, description: 'Time slot conflict' })
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createDto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.createSession(user.id, createDto);
    return session as unknown as SessionResponseDto;
  }

  @Get()
  @ApiOperation({
    summary: 'List sessions',
    description: 'Get paginated list of sessions. Results are filtered based on user role.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_MENTOR', 'CANCELLED_BY_MENTEE', 'NO_SHOW_MENTOR', 'NO_SHOW_MENTEE'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of sessions',
    type: PaginatedSessionsResponseDto,
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: SessionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedSessionsResponseDto> {
    const result = await this.sessionsService.findAll(user.id, user.role, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
    return result as unknown as PaginatedSessionsResponseDto;
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming sessions',
    description: 'Returns next 10 scheduled sessions for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of upcoming sessions',
    type: [SessionResponseDto],
  })
  async getUpcomingSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsService.getUpcomingSessions(user.id, user.role);
    return sessions as unknown as SessionResponseDto[];
  }

  @Get('past')
  @ApiOperation({
    summary: 'Get past sessions',
    description: 'Returns completed or cancelled sessions for the current user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of past sessions',
    type: [SessionResponseDto],
  })
  async getPastSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsService.getPastSessions(
      user.id,
      user.role,
      limit ? parseInt(limit, 10) : 20,
    );
    return sessions as unknown as SessionResponseDto[];
  }

  @Get('check-availability')
  @ApiOperation({
    summary: 'Check time slot availability',
    description: 'Check if a specific time slot is available for booking with a mentor',
  })
  @ApiQuery({ name: 'mentorId', required: true, type: String })
  @ApiQuery({ name: 'datetime', required: true, type: String, description: 'ISO 8601 datetime' })
  @ApiQuery({ name: 'durationMinutes', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Availability check result',
    type: SessionAvailabilityCheckDto,
  })
  async checkAvailability(
    @Query('mentorId', ParseUUIDPipe) mentorId: string,
    @Query('datetime') datetime: string,
    @Query('durationMinutes') durationMinutes: string,
  ): Promise<SessionAvailabilityCheckDto> {
    return this.sessionsService.checkAvailability(
      mentorId,
      new Date(datetime),
      parseInt(durationMinutes, 10),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get session details',
    description: 'Retrieve detailed information about a specific session',
  })
  @ApiParam({ name: 'id', type: String, description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session details',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.findByIdOrFail(id);
    return session as unknown as SessionResponseDto;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update session',
    description: 'Update session details. Can be used to reschedule or update notes.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session updated successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized or session not in SCHEDULED status' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 409, description: 'New time slot conflict' })
  async updateSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.updateSession(id, user.id, updateDto);
    return session as unknown as SessionResponseDto;
  }

  @Post(':id/start')
  @Roles('MENTOR')
  @ApiOperation({
    summary: 'Start session',
    description: 'Start an in-progress session. Only the mentor can start, within 15 minutes of scheduled time.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session started',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized or session not ready to start' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.startSession(id, user.id);
    return session as unknown as SessionResponseDto;
  }

  @Post(':id/complete')
  @Roles('MENTOR')
  @ApiOperation({
    summary: 'Complete session',
    description: 'Mark session as completed with notes and progress data. Only the mentor can complete.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session completed',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized or session not in progress' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async completeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeDto: CompleteSessionDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionsService.completeSession(id, user.id, completeDto);
    return session as unknown as SessionResponseDto;
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel session',
    description: `
Cancel a scheduled session. Both mentor and mentee can cancel.

**Refund Policy:**
- \`> 24h before session:\` 100% refund
- \`2-24h before session:\` 50% refund
- \`< 2h before session:\` No refund
    `,
  })
  @ApiParam({ name: 'id', type: String, description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Session cancelled with refund info',
    type: CancellationResultDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized or session not cancellable' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async cancelSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: CancelSessionDto,
  ): Promise<CancellationResultDto> {
    return this.sessionsService.cancelSession(id, user.id, cancelDto);
  }
}

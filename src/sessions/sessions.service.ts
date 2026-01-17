import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  CancelSessionDto,
  CompleteSessionDto,
  CancellationResultDto,
  SessionAvailabilityCheckDto,
} from './dto';
import type { Session, SessionStatus, Prisma } from '@prisma/client';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session (book a session with a mentor)
   */
  async createSession(
    menteeUserId: string,
    createDto: CreateSessionDto,
  ): Promise<Session> {
    // 1. Get mentee profile
    const menteeProfile = await this.prisma.menteeProfile.findUnique({
      where: { userId: menteeUserId },
    });

    if (!menteeProfile) {
      throw new NotFoundException('Mentee profile not found');
    }

    // 2. Verify mentor exists and is APPROVED
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: createDto.mentorProfileId },
      include: { user: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    if (mentor.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException('Mentor is not approved for sessions');
    }

    if (!mentor.isAcceptingStudents) {
      throw new ForbiddenException('Mentor is not currently accepting students');
    }

    // 3. Validate scheduled time
    const scheduledAt = new Date(createDto.scheduledAt);
    const now = new Date();

    if (scheduledAt <= now) {
      throw new BadRequestException('Session must be scheduled in the future');
    }

    // 4. Validate duration within mentor's limits
    if (createDto.durationMinutes < mentor.minSessionDuration) {
      throw new BadRequestException(
        `Duration must be at least ${mentor.minSessionDuration} minutes`,
      );
    }

    if (createDto.durationMinutes > mentor.maxSessionDuration) {
      throw new BadRequestException(
        `Duration cannot exceed ${mentor.maxSessionDuration} minutes`,
      );
    }

    // 5. Check availability
    const scheduledEndAt = new Date(
      scheduledAt.getTime() + createDto.durationMinutes * 60 * 1000,
    );

    const availabilityCheck = await this.checkAvailability(
      createDto.mentorProfileId,
      scheduledAt,
      createDto.durationMinutes,
    );

    if (!availabilityCheck.isAvailable) {
      throw new ConflictException(availabilityCheck.message);
    }

    // 6. Create the session
    const session = await this.prisma.session.create({
      data: {
        mentorProfileId: createDto.mentorProfileId,
        menteeProfileId: menteeProfile.id,
        scheduledAt,
        scheduledEndAt,
        durationMinutes: createDto.durationMinutes,
        timezone: createDto.timezone || mentor.user.timezone || 'UTC',
        status: 'SCHEDULED',
        lessonPlan: createDto.lessonPlan,
        menteeNotes: createDto.menteeNotes,
        topicsCovered: createDto.topicsToCover || [],
      },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        menteeProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // 7. Update mentor and mentee stats
    await this.prisma.$transaction([
      this.prisma.mentorProfile.update({
        where: { id: mentor.id },
        data: { totalSessions: { increment: 1 } },
      }),
      this.prisma.menteeProfile.update({
        where: { id: menteeProfile.id },
        data: { totalSessions: { increment: 1 } },
      }),
    ]);

    this.logger.log(
      `Session ${session.id} created: mentee ${menteeProfile.id} with mentor ${mentor.id}`,
    );

    return session;
  }

  /**
   * Find all sessions with filters
   */
  async findAll(
    userId: string,
    userRole: string,
    filters: {
      status?: SessionStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: Session[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page = 1, limit = 10, status } = filters;
    const skip = (page - 1) * limit;

    const where = await this.buildUserSessionsWhere(userId, userRole, status);

    const [data, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          mentorProfile: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
          menteeProfile: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { id },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
            },
          },
        },
        menteeProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
            },
          },
        },
        payment: true,
        review: true,
      },
    });
  }

  /**
   * Find session by ID or throw
   */
  async findByIdOrFail(id: string): Promise<Session> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  /**
   * Get upcoming sessions for a user
   */
  async getUpcomingSessions(userId: string, userRole: string): Promise<Session[]> {
    const where = await this.buildUserSessionsWhere(userId, userRole);

    return this.prisma.session.findMany({
      where: {
        ...where,
        scheduledAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        menteeProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
  }

  /**
   * Get past sessions for a user
   */
  async getPastSessions(
    userId: string,
    userRole: string,
    limit = 20,
  ): Promise<Session[]> {
    const where = await this.buildUserSessionsWhere(userId, userRole);

    return this.prisma.session.findMany({
      where: {
        ...where,
        OR: [
          { status: 'COMPLETED' },
          { status: 'CANCELLED_BY_MENTOR' },
          { status: 'CANCELLED_BY_MENTEE' },
          { status: 'NO_SHOW_MENTOR' },
          { status: 'NO_SHOW_MENTEE' },
        ],
      },
      include: {
        mentorProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        menteeProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        review: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update session
   */
  async updateSession(
    id: string,
    userId: string,
    updateDto: UpdateSessionDto,
  ): Promise<Session> {
    const session = await this.findByIdOrFail(id);

    // Verify user is participant
    await this.verifyParticipant(session, userId);

    // Can only update SCHEDULED sessions
    if (session.status !== 'SCHEDULED') {
      throw new ForbiddenException('Can only update scheduled sessions');
    }

    // If rescheduling, validate new time
    let scheduledEndAt = session.scheduledEndAt;
    if (updateDto.scheduledAt) {
      const newScheduledAt = new Date(updateDto.scheduledAt);
      if (newScheduledAt <= new Date()) {
        throw new BadRequestException('New time must be in the future');
      }

      const duration = updateDto.durationMinutes || session.durationMinutes;
      scheduledEndAt = new Date(newScheduledAt.getTime() + duration * 60 * 1000);

      // Check availability for new time
      const availability = await this.checkAvailability(
        session.mentorProfileId,
        newScheduledAt,
        duration,
        id,
      );

      if (!availability.isAvailable) {
        throw new ConflictException(availability.message);
      }
    }

    return this.prisma.session.update({
      where: { id },
      data: {
        scheduledAt: updateDto.scheduledAt ? new Date(updateDto.scheduledAt) : undefined,
        scheduledEndAt: updateDto.scheduledAt ? scheduledEndAt : undefined,
        durationMinutes: updateDto.durationMinutes,
        lessonPlan: updateDto.lessonPlan,
        menteeNotes: updateDto.menteeNotes,
        mentorNotes: updateDto.mentorNotes,
        topicsCovered: updateDto.topicsToCover,
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: { include: { user: true } },
        menteeProfile: { include: { user: true } },
      },
    });
  }

  /**
   * Cancel session
   */
  async cancelSession(
    id: string,
    userId: string,
    cancelDto: CancelSessionDto,
  ): Promise<CancellationResultDto> {
    const session = await this.findByIdOrFail(id);

    // Verify user is participant
    const isMentor = await this.isMentor(session, userId);
    const isMentee = await this.isMentee(session, userId);

    if (!isMentor && !isMentee) {
      throw new ForbiddenException('You are not a participant in this session');
    }

    // Can only cancel SCHEDULED sessions
    if (session.status !== 'SCHEDULED') {
      throw new ForbiddenException('Can only cancel scheduled sessions');
    }

    // Calculate refund percentage based on time until session
    const hoursUntilSession =
      (session.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);

    let refundPercentage: number;
    let message: string;

    if (hoursUntilSession >= 24) {
      refundPercentage = 100;
      message = 'Full refund issued (cancelled > 24h before session)';
    } else if (hoursUntilSession >= 2) {
      refundPercentage = 50;
      message = 'Partial refund (50%) issued (cancelled < 24h before session)';
    } else {
      refundPercentage = 0;
      message = 'No refund (cancelled < 2h before session)';
    }

    const status: SessionStatus = isMentor
      ? 'CANCELLED_BY_MENTOR'
      : 'CANCELLED_BY_MENTEE';

    // Update session
    await this.prisma.session.update({
      where: { id },
      data: {
        status,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: cancelDto.reason,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Session ${id} cancelled by ${isMentor ? 'mentor' : 'mentee'}, refund: ${refundPercentage}%`,
    );

    return {
      success: true,
      status,
      refundPercentage,
      message,
    };
  }

  /**
   * Start session (mentor only)
   */
  async startSession(id: string, mentorUserId: string): Promise<Session> {
    const session = await this.findByIdOrFail(id);

    // Verify mentor
    const isMentor = await this.isMentor(session, mentorUserId);
    if (!isMentor) {
      throw new ForbiddenException('Only the mentor can start the session');
    }

    if (session.status !== 'SCHEDULED') {
      throw new ForbiddenException('Session is not in SCHEDULED status');
    }

    // Check if it's within 15 minutes of scheduled time
    const minutesUntilStart =
      (session.scheduledAt.getTime() - Date.now()) / (1000 * 60);

    if (minutesUntilStart > 15) {
      throw new ForbiddenException(
        'Session can only be started within 15 minutes of scheduled time',
      );
    }

    return this.prisma.session.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: { include: { user: true } },
        menteeProfile: { include: { user: true } },
      },
    });
  }

  /**
   * Complete session (mentor only)
   */
  async completeSession(
    id: string,
    mentorUserId: string,
    completeDto: CompleteSessionDto,
  ): Promise<Session> {
    const session = await this.findByIdOrFail(id);

    // Verify mentor
    const isMentor = await this.isMentor(session, mentorUserId);
    if (!isMentor) {
      throw new ForbiddenException('Only the mentor can complete the session');
    }

    if (session.status !== 'IN_PROGRESS' && session.status !== 'SCHEDULED') {
      throw new ForbiddenException('Session must be in progress or scheduled to complete');
    }

    // Update session
    const updatedSession = await this.prisma.session.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        mentorNotes: completeDto.mentorNotes,
        topicsCovered: completeDto.topicsCovered || [],
        surahStudied: completeDto.surahStudied,
        surahNumber: completeDto.surahNumber,
        ayatRange: completeDto.ayatRange,
        masteryLevel: completeDto.masteryLevel,
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    // Update stats
    const actualDuration = session.durationMinutes;
    const hoursLearned = actualDuration / 60;

    await this.prisma.$transaction([
      this.prisma.mentorProfile.update({
        where: { id: session.mentorProfileId },
        data: { completedSessions: { increment: 1 } },
      }),
      this.prisma.menteeProfile.update({
        where: { id: session.menteeProfileId },
        data: {
          completedSessions: { increment: 1 },
          totalHoursLearned: { increment: hoursLearned },
        },
      }),
    ]);

    // Create progress tracking if surah was studied
    if (completeDto.surahNumber) {
      await this.prisma.progressTracking.create({
        data: {
          menteeProfileId: session.menteeProfileId,
          sessionId: session.id,
          category: 'quran',
          surahNumber: completeDto.surahNumber,
          surahName: completeDto.surahStudied,
          ayahFrom: completeDto.ayatRange ? parseInt(completeDto.ayatRange.split('-')[0]) : null,
          ayahTo: completeDto.ayatRange ? parseInt(completeDto.ayatRange.split('-')[1]) : null,
          masteryLevel: completeDto.masteryLevel || 0,
          notes: completeDto.mentorNotes,
        },
      });
    }

    this.logger.log(`Session ${id} completed`);

    return updatedSession;
  }

  /**
   * Check if a time slot is available for booking
   */
  async checkAvailability(
    mentorId: string,
    datetime: Date,
    durationMinutes: number,
    excludeSessionId?: string,
  ): Promise<SessionAvailabilityCheckDto> {
    const endTime = new Date(datetime.getTime() + durationMinutes * 60 * 1000);

    // Check for conflicting sessions
    const conflictingSession = await this.prisma.session.findFirst({
      where: {
        mentorProfileId: mentorId,
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { scheduledAt: { lte: datetime } },
              { scheduledEndAt: { gt: datetime } },
            ],
          },
          {
            AND: [
              { scheduledAt: { lt: endTime } },
              { scheduledEndAt: { gte: endTime } },
            ],
          },
          {
            AND: [
              { scheduledAt: { gte: datetime } },
              { scheduledEndAt: { lte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflictingSession) {
      return {
        isAvailable: false,
        message: 'Time slot conflicts with an existing session',
        conflictingSessionId: conflictingSession.id,
      };
    }

    // Check mentor availability for this day/time
    const dayOfWeek = datetime.getDay();
    const timeMinutes = datetime.getHours() * 60 + datetime.getMinutes();
    const endTimeMinutes = timeMinutes + durationMinutes;

    const availability = await this.prisma.mentorAvailability.findFirst({
      where: {
        mentorId,
        dayOfWeek,
        isAvailable: true,
      },
    });

    if (!availability) {
      return {
        isAvailable: false,
        message: 'Mentor is not available on this day',
      };
    }

    // Check if time falls within availability window
    const availStart = availability.startTime.getHours() * 60 + availability.startTime.getMinutes();
    const availEnd = availability.endTime.getHours() * 60 + availability.endTime.getMinutes();

    if (timeMinutes < availStart || endTimeMinutes > availEnd) {
      return {
        isAvailable: false,
        message: 'Time slot is outside mentor\'s availability window',
      };
    }

    return {
      isAvailable: true,
      message: 'Slot is available for booking',
    };
  }

  // ==================== Private Helper Methods ====================

  private async buildUserSessionsWhere(
    userId: string,
    userRole: string,
    status?: SessionStatus,
  ): Promise<Prisma.SessionWhereInput> {
    const where: Prisma.SessionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userRole === 'ADMIN') {
      return where;
    }

    if (userRole === 'MENTOR') {
      const mentor = await this.prisma.mentorProfile.findUnique({
        where: { userId },
      });
      if (mentor) {
        where.mentorProfileId = mentor.id;
      }
    } else if (userRole === 'MENTEE') {
      const mentee = await this.prisma.menteeProfile.findUnique({
        where: { userId },
      });
      if (mentee) {
        where.menteeProfileId = mentee.id;
      }
    } else if (userRole === 'PARENT') {
      const children = await this.prisma.menteeProfile.findMany({
        where: { parentUserId: userId },
        select: { id: true },
      });
      where.menteeProfileId = { in: children.map((c) => c.id) };
    }

    return where;
  }

  private async verifyParticipant(session: Session, userId: string): Promise<void> {
    const isMentor = await this.isMentor(session, userId);
    const isMentee = await this.isMentee(session, userId);

    if (!isMentor && !isMentee) {
      throw new ForbiddenException('You are not a participant in this session');
    }
  }

  private async isMentor(session: Session, userId: string): Promise<boolean> {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: session.mentorProfileId },
    });
    return mentor?.userId === userId;
  }

  private async isMentee(session: Session, userId: string): Promise<boolean> {
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { id: session.menteeProfileId },
    });
    return mentee?.userId === userId;
  }
}

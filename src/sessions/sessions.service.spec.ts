import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: PrismaService;

  const mockMentorProfile = {
    id: 'mentor-profile-1',
    userId: 'mentor-user-1',
    verificationStatus: 'APPROVED',
    isAcceptingStudents: true,
    minSessionDuration: 30,
    maxSessionDuration: 120,
    hourlyRate: 25,
    user: {
      id: 'mentor-user-1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Europe/Paris',
    },
  };

  const mockMenteeProfile = {
    id: 'mentee-profile-1',
    userId: 'mentee-user-1',
    parentUserId: null,
    learnerCategory: 'ADULT',
    currentLevel: 'BEGINNER',
    totalSessions: 0,
    completedSessions: 0,
  };

  const mockSession = {
    id: 'session-1',
    mentorProfileId: 'mentor-profile-1',
    menteeProfileId: 'mentee-profile-1',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    scheduledEndAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1h
    durationMinutes: 60,
    timezone: 'Europe/Paris',
    status: 'SCHEDULED',
    mentorProfile: mockMentorProfile,
    menteeProfile: mockMenteeProfile,
  };

  const mockPrismaService = {
    menteeProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    mentorAvailability: {
      findFirst: jest.fn(),
    },
    progressTracking: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callbacks) => Promise.all(callbacks)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      // Schedule for tomorrow at 10:00 AM UTC
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      futureDate.setHours(10, 0, 0, 0);

      const createDto = {
        mentorProfileId: 'mentor-profile-1',
        scheduledAt: futureDate.toISOString(),
        durationMinutes: 60,
      };

      // Mock availability covering the entire day (0:00 to 23:59)
      const availStart = new Date(futureDate);
      availStart.setHours(0, 0, 0, 0);
      const availEnd = new Date(futureDate);
      availEnd.setHours(23, 59, 0, 0);

      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.findFirst.mockResolvedValue(null); // No conflicts
      mockPrismaService.mentorAvailability.findFirst.mockResolvedValue({
        dayOfWeek: futureDate.getDay(),
        startTime: availStart,
        endTime: availEnd,
        isAvailable: true,
      });
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.mentorProfile.update.mockResolvedValue({});
      mockPrismaService.menteeProfile.update.mockResolvedValue({});

      const result = await service.createSession('mentee-user-1', createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if mentee profile not found', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date().toISOString(),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if mentor not found', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date().toISOString(),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if mentor not approved', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        ...mockMentorProfile,
        verificationStatus: 'PENDING',
      });

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if mentor not accepting students', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        ...mockMentorProfile,
        isAcceptingStudents: false,
      });

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if session in the past', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date(Date.now() - 1000).toISOString(),
          durationMinutes: 60,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if duration below minimum', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 15, // Below min of 30
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if duration above maximum', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.createSession('mentee-user-1', {
          mentorProfileId: 'mentor-1',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 180, // Above max of 120
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated sessions for mentor', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.findMany.mockResolvedValue([mockSession]);
      mockPrismaService.session.count.mockResolvedValue(1);

      const result = await service.findAll('mentor-user-1', 'MENTOR', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should return all sessions for admin', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([mockSession]);
      mockPrismaService.session.count.mockResolvedValue(1);

      const result = await service.findAll('admin-user', 'ADMIN', {});

      expect(result.data).toHaveLength(1);
    });
  });

  describe('findByIdOrFail', () => {
    it('should return session if found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

      const result = await service.findByIdOrFail('session-1');

      expect(result).toEqual(mockSession);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrFail('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSession', () => {
    it('should cancel with 100% refund if > 24h before', async () => {
      const futureSession = {
        ...mockSession,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
      };

      mockPrismaService.session.findUnique.mockResolvedValue(futureSession);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.session.update.mockResolvedValue({});

      const result = await service.cancelSession('session-1', 'mentee-user-1', {
        reason: 'Need to reschedule for personal reasons',
      });

      expect(result.refundPercentage).toBe(100);
      expect(result.status).toBe('CANCELLED_BY_MENTEE');
    });

    it('should cancel with 50% refund if 2-24h before', async () => {
      const nearSession = {
        ...mockSession,
        scheduledAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
      };

      mockPrismaService.session.findUnique.mockResolvedValue(nearSession);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.session.update.mockResolvedValue({});

      const result = await service.cancelSession('session-1', 'mentee-user-1', {
        reason: 'Emergency situation came up',
      });

      expect(result.refundPercentage).toBe(50);
    });

    it('should cancel with 0% refund if < 2h before', async () => {
      const imminentSession = {
        ...mockSession,
        scheduledAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1h from now
      };

      mockPrismaService.session.findUnique.mockResolvedValue(imminentSession);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.session.update.mockResolvedValue({});

      const result = await service.cancelSession('session-1', 'mentee-user-1', {
        reason: 'Last minute cancellation needed',
      });

      expect(result.refundPercentage).toBe(0);
    });

    it('should throw ForbiddenException if not participant', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        ...mockMentorProfile,
        userId: 'other-user',
      });
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue({
        ...mockMenteeProfile,
        userId: 'other-user',
      });

      await expect(
        service.cancelSession('session-1', 'random-user', {
          reason: 'Trying to cancel',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if session not scheduled', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED',
      });
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      await expect(
        service.cancelSession('session-1', 'mentee-user-1', {
          reason: 'Trying to cancel completed',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('startSession', () => {
    it('should start session successfully within 15 minutes', async () => {
      const imminentSession = {
        ...mockSession,
        scheduledAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      };

      mockPrismaService.session.findUnique.mockResolvedValue(imminentSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.update.mockResolvedValue({
        ...imminentSession,
        status: 'IN_PROGRESS',
      });

      const result = await service.startSession('session-1', 'mentor-user-1');

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw ForbiddenException if not mentor', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        ...mockMentorProfile,
        userId: 'other-user',
      });

      await expect(
        service.startSession('session-1', 'mentee-user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if too early to start', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.startSession('session-1', 'mentor-user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('completeSession', () => {
    it('should complete session successfully', async () => {
      const inProgressSession = {
        ...mockSession,
        status: 'IN_PROGRESS',
      };

      mockPrismaService.session.findUnique.mockResolvedValue(inProgressSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.update.mockResolvedValue({
        ...inProgressSession,
        status: 'COMPLETED',
      });
      mockPrismaService.mentorProfile.update.mockResolvedValue({});
      mockPrismaService.menteeProfile.update.mockResolvedValue({});

      const result = await service.completeSession('session-1', 'mentor-user-1', {
        mentorNotes: 'Great session',
        topicsCovered: ['tajweed'],
      });

      expect(result.status).toBe('COMPLETED');
    });

    it('should create progress tracking if surah studied', async () => {
      const inProgressSession = {
        ...mockSession,
        status: 'IN_PROGRESS',
      };

      mockPrismaService.session.findUnique.mockResolvedValue(inProgressSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.update.mockResolvedValue({
        ...inProgressSession,
        status: 'COMPLETED',
      });
      mockPrismaService.mentorProfile.update.mockResolvedValue({});
      mockPrismaService.menteeProfile.update.mockResolvedValue({});
      mockPrismaService.progressTracking.create.mockResolvedValue({});

      await service.completeSession('session-1', 'mentor-user-1', {
        surahStudied: 'Al-Fatiha',
        surahNumber: 1,
        ayatRange: '1-7',
        masteryLevel: 8,
      });

      expect(mockPrismaService.progressTracking.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not mentor', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        ...mockMentorProfile,
        userId: 'other-user',
      });

      await expect(
        service.completeSession('session-1', 'mentee-user-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkAvailability', () => {
    it('should return available if no conflicts', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(10, 0, 0, 0);

      // Mock availability covering the entire day
      const availStart = new Date(futureDate);
      availStart.setHours(0, 0, 0, 0);
      const availEnd = new Date(futureDate);
      availEnd.setHours(23, 59, 0, 0);

      mockPrismaService.session.findFirst.mockResolvedValue(null);
      mockPrismaService.mentorAvailability.findFirst.mockResolvedValue({
        dayOfWeek: futureDate.getDay(),
        startTime: availStart,
        endTime: availEnd,
        isAvailable: true,
      });

      const result = await service.checkAvailability(
        'mentor-profile-1',
        futureDate,
        60,
      );

      expect(result.isAvailable).toBe(true);
    });

    it('should return unavailable if conflicting session exists', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue(mockSession);

      const result = await service.checkAvailability(
        'mentor-profile-1',
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        60,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.conflictingSessionId).toBe('session-1');
    });

    it('should return unavailable if mentor not available on that day', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue(null);
      mockPrismaService.mentorAvailability.findFirst.mockResolvedValue(null);

      const result = await service.checkAvailability(
        'mentor-profile-1',
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        60,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.message).toContain('not available on this day');
    });
  });

  describe('getUpcomingSessions', () => {
    it('should return upcoming sessions for user', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.session.findMany.mockResolvedValue([mockSession]);

      const result = await service.getUpcomingSessions('mentee-user-1', 'MENTEE');

      expect(result).toHaveLength(1);
    });
  });

  describe('getPastSessions', () => {
    it('should return past sessions for user', async () => {
      const completedSession = { ...mockSession, status: 'COMPLETED' };
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.session.findMany.mockResolvedValue([completedSession]);

      const result = await service.getPastSessions('mentee-user-1', 'MENTEE');

      expect(result).toHaveLength(1);
    });
  });
});

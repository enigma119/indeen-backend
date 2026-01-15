import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  const mockMentorProfile = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    bio: 'Test mentor',
  };

  const mockAvailability = {
    id: 'avail-123',
    mentorId: mockMentorProfile.id,
    dayOfWeek: 1,
    startTime: new Date('2024-01-01T09:00:00'),
    endTime: new Date('2024-01-01T17:00:00'),
    isRecurring: true,
    specificDate: null,
    isAvailable: true,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    mentorProfile: {
      findUnique: jest.fn(),
    },
    mentorAvailability: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAvailability', () => {
    it('should create availability successfully', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.findMany.mockResolvedValue([]);
      mockPrismaService.mentorAvailability.create.mockResolvedValue(mockAvailability);

      const result = await service.addAvailability(
        mockMentorProfile.id,
        mockMentorProfile.userId,
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      );

      expect(result).toEqual(mockAvailability);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.addAvailability(mockMentorProfile.id, 'other-user', {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when start >= end', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.addAvailability(mockMentorProfile.id, mockMentorProfile.userId, {
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '09:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for overlapping slots', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.findMany.mockResolvedValue([mockAvailability]);

      await expect(
        service.addAvailability(mockMentorProfile.id, mockMentorProfile.userId, {
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkConflict', () => {
    it('should return no conflict when no sessions exist', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const result = await service.checkConflict(
        mockMentorProfile.id,
        '2024-01-20',
        '10:00',
        '11:00',
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingSessions).toHaveLength(0);
    });

    it('should return conflict when session exists', async () => {
      const mockSession = { id: 'session-123' };
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.findMany.mockResolvedValue([mockSession]);

      const result = await service.checkConflict(
        mockMentorProfile.id,
        '2024-01-20',
        '10:00',
        '11:00',
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingSessions).toContain('session-123');
    });

    it('should throw NotFoundException for non-existent mentor', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.checkConflict('non-existent', '2024-01-20', '10:00', '11:00'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return empty array when no availabilities', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        mockMentorProfile.id,
        '2024-01-20',
        60,
      );

      expect(result).toHaveLength(0);
    });

    it('should return slots when availabilities exist', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.findMany.mockResolvedValue([mockAvailability]);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        mockMentorProfile.id,
        '2024-01-22', // Monday (dayOfWeek = 1)
        60,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].durationMinutes).toBe(60);
      expect(result[0].isAvailable).toBe(true);
    });
  });

  describe('bulkCreateWeeklyAvailability', () => {
    it('should create multiple availabilities', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.mentorAvailability.create.mockResolvedValue(mockAvailability);

      const result = await service.bulkCreateWeeklyAvailability(
        mockMentorProfile.id,
        mockMentorProfile.userId,
        {
          weeklyPattern: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
          ],
        },
      );

      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException for overlapping pattern', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);

      await expect(
        service.bulkCreateWeeklyAvailability(
          mockMentorProfile.id,
          mockMentorProfile.userId,
          {
            weeklyPattern: [
              { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
              { dayOfWeek: 1, startTime: '11:00', endTime: '14:00' }, // Overlaps
            ],
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAvailability', () => {
    it('should delete availability successfully', async () => {
      mockPrismaService.mentorAvailability.findUnique.mockResolvedValue(mockAvailability);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorAvailability.delete.mockResolvedValue(mockAvailability);

      await expect(
        service.deleteAvailability(mockAvailability.id, mockMentorProfile.userId),
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException for non-existent availability', async () => {
      mockPrismaService.mentorAvailability.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteAvailability('non-existent', mockMentorProfile.userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

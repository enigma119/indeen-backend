import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { MenteesService } from './mentees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MenteesService', () => {
  let service: MenteesService;
  let prismaService: PrismaService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'mentee@example.com',
    role: 'MENTEE',
    menteeProfile: null,
  };

  const mockParentUser = {
    id: '323e4567-e89b-12d3-a456-426614174002',
    email: 'parent@example.com',
    role: 'PARENT',
  };

  const mockMenteeProfile = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    userId: mockUser.id,
    learnerCategory: 'ADULT',
    isMinor: false,
    yearOfBirth: 1990,
    parentUserId: null,
    parentalConsentGiven: false,
    parentalConsentDate: null,
    currentLevel: 'NO_ARABIC',
    learningContext: 'PERSONAL_GROWTH',
    preferredLanguages: ['fr', 'ar'],
    learningGoals: ['Learn Quran', 'Improve Tajweed'],
    learningPace: 'NORMAL',
    preferredSessionDuration: 60,
    hasSpecialNeeds: false,
    specialNeedsDescription: null,
    totalSessions: 50,
    completedSessions: 48,
    totalHoursLearned: 36.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: mockUser.id,
      email: mockUser.email,
      firstName: 'Jane',
      lastName: 'Doe',
    },
    parent: null,
  };

  const mockMinorMenteeProfile = {
    ...mockMenteeProfile,
    id: '423e4567-e89b-12d3-a456-426614174003',
    learnerCategory: 'CHILD',
    isMinor: true,
    yearOfBirth: 2015,
    parentUserId: mockParentUser.id,
    parentalConsentGiven: false,
    parent: mockParentUser,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    menteeProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
    },
    session: {
      findFirst: jest.fn(),
    },
    progressTracking: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenteesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MenteesService>(MenteesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an adult mentee profile', async () => {
      const createDto = {
        learnerCategory: 'ADULT' as const,
        yearOfBirth: 1990,
        currentLevel: 'NO_ARABIC' as const,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.menteeProfile.create.mockResolvedValue(mockMenteeProfile);

      const result = await service.create(mockUser.id, createDto);

      expect(result).toEqual(mockMenteeProfile);
      expect(prismaService.menteeProfile.create).toHaveBeenCalled();
    });

    it('should create a minor mentee profile with parent', async () => {
      const createDto = {
        learnerCategory: 'CHILD' as const,
        yearOfBirth: 2015,
        parentUserId: mockParentUser.id,
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ ...mockUser, menteeProfile: null })
        .mockResolvedValueOnce(mockParentUser);
      mockPrismaService.menteeProfile.create.mockResolvedValue(mockMinorMenteeProfile);

      const result = await service.create(mockUser.id, createDto);

      expect(result.isMinor).toBe(true);
      expect(result.parentUserId).toBe(mockParentUser.id);
    });

    it('should throw BadRequestException when minor without parent', async () => {
      const createDto = {
        learnerCategory: 'CHILD' as const,
        yearOfBirth: 2015,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.create(mockUser.id, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when parent user not found', async () => {
      const createDto = {
        learnerCategory: 'CHILD' as const,
        yearOfBirth: 2015,
        parentUserId: 'non-existent-parent',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      await expect(service.create(mockUser.id, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when parent user is not PARENT role', async () => {
      const createDto = {
        learnerCategory: 'CHILD' as const,
        yearOfBirth: 2015,
        parentUserId: mockUser.id,
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, role: 'MENTEE' });

      await expect(service.create(mockUser.id, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkParentalConsent', () => {
    it('should return consent not required for adult', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.checkParentalConsent(mockMenteeProfile.id);

      expect(result.isMinor).toBe(false);
      expect(result.consentRequired).toBe(false);
      expect(result.consentGiven).toBe(false);
    });

    it('should return consent required for minor', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMinorMenteeProfile);

      const result = await service.checkParentalConsent(mockMinorMenteeProfile.id);

      expect(result.isMinor).toBe(true);
      expect(result.consentRequired).toBe(true);
      expect(result.consentGiven).toBe(false);
      expect(result.parent).toEqual(mockParentUser);
    });

    it('should return consent given when granted', async () => {
      const consentedMentee = {
        ...mockMinorMenteeProfile,
        parentalConsentGiven: true,
        parentalConsentDate: new Date('2024-01-15'),
      };
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(consentedMentee);

      const result = await service.checkParentalConsent(consentedMentee.id);

      expect(result.consentGiven).toBe(true);
      expect(result.consentDate).toEqual(new Date('2024-01-15'));
    });

    it('should throw NotFoundException for non-existent mentee', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(null);

      await expect(service.checkParentalConsent('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('grantParentalConsent', () => {
    it('should grant consent successfully', async () => {
      const consentedMentee = {
        ...mockMinorMenteeProfile,
        parentalConsentGiven: true,
        parentalConsentDate: new Date(),
      };

      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMinorMenteeProfile);
      mockPrismaService.menteeProfile.update.mockResolvedValue(consentedMentee);

      const result = await service.grantParentalConsent(
        mockMinorMenteeProfile.id,
        mockParentUser.id,
      );

      expect(result.parentalConsentGiven).toBe(true);
      expect(prismaService.menteeProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentalConsentGiven: true,
            parentalConsentDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException for non-minor', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      await expect(
        service.grantParentalConsent(mockMenteeProfile.id, mockParentUser.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for wrong parent', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMinorMenteeProfile);

      await expect(
        service.grantParentalConsent(mockMinorMenteeProfile.id, 'wrong-parent-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if consent already granted', async () => {
      const consentedMentee = {
        ...mockMinorMenteeProfile,
        parentalConsentGiven: true,
      };
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(consentedMentee);

      await expect(
        service.grantParentalConsent(consentedMentee.id, mockParentUser.id),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('canViewMenteeProfile', () => {
    it('should allow admin to view any profile', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.canViewMenteeProfile(
        mockMenteeProfile.id,
        'admin-user-id',
        'ADMIN',
      );

      expect(result).toBe(true);
    });

    it('should allow mentee to view own profile', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.canViewMenteeProfile(
        mockMenteeProfile.id,
        mockUser.id,
        'MENTEE',
      );

      expect(result).toBe(true);
    });

    it('should allow parent to view child profile', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMinorMenteeProfile);

      const result = await service.canViewMenteeProfile(
        mockMinorMenteeProfile.id,
        mockParentUser.id,
        'PARENT',
      );

      expect(result).toBe(true);
    });

    it('should allow mentor with session to view profile', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-profile-id',
      });
      mockPrismaService.session.findFirst.mockResolvedValue({ id: 'session-id' });

      const result = await service.canViewMenteeProfile(
        mockMenteeProfile.id,
        'mentor-user-id',
        'MENTOR',
      );

      expect(result).toBe(true);
    });

    it('should deny mentor without session', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor-profile-id',
      });
      mockPrismaService.session.findFirst.mockResolvedValue(null);

      const result = await service.canViewMenteeProfile(
        mockMenteeProfile.id,
        'mentor-user-id',
        'MENTOR',
      );

      expect(result).toBe(false);
    });

    it('should deny unrelated user', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.canViewMenteeProfile(
        mockMenteeProfile.id,
        'random-user-id',
        'MENTEE',
      );

      expect(result).toBe(false);
    });
  });

  describe('getMenteeProgress', () => {
    it('should return progress summary', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.progressTracking.groupBy
        .mockResolvedValueOnce([
          { surahNumber: 1 },
          { surahNumber: 2 },
          { surahNumber: 114 },
        ])
        .mockResolvedValueOnce([{ surahNumber: 1 }]);

      const result = await service.getMenteeProgress(mockMenteeProfile.id);

      expect(result.totalSessions).toBe(50);
      expect(result.completedSessions).toBe(48);
      expect(result.totalHoursLearned).toBe(36.5);
      expect(result.surahsStudied).toBe(3);
      expect(result.surahsMastered).toBe(1);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MatchingService', () => {
  let service: MatchingService;

  const mockMentorProfile = {
    id: 'mentor-123',
    userId: 'user-mentor',
    bio: 'Experienced Quran teacher',
    headline: 'Tajweed Expert',
    languages: ['ar', 'fr', 'en'],
    specialties: ['tajweed', 'hifz'],
    teachesChildren: true,
    teachesTeenagers: true,
    teachesAdults: true,
    beginnerFriendly: true,
    experiencedWithNewMuslims: true,
    acceptedLevels: ['NO_ARABIC', 'ARABIC_BEGINNER', 'CAN_READ_SLOWLY'],
    hourlyRate: 25,
    currency: 'EUR',
    freeTrialAvailable: true,
    freeSessionsOnly: false,
    averageRating: 4.8,
    totalReviews: 42,
    completedSessions: 150,
    verificationStatus: 'APPROVED',
    isActive: true,
    isAcceptingStudents: true,
    user: {
      id: 'user-mentor',
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: null,
      countryCode: 'FR',
      timezone: 'Europe/Paris',
    },
  };

  const mockMenteeProfile = {
    id: 'mentee-123',
    userId: 'user-mentee',
    learnerCategory: 'ADULT',
    currentLevel: 'NO_ARABIC',
    learningContext: 'NEW_MUSLIM',
    preferredLanguages: ['fr', 'ar'],
    isMinor: false,
    user: {
      id: 'user-mentee',
      countryCode: 'FR',
      timezone: 'Europe/Paris',
    },
  };

  const mockPrismaService = {
    mentorProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    menteeProfile: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCompatibilityScore', () => {
    it('should calculate high score for compatible mentor/mentee', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        mockMentorProfile.id,
        mockMenteeProfile.id,
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('EXCELLENT');
      expect(result.isRecommended).toBe(true);
      expect(result.reasons.length).toBe(7);
    });

    it('should give full LEARNER_CATEGORY score for adult mentor/mentee match', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        mockMentorProfile.id,
        mockMenteeProfile.id,
      );

      const categoryReason = result.reasons.find(
        (r) => r.category === 'LEARNER_CATEGORY',
      );
      expect(categoryReason?.score).toBe(100);
      expect(categoryReason?.isMatch).toBe(true);
    });

    it('should give zero LEARNER_CATEGORY score for mismatched category', async () => {
      const childMentee = {
        ...mockMenteeProfile,
        learnerCategory: 'CHILD',
      };
      const noChildrenMentor = {
        ...mockMentorProfile,
        teachesChildren: false,
      };

      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(noChildrenMentor);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(childMentee);

      const result = await service.calculateCompatibilityScore(
        noChildrenMentor.id,
        childMentee.id,
      );

      const categoryReason = result.reasons.find(
        (r) => r.category === 'LEARNER_CATEGORY',
      );
      expect(categoryReason?.score).toBe(0);
      expect(categoryReason?.isMatch).toBe(false);
    });

    it('should give bonus for new muslim context match', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        mockMentorProfile.id,
        mockMenteeProfile.id,
      );

      const contextReason = result.reasons.find(
        (r) => r.category === 'LEARNING_CONTEXT',
      );
      expect(contextReason?.score).toBe(50);
      expect(contextReason?.reason).toContain('new Muslims');
    });

    it('should score languages based on intersection', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        mockMentorProfile.id,
        mockMenteeProfile.id,
      );

      const languageReason = result.reasons.find((r) => r.category === 'LANGUAGES');
      expect(languageReason?.score).toBe(80); // Both fr and ar match
      expect(languageReason?.reason).toContain('fr');
      expect(languageReason?.reason).toContain('ar');
    });

    it('should give zero language score for no common languages', async () => {
      const noMatchMentor = {
        ...mockMentorProfile,
        languages: ['de', 'es'],
      };

      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(noMatchMentor);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        noMatchMentor.id,
        mockMenteeProfile.id,
      );

      const languageReason = result.reasons.find((r) => r.category === 'LANGUAGES');
      expect(languageReason?.score).toBe(0);
      expect(languageReason?.isMatch).toBe(false);
    });

    it('should give full rating score for high-rated mentor', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      const result = await service.calculateCompatibilityScore(
        mockMentorProfile.id,
        mockMenteeProfile.id,
      );

      const ratingReason = result.reasons.find((r) => r.category === 'RATING');
      expect(ratingReason?.score).toBe(20);
      expect(ratingReason?.reason).toContain('Excellent rating');
    });

    it('should throw NotFoundException for non-existent mentor', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateCompatibilityScore('non-existent', mockMenteeProfile.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent mentee', async () => {
      mockPrismaService.mentorProfile.findUnique.mockResolvedValue(mockMentorProfile);
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateCompatibilityScore(mockMentorProfile.id, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCompatibleMentors', () => {
    it('should return ranked mentors', async () => {
      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);

      const result = await service.findCompatibleMentors(mockMenteeProfile.id, {});

      expect(result.menteeId).toBe(mockMenteeProfile.id);
      expect(result.mentors.length).toBeGreaterThan(0);
      expect(result.mentors[0].compatibilityScore).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const multipleMentors = Array(5)
        .fill(null)
        .map((_, i) => ({
          ...mockMentorProfile,
          id: `mentor-${i}`,
        }));

      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findMany.mockResolvedValue(multipleMentors);

      const result = await service.findCompatibleMentors(mockMenteeProfile.id, {
        limit: 3,
      });

      expect(result.mentors.length).toBeLessThanOrEqual(3);
    });

    it('should filter out very poor matches (score < 20)', async () => {
      const poorMatchMentor = {
        ...mockMentorProfile,
        teachesAdults: false,
        teachesChildren: false,
        teachesTeenagers: false,
        acceptedLevels: ['HAFIZ_COMPLETE'],
        languages: ['zh'],
        experiencedWithNewMuslims: false,
        beginnerFriendly: false,
        averageRating: 2.0,
        totalReviews: 10,
      };

      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findMany.mockResolvedValue([poorMatchMentor]);

      const result = await service.findCompatibleMentors(mockMenteeProfile.id, {});

      // With no category match, no level match, no language match, poor rating - score should be < 20
      expect(result.mentors.length).toBe(0);
    });
  });

  describe('rankMentors', () => {
    it('should rank mentors by compatibility score', async () => {
      const mentor1 = { ...mockMentorProfile, id: 'mentor-1' };
      const mentor2 = {
        ...mockMentorProfile,
        id: 'mentor-2',
        languages: ['de'], // Lower match
      };

      mockPrismaService.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mentor1, mentor2]);

      const result = await service.rankMentors(mockMenteeProfile.id, [
        'mentor-1',
        'mentor-2',
      ]);

      expect(result[0].mentorId).toBe('mentor-1');
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });
  });
});

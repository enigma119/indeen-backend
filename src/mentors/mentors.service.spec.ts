import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { MentorsService } from './mentors.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchMentorDto } from './dto';

describe('MentorsService', () => {
  let service: MentorsService;
  let prismaService: PrismaService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'mentor@example.com',
    role: 'MENTOR',
    mentorProfile: null,
  };

  const mockMentorProfile = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    userId: mockUser.id,
    bio: 'Experienced Quran teacher with over 10 years of experience in teaching Tajweed and Hifz.',
    headline: 'Certified Quran Teacher',
    languages: ['ar', 'fr', 'en'],
    specialties: ['tajweed', 'hifz'],
    hourlyRate: 25.0,
    currency: 'EUR',
    freeSessionsOnly: false,
    verificationStatus: 'APPROVED',
    isActive: true,
    teachesChildren: true,
    teachesTeenagers: true,
    teachesAdults: true,
    beginnerFriendly: true,
    acceptedLevels: ['NO_ARABIC', 'ARABIC_BEGINNER'],
    averageRating: 4.85,
    totalSessions: 150,
    completedSessions: 145,
    totalReviews: 42,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: mockUser.id,
      email: mockUser.email,
      firstName: 'John',
      lastName: 'Doe',
      countryCode: 'FR',
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    mentorProfile: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    session: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MentorsService>(MentorsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a mentor profile successfully', async () => {
      const createDto = {
        bio: 'Experienced Quran teacher with over 10 years of experience in teaching Tajweed and Hifz.',
        languages: ['ar', 'fr'],
        specialties: ['tajweed', 'hifz'],
        hourlyRate: 25.0,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.mentorProfile.create.mockResolvedValue(mockMentorProfile);

      const result = await service.create(mockUser.id, createDto);

      expect(result).toEqual(mockMentorProfile);
      expect(prismaService.mentorProfile.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create('non-existent-id', { bio: 'test', languages: [], specialties: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-MENTOR role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: 'MENTEE',
      });

      await expect(
        service.create(mockUser.id, { bio: 'test', languages: [], specialties: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if profile already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mentorProfile: mockMentorProfile,
      });

      await expect(
        service.create(mockUser.id, { bio: 'test', languages: [], specialties: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if hourlyRate missing and not free sessions only', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create(mockUser.id, {
          bio: 'Experienced Quran teacher with over 10 years of experience in teaching Tajweed and Hifz.',
          languages: ['ar'],
          specialties: ['tajweed'],
          freeSessionsOnly: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchMentors', () => {
    it('should search mentors with filters', async () => {
      const searchDto: SearchMentorDto = {
        languages: ['ar'],
        specialties: ['tajweed'],
        minPrice: 10,
        maxPrice: 50,
        minRating: 4.0,
        page: 1,
        limit: 10,
      };

      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(1);

      const result = await service.searchMentors(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should filter by teaching preferences', async () => {
      const searchDto: SearchMentorDto = {
        teachesChildren: true,
        beginnerFriendly: true,
        page: 1,
        limit: 10,
      };

      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(1);

      const result = await service.searchMentors(searchDto);

      expect(result.data).toHaveLength(1);
      expect(prismaService.mentorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teachesChildren: true,
            beginnerFriendly: true,
          }),
        }),
      );
    });

    it('should filter by accepted levels', async () => {
      const searchDto: SearchMentorDto = {
        acceptedLevels: ['NO_ARABIC', 'ARABIC_BEGINNER'],
        page: 1,
        limit: 10,
      };

      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(1);

      await service.searchMentors(searchDto);

      expect(prismaService.mentorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            acceptedLevels: { hasSome: ['NO_ARABIC', 'ARABIC_BEGINNER'] },
          }),
        }),
      );
    });

    it('should handle text search query', async () => {
      const searchDto: SearchMentorDto = {
        query: 'tajweed expert',
        page: 1,
        limit: 10,
      };

      mockPrismaService.mentorProfile.findMany.mockResolvedValue([]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(0);

      await service.searchMentors(searchDto);

      expect(prismaService.mentorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { bio: { contains: 'tajweed expert', mode: 'insensitive' } },
              { headline: { contains: 'tajweed expert', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should return empty results when no mentors match', async () => {
      mockPrismaService.mentorProfile.findMany.mockResolvedValue([]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(0);

      const result = await service.searchMentors({
        languages: ['zh'],
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrismaService.mentorProfile.count.mockResolvedValue(25);

      const result = await service.searchMentors({
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getMentorStats', () => {
    it('should return mentor statistics', async () => {
      mockPrismaService.mentorProfile.findFirst.mockResolvedValue(mockMentorProfile);
      mockPrismaService.session.groupBy.mockResolvedValue([
        { menteeProfileId: 'mentee1' },
        { menteeProfileId: 'mentee2' },
        { menteeProfileId: 'mentee3' },
      ]);

      const result = await service.getMentorStats(mockMentorProfile.id);

      expect(result.totalSessions).toBe(150);
      expect(result.completedSessions).toBe(145);
      expect(result.averageRating).toBe(4.85);
      expect(result.totalReviews).toBe(42);
      expect(result.totalStudents).toBe(3);
      expect(result.completionRate).toBe(96.67);
    });

    it('should throw NotFoundException for non-existent mentor', async () => {
      mockPrismaService.mentorProfile.findFirst.mockResolvedValue(null);

      await expect(service.getMentorStats('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateVerificationStatus', () => {
    it('should update verification status', async () => {
      const updatedMentor = {
        ...mockMentorProfile,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      };

      mockPrismaService.mentorProfile.findFirst.mockResolvedValue(mockMentorProfile);
      mockPrismaService.mentorProfile.update.mockResolvedValue(updatedMentor);

      const result = await service.updateVerificationStatus(
        mockMentorProfile.id,
        'APPROVED',
        'admin-user-id',
      );

      expect(result.verificationStatus).toBe('APPROVED');
      expect(prismaService.mentorProfile.update).toHaveBeenCalled();
    });
  });
});

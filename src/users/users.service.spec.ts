import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'MENTEE',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    isBanned: false,
    emailVerified: true,
    avatarUrl: null,
    phone: null,
    gender: null,
    countryCode: 'FR',
    timezone: 'UTC',
    locale: 'fr',
    preferredCurrency: 'EUR',
    twoFactorEnabled: false,
    lastLoginAt: null,
    lastActivityAt: null,
    banReason: null,
    notificationEmail: true,
    notificationSms: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    mentorProfile: null,
    menteeProfile: null,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByIdOrFail(mockUser.id);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, {
        firstName: 'Jane',
      });

      expect(result.firstName).toBe('Jane');
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        service.updateProfile(mockUser.id, { firstName: 'Jane' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', { firstName: 'Jane' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRole', () => {
    it('should return user role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'MENTOR' });

      const result = await service.getUserRole(mockUser.id);

      expect(result).toBe('MENTOR');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserRole('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isUserActive', () => {
    it('should return true for active user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isActive: true,
        isBanned: false,
      });

      const result = await service.isUserActive(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isActive: false,
        isBanned: false,
      });

      const result = await service.isUserActive(mockUser.id);

      expect(result).toBe(false);
    });

    it('should return false for banned user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        isActive: true,
        isBanned: true,
      });

      const result = await service.isUserActive(mockUser.id);

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.isUserActive('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('should deactivate user successfully', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(deactivatedUser);

      const result = await service.softDelete(mockUser.id);

      expect(result.isActive).toBe(false);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    });

    it('should throw ForbiddenException for already inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.softDelete(mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reactivate', () => {
    it('should reactivate user successfully', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const reactivatedUser = { ...mockUser, isActive: true };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);
      mockPrismaService.user.update.mockResolvedValue(reactivatedUser);

      const result = await service.reactivate(mockUser.id);

      expect(result.isActive).toBe(true);
    });

    it('should throw ForbiddenException for already active user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.reactivate(mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for banned user', async () => {
      const bannedUser = { ...mockUser, isActive: false, isBanned: true };
      mockPrismaService.user.findUnique.mockResolvedValue(bannedUser);

      await expect(service.reactivate(mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

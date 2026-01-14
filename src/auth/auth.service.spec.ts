import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let supabaseService: SupabaseService;
  let jwtService: JwtService;

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
  };

  const mockSupabaseUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: {
      first_name: 'John',
      last_name: 'Doe',
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockSupabaseService = {
    verifyToken: jest.fn(),
    decodeToken: jest.fn(),
    getUser: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      },
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateSupabaseToken', () => {
    it('should return valid result for valid token', async () => {
      mockSupabaseService.verifyToken.mockResolvedValue(mockSupabaseUser);
      mockSupabaseService.decodeToken.mockReturnValue({
        sub: mockSupabaseUser.id,
        email: mockSupabaseUser.email,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await service.validateSupabaseToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockSupabaseUser.id);
      expect(result.email).toBe(mockSupabaseUser.email);
    });

    it('should return invalid result for invalid token', async () => {
      mockSupabaseService.verifyToken.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      const result = await service.validateSupabaseToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
    });
  });

  describe('getUserFromToken', () => {
    it('should return user for valid token', async () => {
      mockSupabaseService.verifyToken.mockResolvedValue(mockSupabaseUser);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserFromToken('valid-token');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockSupabaseUser.id },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    });

    it('should return null for invalid token', async () => {
      mockSupabaseService.verifyToken.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      const result = await service.getUserFromToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return auth response for valid credentials', async () => {
      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockSupabaseService.getClient().auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      });

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockSupabaseService.getClient().auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for banned user', async () => {
      const bannedUser = { ...mockUser, isBanned: true };

      mockSupabaseService.getClient().auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockSupabaseUser,
          session: { access_token: 'token', refresh_token: 'refresh' },
        },
        error: null,
      });

      mockPrismaService.user.findUnique.mockResolvedValue(bannedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create new user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockSupabaseService.getClient().auth.signUp.mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null,
      });
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        role: 'MENTEE' as any,
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          role: 'MENTEE' as any,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

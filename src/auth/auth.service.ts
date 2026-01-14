import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto } from './dto';
import type { User, UserRole } from '@prisma/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthResponse {
  user: Omit<User, 'metadata'>;
  accessToken: string;
  refreshToken?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  expiresAt?: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Validate a Supabase JWT token
   */
  async validateSupabaseToken(token: string): Promise<TokenValidationResult> {
    try {
      const supabaseUser = await this.supabaseService.verifyToken(token);

      if (!supabaseUser) {
        return { valid: false };
      }

      const payload = this.supabaseService.decodeToken(token);

      return {
        valid: true,
        userId: supabaseUser.id,
        email: supabaseUser.email,
        expiresAt: payload?.exp ? new Date(payload.exp * 1000) : undefined,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Get user from a validated token
   */
  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const supabaseUser = await this.supabaseService.verifyToken(token);

      if (!supabaseUser) {
        return null;
      }

      return this.prisma.user.findUnique({
        where: { id: supabaseUser.id },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Create a user in database after Supabase signup
   */
  async createUserInDatabase(
    supabaseUser: SupabaseUser,
    role: UserRole = 'MENTEE' as UserRole,
  ): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (existingUser) {
      this.logger.log(`User already exists in database: ${supabaseUser.id}`);
      return existingUser;
    }

    const metadata = supabaseUser.user_metadata || {};

    const user = await this.prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        role,
        firstName: metadata.first_name || metadata.firstName || null,
        lastName: metadata.last_name || metadata.lastName || null,
        avatarUrl: metadata.avatar_url || metadata.avatarUrl || null,
        emailVerified: supabaseUser.email_confirmed_at !== null,
      },
    });

    this.logger.log(`Created user in database: ${user.id}`);
    return user;
  }

  /**
   * Sync user data between Supabase and database
   */
  async syncUserWithSupabase(userId: string): Promise<User | null> {
    const supabaseUser = await this.supabaseService.getUser(userId);

    if (!supabaseUser) {
      this.logger.warn(`Supabase user not found: ${userId}`);
      return null;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return this.createUserInDatabase(supabaseUser);
    }

    const metadata = supabaseUser.user_metadata || {};

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: supabaseUser.email || dbUser.email,
        emailVerified: supabaseUser.email_confirmed_at !== null,
        firstName: metadata.first_name || metadata.firstName || dbUser.firstName,
        lastName: metadata.last_name || metadata.lastName || dbUser.lastName,
        avatarUrl: metadata.avatar_url || metadata.avatarUrl || dbUser.avatarUrl,
      },
    });

    this.logger.log(`Synced user with Supabase: ${userId}`);
    return updatedUser;
  }

  /**
   * Verify if token is valid (for POST /auth/verify)
   */
  async verifyToken(token: string): Promise<TokenValidationResult> {
    return this.validateSupabaseToken(token);
  }

  /**
   * Get current user profile (for GET /auth/me)
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Refresh token (delegates to Supabase)
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      this.logger.warn(`Refresh token failed: ${error?.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.user.id },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive || user.isBanned) {
      throw new UnauthorizedException('User account is not active');
    }

    return {
      user,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * Register a new user via Supabase Auth
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, role, firstName, lastName } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const supabase = this.supabaseService.getClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (authError) {
      this.logger.error(`Supabase signup error: ${authError.message}`);
      throw new ConflictException(authError.message);
    }

    if (!authData.user) {
      throw new ConflictException('Failed to create user');
    }

    const user = await this.createUserInDatabase(authData.user, role);

    const accessToken = this.generateAccessToken(user);

    return {
      user,
      accessToken,
    };
  }

  /**
   * Login user via Supabase Auth
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const supabase = this.supabaseService.getClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      this.logger.error(`Supabase login error: ${authError.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!authData.user || !authData.session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let user = await this.prisma.user.findUnique({
      where: { id: authData.user.id },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    if (!user) {
      const createdUser = await this.createUserInDatabase(authData.user);
      user = await this.prisma.user.findUnique({
        where: { id: createdUser.id },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User account is banned');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user,
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase.auth.signOut();
  }

  /**
   * Generate JWT access token (internal use)
   */
  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}

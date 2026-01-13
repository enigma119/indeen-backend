import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';
import { User } from '@prisma/client';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Register a new user via Supabase Auth
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, role, firstName, lastName } = registerDto;

    // Check if user already exists in our database
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Register with Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
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

    // Create user in our database (this should also be handled by Supabase trigger)
    const user = await this.prisma.user.upsert({
      where: { id: authData.user.id },
      update: {
        email,
        role,
        firstName,
        lastName,
      },
      create: {
        id: authData.user.id,
        email,
        role,
        firstName,
        lastName,
      },
    });

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

    // Authenticate with Supabase
    const { data: authData, error: authError } =
      await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      this.logger.error(`Supabase login error: ${authError.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!authData.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user from our database
    const user = await this.prisma.user.findUnique({
      where: { id: authData.user.id },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User account is banned');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateAccessToken(user);

    return {
      user,
      accessToken,
      refreshToken: authData.session?.refresh_token,
    };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.user.id },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.generateAccessToken(user);

    return {
      user,
      accessToken,
      refreshToken: data.session?.refresh_token,
    };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Generate JWT access token
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

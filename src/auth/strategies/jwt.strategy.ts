import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy that validates tokens directly with Supabase
 * This avoids the need to sync JWT secrets between Supabase and the backend
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {
    super();
  }

  async validate(request: Request): Promise<User> {
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Validate token directly with Supabase (handles signature verification)
      const supabaseUser = await this.supabaseService.verifyToken(token);

      if (!supabaseUser) {
        throw new UnauthorizedException('Token validation failed');
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: supabaseUser.id },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });

      if (!user) {
        this.logger.warn(`User not found in database: ${supabaseUser.id}`);
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        this.logger.warn(`User account deactivated: ${user.id}`);
        throw new UnauthorizedException('User account is deactivated');
      }

      if (user.isBanned) {
        this.logger.warn(`User account banned: ${user.id}`);
        throw new UnauthorizedException('User account is banned');
      }

      // Update last activity (non-blocking)
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastActivityAt: new Date() },
      }).catch((err) => {
        this.logger.warn(`Failed to update last activity: ${err.message}`);
      });

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`JWT validation error: ${error}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(request: { headers: Record<string, string> }, payload: JwtPayload): Promise<User> {
    const authHeader = request.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Validate token with Supabase
      const supabaseUser = await this.supabaseService.verifyToken(token);

      if (!supabaseUser || supabaseUser.id !== payload.sub) {
        throw new UnauthorizedException('Token validation failed');
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
      });

      if (!user) {
        this.logger.warn(`User not found in database: ${payload.sub}`);
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

      // Update last activity
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActivityAt: new Date() },
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

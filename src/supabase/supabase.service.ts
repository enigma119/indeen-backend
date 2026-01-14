import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

export interface SupabaseTokenPayload {
  sub: string;
  email: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabase: SupabaseClient;
  private readonly supabaseAdmin: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration is missing (SUPABASE_URL or SUPABASE_ANON_KEY)');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    if (supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      this.supabaseAdmin = this.supabase;
      this.logger.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key for admin operations');
    }
  }

  /**
   * Verify a Supabase JWT token and return the user
   */
  async verifyToken(token: string): Promise<SupabaseUser> {
    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error) {
        this.logger.warn(`Token verification failed: ${error.message}`);
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (!data.user) {
        throw new UnauthorizedException('User not found in token');
      }

      return data.user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Token verification error: ${error}`);
      throw new UnauthorizedException('Token verification failed');
    }
  }

  /**
   * Get a Supabase user by ID (admin operation)
   */
  async getUser(userId: string): Promise<SupabaseUser | null> {
    try {
      const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(userId);

      if (error) {
        this.logger.warn(`Failed to get user ${userId}: ${error.message}`);
        return null;
      }

      return data.user;
    } catch (error) {
      this.logger.error(`Get user error: ${error}`);
      return null;
    }
  }

  /**
   * Extract user ID from a JWT token without full validation
   * Useful for quick extraction when token is already validated
   */
  extractUserIdFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      return payload.sub || null;
    } catch {
      return null;
    }
  }

  /**
   * Decode JWT payload without verification
   * Use only when token has been verified elsewhere
   */
  decodeToken(token: string): SupabaseTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      return payload as SupabaseTokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get the Supabase client for direct operations
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the Supabase admin client for privileged operations
   */
  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin;
  }
}

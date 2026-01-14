import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { AuthService, AuthResponse, TokenValidationResult } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { Public, CurrentUser } from '../common/decorators';
import type { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register - Register a new user
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login - Login user
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  /**
   * POST /auth/logout - Logout user
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<{ message: string }> {
    await this.authService.logout();
    return { message: 'Logged out successfully' };
  }

  /**
   * POST /auth/verify - Verify if token is valid
   */
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Headers('authorization') authHeader: string,
  ): Promise<TokenValidationResult> {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return { valid: false };
    }
    return this.authService.verifyToken(token);
  }

  /**
   * GET /auth/me - Get current user profile
   */
  @Get('me')
  async getProfile(@CurrentUser() user: User): Promise<User> {
    return this.authService.getCurrentUser(user.id);
  }

  /**
   * POST /auth/refresh - Refresh access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshToken);
  }
}

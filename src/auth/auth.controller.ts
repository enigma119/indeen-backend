import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService, AuthResponse, TokenValidationResult } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { Public, CurrentUser } from '../common/decorators';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register - Register a new user
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  /**
   * POST /auth/login - Login user
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  /**
   * POST /auth/logout - Logout user
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout current user' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
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
  @ApiOperation({ summary: 'Verify if a JWT token is valid' })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
  })
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
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@CurrentUser() user: User): Promise<User> {
    return this.authService.getCurrentUser(user.id);
  }

  /**
   * POST /auth/refresh - Refresh access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', description: 'Supabase refresh token' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ): Promise<AuthResponse> {
    return this.authService.refreshToken(refreshToken);
  }
}

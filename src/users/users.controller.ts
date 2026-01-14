import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me - Get current user profile (protected)
   */
  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile with mentor/mentee profiles',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMe(@CurrentUser() user: User): Promise<User> {
    return this.usersService.findByIdOrFail(user.id);
  }

  /**
   * PATCH /users/me - Update current user profile (protected)
   */
  @Patch('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot update inactive user profile',
  })
  async updateMe(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfile(user.id, updateDto);
  }

  /**
   * DELETE /users/me - Soft delete current user (protected)
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Deactivate current user account (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Account deactivated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteMe(@CurrentUser() user: User): Promise<{ message: string }> {
    await this.usersService.softDelete(user.id);
    return { message: 'Account deactivated successfully' };
  }

  /**
   * GET /users/:id - Get user public profile (public with limited data)
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get user public profile (limited data)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User public profile',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Partial<User>> {
    return this.usersService.getPublicProfile(id);
  }

  /**
   * PATCH /users/:id/reactivate - Reactivate a user (admin only)
   */
  @Patch(':id/reactivate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Reactivate a deactivated user (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID to reactivate',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User reactivated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async reactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.usersService.reactivate(id);
    return { message: 'User reactivated successfully' };
  }
}

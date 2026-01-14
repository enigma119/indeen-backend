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
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me - Get current user profile (protected)
   */
  @Get('me')
  async getMe(@CurrentUser() user: User): Promise<User> {
    return this.usersService.findByIdOrFail(user.id);
  }

  /**
   * PATCH /users/me - Update current user profile (protected)
   */
  @Patch('me')
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
  async deleteMe(@CurrentUser() user: User): Promise<{ message: string }> {
    await this.usersService.softDelete(user.id);
    return { message: 'Account deactivated successfully' };
  }

  /**
   * GET /users/:id - Get user public profile (public with limited data)
   */
  @Public()
  @Get(':id')
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
  async reactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.usersService.reactivate(id);
    return { message: 'User reactivated successfully' };
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { User } from '@prisma/client';

@Injectable()
export class IsActiveGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      // Let JwtAuthGuard handle authentication
      return true;
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated');
    }

    if (user.isBanned) {
      throw new ForbiddenException(
        `Your account has been banned${user.banReason ? `: ${user.banReason}` : ''}`,
      );
    }

    return true;
  }
}

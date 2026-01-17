import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard to verify that the current user can modify a session.
 *
 * Modification is allowed if:
 * - User is the mentor of the session
 * - User is the mentee of the session
 * - User is an ADMIN
 *
 * Note: Parents cannot modify sessions, only view them.
 */
@Injectable()
export class CanModifySessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const sessionId = request.params.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!sessionId) {
      return true; // No session ID in params, let controller handle
    }

    // Admins can modify all sessions
    if (user.role === 'ADMIN') {
      return true;
    }

    // Find the session with related profiles
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorProfile: { select: { userId: true } },
        menteeProfile: { select: { userId: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check if user is the mentor
    if (session.mentorProfile.userId === user.id) {
      return true;
    }

    // Check if user is the mentee
    if (session.menteeProfile.userId === user.id) {
      return true;
    }

    throw new ForbiddenException('You are not authorized to modify this session');
  }
}

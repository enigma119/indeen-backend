import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import {
  FindMentorsDto,
  CompatibilityScoreDto,
  RankedMentorsResponseDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@ApiTags('Matching')
@Controller('matching')
@ApiBearerAuth()
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('find-mentors')
  @Roles('MENTEE')
  @ApiOperation({
    summary: 'Find compatible mentors for the current mentee',
    description: `
      Searches for mentors compatible with the current mentee based on:
      - Learner category match (children/teenagers/adults)
      - Accepted learning levels
      - Language preferences
      - Budget constraints
      - Rating and availability

      Returns mentors ranked by compatibility score (0-100).
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of compatible mentors ranked by score',
    type: RankedMentorsResponseDto,
  })
  async findMentors(
    @CurrentUser() user: JwtPayload,
    @Body() findMentorsDto: FindMentorsDto,
  ): Promise<RankedMentorsResponseDto> {
    // Get mentee profile for current user
    const menteeProfile = await this.prisma.menteeProfile.findUnique({
      where: { userId: user.sub },
    });

    if (!menteeProfile) {
      throw new ForbiddenException('Mentee profile not found');
    }

    return this.matchingService.findCompatibleMentors(menteeProfile.id, findMentorsDto);
  }

  @Get('recommendations/:menteeId')
  @Roles('MENTEE', 'PARENT', 'ADMIN')
  @ApiOperation({
    summary: 'Get mentor recommendations for a mentee',
    description: 'Returns top compatible mentors for the specified mentee.',
  })
  @ApiParam({ name: 'menteeId', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recommended mentors',
    type: RankedMentorsResponseDto,
  })
  async getRecommendations(
    @Param('menteeId', ParseUUIDPipe) menteeId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RankedMentorsResponseDto> {
    // Verify access
    await this.verifyMenteeAccess(menteeId, user);

    return this.matchingService.findCompatibleMentors(menteeId, { limit: 10 });
  }

  @Get('compatibility/:mentorId/:menteeId')
  @Roles('MENTEE', 'MENTOR', 'PARENT', 'ADMIN')
  @ApiOperation({
    summary: 'Get compatibility score between a mentor and mentee',
    description: `
      Calculates detailed compatibility score with breakdown by category:
      - Learner Category (100 points)
      - Accepted Level (80 points)
      - Languages (80 points)
      - Learning Context (50 points)
      - Budget (40 points)
      - Timezone (30 points)
      - Rating (20 points)

      Total possible: 400 points, normalized to 0-100 score.
    `,
  })
  @ApiParam({ name: 'mentorId', description: 'Mentor profile ID' })
  @ApiParam({ name: 'menteeId', description: 'Mentee profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compatibility score with detailed breakdown',
    type: CompatibilityScoreDto,
  })
  async getCompatibilityScore(
    @Param('mentorId', ParseUUIDPipe) mentorId: string,
    @Param('menteeId', ParseUUIDPipe) menteeId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompatibilityScoreDto> {
    // Verify user has access to view this compatibility
    await this.verifyCompatibilityAccess(mentorId, menteeId, user);

    return this.matchingService.calculateCompatibilityScore(mentorId, menteeId);
  }

  /**
   * Verify the user has access to the mentee's data
   */
  private async verifyMenteeAccess(
    menteeId: string,
    user: JwtPayload,
  ): Promise<void> {
    if (user.role === 'ADMIN') {
      return; // Admins can access all
    }

    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { id: menteeId },
    });

    if (!mentee) {
      throw new ForbiddenException('Mentee profile not found');
    }

    // Mentee can access their own
    if (mentee.userId === user.sub) {
      return;
    }

    // Parent can access their child's
    if (user.role === 'PARENT' && mentee.parentUserId === user.sub) {
      return;
    }

    throw new ForbiddenException('You do not have access to this mentee profile');
  }

  /**
   * Verify the user has access to view compatibility
   */
  private async verifyCompatibilityAccess(
    mentorId: string,
    menteeId: string,
    user: JwtPayload,
  ): Promise<void> {
    if (user.role === 'ADMIN') {
      return;
    }

    // Check if user is the mentor
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
    });

    if (mentor && mentor.userId === user.sub) {
      return;
    }

    // Check if user is the mentee or parent
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { id: menteeId },
    });

    if (mentee) {
      if (mentee.userId === user.sub) {
        return;
      }
      if (user.role === 'PARENT' && mentee.parentUserId === user.sub) {
        return;
      }
    }

    throw new ForbiddenException('You do not have access to view this compatibility');
  }
}

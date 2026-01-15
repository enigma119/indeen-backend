import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FindMentorsDto,
  CompatibilityScoreDto,
  CompatibilityReasonDto,
  RankedMentorDto,
} from './dto';
import type { MentorProfile, MenteeProfile, User, LearningLevel } from '@prisma/client';

// Weights for compatibility factors (total = 400)
const WEIGHTS = {
  LEARNER_CATEGORY: 100, // CRITICAL
  ACCEPTED_LEVEL: 80, // HIGH
  LANGUAGES: 80, // HIGH
  LEARNING_CONTEXT: 50, // MEDIUM
  BUDGET: 40, // MEDIUM
  TIMEZONE: 30, // LOW
  RATING: 20, // LOW
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

type MentorWithUser = MentorProfile & {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'countryCode' | 'timezone'>;
};

type MenteeWithUser = MenteeProfile & {
  user: Pick<User, 'id' | 'countryCode' | 'timezone'>;
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find compatible mentors for a mentee
   */
  async findCompatibleMentors(
    menteeId: string,
    preferences: FindMentorsDto,
  ): Promise<{ menteeId: string; total: number; mentors: RankedMentorDto[] }> {
    const mentee = await this.getMenteeOrFail(menteeId);

    // Get eligible mentors (APPROVED, active, accepting students)
    const eligibleMentors = await this.getEligibleMentors(preferences);

    // Calculate compatibility for each mentor
    const rankedMentors: RankedMentorDto[] = [];

    for (const mentor of eligibleMentors) {
      const compatibility = this.calculateCompatibility(mentor, mentee, preferences);

      // Only include if score >= 20 (filter out very poor matches)
      if (compatibility.score >= 20) {
        rankedMentors.push(this.mapToRankedMentor(mentor, compatibility));
      }
    }

    // Sort by score descending
    rankedMentors.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Apply limit
    const limit = preferences.limit ?? 10;
    const limitedMentors = rankedMentors.slice(0, limit);

    return {
      menteeId,
      total: limitedMentors.length,
      mentors: limitedMentors,
    };
  }

  /**
   * Calculate compatibility score between a mentor and mentee
   */
  async calculateCompatibilityScore(
    mentorId: string,
    menteeId: string,
  ): Promise<CompatibilityScoreDto> {
    const mentor = await this.getMentorOrFail(mentorId);
    const mentee = await this.getMenteeOrFail(menteeId);

    const compatibility = this.calculateCompatibility(mentor, mentee, {});

    return {
      mentorId,
      menteeId,
      score: compatibility.score,
      level: compatibility.level,
      reasons: compatibility.reasons,
      isRecommended: compatibility.score >= 60,
    };
  }

  /**
   * Rank a list of mentors by compatibility with a mentee
   */
  async rankMentors(
    menteeId: string,
    mentorIds: string[],
  ): Promise<{ mentorId: string; score: number; level: string }[]> {
    const mentee = await this.getMenteeOrFail(menteeId);

    const mentors = await this.prisma.mentorProfile.findMany({
      where: { id: { in: mentorIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
            timezone: true,
          },
        },
      },
    });

    const rankings = mentors.map((mentor) => {
      const compatibility = this.calculateCompatibility(mentor, mentee, {});
      return {
        mentorId: mentor.id,
        score: compatibility.score,
        level: compatibility.level,
      };
    });

    return rankings.sort((a, b) => b.score - a.score);
  }

  // ==================== Private Methods ====================

  private async getMenteeOrFail(menteeId: string): Promise<MenteeWithUser> {
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { id: menteeId },
      include: {
        user: {
          select: {
            id: true,
            countryCode: true,
            timezone: true,
          },
        },
      },
    });

    if (!mentee) {
      throw new NotFoundException('Mentee profile not found');
    }

    return mentee;
  }

  private async getMentorOrFail(mentorId: string): Promise<MentorWithUser> {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
            timezone: true,
          },
        },
      },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    return mentor;
  }

  private async getEligibleMentors(preferences: FindMentorsDto): Promise<MentorWithUser[]> {
    const where: Record<string, unknown> = {
      verificationStatus: 'APPROVED',
      isActive: true,
      isAcceptingStudents: true,
    };

    // Apply basic filters from preferences
    if (preferences.freeSessionsOnly) {
      where.freeSessionsOnly = true;
    }

    if (preferences.requireFreeTrial) {
      where.freeTrialAvailable = true;
    }

    if (preferences.minRating !== undefined) {
      where.averageRating = { gte: preferences.minRating };
    }

    if (preferences.budgetPerSession !== undefined) {
      where.OR = [
        { hourlyRate: { lte: preferences.budgetPerSession } },
        { freeSessionsOnly: true },
      ];
    }

    return this.prisma.mentorProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
            timezone: true,
          },
        },
      },
    });
  }

  private calculateCompatibility(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
    preferences: FindMentorsDto,
  ): {
    score: number;
    level: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POOR';
    reasons: CompatibilityReasonDto[];
  } {
    const reasons: CompatibilityReasonDto[] = [];
    let totalScore = 0;

    // 1. Learner Category (CRITICAL - 100 points)
    const categoryScore = this.scoreLearnerCategory(mentor, mentee);
    reasons.push(categoryScore);
    totalScore += categoryScore.score;

    // 2. Accepted Level (HIGH - 80 points)
    const levelScore = this.scoreAcceptedLevel(mentor, mentee);
    reasons.push(levelScore);
    totalScore += levelScore.score;

    // 3. Languages (HIGH - 80 points)
    const languageScore = this.scoreLanguages(mentor, mentee, preferences);
    reasons.push(languageScore);
    totalScore += languageScore.score;

    // 4. Learning Context (MEDIUM - 50 points)
    const contextScore = this.scoreLearningContext(mentor, mentee);
    reasons.push(contextScore);
    totalScore += contextScore.score;

    // 5. Budget (MEDIUM - 40 points)
    const budgetScore = this.scoreBudget(mentor, preferences);
    reasons.push(budgetScore);
    totalScore += budgetScore.score;

    // 6. Timezone/Country (LOW - 30 points)
    const timezoneScore = this.scoreTimezone(mentor, mentee, preferences);
    reasons.push(timezoneScore);
    totalScore += timezoneScore.score;

    // 7. Rating (LOW - 20 points)
    const ratingScore = this.scoreRating(mentor);
    reasons.push(ratingScore);
    totalScore += ratingScore.score;

    // Calculate final score (0-100)
    const finalScore = Math.round((totalScore / TOTAL_WEIGHT) * 100);

    return {
      score: finalScore,
      level: this.getCompatibilityLevel(finalScore),
      reasons,
    };
  }

  private scoreLearnerCategory(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
  ): CompatibilityReasonDto {
    const category = mentee.learnerCategory;
    let isMatch = false;
    let reason = '';

    switch (category) {
      case 'CHILD':
        isMatch = mentor.teachesChildren;
        reason = isMatch
          ? 'Mentor teaches children and mentee is a child learner'
          : 'Mentor does not teach children';
        break;
      case 'TEENAGER':
        isMatch = mentor.teachesTeenagers;
        reason = isMatch
          ? 'Mentor teaches teenagers and mentee is a teenager'
          : 'Mentor does not teach teenagers';
        break;
      case 'ADULT':
        isMatch = mentor.teachesAdults;
        reason = isMatch
          ? 'Mentor teaches adults and mentee is an adult learner'
          : 'Mentor does not teach adults';
        break;
    }

    return {
      category: 'LEARNER_CATEGORY',
      weight: WEIGHTS.LEARNER_CATEGORY,
      score: isMatch ? WEIGHTS.LEARNER_CATEGORY : 0,
      reason,
      isMatch,
    };
  }

  private scoreAcceptedLevel(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
  ): CompatibilityReasonDto {
    const menteeLevel = mentee.currentLevel;
    const acceptedLevels = mentor.acceptedLevels as LearningLevel[];
    const isMatch = acceptedLevels.includes(menteeLevel);

    return {
      category: 'ACCEPTED_LEVEL',
      weight: WEIGHTS.ACCEPTED_LEVEL,
      score: isMatch ? WEIGHTS.ACCEPTED_LEVEL : 0,
      reason: isMatch
        ? `Mentor accepts ${menteeLevel} level students`
        : `Mentor does not accept ${menteeLevel} level students`,
      isMatch,
    };
  }

  private scoreLanguages(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
    preferences: FindMentorsDto,
  ): CompatibilityReasonDto {
    const menteeLanguages = preferences.preferredLanguages?.length
      ? preferences.preferredLanguages
      : mentee.preferredLanguages;

    const mentorLanguages = mentor.languages;

    const commonLanguages = menteeLanguages.filter((lang) =>
      mentorLanguages.includes(lang),
    );

    const matchRatio =
      menteeLanguages.length > 0 ? commonLanguages.length / menteeLanguages.length : 0;
    const score = Math.round(WEIGHTS.LANGUAGES * matchRatio);

    return {
      category: 'LANGUAGES',
      weight: WEIGHTS.LANGUAGES,
      score,
      reason:
        commonLanguages.length > 0
          ? `${commonLanguages.length} common language(s): ${commonLanguages.join(', ')}`
          : 'No common languages',
      isMatch: commonLanguages.length > 0,
    };
  }

  private scoreLearningContext(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
  ): CompatibilityReasonDto {
    const context = mentee.learningContext;
    let score = WEIGHTS.LEARNING_CONTEXT * 0.5; // Base score
    let reason = 'Standard learning context';
    let isMatch = true;

    if (context === 'NEW_MUSLIM' && mentor.experiencedWithNewMuslims) {
      score = WEIGHTS.LEARNING_CONTEXT;
      reason = 'Mentor is experienced with new Muslims - perfect for your context';
    } else if (context === 'NEW_MUSLIM' && !mentor.experiencedWithNewMuslims) {
      score = WEIGHTS.LEARNING_CONTEXT * 0.3;
      reason = 'Mentor is not specifically experienced with new Muslims';
      isMatch = false;
    }

    if (mentor.beginnerFriendly && mentee.currentLevel === 'NO_ARABIC') {
      score = Math.min(score + 10, WEIGHTS.LEARNING_CONTEXT);
      reason += '; Mentor is beginner-friendly';
    }

    return {
      category: 'LEARNING_CONTEXT',
      weight: WEIGHTS.LEARNING_CONTEXT,
      score: Math.round(score),
      reason,
      isMatch,
    };
  }

  private scoreBudget(
    mentor: MentorWithUser,
    preferences: FindMentorsDto,
  ): CompatibilityReasonDto {
    if (mentor.freeSessionsOnly) {
      return {
        category: 'BUDGET',
        weight: WEIGHTS.BUDGET,
        score: WEIGHTS.BUDGET,
        reason: 'Mentor offers free sessions only',
        isMatch: true,
      };
    }

    const budget = preferences.budgetPerSession;
    const rate = mentor.hourlyRate ? Number(mentor.hourlyRate) : 0;

    if (budget === undefined) {
      return {
        category: 'BUDGET',
        weight: WEIGHTS.BUDGET,
        score: WEIGHTS.BUDGET * 0.5,
        reason: `Mentor charges ${rate} ${mentor.currency}/hour`,
        isMatch: true,
      };
    }

    if (rate <= budget) {
      return {
        category: 'BUDGET',
        weight: WEIGHTS.BUDGET,
        score: WEIGHTS.BUDGET,
        reason: `Mentor's rate (${rate} ${mentor.currency}) is within budget`,
        isMatch: true,
      };
    }

    return {
      category: 'BUDGET',
      weight: WEIGHTS.BUDGET,
      score: 0,
      reason: `Mentor's rate (${rate} ${mentor.currency}) exceeds budget (${budget})`,
      isMatch: false,
    };
  }

  private scoreTimezone(
    mentor: MentorWithUser,
    mentee: MenteeWithUser,
    preferences: FindMentorsDto,
  ): CompatibilityReasonDto {
    let score = 0;
    const reasons: string[] = [];

    // Same country bonus
    const mentorCountry = mentor.user.countryCode;
    const menteeCountry = preferences.countryCode || mentee.user.countryCode;

    if (mentorCountry === menteeCountry) {
      score += WEIGHTS.TIMEZONE * 0.6;
      reasons.push('Same country');
    }

    // Timezone compatibility (simplified - could be enhanced with actual timezone calculation)
    const mentorTimezone = mentor.user.timezone;
    const menteeTimezone = preferences.timezone || mentee.user.timezone;

    if (mentorTimezone && menteeTimezone) {
      // Simple check: same timezone
      if (mentorTimezone === menteeTimezone) {
        score += WEIGHTS.TIMEZONE * 0.4;
        reasons.push('Same timezone');
      } else {
        // Could add more sophisticated timezone difference calculation here
        score += WEIGHTS.TIMEZONE * 0.2;
        reasons.push('Different timezones');
      }
    }

    return {
      category: 'TIMEZONE',
      weight: WEIGHTS.TIMEZONE,
      score: Math.round(Math.min(score, WEIGHTS.TIMEZONE)),
      reason: reasons.length > 0 ? reasons.join('; ') : 'Location neutral',
      isMatch: score > WEIGHTS.TIMEZONE * 0.3,
    };
  }

  private scoreRating(mentor: MentorWithUser): CompatibilityReasonDto {
    const rating = Number(mentor.averageRating);
    let score = 0;
    let reason = '';

    if (rating >= 4.5) {
      score = WEIGHTS.RATING;
      reason = `Excellent rating (${rating}/5)`;
    } else if (rating >= 4.0) {
      score = WEIGHTS.RATING * 0.8;
      reason = `Good rating (${rating}/5)`;
    } else if (rating >= 3.5) {
      score = WEIGHTS.RATING * 0.5;
      reason = `Average rating (${rating}/5)`;
    } else if (mentor.totalReviews === 0) {
      score = WEIGHTS.RATING * 0.5;
      reason = 'New mentor (no reviews yet)';
    } else {
      score = WEIGHTS.RATING * 0.2;
      reason = `Below average rating (${rating}/5)`;
    }

    return {
      category: 'RATING',
      weight: WEIGHTS.RATING,
      score: Math.round(score),
      reason,
      isMatch: score >= WEIGHTS.RATING * 0.5,
    };
  }

  private getCompatibilityLevel(
    score: number,
  ): 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POOR' {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'POOR';
  }

  private mapToRankedMentor(
    mentor: MentorWithUser,
    compatibility: {
      score: number;
      level: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POOR';
      reasons: CompatibilityReasonDto[];
    },
  ): RankedMentorDto {
    return {
      id: mentor.id,
      bio: mentor.bio,
      headline: mentor.headline ?? undefined,
      languages: mentor.languages,
      specialties: mentor.specialties,
      hourlyRate: mentor.hourlyRate ? Number(mentor.hourlyRate) : undefined,
      currency: mentor.currency,
      freeTrialAvailable: mentor.freeTrialAvailable,
      freeSessionsOnly: mentor.freeSessionsOnly,
      averageRating: Number(mentor.averageRating),
      totalReviews: mentor.totalReviews,
      completedSessions: mentor.completedSessions,
      user: {
        id: mentor.user.id,
        firstName: mentor.user.firstName ?? undefined,
        lastName: mentor.user.lastName ?? undefined,
        avatarUrl: mentor.user.avatarUrl ?? undefined,
        countryCode: mentor.user.countryCode,
      },
      compatibilityScore: compatibility.score,
      compatibilityLevel: compatibility.level,
      matchReasons: compatibility.reasons.filter((r) => r.isMatch).slice(0, 5),
    };
  }
}

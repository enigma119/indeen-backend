import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  BulkAvailabilityDto,
  AvailableSlotDto,
} from './dto';
import type { MentorAvailability } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add availability slot for a mentor
   */
  async addAvailability(
    mentorId: string,
    userId: string,
    createDto: CreateAvailabilityDto,
  ): Promise<MentorAvailability> {
    // Verify mentor exists and belongs to user
    const mentor = await this.verifyMentorOwnership(mentorId, userId);

    // Validate time range
    this.validateTimeRange(createDto.startTime, createDto.endTime);

    // Check for overlapping availability
    await this.checkAvailabilityOverlap(
      mentorId,
      createDto.dayOfWeek,
      createDto.startTime,
      createDto.endTime,
    );

    const startTimeDate = this.parseTimeToDate(createDto.startTime);
    const endTimeDate = this.parseTimeToDate(createDto.endTime);

    const availability = await this.prisma.mentorAvailability.create({
      data: {
        mentorId: mentor.id,
        dayOfWeek: createDto.dayOfWeek,
        startTime: startTimeDate,
        endTime: endTimeDate,
        isRecurring: createDto.isRecurring ?? true,
        specificDate: createDto.specificDate ? new Date(createDto.specificDate) : null,
        isAvailable: createDto.isAvailable ?? true,
      },
    });

    this.logger.log(`Availability added for mentor ${mentorId}`);
    return availability;
  }

  /**
   * Get all availabilities for a mentor
   */
  async getAvailabilities(mentorId: string): Promise<MentorAvailability[]> {
    // Verify mentor exists
    await this.getMentorOrFail(mentorId);

    return this.prisma.mentorAvailability.findMany({
      where: { mentorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Update availability
   */
  async updateAvailability(
    id: string,
    userId: string,
    updateDto: UpdateAvailabilityDto,
  ): Promise<MentorAvailability> {
    const availability = await this.getAvailabilityOrFail(id);

    // Verify ownership
    await this.verifyMentorOwnership(availability.mentorId, userId);

    // Validate time range if both times provided
    if (updateDto.startTime && updateDto.endTime) {
      this.validateTimeRange(updateDto.startTime, updateDto.endTime);
    }

    const updateData: Record<string, unknown> = {};

    if (updateDto.startTime) {
      updateData.startTime = this.parseTimeToDate(updateDto.startTime);
    }
    if (updateDto.endTime) {
      updateData.endTime = this.parseTimeToDate(updateDto.endTime);
    }
    if (updateDto.isRecurring !== undefined) {
      updateData.isRecurring = updateDto.isRecurring;
    }
    if (updateDto.specificDate !== undefined) {
      updateData.specificDate = updateDto.specificDate
        ? new Date(updateDto.specificDate)
        : null;
    }
    if (updateDto.isAvailable !== undefined) {
      updateData.isAvailable = updateDto.isAvailable;
    }

    return this.prisma.mentorAvailability.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete availability
   */
  async deleteAvailability(id: string, userId: string): Promise<void> {
    const availability = await this.getAvailabilityOrFail(id);

    // Verify ownership
    await this.verifyMentorOwnership(availability.mentorId, userId);

    await this.prisma.mentorAvailability.delete({ where: { id } });
    this.logger.log(`Availability ${id} deleted`);
  }

  /**
   * Get available slots for a specific date and duration
   */
  async getAvailableSlots(
    mentorId: string,
    date: string,
    durationMinutes: number,
  ): Promise<AvailableSlotDto[]> {
    const mentor = await this.getMentorOrFail(mentorId);

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get availabilities for this day
    const availabilities = await this.prisma.mentorAvailability.findMany({
      where: {
        mentorId: mentor.id,
        dayOfWeek,
        isAvailable: true,
        OR: [
          { isRecurring: true },
          { specificDate: targetDate },
        ],
      },
      orderBy: { startTime: 'asc' },
    });

    if (availabilities.length === 0) {
      return [];
    }

    // Get booked sessions for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedSessions = await this.prisma.session.findMany({
      where: {
        mentorProfileId: mentor.id,
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Calculate available slots
    const slots: AvailableSlotDto[] = [];

    for (const availability of availabilities) {
      const availStart = this.extractTimeMinutes(availability.startTime);
      const availEnd = this.extractTimeMinutes(availability.endTime);

      // Generate slots of requested duration within this availability window
      let slotStart = availStart;

      while (slotStart + durationMinutes <= availEnd) {
        const slotEnd = slotStart + durationMinutes;

        // Check if this slot conflicts with any booked session
        const hasConflict = bookedSessions.some((session) => {
          const sessionStart = this.extractTimeMinutes(session.scheduledAt);
          const sessionEnd = this.extractTimeMinutes(session.scheduledEndAt);
          return slotStart < sessionEnd && slotEnd > sessionStart;
        });

        if (!hasConflict) {
          slots.push({
            date,
            startTime: this.minutesToTimeString(slotStart),
            endTime: this.minutesToTimeString(slotEnd),
            durationMinutes,
            isAvailable: true,
          });
        }

        // Move to next slot (increment by slot duration or smaller interval)
        slotStart += Math.min(durationMinutes, 30);
      }
    }

    return slots;
  }

  /**
   * Check for conflict with existing sessions
   */
  async checkConflict(
    mentorId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<{ hasConflict: boolean; conflictingSessions: string[] }> {
    const mentor = await this.getMentorOrFail(mentorId);

    const targetDate = new Date(date);
    const startDateTime = new Date(targetDate);
    const endDateTime = new Date(targetDate);

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    startDateTime.setHours(startHour, startMin, 0, 0);
    endDateTime.setHours(endHour, endMin, 0, 0);

    const conflictingSessions = await this.prisma.session.findMany({
      where: {
        mentorProfileId: mentor.id,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { scheduledAt: { lte: startDateTime } },
              { scheduledEndAt: { gt: startDateTime } },
            ],
          },
          {
            AND: [
              { scheduledAt: { lt: endDateTime } },
              { scheduledEndAt: { gte: endDateTime } },
            ],
          },
          {
            AND: [
              { scheduledAt: { gte: startDateTime } },
              { scheduledEndAt: { lte: endDateTime } },
            ],
          },
        ],
      },
      select: { id: true },
    });

    return {
      hasConflict: conflictingSessions.length > 0,
      conflictingSessions: conflictingSessions.map((s) => s.id),
    };
  }

  /**
   * Bulk create weekly availability pattern
   */
  async bulkCreateWeeklyAvailability(
    mentorId: string,
    userId: string,
    bulkDto: BulkAvailabilityDto,
  ): Promise<MentorAvailability[]> {
    const mentor = await this.verifyMentorOwnership(mentorId, userId);

    // Validate all time ranges
    for (const pattern of bulkDto.weeklyPattern) {
      this.validateTimeRange(pattern.startTime, pattern.endTime);
    }

    // Check for overlaps within the pattern itself
    this.checkPatternOverlaps(bulkDto.weeklyPattern);

    // Delete existing recurring availabilities
    await this.prisma.mentorAvailability.deleteMany({
      where: { mentorId: mentor.id, isRecurring: true },
    });

    // Create new availabilities
    const createdAvailabilities: MentorAvailability[] = [];

    for (const pattern of bulkDto.weeklyPattern) {
      const availability = await this.prisma.mentorAvailability.create({
        data: {
          mentorId: mentor.id,
          dayOfWeek: pattern.dayOfWeek,
          startTime: this.parseTimeToDate(pattern.startTime),
          endTime: this.parseTimeToDate(pattern.endTime),
          isRecurring: true,
          isAvailable: true,
        },
      });
      createdAvailabilities.push(availability);
    }

    this.logger.log(
      `Bulk availability created for mentor ${mentorId}: ${createdAvailabilities.length} slots`,
    );

    return createdAvailabilities;
  }

  // ==================== Private Helper Methods ====================

  private async getMentorOrFail(mentorId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    return mentor;
  }

  private async verifyMentorOwnership(mentorId: string, userId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    if (mentor.userId !== userId) {
      throw new ForbiddenException('You can only manage your own availability');
    }

    return mentor;
  }

  private async getAvailabilityOrFail(id: string) {
    const availability = await this.prisma.mentorAvailability.findUnique({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    return availability;
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    const startMinutes = this.timeStringToMinutes(startTime);
    const endMinutes = this.timeStringToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private async checkAvailabilityOverlap(
    mentorId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const existingAvailabilities = await this.prisma.mentorAvailability.findMany({
      where: {
        mentorId,
        dayOfWeek,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });

    const newStart = this.timeStringToMinutes(startTime);
    const newEnd = this.timeStringToMinutes(endTime);

    for (const existing of existingAvailabilities) {
      const existingStart = this.extractTimeMinutes(existing.startTime);
      const existingEnd = this.extractTimeMinutes(existing.endTime);

      if (newStart < existingEnd && newEnd > existingStart) {
        throw new BadRequestException(
          'This availability overlaps with an existing slot',
        );
      }
    }
  }

  private checkPatternOverlaps(
    patterns: { dayOfWeek: number; startTime: string; endTime: string }[],
  ): void {
    // Group patterns by day
    const byDay = new Map<number, { startTime: string; endTime: string }[]>();

    for (const pattern of patterns) {
      const dayPatterns = byDay.get(pattern.dayOfWeek) || [];
      dayPatterns.push({ startTime: pattern.startTime, endTime: pattern.endTime });
      byDay.set(pattern.dayOfWeek, dayPatterns);
    }

    // Check for overlaps within each day
    for (const [day, dayPatterns] of byDay) {
      for (let i = 0; i < dayPatterns.length; i++) {
        for (let j = i + 1; j < dayPatterns.length; j++) {
          const a = dayPatterns[i];
          const b = dayPatterns[j];

          const aStart = this.timeStringToMinutes(a.startTime);
          const aEnd = this.timeStringToMinutes(a.endTime);
          const bStart = this.timeStringToMinutes(b.startTime);
          const bEnd = this.timeStringToMinutes(b.endTime);

          if (aStart < bEnd && aEnd > bStart) {
            throw new BadRequestException(
              `Overlapping availability slots on day ${day}`,
            );
          }
        }
      }
    }
  }

  private parseTimeToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private extractTimeMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

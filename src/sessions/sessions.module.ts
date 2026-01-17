import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { MeetingService } from './meeting.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [SessionsService, MeetingService],
  exports: [SessionsService, MeetingService],
})
export class SessionsModule {}

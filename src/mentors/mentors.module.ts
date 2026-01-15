import { Module } from '@nestjs/common';
import { MentorsController } from './mentors.controller';
import { MentorsService } from './mentors.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}

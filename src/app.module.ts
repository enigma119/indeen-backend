import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { SupabaseModule } from './supabase';
import { AuthModule } from './auth';
import { UsersModule } from './users';
import { MentorsModule } from './mentors';
import { MenteesModule } from './mentees';
import { AvailabilityModule } from './availability';
import { MatchingModule } from './matching';
import { SessionsModule } from './sessions';
import { GlobalExceptionFilter } from './common/filters';
import { JwtAuthGuard, RolesGuard, IsActiveGuard } from './common/guards';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    MentorsModule,
    MenteesModule,
    AvailabilityModule,
    MatchingModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IsActiveGuard,
    },
  ],
})
export class AppModule {}

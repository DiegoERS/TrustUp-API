import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { SupabaseService } from '../../database/supabase.client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { getJwtConfig } from '../../config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getJwtConfig,
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, SupabaseService, JwtAuthGuard],
})
export class UsersModule {}

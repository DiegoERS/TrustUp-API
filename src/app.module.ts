import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // ConfigModule must be first — SupabaseService and other providers depend on it
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    UsersModule,
    // AuthModule will be added here when API-03 is merged
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }


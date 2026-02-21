import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';
import { SorobanService } from '../../blockchain/soroban/soroban.service';
import { ReputationContractClient } from '../../blockchain/contracts/reputation-contract.client';

@Module({
  imports: [ConfigModule],
  controllers: [ReputationController],
  providers: [ReputationService, SorobanService, ReputationContractClient],
  exports: [ReputationService],
})
export class ReputationModule {}

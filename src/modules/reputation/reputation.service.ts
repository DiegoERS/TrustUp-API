import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ReputationContractClient } from '../../blockchain/contracts/reputation-contract.client';
import {
  ReputationResponseDto,
  ReputationTier,
} from './dto/reputation-response.dto';

/** Default score assigned to wallets with no on-chain history */
const DEFAULT_SCORE = 50;

/** Clamp a value between min and max inclusive */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(
    private readonly reputationContract: ReputationContractClient,
  ) {}

  /**
   * Fetches the on-chain reputation score for a wallet and returns a
   * normalized response with tier, interest rate, and credit limit.
   *
   * If the wallet has no on-chain score, a default score of 50 is used.
   * Scores are clamped to the 0-100 range before tier calculation.
   *
   * @param wallet - Stellar public key (G... format)
   */
  async getReputationScore(wallet: string): Promise<ReputationResponseDto> {
    let rawScore: number | null;

    try {
      rawScore = await this.reputationContract.getScore(wallet);
    } catch (error) {
      this.logger.error(
        `Failed to read reputation for ${wallet.slice(0, 8)}...: ${error.message}`,
      );

      // RPC timeout or network failure — surface a clear error
      if (
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('fetch failed')
      ) {
        throw new InternalServerErrorException({
          code: 'BLOCKCHAIN_RPC_TIMEOUT',
          message: 'Blockchain RPC is currently unavailable. Please try again later.',
        });
      }

      throw new InternalServerErrorException({
        code: 'BLOCKCHAIN_CONTRACT_READ_FAILED',
        message: 'Failed to read reputation score from blockchain.',
      });
    }

    const score = clamp(rawScore ?? DEFAULT_SCORE, 0, 100);
    const tier = this.calculateTier(score);
    const interestRate = this.calculateInterestRate(score, tier);
    const maxCredit = this.calculateMaxCredit(score, tier);

    return {
      wallet,
      score,
      tier,
      interestRate,
      maxCredit,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Maps a 0-100 score to a reputation tier.
   *
   * - 90-100 → gold
   * - 75-89  → silver
   * - 60-74  → bronze
   * - <60    → poor
   */
  calculateTier(score: number): ReputationTier {
    if (score >= 90) return 'gold';
    if (score >= 75) return 'silver';
    if (score >= 60) return 'bronze';
    return 'poor';
  }

  /**
   * Derives an annual interest rate (APR %) from the score and tier.
   * Lower scores yield higher rates; the rate is linearly interpolated
   * within each tier band.
   *
   * - gold:   4-6%   (score 90-100)
   * - silver: 6-8%   (score 75-89)
   * - bronze: 8-10%  (score 60-74)
   * - poor:   10-15% (score 0-59)
   */
  calculateInterestRate(score: number, tier: ReputationTier): number {
    switch (tier) {
      case 'gold': {
        // 100 → 4%, 90 → 6%
        const ratio = (score - 90) / 10;
        return Math.round((6 - ratio * 2) * 100) / 100;
      }
      case 'silver': {
        // 89 → 6%, 75 → 8%
        const ratio = (score - 75) / 14;
        return Math.round((8 - ratio * 2) * 100) / 100;
      }
      case 'bronze': {
        // 74 → 8%, 60 → 10%
        const ratio = (score - 60) / 14;
        return Math.round((10 - ratio * 2) * 100) / 100;
      }
      default: {
        // 59 → 10%, 0 → 15%
        const ratio = score / 59;
        return Math.round((15 - ratio * 5) * 100) / 100;
      }
    }
  }

  /**
   * Derives the maximum credit limit (USD) from the score and tier.
   * Higher scores unlock larger credit lines; the limit is linearly
   * interpolated within each tier band.
   *
   * - gold:   $5000-$10000 (score 90-100)
   * - silver: $2000-$5000  (score 75-89)
   * - bronze: $1000-$2000  (score 60-74)
   * - poor:   $0-$1000     (score 0-59)
   */
  calculateMaxCredit(score: number, tier: ReputationTier): number {
    switch (tier) {
      case 'gold': {
        const ratio = (score - 90) / 10;
        return Math.round(5000 + ratio * 5000);
      }
      case 'silver': {
        const ratio = (score - 75) / 14;
        return Math.round(2000 + ratio * 3000);
      }
      case 'bronze': {
        const ratio = (score - 60) / 14;
        return Math.round(1000 + ratio * 1000);
      }
      default: {
        const ratio = score / 59;
        return Math.round(ratio * 1000);
      }
    }
  }
}

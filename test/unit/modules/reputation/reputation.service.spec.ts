import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ReputationService } from '../../../../src/modules/reputation/reputation.service';
import { ReputationContractClient } from '../../../../src/blockchain/contracts/reputation-contract.client';

describe('ReputationService', () => {
  let service: ReputationService;

  const mockReputationContract = {
    getScore: jest.fn(),
  };

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: ReputationContractClient, useValue: mockReputationContract },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // getReputationScore
  // ---------------------------------------------------------------------------
  describe('getReputationScore', () => {
    it('should return a valid reputation response with on-chain score', async () => {
      mockReputationContract.getScore.mockResolvedValue(75);

      const result = await service.getReputationScore(validWallet);

      expect(result.wallet).toBe(validWallet);
      expect(result.score).toBe(75);
      expect(result.tier).toBe('silver');
      expect(result).toHaveProperty('interestRate');
      expect(result).toHaveProperty('maxCredit');
      expect(result).toHaveProperty('lastUpdated');
      expect(mockReputationContract.getScore).toHaveBeenCalledWith(validWallet);
    });

    it('should default to score 50 when wallet has no on-chain score', async () => {
      mockReputationContract.getScore.mockResolvedValue(null);

      const result = await service.getReputationScore(validWallet);

      expect(result.score).toBe(50);
      expect(result.tier).toBe('poor');
    });

    it('should clamp scores above 100 to 100', async () => {
      mockReputationContract.getScore.mockResolvedValue(150);

      const result = await service.getReputationScore(validWallet);

      expect(result.score).toBe(100);
      expect(result.tier).toBe('gold');
    });

    it('should clamp scores below 0 to 0', async () => {
      mockReputationContract.getScore.mockResolvedValue(-10);

      const result = await service.getReputationScore(validWallet);

      expect(result.score).toBe(0);
      expect(result.tier).toBe('poor');
    });

    it('should throw BLOCKCHAIN_RPC_TIMEOUT on timeout errors', async () => {
      mockReputationContract.getScore.mockRejectedValue(
        new Error('request timeout'),
      );

      await expect(service.getReputationScore(validWallet)).rejects.toMatchObject({
        response: { code: 'BLOCKCHAIN_RPC_TIMEOUT' },
      });
    });

    it('should throw BLOCKCHAIN_RPC_TIMEOUT on connection refused', async () => {
      mockReputationContract.getScore.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:443'),
      );

      await expect(service.getReputationScore(validWallet)).rejects.toMatchObject({
        response: { code: 'BLOCKCHAIN_RPC_TIMEOUT' },
      });
    });

    it('should throw BLOCKCHAIN_CONTRACT_READ_FAILED on generic errors', async () => {
      mockReputationContract.getScore.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(service.getReputationScore(validWallet)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should include lastUpdated as a valid ISO timestamp', async () => {
      mockReputationContract.getScore.mockResolvedValue(80);
      const before = Date.now();

      const result = await service.getReputationScore(validWallet);

      const ts = new Date(result.lastUpdated).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(Date.now());
    });
  });

  // ---------------------------------------------------------------------------
  // calculateTier
  // ---------------------------------------------------------------------------
  describe('calculateTier', () => {
    it('should return gold for scores 90-100', () => {
      expect(service.calculateTier(90)).toBe('gold');
      expect(service.calculateTier(95)).toBe('gold');
      expect(service.calculateTier(100)).toBe('gold');
    });

    it('should return silver for scores 75-89', () => {
      expect(service.calculateTier(75)).toBe('silver');
      expect(service.calculateTier(82)).toBe('silver');
      expect(service.calculateTier(89)).toBe('silver');
    });

    it('should return bronze for scores 60-74', () => {
      expect(service.calculateTier(60)).toBe('bronze');
      expect(service.calculateTier(67)).toBe('bronze');
      expect(service.calculateTier(74)).toBe('bronze');
    });

    it('should return poor for scores below 60', () => {
      expect(service.calculateTier(0)).toBe('poor');
      expect(service.calculateTier(30)).toBe('poor');
      expect(service.calculateTier(59)).toBe('poor');
    });
  });

  // ---------------------------------------------------------------------------
  // calculateInterestRate
  // ---------------------------------------------------------------------------
  describe('calculateInterestRate', () => {
    it('should return 4-6% for gold tier', () => {
      const rateAt100 = service.calculateInterestRate(100, 'gold');
      const rateAt90 = service.calculateInterestRate(90, 'gold');

      expect(rateAt100).toBe(4);
      expect(rateAt90).toBe(6);
    });

    it('should return 6-8% for silver tier', () => {
      const rateAt89 = service.calculateInterestRate(89, 'silver');
      const rateAt75 = service.calculateInterestRate(75, 'silver');

      expect(rateAt89).toBe(6);
      expect(rateAt75).toBe(8);
    });

    it('should return 8-10% for bronze tier', () => {
      const rateAt74 = service.calculateInterestRate(74, 'bronze');
      const rateAt60 = service.calculateInterestRate(60, 'bronze');

      expect(rateAt74).toBe(8);
      expect(rateAt60).toBe(10);
    });

    it('should return 10-15% for poor tier', () => {
      const rateAt59 = service.calculateInterestRate(59, 'poor');
      const rateAt0 = service.calculateInterestRate(0, 'poor');

      expect(rateAt59).toBe(10);
      expect(rateAt0).toBe(15);
    });

    it('should interpolate within tier bands', () => {
      const rate = service.calculateInterestRate(82, 'silver');
      expect(rate).toBeGreaterThan(6);
      expect(rate).toBeLessThan(8);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateMaxCredit
  // ---------------------------------------------------------------------------
  describe('calculateMaxCredit', () => {
    it('should return $5000-$10000 for gold tier', () => {
      const creditAt90 = service.calculateMaxCredit(90, 'gold');
      const creditAt100 = service.calculateMaxCredit(100, 'gold');

      expect(creditAt90).toBe(5000);
      expect(creditAt100).toBe(10000);
    });

    it('should return $2000-$5000 for silver tier', () => {
      const creditAt75 = service.calculateMaxCredit(75, 'silver');
      const creditAt89 = service.calculateMaxCredit(89, 'silver');

      expect(creditAt75).toBe(2000);
      expect(creditAt89).toBe(5000);
    });

    it('should return $1000-$2000 for bronze tier', () => {
      const creditAt60 = service.calculateMaxCredit(60, 'bronze');
      const creditAt74 = service.calculateMaxCredit(74, 'bronze');

      expect(creditAt60).toBe(1000);
      expect(creditAt74).toBe(2000);
    });

    it('should return $0-$1000 for poor tier', () => {
      const creditAt0 = service.calculateMaxCredit(0, 'poor');
      const creditAt59 = service.calculateMaxCredit(59, 'poor');

      expect(creditAt0).toBe(0);
      expect(creditAt59).toBe(1000);
    });

    it('should interpolate within tier bands', () => {
      const credit = service.calculateMaxCredit(82, 'silver');
      expect(credit).toBeGreaterThan(2000);
      expect(credit).toBeLessThan(5000);
    });
  });
});

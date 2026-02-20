import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { SupabaseService } from '../../../../src/database/supabase.client';

describe('AuthService', () => {
  let service: AuthService;
  let supabaseService: SupabaseService;

  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

  const mockSupabaseClient = {
    from: mockFrom,
  };

  const mockSupabaseService = {
    getServiceRoleClient: jest.fn(() => mockSupabaseClient),
  };

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNonce', () => {
    it('should return nonce and expiresAt', async () => {
      const result = await service.generateNonce(validWallet);

      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(result.nonce)).toBe(true);
    });

    it('should generate unique nonces on each call', async () => {
      const result1 = await service.generateNonce(validWallet);
      const result2 = await service.generateNonce(validWallet);

      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it('should set expiresAt to approximately 5 minutes from now', async () => {
      const before = Date.now();
      const result = await service.generateNonce(validWallet);
      const after = Date.now();

      const expiresAtTime = new Date(result.expiresAt).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      const tolerance = 2000; // 2 second tolerance

      expect(expiresAtTime).toBeGreaterThanOrEqual(before + fiveMinutes - tolerance);
      expect(expiresAtTime).toBeLessThanOrEqual(after + fiveMinutes + tolerance);
    });

    it('should store nonce in database with correct data', async () => {
      await service.generateNonce(validWallet);

      expect(mockSupabaseService.getServiceRoleClient).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('nonces');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_address: validWallet,
          nonce: expect.any(String),
          expires_at: expect.any(String),
        }),
      );
    });

    it('should throw InternalServerErrorException when database insert fails', async () => {
      const dbError = { message: 'Database connection failed' };
      mockInsert.mockResolvedValue({ error: dbError });

      await expect(service.generateNonce(validWallet)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

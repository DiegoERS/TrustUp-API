import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../../src/modules/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    generateNonce: jest.fn(),
  };

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNonce', () => {
    it('should return nonce and expiresAt', async () => {
      const expectedResult = {
        nonce: 'a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890',
        expiresAt: '2026-02-13T10:05:00.000Z',
      };

      mockAuthService.generateNonce.mockResolvedValue(expectedResult);

      const dto = { wallet: validWallet };
      const result = await controller.getNonce(dto);

      expect(result).toEqual(expectedResult);
      expect(authService.generateNonce).toHaveBeenCalledWith(validWallet);
      expect(authService.generateNonce).toHaveBeenCalledTimes(1);
    });
  });
});

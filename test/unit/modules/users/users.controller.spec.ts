import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../../src/modules/users/users.controller';
import { UsersService } from '../../../../src/modules/users/users.service';
import { UserProfileDto } from '../../../../src/modules/users/dto/user-profile.dto';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  const expectedProfile: UserProfileDto = {
    wallet: validWallet,
    name: 'Maria Garcia',
    avatar: 'https://example.com/avatar.jpg',
    preferences: { notifications: true, language: 'en', theme: 'dark' },
    updatedAt: '2026-02-20T10:00:00.000Z',
  };

  const mockUsersService = {
    updateProfile: jest.fn().mockResolvedValue(expectedProfile),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      // Override the guard so the test module does not need JwtService/ConfigService
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // PATCH /users/me
  // ---------------------------------------------------------------------------
  describe('updateProfile', () => {
    it('should call usersService.updateProfile and return the result', async () => {
      const dto = {
        name: 'Maria Garcia',
        avatar: 'https://example.com/avatar.jpg',
      };

      const result = await controller.updateProfile(validWallet, dto);

      expect(result).toEqual(expectedProfile);
      expect(usersService.updateProfile).toHaveBeenCalledWith(validWallet, dto);
      expect(usersService.updateProfile).toHaveBeenCalledTimes(1);
    });

    it('should pass the wallet from @CurrentUser to the service', async () => {
      await controller.updateProfile(validWallet, {});

      expect(usersService.updateProfile).toHaveBeenCalledWith(validWallet, {});
    });
  });
});

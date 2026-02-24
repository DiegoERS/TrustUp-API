import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../../../../src/modules/users/users.service';
import { UsersRepository } from '../../../../src/modules/users/users.repository';
import { UserProfileDto } from '../../../../src/modules/users/dto/user-profile.dto';

describe('UsersService', () => {
  let service: UsersService;

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  const baseProfile: UserProfileDto = {
    wallet: validWallet,
    name: null,
    avatar: null,
    preferences: { notifications: true, language: 'en', theme: 'system' },
    updatedAt: '2026-02-20T10:00:00.000Z',
  };

  const mockUsersRepository = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
    mockUsersRepository.update.mockResolvedValue(baseProfile);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // updateProfile
  // ---------------------------------------------------------------------------
  describe('updateProfile', () => {
    it('should update name successfully', async () => {
      const expectedProfile: UserProfileDto = { ...baseProfile, name: 'Maria Garcia' };
      mockUsersRepository.update.mockResolvedValue(expectedProfile);

      const result = await service.updateProfile(validWallet, { name: 'Maria Garcia' });

      expect(result.name).toBe('Maria Garcia');
      expect(mockUsersRepository.update).toHaveBeenCalledWith(
        validWallet,
        expect.objectContaining({ name: 'Maria Garcia' }),
      );
    });

    it('should update avatar successfully', async () => {
      const expectedProfile: UserProfileDto = {
        ...baseProfile,
        avatar: 'https://example.com/avatar.jpg',
      };
      mockUsersRepository.update.mockResolvedValue(expectedProfile);

      const result = await service.updateProfile(validWallet, {
        avatar: 'https://example.com/avatar.jpg',
      });

      expect(result.avatar).toBe('https://example.com/avatar.jpg');
      expect(mockUsersRepository.update).toHaveBeenCalledWith(
        validWallet,
        expect.objectContaining({ avatar: 'https://example.com/avatar.jpg' }),
      );
    });

    it('should update preferences successfully', async () => {
      const expectedProfile: UserProfileDto = {
        ...baseProfile,
        preferences: { notifications: false, language: 'es', theme: 'dark' },
      };
      mockUsersRepository.update.mockResolvedValue(expectedProfile);

      const result = await service.updateProfile(validWallet, {
        preferences: { notifications: false, language: 'es', theme: 'dark' },
      });

      expect(result.preferences).toEqual({
        notifications: false,
        language: 'es',
        theme: 'dark',
      });
      expect(mockUsersRepository.update).toHaveBeenCalledWith(
        validWallet,
        expect.objectContaining({
          preferences: { notifications: false, language: 'es', theme: 'dark' },
        }),
      );
    });

    it('should throw BadRequestException when avatar URL does not use HTTPS', async () => {
      await expect(
        service.updateProfile(validWallet, { avatar: 'http://example.com/avatar.jpg' }),
      ).rejects.toMatchObject({
        response: { code: 'USERS_AVATAR_INVALID_SCHEME' },
      });

      expect(mockUsersRepository.update).not.toHaveBeenCalled();
    });

    it('should strip HTML tags from name before saving', async () => {
      await service.updateProfile(validWallet, { name: '<script>alert(1)</script>Maria' });

      expect(mockUsersRepository.update).toHaveBeenCalledWith(
        validWallet,
        expect.objectContaining({ name: 'Maria' }),
      );
    });
  });
});

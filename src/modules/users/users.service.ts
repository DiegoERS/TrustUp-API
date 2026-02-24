import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Updates the authenticated user's profile.
   * Sanitizes the name field to strip HTML tags (XSS prevention) and
   * enforces HTTPS-only avatar URLs as a defense-in-depth layer on top of
   * DTO validation.
   *
   * @param walletAddress - Stellar wallet address (from JWT via JwtAuthGuard)
   * @param dto - Validated update payload
   * @returns The updated user profile
   */
  async updateProfile(walletAddress: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    // Defense-in-depth: reject non-HTTPS avatar URLs even if DTO validation is bypassed
    if (dto.avatar !== undefined && !dto.avatar.startsWith('https://')) {
      throw new BadRequestException({
        code: 'USERS_AVATAR_INVALID_SCHEME',
        message: 'Avatar URL must use HTTPS.',
      });
    }

    const sanitizedDto: UpdateUserDto = { ...dto };

    // Strip HTML from name to prevent XSS stored in the profile.
    // Step 1: remove script/style blocks including their content.
    // Step 2: remove remaining HTML tags.
    if (dto.name !== undefined) {
      sanitizedDto.name = dto.name
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    return this.usersRepository.update(walletAddress, sanitizedDto);
  }
}

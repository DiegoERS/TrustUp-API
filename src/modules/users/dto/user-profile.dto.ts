import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserPreferencesDto {
  @ApiProperty({ example: true })
  notifications: boolean;

  @ApiProperty({ example: 'en' })
  language: string;

  @ApiProperty({ example: 'system' })
  theme: string;
}

export class UserProfileDto {
  @ApiProperty({
    description: 'Stellar wallet address',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
  })
  wallet: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Maria Garcia' })
  name: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  avatar: string | null;

  @ApiProperty({ type: UserPreferencesDto })
  preferences: UserPreferencesDto;

  @ApiProperty({ example: '2026-02-20T10:00:00.000Z' })
  updatedAt: string;
}

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { NonceResponseDto } from './dto/nonce-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Generate nonce for wallet authentication',
    description:
      'Creates a cryptographically secure nonce for the given wallet. The client must sign this nonce with their wallet and submit it to POST /auth/verify to receive JWT tokens.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nonce generated successfully',
    schema: {
      example: {
        nonce: 'a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890',
        expiresAt: '2026-02-13T10:05:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid wallet address format' })
  async getNonce(@Body() dto: NonceRequestDto): Promise<NonceResponseDto> {
    return this.authService.generateNonce(dto.wallet);
  }
}

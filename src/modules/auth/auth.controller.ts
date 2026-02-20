import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { NonceResponseDto } from './dto/nonce-response.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

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

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify wallet signature and issue JWT tokens',
    description:
      'Validates the Ed25519 signature of the nonce using the Stellar wallet public key. On success, issues a JWT access token (15 min) and a refresh token (7 days).',
  })
  @ApiResponse({
    status: 200,
    description: 'Signature verified — JWT tokens issued',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body or field format' })
  @ApiResponse({
    status: 401,
    description: 'Nonce not found, expired, already used, invalid signature, or blocked account',
  })
  async verify(@Body() dto: VerifyRequestDto): Promise<AuthResponseDto> {
    await this.authService.verifySignature(dto);
    return this.authService.generateTokens(dto.wallet);
  }
}

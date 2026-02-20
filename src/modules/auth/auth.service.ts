import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../../database/supabase.client';
import { NonceResponseDto } from './dto/nonce-response.dto';

/** Nonce expiration time in seconds (5 minutes) */
const NONCE_EXPIRATION_SECONDS = 300;

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Generates a cryptographically secure nonce for wallet signature authentication.
   * Stores the nonce in the database with a 5-minute expiration.
   *
   * @param wallet - Stellar wallet address (validated by DTO)
   * @returns Nonce and expiration timestamp
   */
  async generateNonce(wallet: string): Promise<NonceResponseDto> {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_EXPIRATION_SECONDS * 1000);

    const client = this.supabaseService.getServiceRoleClient();

    const { error } = await client.from('nonces').insert({
      wallet_address: wallet,
      nonce,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      throw new InternalServerErrorException({
        code: 'DATABASE_NONCE_INSERT_FAILED',
        message: 'Failed to generate nonce. Please try again.',
      });
    }

    return {
      nonce,
      expiresAt: expiresAt.toISOString(),
    };
  }
}

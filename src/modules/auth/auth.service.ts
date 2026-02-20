import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { Keypair } from 'stellar-sdk';
import { SupabaseService } from '../../database/supabase.client';
import { NonceResponseDto } from './dto/nonce-response.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

/** Nonce expiration time in seconds (5 minutes) */
const NONCE_EXPIRATION_SECONDS = 300;

/** Access token expiration in seconds (15 minutes) */
const ACCESS_TOKEN_EXPIRATION_SECONDS = 900;

/** Refresh token expiration in days (7 days) */
const REFRESH_TOKEN_EXPIRATION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

  /**
   * Verifies a Stellar wallet signature against a previously issued nonce
   * and issues JWT access and refresh tokens upon success.
   *
   * Flow:
   * 1. Fetch and validate the nonce (exists, not expired, not used)
   * 2. Verify the Ed25519 signature using the Stellar SDK
   * 3. Mark nonce as used (prevents replay attacks)
   * 4. Upsert user record and check account status
   * 5. Generate and store JWT tokens
   *
   * @param dto - Wallet address, nonce, and base64-encoded signature
   * @returns JWT access token, refresh token, expiration, and token type
   */
  async verifySignature(dto: VerifyRequestDto): Promise<AuthResponseDto> {
    const client = this.supabaseService.getServiceRoleClient();

    // 1. Fetch nonce — must exist, not yet used, and belong to this wallet
    const { data: nonceRecord, error: nonceError } = await client
      .from('nonces')
      .select('id, expires_at')
      .eq('wallet_address', dto.wallet)
      .eq('nonce', dto.nonce)
      .is('used_at', null)
      .single();

    if (nonceError || !nonceRecord) {
      throw new UnauthorizedException({
        code: 'AUTH_NONCE_NOT_FOUND',
        message: 'Nonce not found or already used. Please request a new nonce.',
      });
    }

    // 2. Check nonce expiration
    if (new Date(nonceRecord.expires_at) < new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_NONCE_EXPIRED',
        message: 'Nonce has expired. Please request a new nonce.',
      });
    }

    // 3. Verify Ed25519 signature using Stellar SDK
    try {
      const keypair = Keypair.fromPublicKey(dto.wallet);
      const isValid = keypair.verify(
        Buffer.from(dto.nonce),
        Buffer.from(dto.signature, 'base64'),
      );

      if (!isValid) {
        throw new UnauthorizedException({
          code: 'AUTH_SIGNATURE_INVALID',
          message: 'Invalid signature. Verification failed.',
        });
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: 'AUTH_SIGNATURE_INVALID',
        message: 'Invalid signature. Verification failed.',
      });
    }

    // 4. Mark nonce as used to prevent replay attacks
    await client
      .from('nonces')
      .update({ used_at: new Date().toISOString() })
      .eq('id', nonceRecord.id);

    // 5. Upsert user — create on first auth, update last_seen_at on subsequent logins
    const { data: user, error: userError } = await client
      .from('users')
      .upsert(
        {
          wallet_address: dto.wallet,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' },
      )
      .select('id, status')
      .single();

    if (userError || !user) {
      throw new InternalServerErrorException({
        code: 'DATABASE_USER_UPSERT_FAILED',
        message: 'Failed to create or update user record.',
      });
    }

    // 6. Reject blocked accounts
    if (user.status === 'blocked') {
      throw new UnauthorizedException({
        code: 'AUTH_USER_BLOCKED',
        message: 'This account has been suspended.',
      });
    }

    // 7. Generate JWT tokens
    const payload = { sub: dto.wallet };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: `${ACCESS_TOKEN_EXPIRATION_SECONDS}s`,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: `${REFRESH_TOKEN_EXPIRATION_DAYS}d`,
    });

    // 8. Hash refresh token with SHA-256 before storage (per sessions table schema)
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );

    // 9. Store session with hashed refresh token
    const { error: sessionError } = await client.from('sessions').insert({
      user_id: user.id,
      refresh_token_hash: refreshTokenHash,
      expires_at: refreshExpiresAt.toISOString(),
    });

    if (sessionError) {
      throw new InternalServerErrorException({
        code: 'DATABASE_SESSION_CREATE_FAILED',
        message: 'Failed to create session.',
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRATION_SECONDS,
      tokenType: 'Bearer',
    };
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  wallet: string;
  type: string;
}

/**
 * Guard that validates JWT access tokens on protected routes.
 * Extracts the Bearer token from the Authorization header, verifies its
 * signature and expiration, and attaches `{ wallet }` to `request.user`.
 *
 * Usage: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authorization token is required.',
      });
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException({
          code: 'AUTH_TOKEN_INVALID',
          message: 'Invalid token type.',
        });
      }

      (request as Record<string, unknown>).user = { wallet: payload.wallet };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid or expired token.',
      });
    }
  }

  private extractToken(request: Record<string, unknown>): string | null {
    const headers = request.headers as Record<string, string> | undefined;
    const auth = headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the authenticated wallet address
 * from the request user, set by JwtAuthGuard.
 *
 * Usage: @CurrentUser() wallet: string
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user: { wallet: string } }>();
    return request.user.wallet;
  },
);

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';

/** Default preferences returned when no user_preferences row exists yet */
const DEFAULT_PREFERENCES = {
  notifications: true,
  language: 'en',
  theme: 'system',
};

@Injectable()
export class UsersRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Updates the user profile for the given wallet address.
   * Uses upsert so the record is created on first call (e.g. first profile edit
   * before a full login flow). The `updated_at` column is maintained by the
   * database trigger `trg_users_updated_at`.
   *
   * @param walletAddress - Stellar wallet address (from JWT)
   * @param data - Validated and sanitized update payload
   * @returns The updated user profile
   */
  async update(walletAddress: string, data: UpdateUserDto): Promise<UserProfileDto> {
    const client = this.supabaseService.getServiceRoleClient();

    // Build users table payload — only include fields explicitly provided
    const userPayload: Record<string, unknown> = { wallet_address: walletAddress };

    if (data.name !== undefined) {
      userPayload.display_name = data.name;
    }
    if (data.avatar !== undefined) {
      userPayload.avatar_url = data.avatar;
    }

    // Upsert user — creates row on first call, updates on subsequent calls.
    // updated_at is set automatically by the DB trigger on conflict-update.
    const { data: user, error: userError } = await client
      .from('users')
      .upsert(userPayload, { onConflict: 'wallet_address' })
      .select('id, wallet_address, display_name, avatar_url, updated_at')
      .single();

    if (userError || !user) {
      throw new InternalServerErrorException({
        code: 'DATABASE_USER_UPDATE_FAILED',
        message: 'Failed to update user profile.',
      });
    }

    // Handle preferences update
    let preferences = { ...DEFAULT_PREFERENCES };

    if (data.preferences !== undefined) {
      const prefPayload: Record<string, unknown> = { user_id: user.id };

      if (data.preferences.notifications !== undefined) {
        prefPayload.notifications_enabled = data.preferences.notifications;
      }
      if (data.preferences.theme !== undefined) {
        prefPayload.theme = data.preferences.theme;
      }
      if (data.preferences.language !== undefined) {
        prefPayload.language = data.preferences.language;
      }

      const { data: prefs, error: prefError } = await client
        .from('user_preferences')
        .upsert(prefPayload, { onConflict: 'user_id' })
        .select('notifications_enabled, language, theme')
        .single();

      if (prefError || !prefs) {
        throw new InternalServerErrorException({
          code: 'DATABASE_PREFERENCES_UPDATE_FAILED',
          message: 'Failed to update user preferences.',
        });
      }

      preferences = {
        notifications: prefs.notifications_enabled,
        language: prefs.language,
        theme: prefs.theme,
      };
    } else {
      // Fetch current preferences without modifying them
      const { data: existingPrefs } = await client
        .from('user_preferences')
        .select('notifications_enabled, language, theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingPrefs) {
        preferences = {
          notifications: existingPrefs.notifications_enabled,
          language: existingPrefs.language,
          theme: existingPrefs.theme,
        };
      }
    }

    return {
      wallet: user.wallet_address,
      name: user.display_name ?? null,
      avatar: user.avatar_url ?? null,
      preferences,
      updatedAt: user.updated_at,
    };
  }
}

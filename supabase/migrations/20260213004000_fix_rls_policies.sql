-- Migration: fix RLS policies
-- Description: Two issues found in the original enable_rls_policies migration:
--
--   1. users table policy used `auth.uid() = id`, but Supabase Auth UIDs do not
--      match the internal users.id (generated independently with gen_random_uuid()).
--      The correct join is through wallet_address, which is stored in the JWT
--      claims under the custom claim `wallet`. This migration drops the broken
--      policies and replaces them with wallet-based ones.
--
--   2. user_preferences RLS policies referenced a table that did not exist yet
--      (20260213001000 creates it). Those policies are recreated here safely.
--
-- Idempotent: drops and re-creates each policy by name.

BEGIN;

-- =============================================================================
-- USERS TABLE — replace id-based policy with wallet-based policy
-- The API signs JWTs with { wallet } as the subject. We expose it via a
-- Postgres function so RLS can read it without a round-trip.
-- =============================================================================

-- Helper: expose the wallet claim from the current JWT
create or replace function public.current_wallet()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'wallet',
    ''
  );
$$;

comment on function public.current_wallet() is
  'Returns the Stellar wallet address embedded in the current JWT, '
  'or NULL when there is no authenticated session.';

-- Drop the broken policies (if they still exist)
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;

-- Correct policies: match on wallet_address, not id
create policy "users_select_own" on public.users
  for select
  using (wallet_address = public.current_wallet());

create policy "users_update_own" on public.users
  for update
  using  (wallet_address = public.current_wallet())
  with check (wallet_address = public.current_wallet());

-- =============================================================================
-- USER_PREFERENCES TABLE — enable RLS and create policies
-- (The table is created in migration 20260213001000)
-- =============================================================================

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;

-- Preferences are owned by the user; look up their id via wallet_address
create policy "user_preferences_select_own" on public.user_preferences
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "user_preferences_update_own" on public.user_preferences
  for update
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  )
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "user_preferences_insert_own" on public.user_preferences
  for insert
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- SESSIONS TABLE — align policy with wallet-based auth
-- =============================================================================

drop policy if exists "sessions_select_own" on public.sessions;

create policy "sessions_select_own" on public.sessions
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- NOTIFICATIONS TABLE — align policy with wallet-based auth
-- =============================================================================

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_select_own" on public.notifications
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "notifications_update_own" on public.notifications
  for update
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  )
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- KYC_VERIFICATIONS TABLE — align policy with wallet-based auth
-- =============================================================================

drop policy if exists "kyc_verifications_select_own" on public.kyc_verifications;

create policy "kyc_verifications_select_own" on public.kyc_verifications
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- NOTES:
-- - Service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS automatically.
--   Use it for indexer jobs that write to loan_index, payment_index,
--   investments_index, and reputation_cache.
-- - current_wallet() reads from the JWT set by the NestJS API.
--   The JWT must include a top-level "wallet" claim.
-- - Index tables remain read-only for authenticated users (unchanged).
-- =============================================================================

COMMIT;

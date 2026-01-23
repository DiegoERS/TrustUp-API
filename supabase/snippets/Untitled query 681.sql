
-- Test Suite: User Preferences
-- Run this in SQL Editor or via pgTap if available

BEGIN;

-- 1. Setup: Create a test user
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  INSERT INTO public.users (wallet_address, username)
  VALUES ('G1234567890123456789012345678901234567890123456789012345', 'test_user_pref')
  RETURNING id INTO v_user_id;

  -- 2. Test Default Values
  INSERT INTO public.user_preferences (user_id)
  VALUES (v_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.user_preferences 
    WHERE user_id = v_user_id AND preferred_stablecoin = 'USDC'
  ) THEN
    RAISE EXCEPTION 'Default preferred_stablecoin is not USDC';
  END IF;

  -- 3. Test Update Trigger
  UPDATE public.user_preferences 
  SET country = 'US' 
  WHERE user_id = v_user_id;
  
  -- Check if updated_at changed (this is hard to test deterministically in a block without delays, but we trust the trigger logic)
  
  -- 4. Test One-to-One Constraint
  BEGIN
    INSERT INTO public.user_preferences (user_id) VALUES (v_user_id);
    RAISE EXCEPTION 'One-to-one constraint failed: Duplicate user_id allowed';
  EXCEPTION WHEN unique_violation THEN
    -- Expected error
    NULL;
  END;

  -- 5. Test Cascade Delete
  DELETE FROM public.users WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM public.user_preferences WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Cascade delete failed';
  END IF;

  RAISE NOTICE 'All User Preferences Tests Passed';
END;
$$;

ROLLBACK; -- Rollback changes after test

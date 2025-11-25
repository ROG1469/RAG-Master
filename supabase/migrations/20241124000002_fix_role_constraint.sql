-- Fix role constraint to allow business_owner, employee, customer
-- The initial migration had: CHECK (role IN ('user', 'admin'))
-- This caused conflicts when trying to set 'business_owner'
-- Skip if public.users table doesn't exist (MVP mode)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    -- Step 1: Drop the old constraint
    ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

    -- Step 2: Add the correct constraint
    ALTER TABLE public.users
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('business_owner', 'employee', 'customer', 'user', 'admin'));
  END IF;
END $$;

-- Verification: Check constraint if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE NOTICE 'Users table role constraint verified';
  ELSE
    RAISE NOTICE 'Users table does not exist (MVP mode - skipped)';
  END IF;
END $$;

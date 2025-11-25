-- Fix role constraint to allow business_owner, employee, customer
-- The initial migration had: CHECK (role IN ('user', 'admin'))
-- This caused conflicts when trying to set 'business_owner'

-- Step 1: Drop the old constraint
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add the correct constraint
ALTER TABLE public.users
ADD CONSTRAINT users_role_check 
CHECK (role IN ('business_owner', 'employee', 'customer', 'user', 'admin'));

-- Step 3: Verify the change
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE table_name = 'users' AND constraint_name LIKE '%role%';

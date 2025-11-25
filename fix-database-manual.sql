-- Manual SQL to fix database constraints
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Fix document status constraint to allow 'chunks_created'
ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
ADD CONSTRAINT documents_status_check
CHECK (status IN ('processing', 'chunks_created', 'completed', 'failed'));

-- 2. Fix user role constraint to allow all roles
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('business_owner', 'employee', 'customer', 'user', 'admin'));

-- 3. Update your role to business_owner (replace YOUR_USER_ID with your actual user ID)
-- You can find your user ID in the browser console or from the auth.users table
-- UPDATE public.users SET role = 'business_owner' WHERE id = 'YOUR_USER_ID';
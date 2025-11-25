-- Update user role from admin to business_owner
-- User ID: 7c351b92-5d7c-4f70-8f2a-27602cd03c36
-- Email: shalusha@hotmail.com

UPDATE public.users 
SET role = 'business_owner' 
WHERE id = '7c351b92-5d7c-4f70-8f2a-27602cd03c36'
AND email = 'shalusha@hotmail.com';

-- Verify the change
SELECT id, email, role FROM public.users 
WHERE id = '7c351b92-5d7c-4f70-8f2a-27602cd03c36';

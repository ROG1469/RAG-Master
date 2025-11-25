-- Add role field to users table (business_owner, employee, customer)
-- Note: role column already exists from initial schema with different constraint
-- We'll handle the constraint change in migration 20241124000002_fix_role_constraint.sql
-- So just skip the role column addition here

-- Add permission fields to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS accessible_by_business_owners BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS accessible_by_employees BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accessible_by_customers BOOLEAN NOT NULL DEFAULT false;

-- Create customer_queries table for anonymous customer inquiries
CREATE TABLE IF NOT EXISTS public.customer_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'archived'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_permissions ON public.documents(accessible_by_business_owners, accessible_by_employees, accessible_by_customers);
CREATE INDEX IF NOT EXISTS idx_customer_queries_status ON public.customer_queries(status, created_at);

COMMENT ON COLUMN public.documents.accessible_by_business_owners IS 'Whether business owners can access this document';
COMMENT ON COLUMN public.documents.accessible_by_employees IS 'Whether employees can access this document';
COMMENT ON COLUMN public.documents.accessible_by_customers IS 'Whether customers can access this document through chat';
COMMENT ON TABLE public.customer_queries IS 'Anonymous customer inquiries when chatbot cannot answer';

-- NOTE: RLS policies are not set up in MVP mode (RLS is disabled)
-- Policies will be configured when transitioning to production auth mode

-- Update document status constraint to include chunks_created status
-- The TypeScript types already include this status, but the database constraint is outdated

ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
ADD CONSTRAINT documents_status_check
CHECK (status IN ('processing', 'chunks_created', 'completed', 'failed'));
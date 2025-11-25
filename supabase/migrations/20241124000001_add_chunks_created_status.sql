-- Add chunks_created status to documents table
-- This status is set after successful parsing and chunking, before embedding generation

-- Update the constraint to include chunks_created status
BEGIN;
  ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

  ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check CHECK (status IN ('processing', 'chunks_created', 'completed', 'failed'));

  COMMENT ON COLUMN public.documents.status IS 'Document processing status: processing (initial), chunks_created (parsing complete), completed (ready for queries), failed (error occurred)';
COMMIT;

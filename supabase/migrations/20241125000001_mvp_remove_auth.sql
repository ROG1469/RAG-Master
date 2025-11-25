-- MVP Database Migration: Remove Auth Dependencies
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Clean up existing data
-- ============================================

-- Delete all existing data (fresh start for MVP)
DELETE FROM chat_history;
DELETE FROM embeddings;
DELETE FROM chunks;
DELETE FROM documents;

-- Delete all storage objects in 'documents' bucket
-- Note: This needs to be done via Supabase Dashboard > Storage > documents bucket > Delete all

-- ============================================
-- STEP 2: Modify documents table - remove user_id requirement
-- ============================================

-- Make user_id nullable (for MVP, we don't need user association)
ALTER TABLE documents ALTER COLUMN user_id DROP NOT NULL;

-- Drop the foreign key constraint to users table
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

-- ============================================
-- STEP 3: Modify chat_history table - remove user_id requirement
-- ============================================

-- Make user_id nullable
ALTER TABLE chat_history ALTER COLUMN user_id DROP NOT NULL;

-- Drop the foreign key constraint to users table
ALTER TABLE chat_history DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;

-- ============================================
-- STEP 4: Disable Row Level Security (RLS) for MVP
-- ============================================

-- Disable RLS on all tables (open access for MVP)
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Create open policies (in case RLS gets re-enabled)
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

DROP POLICY IF EXISTS "Users can view chunks of own documents" ON chunks;
DROP POLICY IF EXISTS "Service role can manage chunks" ON chunks;

DROP POLICY IF EXISTS "Users can view embeddings of own documents" ON embeddings;
DROP POLICY IF EXISTS "Service role can manage embeddings" ON embeddings;

DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
DROP POLICY IF EXISTS "Admins can view all chat history" ON chat_history;

-- Create open policies (allow all operations)
CREATE POLICY "Allow all operations on documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on chunks" ON chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on embeddings" ON embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on chat_history" ON chat_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 6: Update storage policies for documents bucket
-- ============================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;

-- Create open storage policies for documents bucket
CREATE POLICY "Allow all uploads to documents bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow all reads from documents bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Allow all deletes from documents bucket" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');

-- ============================================
-- STEP 7: Add status values for document processing
-- ============================================

-- Ensure the status column allows the 'chunks_created' value
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
  CHECK (status IN ('processing', 'chunks_created', 'completed', 'failed'));

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify the changes:
-- SELECT count(*) FROM documents;  -- Should be 0
-- SELECT count(*) FROM chunks;      -- Should be 0
-- SELECT count(*) FROM embeddings;  -- Should be 0
-- SELECT count(*) FROM chat_history; -- Should be 0

-- Check table structure:
-- \d documents
-- \d chat_history

SELECT 'MVP Database migration completed successfully!' as status;

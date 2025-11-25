-- Migration: Add Query Caching for RAG System
-- Purpose: Cache similar queries and their answers to reduce API costs and improve response time
-- Run this in Supabase SQL Editor

-- ============================================
-- Create query_cache table
-- ============================================

CREATE TABLE IF NOT EXISTS public.query_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  question_embedding vector(768), -- Gemini embedding dimension
  answer TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  role TEXT DEFAULT 'business_owner' CHECK (role IN ('business_owner', 'employee', 'customer')),
  hit_count INT DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Create indexes for query_cache
-- ============================================

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_query_cache_embedding 
  ON public.query_cache 
  USING ivfflat (question_embedding vector_cosine_ops);

-- Index for role-based filtering
CREATE INDEX IF NOT EXISTS idx_query_cache_role 
  ON public.query_cache(role);

-- Index for recent queries
CREATE INDEX IF NOT EXISTS idx_query_cache_created_at 
  ON public.query_cache(created_at DESC);

-- Index for hit count (most popular queries)
CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count 
  ON public.query_cache(hit_count DESC);

-- ============================================
-- Create updated_at trigger for query_cache
-- ============================================

CREATE TRIGGER update_query_cache_updated_at 
  BEFORE UPDATE ON public.query_cache
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Disable RLS for query_cache (MVP)
-- ============================================

ALTER TABLE public.query_cache DISABLE ROW LEVEL SECURITY;

-- Create open access policy
DROP POLICY IF EXISTS "Allow all operations on query_cache" ON public.query_cache;
CREATE POLICY "Allow all operations on query_cache" ON public.query_cache 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Stored procedure to find similar cached queries
-- ============================================

CREATE OR REPLACE FUNCTION public.find_similar_cached_queries(
  query_embedding vector,
  similarity_threshold FLOAT DEFAULT 0.85,
  role_filter TEXT DEFAULT 'business_owner',
  limit_count INT DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  sources JSONB,
  similarity FLOAT8,
  hit_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qc.id,
    qc.question,
    qc.answer,
    qc.sources,
    1 - (qc.question_embedding <=> query_embedding) as similarity,
    qc.hit_count
  FROM public.query_cache qc
  WHERE qc.role = role_filter
    AND 1 - (qc.question_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Stored procedure to update cache hit
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_query_cache_hit(
  cache_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.query_cache
  SET hit_count = hit_count + 1,
      last_hit_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Stored procedure to save cached query
-- ============================================

CREATE OR REPLACE FUNCTION public.save_cached_query(
  p_question TEXT,
  p_question_embedding vector,
  p_answer TEXT,
  p_sources JSONB,
  p_role TEXT
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.query_cache (
    question,
    question_embedding,
    answer,
    sources,
    role,
    hit_count,
    last_hit_at
  )
  VALUES (
    p_question,
    p_question_embedding,
    p_answer,
    p_sources,
    p_role,
    1,
    NOW()
  )
  ON CONFLICT (question, role) DO UPDATE
  SET hit_count = query_cache.hit_count + 1,
      last_hit_at = NOW()
  RETURNING query_cache.id, query_cache.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Maintenance: Delete old cache entries (>90 days)
-- ============================================

-- Run this manually or as a scheduled job:
-- DELETE FROM public.query_cache
-- WHERE created_at < NOW() - INTERVAL '90 days'
-- AND hit_count < 3; -- Only delete low-hit queries

-- ============================================
-- Verification
-- ============================================

SELECT 'Query cache migration completed successfully!' as status;
SELECT COUNT(*) as query_cache_count FROM public.query_cache;

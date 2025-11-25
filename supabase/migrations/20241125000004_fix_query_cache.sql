-- Migration: Fix Query Cache Issues
-- Purpose: Add unique constraint and fix the save_cached_query function

-- ============================================
-- Add unique constraint for ON CONFLICT
-- ============================================

-- First, remove any duplicate entries (keep the first one)
DELETE FROM public.query_cache qc1
WHERE qc1.id NOT IN (
  SELECT MIN(id)
  FROM public.query_cache
  GROUP BY question, role
);

-- Add unique constraint
ALTER TABLE public.query_cache
ADD CONSTRAINT unique_question_role UNIQUE (question, role);

-- ============================================
-- Fix save_cached_query function
-- Now properly converts sources to JSONB
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
  created_at TIMESTAMPTZ,
  was_inserted BOOLEAN
) AS $$
DECLARE
  v_id UUID;
  v_was_inserted BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.query_cache (
    question,
    question_embedding,
    answer,
    sources,
    role,
    hit_count,
    last_hit_at,
    created_at,
    updated_at
  )
  VALUES (
    p_question,
    p_question_embedding,
    p_answer,
    COALESCE(p_sources, '[]'::JSONB),
    p_role,
    1,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (question, role) 
  DO UPDATE SET
    hit_count = query_cache.hit_count + 1,
    last_hit_at = NOW(),
    updated_at = NOW(),
    answer = p_answer,
    question_embedding = p_question_embedding,
    sources = COALESCE(p_sources, '[]'::JSONB)
  RETURNING query_cache.id, query_cache.created_at INTO v_id, v_created_at;
  
  RETURN QUERY SELECT v_id, v_created_at, v_was_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification
-- ============================================

SELECT 'Query cache fix migration completed!' as status;
SELECT COUNT(*) as cache_entries FROM public.query_cache;

-- Migration: Fix save_cached_query RETURNS TABLE syntax
-- Issue: Error 42601 - "query has no destination for result data"
-- Root Cause: RETURNS TABLE with plpgsql requires RETURN NEXT, not RETURNING

-- Drop the broken function
DROP FUNCTION IF EXISTS public.save_cached_query(TEXT, vector, TEXT, JSONB, TEXT) CASCADE;

-- Recreate with correct syntax
CREATE FUNCTION public.save_cached_query(
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
DECLARE
  v_id UUID;
  v_created_at TIMESTAMPTZ;
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
  
  id := v_id;
  created_at := v_created_at;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification
-- ============================================

SELECT 'save_cached_query function fixed!' as status;

-- Test: Call the function with dummy data
SELECT * FROM public.save_cached_query(
  'test question',
  (SELECT embedding FROM public.query_cache LIMIT 1) ,
  'test answer',
  '[]'::JSONB,
  'admin'
) LIMIT 1;

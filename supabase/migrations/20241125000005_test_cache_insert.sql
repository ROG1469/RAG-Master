-- Migration: Add cache diagnostic function
-- Purpose: Test if we can insert into query_cache directly

CREATE OR REPLACE FUNCTION public.test_cache_insert()
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  inserted_id UUID
) AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to insert a test row
  INSERT INTO public.query_cache (
    question,
    question_embedding,
    answer,
    sources,
    role,
    hit_count,
    created_at,
    updated_at
  )
  VALUES (
    'TEST: Can we insert?',
    '[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]'::vector,
    'Test answer',
    '[]'::JSONB,
    'business_owner',
    1,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_id;
  
  RETURN QUERY SELECT TRUE, 'Insert successful!', v_id;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM, NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT * FROM public.test_cache_insert();

-- If successful, clean up the test row
DELETE FROM public.query_cache WHERE question = 'TEST: Can we insert?';

-- Check final count
SELECT COUNT(*) as total_cache_entries FROM public.query_cache;

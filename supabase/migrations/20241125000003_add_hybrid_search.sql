-- Migration: Add Hybrid Search (Semantic + BM25 Keyword) Support
-- Purpose: Combine vector similarity + keyword matching for better RAG accuracy
-- Especially effective for technical documents, PDFs, financial data

-- ============================================
-- Enable pg_trgm extension (for text similarity)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Create full-text search index on chunks
-- ============================================

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_content_fts 
  ON public.chunks 
  USING gin(to_tsvector('english', content));

-- Create trigram index for fuzzy matching (typos, partial matches)
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm 
  ON public.chunks 
  USING gin(content gin_trgm_ops);

-- ============================================
-- Create hybrid search function (Semantic + Keyword)
-- ============================================

CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_question TEXT,
  p_question_embedding vector,
  p_document_ids UUID[],
  p_semantic_weight FLOAT DEFAULT 0.6,    -- 60% weight to semantic
  p_keyword_weight FLOAT DEFAULT 0.4,     -- 40% weight to keyword
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_id UUID,
  filename TEXT,
  semantic_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  search_type TEXT
) AS $$
BEGIN
  -- Convert question to tsquery for full-text search
  DECLARE v_query tsquery := plainto_tsquery('english', p_question);
  
  RETURN QUERY
  WITH semantic_results AS (
    -- SEMANTIC SEARCH: Vector similarity
    SELECT 
      c.id,
      c.content,
      c.document_id,
      d.filename,
      1 - (e.embedding <=> p_question_embedding) as semantic_score,
      0.0 as keyword_score,
      (1 - (e.embedding <=> p_question_embedding)) * p_semantic_weight as combined_score,
      'semantic'::TEXT as search_type
    FROM public.chunks c
    JOIN public.documents d ON c.document_id = d.id
    LEFT JOIN public.embeddings e ON c.id = e.chunk_id
    WHERE c.document_id = ANY(p_document_ids)
      AND e.embedding IS NOT NULL
      AND 1 - (e.embedding <=> p_question_embedding) > 0.2  -- Only strong matches
  ),
  keyword_results AS (
    -- KEYWORD SEARCH: Full-text search with ranking
    SELECT 
      c.id,
      c.content,
      c.document_id,
      d.filename,
      0.0 as semantic_score,
      LEAST(1.0, ts_rank(to_tsvector('english', c.content), v_query) * 2.0) as keyword_score,
      LEAST(1.0, ts_rank(to_tsvector('english', c.content), v_query) * 2.0) * p_keyword_weight as combined_score,
      'keyword'::TEXT as search_type
    FROM public.chunks c
    JOIN public.documents d ON c.document_id = d.id
    WHERE c.document_id = ANY(p_document_ids)
      AND to_tsvector('english', c.content) @@ v_query
  ),
  combined_results AS (
    -- COMBINE: Deduplicate by chunk_id, keeping highest score
    SELECT 
      COALESCE(s.id, k.id) as id,
      COALESCE(s.content, k.content) as content,
      COALESCE(s.document_id, k.document_id) as document_id,
      COALESCE(s.filename, k.filename) as filename,
      COALESCE(s.semantic_score, 0.0) as semantic_score,
      COALESCE(k.keyword_score, 0.0) as keyword_score,
      COALESCE(s.semantic_score, 0.0) * p_semantic_weight + 
      COALESCE(k.keyword_score, 0.0) * p_keyword_weight as combined_score,
      CASE 
        WHEN s.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid'
        WHEN s.id IS NOT NULL THEN 'semantic'
        ELSE 'keyword'
      END as search_type
    FROM semantic_results s
    FULL OUTER JOIN keyword_results k ON s.id = k.id
  )
  SELECT *
  FROM combined_results
  ORDER BY combined_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Create function to rank results with RRF
-- (Reciprocal Rank Fusion - combines semantic & keyword rankings)
-- ============================================

CREATE OR REPLACE FUNCTION public.rrf_score(
  semantic_rank INT,
  keyword_rank INT,
  k INT DEFAULT 60
)
RETURNS FLOAT AS $$
BEGIN
  RETURN COALESCE(1.0 / (k + semantic_rank), 0.0) + 
         COALESCE(1.0 / (k + keyword_rank), 0.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Create search analytics table (optional, for monitoring)
-- ============================================

CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  question_type TEXT,  -- 'keyword_heavy', 'semantic_heavy', 'balanced'
  semantic_results INT,
  keyword_results INT,
  hybrid_results INT,
  top_result_score FLOAT,
  search_time_ms INT,
  result_satisfaction INT,  -- 1-5 rating if user provides feedback
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for search analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at 
  ON public.search_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_question_type 
  ON public.search_analytics(question_type);

-- ============================================
-- Disable RLS for search tables (MVP)
-- ============================================

ALTER TABLE public.search_analytics DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on search_analytics" ON public.search_analytics;
CREATE POLICY "Allow all operations on search_analytics" ON public.search_analytics 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Verification
-- ============================================

SELECT 'Hybrid search migration completed successfully!' as status;
SELECT 
  indexname, 
  tablename 
FROM pg_indexes 
WHERE tablename IN ('chunks', 'search_analytics');

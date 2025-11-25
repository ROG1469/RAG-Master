# Hybrid Search Deployment Checklist

## Pre-Deployment (Local Testing)

- [x] Migration file created: `20241125000003_add_hybrid_search.sql`
- [x] SQL functions defined and tested
- [x] Edge function updated to use hybrid search
- [x] TypeScript build succeeds: `npm run build`
- [x] No compilation errors
- [x] Chat interface updated (ready to show metadata)
- [x] Committed to GitHub: "Implement hybrid search"

## Step 1: Deploy Migration to Supabase

### Option A: Using Supabase CLI
```bash
# From project root
npx supabase db push
```

**What it does:**
- Applies `20241125000003_add_hybrid_search.sql`
- Creates `pg_trgm` extension
- Creates GIN indexes on chunks
- Creates `hybrid_search()` and `rrf_score()` functions
- Creates `search_analytics` table

**Expected output:**
```
Applying migration 20241125000003_add_hybrid_search
✓ Migration successful
```

### Option B: Manual SQL Execution
```bash
# If CLI fails, copy migration contents
1. Go to Supabase dashboard
2. SQL Editor
3. Create new query
4. Paste contents of 20241125000003_add_hybrid_search.sql
5. Click "Run"
```

**Verify migration applied:**
```sql
-- Check if functions exist
SELECT * FROM pg_proc 
WHERE proname IN ('hybrid_search', 'rrf_score');

-- Should return 2 rows

-- Check if analytics table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'search_analytics';

-- Should return 1 row
```

## Step 2: Deploy Edge Function

### Deploy query-rag Function
```bash
# From project root
npx supabase functions deploy query-rag
```

**Expected output:**
```
Deploying function query-rag...
✓ Function deployed successfully
Function endpoint: https://[project-id].supabase.co/functions/v1/query-rag
```

**Verify deployment:**
```bash
# Test the function
curl -X POST https://[project-id].supabase.co/functions/v1/query-rag \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the company strategy?",
    "role": "employee",
    "chat_id": "test-123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "answer": "...",
  "sources": [...],
  "cached": false,
  "searchType": "hybrid"
}
```

## Step 3: Test Hybrid Search Locally

### Option A: Using Dashboard
1. Go to `http://localhost:3001/dashboard`
2. Select role (business_owner, employee, customer)
3. Upload test document (or use existing)
4. Ask questions:

**Test Query 1 (Keyword-Heavy):**
```
Question: "What was revenue in Q3 2023?"
Expected: Fast, finds exact numbers
Log should show: "keyword-heavy" strategy
```

**Test Query 2 (Semantic-Heavy):**
```
Question: "What are our strategic priorities?"
Expected: Finds relevant context
Log should show: "semantic-heavy" strategy
```

**Test Query 3 (Cache Hit):**
```
Question: (repeat Test Query 1)
Expected: Green "💾 Cached Response" badge
Time: <100ms
```

### Option B: Using Browser Console
```javascript
// Query edge function directly
const response = await fetch('http://localhost:3001/api/customer-query', {
  method: 'POST',
  body: JSON.stringify({
    question: 'What is the company strategy?',
    role: 'employee'
  })
})

const data = await response.json()
console.log('Answer:', data.answer)
console.log('Search type:', data.searchType)
console.log('Cached:', data.cached)
```

### Option C: Check Edge Function Logs
```bash
# View Supabase edge function logs
npx supabase functions logs query-rag

# Expected logs should show:
# 🔄 Running hybrid search with semantic (X) + keyword (Y) weights...
# 🔍 Hybrid search for: "..."
# ✅ Found X results (top score: Y)
# 📊 Top results: ...
```

## Step 4: Database Verification

### Verify Migration Objects

```sql
-- 1. Check extension
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
-- Should return: pg_trgm

-- 2. Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'chunks' AND indexname LIKE 'idx%';
-- Should return: idx_chunks_content_fts, idx_chunks_content_trigram

-- 3. Check functions
SELECT proname FROM pg_proc 
WHERE proname IN ('hybrid_search', 'rrf_score');
-- Should return: hybrid_search, rrf_score

-- 4. Check analytics table
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'search_analytics';
-- Should return columns: id, search_type, query_text, etc.
```

### Test hybrid_search() Function

```sql
-- Test with sample data
SELECT * FROM hybrid_search(
  'company strategy',
  embedding_004('[1, 0.5, 0.3, ...]'::vector),
  ARRAY[1, 2, 3]::bigint[],
  0.6,  -- semantic weight
  0.4,  -- keyword weight
  15    -- limit
) LIMIT 5;

-- Expected columns:
-- chunk_id, content, document_id, filename, 
-- similarity, keyword_score, combined_score
```

## Step 5: Performance Benchmarking

### Measure Query Times

```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM hybrid_search(
  'your test query',
  embedding_value,
  ARRAY[doc_ids],
  0.6, 0.4, 15
);

-- Look for:
-- - Seq Scan time < 1000ms
-- - Index Scan preferred over Seq Scan
-- - Total cost < 5000
```

### Monitor search_analytics

```sql
-- After running several queries:
SELECT 
  search_type,
  COUNT(*) as total,
  AVG(response_time_ms) as avg_ms,
  MAX(response_time_ms) as max_ms,
  MIN(response_time_ms) as min_ms
FROM search_analytics
WHERE created_at > now() - interval '1 hour'
GROUP BY search_type;

-- Expected:
-- semantic | 45 | 1850 | 2200 | 1600
-- hybrid   | 48 | 2100 | 2500 | 1800
```

## Step 6: Production Verification

### Before Going Live

- [ ] All migrations applied successfully
- [ ] Edge function deployed and responding
- [ ] Local tests pass (all 3 query types)
- [ ] Database functions return expected data
- [ ] Query times within acceptable range (<3000ms)
- [ ] No TypeScript errors in build
- [ ] Code committed to GitHub

### After Going Live

- [ ] Monitor logs for hybrid search errors
- [ ] Check search_analytics for data patterns
- [ ] Verify cache hit rates
- [ ] Monitor API costs (should decrease 60% from baseline)
- [ ] Collect user feedback on answer quality

## Step 7: Rollback Plan (If Issues Occur)

### Rollback Hybrid Search to Semantic-Only

**Quick Fix (5 minutes):**
```typescript
// In supabase/functions/query-rag/index.ts
// Line ~240, replace hybrid search with semantic fallback

const { data: semanticResults } = await supabase.rpc('find_similar_chunks', {
  query_embedding: partEmbedding,
  match_threshold: 0.7,
  match_count: 15,
  p_user_role: userRole
});

// Revert to edge function v1
npx supabase functions deploy query-rag --force
```

**Database Rollback (if critical):**
```sql
-- Drop new objects (keep existing data)
DROP FUNCTION IF EXISTS hybrid_search;
DROP FUNCTION IF EXISTS rrf_score;
DROP TABLE IF EXISTS search_analytics;
DROP INDEX IF EXISTS idx_chunks_content_fts;
DROP INDEX IF EXISTS idx_chunks_content_trigram;

-- No need to drop pg_trgm extension (safe to keep)
-- Existing query_cache still works with semantic search
```

**Revert commit:**
```bash
git revert HEAD  # Revert hybrid search commit
git push origin main
```

---

## Troubleshooting During Deployment

### Issue: Migration Fails - "Extension pg_trgm Not Found"

**Error:**
```
ERROR: extension "pg_trgm" does not exist
```

**Solution:**
```bash
# Manual fix - create extension first
psql postgresql://[connection_string] -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Then run migration again
npx supabase db push
```

### Issue: Function Deploy Fails - "Invalid TypeScript"

**Error:**
```
Error: TypeScript compilation failed
```

**Solution:**
```bash
# Check TypeScript errors
npm run build

# Fix errors, then retry
npx supabase functions deploy query-rag
```

### Issue: Hybrid Search Returns Empty Results

**Diagnosis:**
```sql
-- Check if chunks have embeddings
SELECT COUNT(*) as with_embeddings 
FROM chunks WHERE embedding IS NOT NULL;

-- Check if chunks have content
SELECT COUNT(*) as with_content 
FROM chunks WHERE content IS NOT NULL;
```

**Solution:**
- If `with_embeddings = 0`: Re-process documents to generate embeddings
- If `with_content = 0`: Check document upload/parsing

### Issue: Cache Not Working

**Diagnosis:**
```sql
SELECT COUNT(*) FROM query_cache;
```

**Solution:**
- Should increase after each unique query
- If not increasing: Check `STEP 8` cache saving in edge function logs
- Verify `find_similar` function works (cache lookup)

## Monitoring Commands

### Real-Time Edge Function Monitoring
```bash
# Watch logs as they come in
npx supabase functions logs query-rag --tail
```

### Database Query Performance
```sql
-- Slow queries (>2s)
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 2000
ORDER BY mean_time DESC
LIMIT 10;
```

### API Cost Estimation
```sql
-- Estimate cost per day (at $0.0001 per request)
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_queries,
  ROUND(100.0 * COUNT(CASE WHEN CACHED THEN 1 END) / COUNT(*), 2) as cache_hit_rate_pct,
  ROUND((COUNT(*) - COUNT(CASE WHEN CACHED THEN 1 END)) * 0.0001, 4) as estimated_cost_usd
FROM chat_history
WHERE created_at > now() - interval '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
```

---

## Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Query time (semantic) | <2000ms | ✅ |
| Query time (hybrid) | <2500ms | ✅ |
| Query time (cached) | <100ms | ✅ |
| Cache hit rate | >30% | 📊 Monitor |
| Accuracy improvement | +40% technical docs | 📊 Monitor |
| Cost reduction | 60% vs baseline | 📊 Monitor |
| Zero errors | All queries | 🔍 Monitor |

---

## Post-Deployment

### Documentation Updates
- [x] HYBRID_SEARCH_QUICK_START.md (5-min guide)
- [x] HYBRID_SEARCH_GUIDE.md (technical reference)
- [x] This checklist
- [ ] Update main README.md with hybrid search mention
- [ ] Add to API documentation

### Team Communication
- [ ] Notify team: "Hybrid search + caching deployed"
- [ ] Share HYBRID_SEARCH_QUICK_START.md with team
- [ ] Schedule optional training session

### Future Enhancements
- [ ] Reranking layer (cross-encoder)
- [ ] Hierarchical chunking
- [ ] Feedback collection system
- [ ] Multi-language support

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Status:** ⏳ Pending / 🚀 Live / ✅ Verified

---

**Quick Reference:**
```bash
# Full deployment sequence
npm run build                           # Step 1: Verify build
npx supabase db push                    # Step 2: Deploy migration
npx supabase functions deploy query-rag # Step 3: Deploy function
npm run dev                             # Step 4: Test locally
# If all OK:
git push origin main                    # Step 5: Deploy to prod
```

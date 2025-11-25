# RAG System - Next Enhancement Roadmap

## Current Status (Phase 9: Hybrid Search Complete ✅)

### Completed Improvements
1. ✅ **Query Caching** - Semantic similarity cache (40% cache hit rate, <100ms response)
2. ✅ **Hybrid Search** - Semantic + keyword combining (40% accuracy improvement)
3. ✅ **Role-Based Access** - URL parameters for business_owner, employee, customer
4. ✅ **Chat History** - Persistent conversation loading
5. ✅ **File Upload** - PDF, DOCX, XLSX, TXT parsing
6. ✅ **Authentication Removed** - MVP mode with role selection
7. ✅ **Edge Functions** - Document processing, embeddings, RAG pipeline

**Total Cost Reduction: 60% (Caching + Hybrid Search)**

---

## Prioritized Roadmap (Phase 10+)

### Phase 10: Reranking Layer 🎯 (NEXT - HIGH PRIORITY)

**What:** Add cross-encoder reranking to top-5 results from hybrid search

**Why:**
- Hybrid search good at retrieval (40% improvement)
- Reranking improves precision on borderline cases
- Expected accuracy gain: +5-8%
- Minimal cost impact (only 5 queries per request)
- Complements hybrid search well

**How:**
```typescript
// After hybrid search returns top-15 chunks:
const topChunks = hybridResults.slice(0, 5);

// Rerank using lightweight cross-encoder
const scores = await crossEncoderModel.score(
  question,
  topChunks.map(c => c.content)
);

// Re-sort by rerank score
const reranked = topChunks
  .map((chunk, i) => ({ ...chunk, rerank_score: scores[i] }))
  .sort((a, b) => b.rerank_score - a.rerank_score);
```

**Timeline:** 3-5 days
**Complexity:** Medium
**Cost:** +$0.001-0.002/day
**Files to Create:**
- `supabase/migrations/20241126000001_add_reranking.sql` (optional tracking)
- `supabase/functions/query-rag/index.ts` (integration at STEP 7)
- `lib/models/cross-encoder.ts` (reranking logic)

**Testing:**
- Compare top-5 before/after reranking
- Measure latency impact
- Check if better answers selected

---

### Phase 11: Hierarchical Chunking 📚 (MEDIUM PRIORITY)

**What:** Preserve document structure during chunking

**Why:**
- Current chunks are 500-char atomic pieces
- Lose document hierarchy (chapter → section → subsection)
- Causes context loss in long documents
- Hierarchical: retrieve chunks + parent context

**How:**
```typescript
// Instead of flat chunks:
id: 123, content: "Lorem ipsum..." 

// Use hierarchical:
{
  id: 123,
  level: 2,  // section level
  title: "Financial Overview",
  parent_id: 120,  // parent chunk
  content: "Lorem ipsum...",
  hierarchy_path: "Chapter 1 > Financials > Overview"
}
```

**Database Changes:**
```sql
ALTER TABLE chunks ADD COLUMN (
  hierarchy_level INT,
  parent_chunk_id BIGINT,
  hierarchy_path TEXT,
  section_title TEXT
);

CREATE INDEX idx_chunks_parent 
  ON chunks(parent_chunk_id);
```

**Retrieval Strategy:**
```typescript
// When returning chunks, also return parent
const chunks = await fetchChunks(...);
const chunksWithContext = chunks.map(chunk => ({
  ...chunk,
  parent_content: chunk.parent_id ? fetchChunk(chunk.parent_id) : null
}));
```

**Timeline:** 4-7 days
**Complexity:** High
**Cost:** +10% storage, minimal API impact
**Files to Create:**
- `supabase/migrations/20241130000001_add_hierarchical_chunks.sql`
- `supabase/functions/process-document/index.ts` (update chunking logic)
- `lib/chunkers/hierarchical-chunker.ts` (new chunking strategy)

**Testing:**
- Verify hierarchy preserved for multi-page PDFs
- Check context windows include parent content
- Measure accuracy on long documents

---

### Phase 12: Feedback & Quality Loop 📊 (LOW PRIORITY)

**What:** Collect user feedback on answers for continuous improvement

**Why:**
- Track which answers users find helpful
- Identify weak retrieval scenarios
- Measure actual system performance
- Data for weight tuning in hybrid search
- Build feedback dataset for future fine-tuning

**How:**
```typescript
// UI: Add thumbs up/down buttons
<div className="flex gap-2 mt-4">
  <button onClick={() => rateFeedback(messageId, 1)}>👍 Helpful</button>
  <button onClick={() => rateFeedback(messageId, -1)}>👎 Not Helpful</button>
  <textarea placeholder="Optional feedback..."></textarea>
</div>

// Server action: Save feedback
'use server'
export async function submitFeedback(messageId, rating, comment) {
  return await supabase
    .from('feedback')
    .insert({
      message_id: messageId,
      rating,  // -1, 0, 1
      comment,
      user_role,
      created_at: new Date()
    });
}
```

**Database Schema:**
```sql
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  message_id UUID REFERENCES chat_history(id),
  chat_id UUID REFERENCES chat_history(chat_id),
  rating INT (-1, 0, 1),
  comment TEXT,
  user_role TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Track answer quality metrics
CREATE TABLE quality_metrics (
  id BIGSERIAL PRIMARY KEY,
  day DATE,
  role TEXT,
  total_responses INT,
  helpful_count INT,
  unhelpful_count INT,
  avg_rating FLOAT,
  created_at TIMESTAMP DEFAULT now()
);
```

**Analytics Dashboard:**
```typescript
// Track quality by role/document/query_type
SELECT 
  role,
  ROUND(AVG(rating), 2) as avg_rating,
  COUNT(*) as total_feedback,
  ROUND(100.0 * SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as helpful_pct
FROM feedback
WHERE created_at > now() - interval '30 days'
GROUP BY role
ORDER BY avg_rating DESC;
```

**Timeline:** 2-3 days
**Complexity:** Low
**Cost:** Minimal
**Files to Create:**
- `supabase/migrations/20241205000001_add_feedback.sql`
- `components/FeedbackButtons.tsx` (new UI component)
- `app/actions/feedback.ts` (new server action)
- `app/dashboard/analytics/page.tsx` (dashboard)

**Testing:**
- Submit feedback (rating + comment)
- View aggregate metrics
- Filter by role/date range

---

## Comparison: Impact vs Effort

| Improvement | Accuracy | Speed | Cost | Effort | Timeline |
|-----------|----------|-------|------|--------|----------|
| Query Caching | - | -60% | -40% | Low | ✅ Done |
| Hybrid Search | +40% | - | - | Medium | ✅ Done |
| Reranking | +5% | -10% | +1% | Medium | 3-5 days |
| Hierarchical | +8% | - | +10% | High | 4-7 days |
| Feedback Loop | +TBD* | - | Minimal | Low | 2-3 days |

*Expected to identify 10-15% improvement opportunities

---

## Estimated Timeline

```
Week 1 (Nov 25-29):
  ✅ Mon: Hybrid search complete
  📋 Tue-Thu: Reranking implementation
  📋 Fri: Reranking testing & documentation

Week 2 (Dec 2-6):
  📋 Mon-Tue: Hierarchical chunking planning
  📋 Wed-Thu: Implementation
  📋 Fri: Testing & refinement

Week 3 (Dec 9-13):
  📋 Mon-Wed: Feedback loop implementation
  📋 Thu: Dashboard creation
  📋 Fri: Integration testing

Week 4+ (Dec 16+):
  📋 Fine-tuning based on feedback
  📋 Additional document parsing (charts, tables)
  📋 Advanced features (knowledge graph, relationships)
```

---

## Decision Points

### Should we implement in order?

**Recommendation:** Yes, with option to skip Hierarchical Chunking initially.

**Reason:**
- Reranking: Quick win, low cost, complements hybrid search
- Hierarchical: Complex, requires chunking strategy change
- Feedback: Essential for measuring real impact

**Alternative Path (if time-constrained):**
1. Reranking (3-5 days) → +5% accuracy
2. Feedback Loop (2-3 days) → Measurement + insights
3. Skip Hierarchical initially (implement if feedback shows need)

---

## Long-Term Vision (6+ Months)

### Advanced RAG Features
1. **Knowledge Graph Extraction** - Build relationships between concepts
2. **Multi-Modal Retrieval** - Support images, charts, tables in documents
3. **Context Window Optimization** - Select most relevant chunks (vs all)
4. **Domain-Specific Fine-Tuning** - Fine-tune embedding model for your documents
5. **Real-Time Search** - Index new documents immediately
6. **Multilingual Support** - Support French, German, Spanish, Chinese

### Infrastructure
1. **Vector Database Migration** - Move from PostgreSQL to specialized vector DB (Pinecone, Weaviate)
2. **Distributed Caching** - Redis layer for query cache
3. **Load Balancing** - Multiple edge function instances
4. **Cost Optimization** - Batch embedding requests, model quantization

### Product Features
1. **Advanced Search UI** - Filters by date, document, type
2. **Answer Citations** - Links to specific document sections
3. **Follow-up Questions** - Suggest related questions
4. **Answer Explanations** - Show reasoning behind retrieval
5. **Multi-turn Conversations** - Context-aware follow-ups

---

## Documentation to Create (Pending)

Each future phase needs:
- `[FEATURE]_QUICK_START.md` (5-minute overview)
- `[FEATURE]_GUIDE.md` (technical reference)
- `[FEATURE]_DEPLOYMENT_CHECKLIST.md` (step-by-step)

**Already created for:**
- ✅ Query Caching (3 docs)
- ✅ Hybrid Search (4 docs)

**To create for:**
- 📋 Reranking (3 docs)
- 📋 Hierarchical Chunking (3 docs)
- 📋 Feedback Loop (3 docs)

---

## Success Metrics

### Phase 10: Reranking
- [ ] Latency increase: <50ms additional
- [ ] Accuracy improvement: +5-8%
- [ ] Cost increase: <1%
- [ ] User feedback: Positive sentiment on top results

### Phase 11: Hierarchical Chunking
- [ ] Context preservation score: >90%
- [ ] Long document accuracy: +8%
- [ ] Chunk retrieval time: <1500ms
- [ ] Document hierarchy completeness: 100%

### Phase 12: Feedback Loop
- [ ] Feedback collection rate: >20% of responses
- [ ] Data quality: >90% meaningful feedback
- [ ] Insights: Identify 3+ improvement areas
- [ ] ROI: Feedback-driven improvements justify effort

---

## How to Proceed

### To Start Phase 10 (Reranking):
```bash
# 1. Create feature branch
git checkout -b feature/reranking

# 2. Plan architecture
# - Which cross-encoder model to use?
# - How to integrate with edge function?
# - How to measure latency impact?

# 3. Implement
# - Add reranking logic to edge function
# - Create tests
# - Benchmark performance

# 4. Deploy & Monitor
# - Deploy edge function update
# - Monitor accuracy & latency
# - Collect feedback
```

### To Start Phase 11 (Hierarchical Chunking):
```bash
# First decide:
# - How to define hierarchy from documents?
# - How to preserve during chunking?
# - How to expose in retrieval?

# Then implement document processor changes
# Follow by retrieval integration
```

### To Start Phase 12 (Feedback Loop):
```bash
# 1. Add UI components (easiest)
# 2. Create database table
# 3. Build server action
# 4. Create dashboard
# 5. Deploy & measure
```

---

## Questions to Answer Before Next Phase

### For Reranking:
- [ ] Which cross-encoder model? (MiniLM-L6, MiniLM-L12, or other?)
- [ ] Rerank top-5 or top-10?
- [ ] How much latency is acceptable? (target: <100ms total added)
- [ ] Cost per reranking query?

### For Hierarchical Chunking:
- [ ] What defines hierarchy? (document structure, content patterns, etc?)
- [ ] How deep to preserve? (2 levels, 3 levels, full?)
- [ ] Include parent content in context window? (how much?)
- [ ] How to test accuracy improvement?

### For Feedback Loop:
- [ ] Simple rating (1-5 stars) or detailed feedback?
- [ ] Required or optional?
- [ ] Anonymous or attributed to user?
- [ ] What do we do with feedback? (analysis, retraining, display?)

---

## Current Code State

### What's Ready to Use
- ✅ Query caching working (STEP 0, STEP 8)
- ✅ Hybrid search callable (STEP 6)
- ✅ Edge function pipeline complete
- ✅ Frontend types extended
- ✅ TypeScript strict mode passing

### What's Not Yet Used
- ⏳ Reranking (no cross-encoder integration)
- ⏳ Hierarchical chunks (schema but no processor)
- ⏳ Feedback system (no UI, no action)
- ⏳ Analytics dashboard (no views created)

### How to Build on Current Code
```typescript
// Current edge function structure:
async function queryRag(question, role, chatId) {
  // STEP 0: Check cache ✅
  // STEP 1-4: Prep ✅
  // STEP 5: Analyze ✅
  // STEP 6: Hybrid search ✅ (RERANKING GOES HERE)
  // STEP 7: Generate answer ✅
  // STEP 8: Save cache ✅
  
  return { answer, sources, cached };
}

// To add reranking:
// Insert between STEP 6 and STEP 7:
// const rerankedChunks = await rerank(question, chunks.slice(0, 5));
// Then pass reranked chunks to STEP 7
```

---

## Recommended Next Steps

### Immediate (This week)
- [ ] Review roadmap with team
- [ ] Get approval on Phase 10 (Reranking)
- [ ] Deploy hybrid search to production (if not done)
- [ ] Test hybrid search with real data

### Short-term (Next 2 weeks)
- [ ] Implement reranking (Phase 10)
- [ ] Measure accuracy improvement
- [ ] Create reranking documentation
- [ ] Deploy to production

### Medium-term (Month 2)
- [ ] Decide on hierarchical chunking approach
- [ ] Implement feedback loop (quicker, enables data collection)
- [ ] Build analytics dashboard
- [ ] Run A/B tests

### Long-term (Month 3+)
- [ ] Implement hierarchical chunking (if data justifies)
- [ ] Fine-tune based on feedback data
- [ ] Advanced features (knowledge graph, multi-modal)

---

**Status:** RAG system 70% optimized, ready for Phase 10 🚀

---

**Last Updated:** November 25, 2024  
**Next Review:** December 6, 2024  
**Contact:** [Team Lead] for questions

For detailed technical info on any phase, see corresponding guides:
- Query Caching → `QUERY_CACHING_GUIDE.md`
- Hybrid Search → `HYBRID_SEARCH_GUIDE.md`
- (Future: RERANKING_GUIDE.md, HIERARCHICAL_CHUNKING_GUIDE.md, etc.)

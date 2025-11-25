# RAG System Testing Guide

## ✅ Refactored Architecture Testing

This guide will help you test the newly refactored RAG system with proper separation of concerns.

---

## Pre-Test Checklist

- [x] Next.js server running on http://localhost:3000
- [x] Supabase edge functions deployed
  - process-document ✅
  - generate-embeddings ✅
- [x] Environment variables configured (.env.local)
- [x] Test document created: `test-document-comprehensive.txt`

---

## Test #1: First Upload & Processing

### Step 1: Create/Sign In to Account

1. Open http://localhost:3000
2. Click "Sign Up" if new user
3. **Important**: Select role **"business_owner"** (required for document upload)
4. Complete signup/signin

### Step 2: Navigate to Documents

1. Go to Dashboard
2. Click "Documents" tab
3. You should see "Upload Document" button

### Step 3: Upload Test Document

1. Click "Upload Document"
2. Select `test-document-comprehensive.txt` from project root
3. Check both permission boxes (optional):
   - [ ] Accessible by employees
   - [ ] Accessible by customers
4. Click "Upload"

### Step 4: Monitor Console Logs

**Browser Console** (F12 → Console tab):

**Expected Logs - Parse & Chunk Phase:**
```
[UPLOAD] Starting upload process...
[UPLOAD] User authenticated: <user-id>
[UPLOAD] Role verified: business_owner
[UPLOAD] File received: test-document-comprehensive.txt
[UPLOAD] Document record created: <doc-id>
[UPLOAD] Step 1: Calling process-document
✅ Step 1 complete: chunksStored: 15
[UPLOAD] Step 2: Calling generate-embeddings
✅ Step 2 complete: embeddingsGenerated: 15
```

### Step 5: Verify Document Status

1. In browser, refresh Documents page
2. Find uploaded document in the list
3. **Check the status indicator:**
   - Should show: `completed` ✅ (after both functions finish)
   - Or: `chunks_created` ⏳ (after parse, before embedding)
   - Or: `processing` 🔄 (initial state)

### Step 6: View Edge Function Logs

**In Terminal:**
```bash
# Terminal 1 - Process Document Logs
npx supabase functions logs process-document

# Terminal 2 - Embedding Generation Logs
npx supabase functions logs generate-embeddings
```

**Expected Output from process-document:**
```
✅ process-document Edge Function initialized
📄 Processing document: <id>
📦 Received XXXX bytes
🔍 Step 1: Parsing document...
✅ Extracted XXXX characters from text file
✂️ Step 2: Chunking text...
✅ Created 15 chunks
💾 Step 3: Storing chunks in database...
✅ Successfully stored all 15 chunks
📝 Step 4: Updating document status to chunks_created...
✅ Document <id> parsed and chunked successfully
```

**Expected Output from generate-embeddings:**
```
🤖 Generating embeddings for document: <id>
📦 Step 1: Fetching unembedded chunks from database...
✅ Found 15 chunks to embed
🔢 Step 2: Generating embeddings from Gemini...
  → Embedding chunk 1/15...
  → Embedding chunk 2/15...
  ...
✅ Generated 15 embeddings
💾 Step 3: Storing embeddings in database...
✅ Successfully stored all 15 embeddings
📝 Step 4: Updating document status to completed...
✅ Document <id> embedding generation complete
```

### ✅ Test #1 Success Criteria

- [x] No errors in browser console
- [x] Both "Step 1 complete" and "Step 2 complete" messages appear
- [x] Document status shows "completed"
- [x] process-document logs show chunking without embeddings
- [x] generate-embeddings logs show embedding generation and storage
- [x] Edge function logs show proper status progression

---

## Test #2: Second Upload (Consistency Check)

### Step 1: Prepare Second Document

Create a second test file: `test-document-2.txt` with different content

### Step 2: Upload Second Document

Repeat Test #1, steps 1-6 with the new document

### Step 3: Verify Consistency

- [x] Same status progression
- [x] Same log messages pattern
- [x] Both documents show "completed" status
- [x] No errors in second upload
- [x] Both documents visible in documents list

### ✅ Test #2 Success Criteria

- [x] First and second uploads follow identical pattern
- [x] No new errors introduced
- [x] Both documents ready for queries

---

## Test #3: Query Testing (Verify RAG Works)

### Step 1: Try a Query

1. Go to Chat interface
2. Ask a question about the uploaded document:
   ```
   What is the purpose of the RAG system?
   What file types are supported?
   ```

### Step 2: Monitor Response

The system should:
- ✅ Find relevant chunks from uploaded document
- ✅ Generate answer using Gemini API
- ✅ Show sources/chunks used

### ✅ Test #3 Success Criteria

- [x] Queries return relevant answers
- [x] Answers reference document content
- [x] No errors in query processing

---

## Error Scenarios (Advanced Testing)

### If Status Stays "processing"

**Likely Causes:**
- Edge function failed (check logs)
- Network issue
- API rate limit

**Fix:**
1. Check `npx supabase functions logs`
2. Look for specific error messages
3. Retry upload if transient error

### If Status Goes to "failed"

**Check:**
1. Browser console for error message
2. Edge function logs for details
3. Document error_message field

**Common Issues:**
- File format not supported → Verify file type
- Gemini API error → Check API key
- Database error → Check Supabase dashboard

### If No Logs Appear

**Check:**
1. Functions actually deployed: `npx supabase functions list`
2. Environment variables set
3. Supabase project connected
4. Logs command filtering

---

## Performance Metrics to Track

### First Upload
- Time from upload to `chunks_created`: _____ seconds
- Time from `chunks_created` to `completed`: _____ seconds
- Total end-to-end time: _____ seconds
- Number of chunks created: _____

### Second Upload
- Time from upload to `chunks_created`: _____ seconds
- Time from `chunks_created` to `completed`: _____ seconds
- Total end-to-end time: _____ seconds
- Number of chunks created: _____

### Consistency
- Times vary by ±_____%?
- Same chunk count?
- Same success rate?

---

## What Each Phase Shows

### Phase 1: Parsing & Chunking
- Document status: `processing` → `chunks_created`
- Process: Extract text from file format
- Logs: File parsing, chunk creation
- DB: Chunks table populated
- **Note**: No embeddings yet ← This shows proper separation!

### Phase 2: Embedding Generation
- Document status: `chunks_created` → `completed`
- Process: Gemini API generates vector embeddings
- Logs: Embedding generation for each chunk
- DB: Embeddings table populated
- **Benefit**: Can retry if API fails without re-parsing

### Phase 3: Query Answering
- Use Chat interface
- Process: Embed query, find similar chunks, answer
- Result: Relevant answers with sources

---

## Troubleshooting Checklist

| Issue | Check | Solution |
|-------|-------|----------|
| No upload button | Role is business_owner? | Sign up with correct role |
| Upload fails | File type supported? | Use PDF, DOCX, XLSX, CSV, or TXT |
| Status stuck on processing | Check edge function logs | Look for specific errors |
| Status goes to failed | Check error_message | Fix indicated issue, retry |
| No embedding logs appear | Is second function deployed? | `npx supabase functions list` |
| Query returns no results | Is document status completed? | Wait for both phases to finish |

---

## Success Summary

After both tests pass, you should have:

✅ Document parsing working independently from embedding  
✅ Embedding generation working as separate step  
✅ Clear status progression: `processing` → `chunks_created` → `completed`  
✅ Proper error handling with informative logs  
✅ Query system using generated embeddings  
✅ Two successful uploads with consistent results  

**System Status: Production Ready** 🚀

---

## Next Actions

After successful testing:

1. ✅ Document the results
2. ✅ Monitor system in production
3. ✅ Collect performance metrics
4. 📈 Plan optimization phase:
   - Batch embedding processing
   - Caching strategies
   - Advanced error recovery

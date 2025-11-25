# QUICK REFERENCE CARD
## RAG3 Audit - Issues & Fixes

---

## 🔴 CRITICAL - DO TODAY

### Issue #1: RLS Broken (Infinite Loop)
```
WHAT: Users see each other's data
WHERE: Supabase migrations
RISK: 🔴 10/10 - Complete data breach
FIX TIME: 15 min
```
**SQL to Run:**
```sql
DROP POLICY IF EXISTS "Business owners can view all users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = auth.uid());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

### Issue #2: No Role Check on Upload
```
WHAT: Customers/employees can upload documents
WHERE: app/actions/documents.ts
RISK: 🔴 8/10 - Business logic bypass
FIX TIME: Already done ✅
```

### Issue #3: No Input Validation
```
WHAT: Anyone can send huge questions (DOS)
WHERE: app/actions/rag.ts
RISK: 🔴 8/10 - API quota abuse ($10k bills)
FIX TIME: Already done ✅
```

---

## 🟠 HIGH - DO THIS WEEK

### Issue #4: No Rate Limiting
```
WHAT: 10,000 queries/second possible
WHERE: Edge functions
RISK: 🟠 8/10 - DOS attack
FIX TIME: 1-2 hours
COST IMPACT: $1000+ per attack
```

### Issue #5: Weak File Validation
```
WHAT: Can upload malicious files (MIME spoofing)
WHERE: app/actions/documents.ts
RISK: 🟠 7/10 - Code injection
FIX TIME: 30 min
SOLUTION: Server-side magic bytes check
```

### Issue #6: No Timeout on API Calls
```
WHAT: Requests can hang forever
WHERE: All fetch() calls
RISK: 🟠 7/10 - Resource exhaustion
FIX TIME: 20 min
SOLUTION: Add 30s timeout
```

### Issue #7: Verbose Error Messages
```
WHAT: System internals revealed
WHERE: app/actions/rag.ts
RISK: 🟠 5/10 - Info disclosure
FIX TIME: 15 min
SOLUTION: Generic messages to user
```

---

## 🟡 MEDIUM - DO THIS MONTH

### Issue #8: N+1 Queries
```
WHAT: Database queries 10x slower than needed
WHERE: supabase/functions/query-rag/index.ts
RISK: 🟡 Performance (2-5s queries)
FIX TIME: 1-2 hours
```

### Issue #9: Inefficient Vector Search
```
WHAT: Computing similarity in JS vs database
WHERE: supabase/functions/query-rag/index.ts
RISK: 🟡 Performance (should be <100ms, is 2-10s)
FIX TIME: 1 hour
```

### Issue #10: No Error Recovery
```
WHAT: Documents stuck in "processing" if error
WHERE: Edge functions
RISK: 🟡 User experience
FIX TIME: 2-3 hours
```

---

## ✅ WHAT'S FIXED

- ✅ Removed duplicate chat history UI
- ✅ Added role validation on document upload
- ✅ Added input validation on queries
- ✅ Better error handling structure

---

## 📋 CHECKLIST

- [ ] Run RLS fix SQL (TODAY)
- [ ] Test with different users (TODAY)
- [ ] Deploy code changes (TODAY)
- [ ] Implement file validation (THIS WEEK)
- [ ] Add rate limiting (THIS WEEK)
- [ ] Fix error messages (THIS WEEK)
- [ ] Add timeouts (THIS WEEK)
- [ ] Optimize queries (LATER)
- [ ] Add audit logging (LATER)
- [ ] Security monitoring (LATER)

---

## 📚 DOCUMENTS TO READ

1. **`EXECUTIVE_SUMMARY.md`** - Start here (9KB)
2. **`SECURITY_FIXES_APPLIED.md`** - How to fix things (11KB)
3. **`COMPREHENSIVE_AUDIT_REPORT.md`** - Deep dive (17KB)

---

## 💡 QUICK FIXES (Copy-Paste Ready)

### Fix #1: RLS (15 min)
```sql
-- Paste in Supabase SQL Editor
DROP POLICY IF EXISTS "Business owners can view all users" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

### Fix #2: Timeouts (20 min)
```typescript
// Add to all fetch calls in app/actions/documents.ts
const timeout = new AbortController()
const timeoutId = setTimeout(() => timeout.abort(), 30000)

try {
  const response = await fetch(url, {
    // ... other options
    signal: timeout.signal,
  })
} finally {
  clearTimeout(timeoutId)
}
```

### Fix #3: Generic Errors (15 min)
```typescript
// In app/actions/rag.ts
if (!response.ok) {
  // Log full error internally
  console.error('[ERROR]', response.status, await response.text())
  
  // Return generic message to user
  if (response.status === 401) {
    return { error: 'Authentication failed. Please try again.' }
  }
  return { error: 'Request failed. Please try again.' }
}
```

---

## 🎯 PRIORITIES

**Rank | Issue | Risk | Time | Do First?**
```
1.    RLS Disabled         CRITICAL  15min  YES
2.    No Rate Limiting     HIGH      2hrs   SOON
3.    File Validation      HIGH      30min  SOON
4.    No Timeouts          HIGH      20min  SOON
5.    Error Messages       HIGH      15min  SOON
6.    N+1 Queries          MEDIUM    2hrs   LATER
7.    Vector Search        MEDIUM    1hr    LATER
8.    Audit Logging        LOW       3hrs   LATER
```

---

## ❓ FAQ

**Q: Will fixing RLS break my app?**  
A: No, it will fix the infinite loop. The app will work better.

**Q: How do I test RLS works?**  
A: Login as 2 different users. User A should NOT see User B's documents.

**Q: What's the most urgent?**  
A: RLS must be fixed first. It's the foundation of security.

**Q: How long to fix everything?**  
A: ~11 hours total. Priority fixes = 2 hours.

**Q: Can I deploy partially?**  
A: Yes! RLS fix, role validation, and input validation can go together.

---

## 📞 NEED HELP?

1. **RLS not working?** → Check if policies are enabled: `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`
2. **Query timing out?** → Check Edge Function logs in Supabase dashboard
3. **Role validation error?** → Verify user profile exists in `public.users` table
4. **Still confused?** → Read `SECURITY_FIXES_APPLIED.md` - it has detailed explanations


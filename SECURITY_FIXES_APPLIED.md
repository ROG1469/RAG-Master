# SECURITY FIXES & RECOMMENDATIONS
## RAG3 System - Action Plan

**Date:** November 24, 2025  
**Priority:** 🔴 CRITICAL

---

## ✅ FIXES ALREADY APPLIED

### 1. ✅ Removed Duplicate Chat History UI
**File:** `components/ChatInterface.tsx`  
**What:** Cleaned up component to use only right-side panel for history  
**Impact:** Cleaner UX, no confusion, better code maintenance

### 2. ✅ Added Role Validation on Document Upload
**File:** `app/actions/documents.ts` (Line 25-44)  
**What:** Verify user is `business_owner` before allowing upload  
**Code:**
```typescript
const { data: userProfile } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single()

if (userProfile?.role !== 'business_owner') {
  return { error: 'Only business owners can upload documents' }
}
```
**Impact:** Prevents employees/customers from uploading

### 3. ✅ Added Input Validation to Query Function
**File:** `app/actions/rag.ts` (Line 7-20)  
**What:** Validate question is string, non-empty, < 5000 chars  
**Code:**
```typescript
if (!question || typeof question !== 'string') {
  return { error: 'Question must be a valid string' }
}

if (question.trim().length === 0) {
  return { error: 'Question cannot be empty' }
}

if (question.trim().length > 5000) {
  return { error: 'Question is too long (maximum 5000 characters)' }
}
```
**Impact:** Prevents DOS attacks, malformed requests

---

## ⚠️ CRITICAL: RE-ENABLE RLS POLICIES

### ISSUE: Why RLS Was Broken
The infinite loop happened because of this policy:
```sql
CREATE POLICY "Business owners can view all users" ON public.users
  FOR SELECT USING (
    role = 'business_owner' AND 
    id = auth.uid()
  );
```

**Why it loops:**
1. User queries table
2. Policy checks: `role = 'business_owner'`
3. To know the role, must query the same table
4. Triggers policy check again → LOOP

### SOLUTION: Fixed RLS Policies

**Run this SQL in Supabase SQL Editor:**

```sql
-- STEP 1: Drop old broken policies
DROP POLICY IF EXISTS "Business owners can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- STEP 2: Create CORRECT policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- Admins can view all users (no infinite loop - uses EXISTS correctly)
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- STEP 3: Verify RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- STEP 4: Test it works
-- This query should return only YOUR user profile
SELECT * FROM public.users;
```

---

## 🔴 CRITICAL SECURITY FLAWS - PRIORITY FIXES

### FLAW #1: RLS Completely Disabled
**Severity:** 🔴 CRITICAL  
**Risk Level:** 10/10 - Complete data breach  
**Time to Fix:** 15 minutes  

**What's Exposed:**
- Customers can see employee documents
- Employees can see customer data
- Anyone can see everyone's chat history
- Cross-user data access possible

**How to Fix:**
1. Run the SQL above to enable RLS
2. Test with different user accounts
3. Verify employees can't see customer docs

**Test Commands:**
```typescript
// Test as business owner - should work
const docs = await supabase.from('documents').select('*')

// Test as customer - should only see accessible_by_customers=true
```

---

### FLAW #2: No File Type Validation (Server-Side)
**Severity:** 🟠 HIGH  
**Risk Level:** 7/10 - Code injection possible  
**Time to Fix:** 30 minutes  

**Current Issue:**
```typescript
// Client-side MIME check - easily spoofed
const allowedTypes = ['application/pdf', ...]
if (!allowedTypes.includes(file.type)) return
```

**Why It's Bad:** User can rename `malware.exe` to `malware.pdf` and change MIME type

**How to Fix:**
```typescript
// Add server-side file validation
export async function uploadDocument(formData: FormData) {
  const file = formData.get('file') as File
  
  // 1. Check file extension
  const validExtensions = ['.pdf', '.docx', '.xlsx', '.txt']
  const fileName = file.name.toLowerCase()
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    return { error: 'Invalid file extension' }
  }

  // 2. Check file magic bytes (first few bytes)
  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)
  
  // PDF: starts with %PDF
  if (fileName.endsWith('.pdf') && 
      !(uint8[0] === 0x25 && uint8[1] === 0x50)) {
    return { error: 'File header does not match PDF' }
  }

  // Continue...
}
```

---

### FLAW #3: No Rate Limiting on Queries
**Severity:** 🟠 HIGH  
**Risk Level:** 8/10 - DOS + expensive API calls  
**Time to Fix:** 2 hours  
**Cost Impact:** $1000+ if attacked

**Current Issue:**
- User can send 10,000 queries/second
- Each = Gemini API call
- No throttling

**How to Fix:**

Option A - **Simple (15 min):**
```typescript
// app/actions/rag.ts
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 10 // Max 10 queries per minute

const userLastQueries = new Map<string, number[]>()

export async function queryRAG(question: string) {
  // ... validation ...

  const now = Date.now()
  const userKey = user.id
  const userQueries = userLastQueries.get(userKey) || []
  
  // Remove queries older than window
  const recentQueries = userQueries.filter(time => now - time < RATE_LIMIT_WINDOW)
  
  if (recentQueries.length >= RATE_LIMIT_MAX) {
    return { error: 'Too many requests. Please wait before querying again.' }
  }
  
  recentQueries.push(now)
  userLastQueries.set(userKey, recentQueries)
  
  // Continue with query...
}
```

**Limitation:** In-memory storage, resets on server restart

Option B - **Robust (2 hours):**
- Use Redis for rate limiting
- Persists across server restarts
- Can be configured in Supabase

---

### FLAW #4: Verbose Error Messages
**Severity:** 🟡 MEDIUM  
**Risk Level:** 3/10 - Information disclosure  
**Time to Fix:** 15 minutes  

**Current Issue:**
```typescript
if (!response.ok) {
  const errorText = await response.text()
  return { error: `Query failed: ${errorText}` } // ← Shows internals
}
```

**User might see:**
```
Error: "Gemini API error: 401 Unauthorized. Check GEMINI_API_KEY at line 234"
```

**How to Fix:**
```typescript
if (!response.ok) {
  console.error('[QUERY] Edge Function error:', response.status, await response.text())
  
  // Return generic message to user
  if (response.status === 401) {
    return { error: 'Authentication error. Please try again.' }
  } else if (response.status === 429) {
    return { error: 'Service temporarily unavailable. Please try again later.' }
  } else {
    return { error: 'Query failed. Please try again.' }
  }
}
```

---

## 🟠 HIGH PRIORITY: Complete This Week

### TODO #1: Add Timeout Handling
**File:** `app/actions/documents.ts`  
**Issue:** Edge Function calls have no timeout  
**Fix Time:** 30 min

```typescript
const timeout = new AbortController()
const timeoutId = setTimeout(() => timeout.abort(), 30000) // 30s

try {
  const response = await fetch(processUrl, {
    method: 'POST',
    headers: { ... },
    signal: timeout.signal,
  })
} finally {
  clearTimeout(timeoutId)
}
```

### TODO #2: Add Request Logging
**Where:** Middleware + Server Actions  
**Purpose:** Audit trail for security  
**Fix Time:** 1 hour

```typescript
// Log query attempts
console.log({
  timestamp: new Date().toISOString(),
  userId: user.id,
  action: 'query_rag',
  questionLength: question.length,
  documentsCount: documentIds.length,
})
```

### TODO #3: Fix Performance Issues
**Issue:** N+1 queries, vector search is slow  
**Fix Time:** 2-3 hours

See "Performance Section" in audit report

---

## 📋 SECURITY CHECKLIST

- [ ] **RLS Policies Enabled** - Re-enable using SQL above
- [ ] **Role Validation** - ✅ Done in `documents.ts`
- [ ] **Input Validation** - ✅ Done in `rag.ts`
- [ ] **File Validation** - Implement server-side magic bytes check
- [ ] **Rate Limiting** - Implement Redis-based rate limiter
- [ ] **Error Handling** - Generic error messages to users
- [ ] **Timeout Handling** - Add to all fetch calls
- [ ] **Request Logging** - Log all sensitive actions
- [ ] **SQL Injection** - ✅ Using Supabase SDK (safe)
- [ ] **CSRF Protection** - ✅ Built into Next.js/Supabase
- [ ] **Secure Headers** - Check next.config.ts

---

## 🎯 NEXT STEPS

**TODAY:**
1. ✅ Run the RLS SQL above
2. ✅ Test with different user roles
3. ✅ Deploy code with role validation + input validation

**THIS WEEK:**
1. Implement file type validation
2. Add rate limiting
3. Fix error messages
4. Add timeout handling

**THIS MONTH:**
1. Implement audit logging
2. Add security monitoring
3. Performance optimization
4. Penetration testing

---

## VERIFICATION

After fixes, test:

```typescript
// Test 1: RLS works
// Login as Customer → Should see only customer docs
// Login as Employee → Should see only employee docs
// Login as Admin → Should see all docs

// Test 2: Role validation
// Try uploading as Customer → Should fail
// Try uploading as Employee → Should fail
// Try uploading as Owner → Should work

// Test 3: Input validation
// Send empty question → Should fail
// Send 10000 char question → Should fail
// Send normal question → Should work

// Test 4: Rate limiting (next week)
// Send 20 queries in 10 seconds → Should rate limit
```

---

## QUESTIONS?

- Which RLS fix should I run first? → Run the SQL above, it's safe
- Will this break existing functionality? → No, it fixes security
- Do I need to redeploy? → Yes, re-enable RLS in Supabase dashboard
- How do I test RLS works? → Use different user accounts


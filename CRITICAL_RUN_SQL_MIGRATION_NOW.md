# 🚨 CRITICAL: Run SQL Migration to Fix 401 Error

## The Real Problem
Your database still has **Row Level Security (RLS) policies** that are blocking the edge functions from accessing the database.

**process-document** and **generate-embeddings** worked because they just write to the database.  
**query-rag** failed because it tries to READ from the database (SELECT), which is blocked by RLS policies.

## The Solution: Run the SQL Migration

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (in left sidebar)
4. Click **New Query** button

### Step 2: Copy and Run the Migration
1. Open this file: `supabase/migrations/20241125000001_mvp_remove_auth.sql`
2. **Copy ALL the SQL code** (the entire file)
3. Paste it into the Supabase SQL editor
4. Click **Run** button (or press `Ctrl+Enter`)

**What this does:**
- ✅ Disables Row Level Security (RLS) on all tables
- ✅ Makes user_id nullable in documents and chat_history
- ✅ Drops old RLS policies
- ✅ Creates open access policies for MVP

### Step 3: Verify Migration Ran Successfully
After running the SQL, you should see:
```
✅ Success: Command completed successfully
```

At the bottom, you should see:
```
MVP Database migration completed successfully!
```

### Step 4: Delete Existing Storage Files
The SQL can't delete storage files. Do this manually:

1. Go to Supabase Dashboard → **Storage** (left sidebar)
2. Click **documents** bucket
3. Click **global** folder
4. Select all files (⚠️ if you have any)
5. Click **Delete**

### Step 5: Test Again
Now try asking a question in your app. Should work! 🎉

---

## Why Did process-document and generate-embeddings Work?

Because they **INSERT** data:
- `INSERT` statements bypass some RLS restrictions
- They succeeded, so documents and embeddings were created

But **query-rag** tries to **SELECT** data:
- `SELECT` statements are strictly controlled by RLS policies
- RLS policies said "only the authenticated user can see their own data"
- Since there's no authenticated user context in the edge function, the SELECT was blocked → 401 error

---

## Files Involved
- **Migration file:** `supabase/migrations/20241125000001_mvp_remove_auth.sql`
- **Edge function:** `supabase/functions/query-rag/index.ts`
- **Server action:** `app/actions/rag.ts`

---

## Status
⏳ **BLOCKED:** query-rag needs database RLS to be disabled  
✅ **FIXED:** Code is correct, just needs database migration

---

**Once you run the SQL migration, everything should work!**

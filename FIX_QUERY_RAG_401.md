# Fix: query-rag 401 Unauthorized Error

## Problem
The `query-rag` edge function is returning a **401 Unauthorized** error when querying:

```
POST | 401 | https://jpyacjqxlppfawvobfds.supabase.co/functions/v1/query-rag
```

## Root Cause
The function is missing environment variables needed for authentication:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `GEMINI_API_KEY` - Google Gemini API key

The function needs these to initialize Supabase client and Gemini AI client.

## Solution: Set Edge Function Secrets

### Step 1: Get Your Secrets
From your `.env.local` file, copy these values:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
GEMINI_API_KEY=your-actual-gemini-api-key
```

### Step 2: Add to query-rag Function
1. Go to: **Supabase Dashboard** → **Edge Functions** → **query-rag**
2. Click **Settings** tab
3. Scroll to **Secrets**
4. Click **Add Secret**
5. Add three secrets:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `GEMINI_API_KEY` | Your Gemini API key |

6. Click **Save** after each secret

### Step 3: Verify in Logs
1. Go back to **Edge Functions** → **query-rag**
2. Click **Logs** tab
3. Scroll to recent entries
4. Should see: `✅ Server configuration error: missing environment variables` is GONE
5. If it says the error about missing vars, the secrets weren't saved properly

### Step 4: Test Query
Try asking a question in your app. Should work now!

## How to Check if Secrets Are Set

### Method 1: Via Supabase Dashboard
1. Go to Edge Functions → query-rag → Settings
2. Look for "Secrets" section
3. You should see the three secrets listed

### Method 2: Via Logs
1. Make a query request
2. Check the logs
3. **Good log:** Function starts processing, shows "🔢 Generating question embedding..."
4. **Bad log:** Shows "❌ Server configuration error: missing environment variables"

## Code Changes Made
- Added proper environment variable validation
- Added detailed error messages when vars are missing
- Function now logs which vars are missing (if any)

## Related Files
- `supabase/functions/query-rag/index.ts` - Updated with better error handling
- `.env.local` - Contains your actual secrets (keep private!)

## Next Steps If Still Failing
1. Check Supabase dashboard that ALL THREE secrets are set
2. Check that the keys don't have extra spaces or formatting
3. Look at function logs for exact error message
4. Try redeploying the function after setting secrets

---

**Status:** ✅ Fixed - Ready to deploy secrets to Supabase

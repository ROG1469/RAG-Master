# 🔧 QUICK FIX: User Role Issue

## Problem
Error: "Only business owners can upload documents"

**Cause**: Your user profile in the database doesn't have the role set to `business_owner`, even though you signed up with that role.

---

## ✅ Quick Fix (Option 1 - UI Based)

### Step 1: Visit Diagnostics Page
Open in your browser:
```
http://localhost:3000/role-diagnostics
```

### Step 2: Click "Run Diagnosis"
This will show you:
- Your user ID and email
- What role is in auth
- What role is in the database
- Recommendations

### Step 3: Click "Fix Role"
If your role is NOT "business_owner", click the green button to fix it.

### Step 4: Try Upload Again
Go to Dashboard → Documents and try uploading.

---

## ✅ Quick Fix (Option 2 - API Based)

### Step 1: Check Your Current Role
```bash
curl http://localhost:3000/api/debug/user-role \
  -H "Cookie: <your-session-cookie>"
```

Response will show:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "...",
    "authRole": "business_owner",
    "databaseRole": "employee",  // ← This is the problem!
    "profileExists": true
  }
}
```

### Step 2: Fix the Role
```bash
curl -X POST http://localhost:3000/api/debug/user-role \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"role": "business_owner"}'
```

Response:
```json
{
  "success": true,
  "message": "User role set to business_owner",
  "user": {
    "id": "...",
    "role": "business_owner"
  }
}
```

---

## ✅ Quick Fix (Option 3 - Direct Database)

If you have Supabase dashboard access:

1. Go to Supabase Dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy your user ID from the error message
5. Run this SQL:

```sql
UPDATE public.users 
SET role = 'business_owner' 
WHERE id = '<your-user-id>';
```

6. Press Execute
7. Try uploading again

---

## Why Did This Happen?

The database trigger that creates user profiles from auth metadata may not have run properly. This can happen if:

1. ❌ User profile wasn't created by the trigger
2. ❌ Role wasn't stored in auth metadata
3. ❌ Timing issue with trigger execution
4. ❌ RLS policy prevented profile creation

**Solution**: The fixes above work around this by directly setting the correct role in the database.

---

## Verification

After applying the fix:

1. Refresh the page
2. Check that you can now upload documents
3. Monitor console logs for upload progress
4. Verify document status progresses: `processing` → `chunks_created` → `completed`

---

## If Still Having Issues

### Check Server Logs
Look for errors like:
```
[UPLOAD] Failed to get user profile: ...
[UPLOAD] User is not a business_owner. Role: ...
```

### Verify Session
Make sure you're logged in as the business_owner account:
1. Go to http://localhost:3000
2. Check top-right corner for your email
3. If logged out, sign in again

### Check Database Directly
In Supabase dashboard, check the `users` table:
1. Find your user by email
2. Verify `role` column shows `business_owner`

### Still Broken?
1. Sign out completely
2. Clear browser cache (Cmd+Shift+Delete)
3. Sign in again with business_owner role
4. Check database again to verify role was created correctly

---

## Step-by-Step for Absolute Beginners

### Using Option 1 (Easiest):
```
1. Open: http://localhost:3000/role-diagnostics
2. Click blue button "Run Diagnosis"
3. Look at "Database Role" field
   - If it says "business_owner" → Go to step 6
   - If it says anything else → Go to step 4
4. Click green button "Fix Role (Set to business_owner)"
5. Wait for success message
6. Go to: http://localhost:3000/dashboard
7. Click "Documents" tab
8. Click "Upload Document" button
9. Select test-document-comprehensive.txt
10. Click Upload
11. Wait for messages in console (F12 to open)
```

---

## Success Indicators

After the fix, you should see:

✅ Upload button is now active  
✅ File selection works  
✅ Console shows upload progress  
✅ Document status changes: processing → chunks_created → completed  
✅ No more "Only business owners" error  

---

## What Gets Fixed

| Component | Before | After |
|-----------|--------|-------|
| Auth metadata | `role: business_owner` | Unchanged |
| Database profile | `role: employee` (wrong!) | `role: business_owner` ✅ |
| Upload permission | ❌ Blocked | ✅ Allowed |
| Document upload | ❌ Error | ✅ Works |

---

## Next Steps After Fix

1. ✅ Upload test document
2. ✅ Monitor edge function logs
3. ✅ Verify status progression
4. ✅ Try asking a query
5. ✅ Document works correctly

---

**Need help?** Check http://localhost:3000/role-diagnostics first!

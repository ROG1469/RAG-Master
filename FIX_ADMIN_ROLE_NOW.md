# ✅ QUICK FIX FOR YOUR UPLOAD ERROR

## The Problem
Your user role in the database is set to `'admin'` but needs to be `'business_owner'` to upload documents.

**Server Log Shows:**
```
[UPLOAD] User is not a business_owner. Role: admin
```

---

## The Solution - 2 STEPS

### Step 1: Visit the Fix Page
Open this URL in your browser:
```
http://localhost:3000/role-diagnostics
```

### Step 2: Click "Run Diagnosis"
This will show you:
- Your user ID and email
- Current roles
- Recommendations

### Step 3: Click "Fix Role (Set to business_owner)"
This will:
- Update your database role to `business_owner`
- Automatically refresh to show success

### Step 4: Go Back and Upload!
```
1. Go to: http://localhost:3000/dashboard
2. Click: "Documents" tab
3. Click: "Upload Document" button
4. Select: test-document-comprehensive.txt
5. Click: Upload
```

---

## What Changed

| Component | Before | After |
|-----------|--------|-------|
| Database Role | `admin` ❌ | `business_owner` ✅ |
| Can Upload | NO ❌ | YES ✅ |
| Error Message | "Only business owners..." | (no error) |

---

## After The Fix

You should then see:

✅ Upload button works  
✅ File selected successfully  
✅ Browser console shows: "[UPLOAD] Step 1 complete"  
✅ Browser console shows: "[UPLOAD] Step 2 complete"  
✅ Document status: `processing` → `chunks_created` → `completed`  

---

## If That Doesn't Work

Try this alternative:

**In Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click: **SQL Editor**
4. Paste this and run:

```sql
UPDATE public.users 
SET role = 'business_owner' 
WHERE email = 'shalusha@hotmail.com';
```

5. Check the result shows 1 row updated
6. Refresh browser
7. Try uploading again

---

## Next: Document Upload & Testing

After the role fix works, we can test the full refactored pipeline:

1. Upload test document ✅
2. Check `chunks_created` status ✅
3. Wait for `completed` status ✅
4. Try asking a query ✅

**Start here**: http://localhost:3000/role-diagnostics

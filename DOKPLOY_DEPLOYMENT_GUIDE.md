# Dokploy Deployment Guide for RAG3 (Next.js)

## Quick Summary

Your Next.js app is now ready for Dokploy deployment with a production-optimized multi-stage Dockerfile.

✅ **Dockerfile** added to repo root
✅ **package.json** updated with PORT support
✅ All environment variables documented below

---

## 1️⃣ Environment Variables to Add in Dokploy

Before deploying, you **must add these environment variables** to Dokploy:

### From your `./.env.local`, copy these to Dokploy:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Next.js Build & Runtime
NODE_ENV=production
PORT=3000

# Google Generative AI (if used)
NEXT_PUBLIC_GOOGLE_API_KEY=your_key_here

# App URL (for callbacks)
NEXT_PUBLIC_APP_URL=https://charlin-rag.your-dokploy-domain
```

**Important:**
- `NEXT_PUBLIC_*` variables are available in browser code
- Server-only variables (like `SUPABASE_SERVICE_ROLE_KEY`) are only available server-side
- Never expose secrets in `NEXT_PUBLIC_` prefix
- Add all missing keys if your app uses them

---

## 2️⃣ Local Docker Test (Before Pushing to Dokploy)

Test the Docker build locally to catch issues early:

```bash
# Build the Docker image
docker build -t rag3:local .

# Run the container
docker run --rm -it -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here \
  -e SUPABASE_SERVICE_ROLE_KEY=your_key_here \
  rag3:local
```

Expected output:
```
> rag3@0.1.0 start
> next start -p 3000

▲ Next.js 16.0.3
  Local:        http://localhost:3000
```

Open http://localhost:3000 — if it loads, Docker is working correctly! ✅

---

## 3️⃣ Dokploy Deployment Steps

### Step 1: Go to Your Dokploy Project

1. Open Dokploy dashboard
2. Select your project (or create one)
3. Go to **Services** tab

### Step 2: Update Git Source

If you already have a service:

1. Click on your service
2. Go to **Source** tab
3. Ensure:
   - **Provider:** Git (Generic)
   - **Git Repo URL:** `https://github.com/your-username/RAG-master.git`
   - **Branch:** `main` (or your default branch — **important:** make sure this matches!)
   - **Dockerfile Path:** `/Dockerfile` (or leave blank for root)

### Step 3: Configure Build Settings

1. Go to **Build** tab
2. Set:
   - **Build Type:** `Dockerfile`
   - **Dockerfile:** `/Dockerfile`

### Step 4: Configure Container

1. Go to **Container** tab
2. Set:
   - **Container Port:** `3000`
   - **Internal Path:** (leave empty unless using subpath routing)
   - **HTTPS:** `ON` (recommended for production)

### Step 5: Add Environment Variables

1. Go to **Environment / Secrets** tab
2. Click **Add Variable** and add each from Section 1️⃣
3. Example:
   ```
   Key: NEXT_PUBLIC_SUPABASE_URL
   Value: https://your-project.supabase.co
   ```
4. Click **Save** after adding all variables

### Step 6: Deploy

Option A (Manual Deploy):
- Click **Deploy** button → wait for build & runtime logs

Option B (Auto Deploy):
- Enable **Auto Deploy** → Dokploy will redeploy on git push

---

## 4️⃣ Monitoring Deployment

### During Build:

You'll see logs like:
```
Step 1/15 : FROM node:20-bullseye AS builder
Step 2/15 : WORKDIR /app
...
Running npm ci --legacy-peer-deps
Running npm run build
✓ Compiled successfully
```

If build fails, check:
- Missing packages? → Add to `package.json`
- TypeScript errors? → Fix and commit
- Environment variables needed at build time? → Add to Dokploy build env

### After Deployment:

Container logs should show:
```
▲ Next.js 16.0.3
  Local:        http://localhost:3000

FATAL Error: Cannot read properties of undefined (reading 'ENV')
```

⚠️ If you see an error about undefined ENV — **one or more environment variables are missing**. 
Add them in Dokploy and redeploy.

---

## 5️⃣ Troubleshooting Checklist

### ❌ Build Fails

- [ ] Dockerfile in repo root? (`/Dockerfile`)
- [ ] Branch name correct? (`main` vs `master`)
- [ ] All dependencies in `package.json`?
- [ ] Run `npm ci` locally — does it succeed?

### ❌ Container Starts but App Errors

- [ ] All env variables added to Dokploy?
- [ ] Env values correct (copy-paste from `.env.local`)?
- [ ] Check container logs for specific error message
- [ ] Look for "Cannot read properties of undefined" — means an env var is missing

### ❌ Container Runs but Shows Blank Page

- [ ] Check Dokploy domain/URL
- [ ] Are build logs showing "✓ Compiled successfully"?
- [ ] Run `docker build -t test . && docker run -it -p 3000:3000 test` locally
- [ ] Check browser console for JavaScript errors

### ❌ Connection Refused / Port Issues

- [ ] Container Port set to `3000`?
- [ ] Dockerfile exposes port `3000`?
- [ ] `package.json` start script uses `-p ${PORT:-3000}`?

---

## 6️⃣ Example Dokploy Configuration

**Service Settings Summary:**

| Setting | Value |
|---------|-------|
| **Provider** | Git (Generic) |
| **Repo URL** | `https://github.com/your-user/RAG-master.git` |
| **Branch** | `main` |
| **Build Type** | Dockerfile |
| **Dockerfile Path** | `/Dockerfile` |
| **Container Port** | `3000` |
| **Domain** | `charlin-rag` |
| **HTTPS** | ON |
| **Auto Deploy** | ON (optional) |

**Env Variables (copy from Section 1):**

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from `.env.local`) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `NEXT_PUBLIC_APP_URL` | `https://charlin-rag.your-domain` |

---

## 7️⃣ Next Steps

1. **Commit & push** the Dockerfile and updated `package.json`:
   ```bash
   git add Dockerfile package.json
   git commit -m "Add production Dockerfile for Dokploy deployment"
   git push origin main
   ```

2. **Test locally** (Section 2️⃣):
   ```bash
   docker build -t rag3:local .
   docker run -it -p 3000:3000 --env-file .env.local rag3:local
   ```

3. **Go to Dokploy** and follow Section 3️⃣ to deploy

4. **Monitor logs** during build → watch for errors

5. **Verify deployment** by visiting your domain

---

## 📝 Common Errors & Fixes

### Error: `Cannot read properties of undefined (reading 'ENV')`

**Cause:** A required environment variable is missing in Dokploy.

**Fix:** 
1. Go to Dokploy → Service → Environment/Secrets
2. Add all variables from Section 1️⃣
3. Redeploy

---

### Error: `Cannot find module 'next'`

**Cause:** Dependencies not installed (npm ci failed).

**Fix:**
1. Check build logs for npm errors
2. Ensure `package.json` is valid JSON
3. Try building locally: `npm ci`

---

### Error: `Port 3000 already in use`

**Cause:** Another service is using port 3000.

**Fix:**
1. Set container port to different port (e.g., `3001`)
2. Or stop the conflicting service

---

### App Runs Locally But Not in Dokploy

**Troubleshoot:**
1. Compare local `.env.local` vs Dokploy env vars — are they identical?
2. Check if Dokploy env vars have trailing spaces or quotes
3. Run: `docker build -t test . && docker run -it -p 3000:3000 --env-file .env.local test`
4. If local Docker fails the same way, fix locally first

---

## ✅ Success Checklist

After deployment is live:

- [ ] Domain accessible at `https://charlin-rag.your-dokploy-domain`
- [ ] App loads without blank page
- [ ] No JavaScript errors in browser console
- [ ] Dashboard page works (`/dashboard`)
- [ ] API routes respond correctly
- [ ] No 500 errors in container logs
- [ ] Supabase connections work (if applicable)

---

## 🎯 Summary

Your app is now ready for production:

✅ **Dockerfile**: Multi-stage, optimized, secure
✅ **package.json**: Updated with PORT support
✅ **Deployment ready**: Follow Section 3️⃣ in Dokploy UI

**Next action:** Commit files, add env vars to Dokploy, and deploy! 🚀

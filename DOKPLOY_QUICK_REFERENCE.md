# 🚀 Dokploy Deployment Quick Reference

## 1. Test Docker Build Locally

```bash
# Build image
docker build -t rag3:local .

# Run with environment file
docker run --rm -it -p 3000:3000 \
  --env-file .env.local \
  rag3:local

# Open browser
# http://localhost:3000
```

---

## 2. Commit & Push to Git

```bash
git add Dockerfile package.json
git commit -m "Add Dockerfile for Dokploy deployment"
git push origin main
```

---

## 3. Dokploy UI Configuration

### Service Settings:
- **Provider:** Git (Generic)
- **Repo URL:** `https://github.com/your-username/RAG-master.git`
- **Branch:** `main`
- **Build Type:** Dockerfile
- **Dockerfile Path:** `/Dockerfile`
- **Container Port:** `3000`

---

## 4. Environment Variables to Add

Copy these from `.env.local` and add to Dokploy:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from .env.local>
SUPABASE_SERVICE_ROLE_KEY=<copy from .env.local>
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://charlin-rag.your-dokploy-domain
```

---

## 5. Deploy in Dokploy UI

1. Go to **Services** → Your Service
2. Click **Deploy** (manual) or enable **Auto Deploy**
3. Watch build logs for errors
4. Check runtime logs after deployment
5. Visit `https://charlin-rag.your-dokploy-domain`

---

## 6. Debug If Issues

```bash
# Test locally with exact Dokploy env vars
docker run --rm -it -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  rag3:local

# Check Dokploy service logs
# (In Dokploy UI → Service → Logs)

# Rebuild in Dokploy
# (Click Deploy button again)
```

---

## 7. Common Issues

| Issue | Fix |
|-------|-----|
| `Cannot read properties of undefined` | Add missing env vars to Dokploy |
| Blank page | Check browser console, verify build succeeded |
| Port already in use | Change container port in Dokploy |
| Docker build fails | Run `npm ci` locally to check for errors |
| Branch not found | Verify branch name matches (main vs master) |

---

## Files Modified/Created

- ✅ `Dockerfile` — Added to repo root
- ✅ `package.json` — Updated start script
- ✅ `DOKPLOY_DEPLOYMENT_GUIDE.md` — Full guide (this repo)

All ready for Dokploy deployment! 🎉

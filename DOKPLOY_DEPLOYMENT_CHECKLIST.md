# Dokploy Deployment Checklist

## Pre-Deployment

### Files & Code
- [ ] `Dockerfile` created in repo root
- [ ] `.dockerignore` created in repo root  
- [ ] `package.json` start script updated to: `next start -p ${PORT:-3000}`
- [ ] All files committed to git
- [ ] Files pushed to `main` branch

### Local Testing
- [ ] Local `docker build -t rag3:local .` succeeds
- [ ] Local `docker run` starts without errors
- [ ] App loads at `http://localhost:3000`
- [ ] No runtime errors in Docker logs

### Git Repository
- [ ] Repository accessible (public or you have auth)
- [ ] Branch name verified (`main` vs `master`)
- [ ] Latest commits pushed

---

## Dokploy UI Configuration

### Service Setup
- [ ] Service created in Dokploy
- [ ] Provider: `Git (Generic)`
- [ ] Git URL: `https://github.com/your-user/RAG-master.git`
- [ ] Branch: `main` (or your default branch)

### Build Configuration
- [ ] Build Type: `Dockerfile`
- [ ] Dockerfile Path: `/Dockerfile` (or empty for root)
- [ ] Build logs reviewed (should show `npm ci` and `npm run build`)

### Container Configuration
- [ ] Container Port: `3000`
- [ ] Internal Path: (leave empty)
- [ ] HTTPS: `ON` (recommended)

### Environment Variables Added
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://jpyacjqxlppfawvobfds.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from .env.local)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = (from .env.local)
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`
- [ ] `NEXT_PUBLIC_APP_URL` = (your Dokploy domain)
- [ ] Any other vars from `.env.local` used in code

---

## Deployment

### Manual Deploy
- [ ] Click **Deploy** button in Dokploy UI
- [ ] Watch build logs for errors
- [ ] Build completes with "Build finished"
- [ ] Container starts successfully
- [ ] Check runtime logs show "▲ Next.js 16.0.3"

### Auto Deploy (Optional)
- [ ] Enable **Auto Deploy** toggle
- [ ] Next git push will trigger automatic redeploy

---

## Post-Deployment Verification

### Application Access
- [ ] Domain loads without error (e.g., `https://charlin-rag.your-domain`)
- [ ] Page is not blank
- [ ] No 500 errors shown
- [ ] Browser console has no JavaScript errors

### Functionality Tests
- [ ] Dashboard page loads (`/dashboard`)
- [ ] Chat interface works
- [ ] Can navigate between pages
- [ ] API routes respond correctly

### Logs & Monitoring
- [ ] Container logs show clean startup
- [ ] No "Cannot read properties of undefined" errors
- [ ] No "connection refused" errors
- [ ] Healthcheck passing (if enabled)

---

## Troubleshooting Matrix

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| Build fails | Docker config or code error | `docker build -t test .` locally |
| App shows error | Missing env vars | Review Dokploy env variables |
| Blank page | Build didn't complete | Check build logs in Dokploy |
| Port error | Port already in use | Change container port in Dokploy |
| Not accessible | Domain not configured | Verify Dokploy domain settings |
| Logs show undefined | Env var missing | Add all vars from `.env.local` |

---

## Quick Command Reference

### Local Testing
```bash
# Build
docker build -t rag3:local .

# Run
docker run --rm -it -p 3000:3000 --env-file .env.local rag3:local

# Check logs
docker logs <container-id>
```

### Git Operations
```bash
# Stage files
git add Dockerfile package.json .dockerignore

# Commit
git commit -m "Add Dockerfile for Dokploy deployment"

# Push
git push origin main
```

### Dokploy Redeploy
```bash
# Via UI: Click Deploy button
# Or: git push (if Auto Deploy enabled)
```

---

## Support Documents

| Document | Contains |
|----------|----------|
| `DOKPLOY_README.md` | Overview & quick start |
| `DOKPLOY_DEPLOYMENT_GUIDE.md` | Full 7-section guide |
| `DOKPLOY_QUICK_REFERENCE.md` | Copy-paste commands |
| `DOKPLOY_SETUP_COMPLETE.md` | Detailed next steps |
| `DOKPLOY_DEPLOYMENT_CHECKLIST.md` | This checklist |

---

## Success Criteria ✅

After deployment is complete and verified, you should have:

✅ Live application accessible via Dokploy domain  
✅ All pages loading without errors  
✅ Clean container logs on startup  
✅ All features functional (dashboard, chat, etc.)  
✅ No JavaScript errors in browser  
✅ Health checks passing  
✅ Ready for production use  

---

## When Done

- [ ] Application verified working
- [ ] Team notified of deployment
- [ ] Dokploy domain bookmarked
- [ ] Backup of `.env.local` saved securely
- [ ] Auto Deploy enabled (optional)

---

**Last Updated:** November 25, 2025  
**Status:** ✅ Ready for Production Deployment

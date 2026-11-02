# MobiStock deployment checklist (classroom MVP)

## Before deployment
- [ ] Create a GitHub repository and upload the contents of this folder.
- [ ] Create a managed PostgreSQL database.
- [ ] Copy its connection string into the backend host as `DATABASE_URL`.
- [ ] Deploy backend using `backend/` as root directory.
- [ ] Confirm `https://YOUR-API/api/health` returns `status: ok`.
- [ ] Set backend `FRONTEND_ORIGIN` to the exact frontend origin.
- [ ] Deploy frontend using `frontend/` as root directory.
- [ ] Set `VITE_API_URL=https://YOUR-API/api` in frontend build environment.
- [ ] Redeploy frontend after setting `VITE_API_URL`.
- [ ] Test adding a product, stock-in, stock-out, low-stock alert and refresh persistence.
- [ ] Share the frontend URL with the group.

## Hosting choices
Use a managed PostgreSQL provider (for example Supabase), Render for Flask, and Vercel for the Vite frontend. Confirm current free-tier limits and database pause/expiry policies before choosing. Free tiers can change.

## Demo data
All seeded products and movements are illustrative. The application currently uses one shared demonstration workspace. Do not enter real business records. Keep `DEMO_MODE=true` only for the classroom demo so the reset action works. Disable it for any real deployment.

## Important security boundary
This MVP has no user authentication or tenant isolation. Anyone with the public URL can view and modify the shared demo workspace. Share it only with the class group for the demonstration, and do not present it as production-ready software.

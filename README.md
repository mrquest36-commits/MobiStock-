# MobiStock — Inventory Control MVP

A mobile-first web application for owner-operated small retailers. The first release is deliberately limited to:
- Product registration and maintenance
- Stock-in and stock-out recording
- Current stock balances
- Minimum-stock alerts
- Stock movement history
- Basic inventory summary

## Technology
- Frontend: React + Vite + plain CSS
- API: Python Flask
- Database: PostgreSQL via SQLAlchemy

## Local development

### 1. Backend
```bash
cd backend
python -m venv .venv
# activate the environment, then:
pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL to a PostgreSQL connection string
python app.py
```
API: `http://127.0.0.1:5000/api`

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Vite: `http://localhost:5173`

Set `VITE_API_URL=http://127.0.0.1:5000/api` in `frontend/.env`.

## Deployment outline
1. Create a PostgreSQL database with a managed provider.
2. Deploy `backend/` as a Python web service. Build command: `pip install -r requirements.txt`; start command: `gunicorn app:app`.
3. Set backend environment variables:
   - `DATABASE_URL` = provider PostgreSQL URL
   - `FRONTEND_ORIGIN` = deployed frontend origin
   - `DEMO_MODE` = `true` for this controlled classroom demonstration
4. Deploy `frontend/` as a Vite static site. Build command: `npm run build`; output directory: `dist`.
5. Set `VITE_API_URL` to `https://YOUR-BACKEND-DOMAIN/api` and redeploy the frontend.
6. Test on a second device before sharing the link.

## Demonstration safety
This is a classroom MVP, not a production inventory service. Use only illustrative product data. The shared demo workspace is not tenant-isolated and should not contain real shop/customer data. The API's demo reset endpoint is enabled only when `DEMO_MODE=true`; disable it before any real use.

## Important
- Do not commit `.env` files, database passwords, or provider API keys.
- The browser interface does not store stock data as its source of truth; the API and PostgreSQL database do.
- Do not describe the MVP as a fully commercial or production-hardened platform.

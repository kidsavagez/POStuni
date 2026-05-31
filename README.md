# TuniOrder — Sales Order & Invoice Management System

A full-stack web app for managing customers, products, sales orders, invoices, and
analytics. Admins approve orders and view reports; sales staff create orders and
generate invoices.

- **Frontend:** React 19 + Vite + Tailwind CSS + Chart.js
- **Backend:** Node.js + Express 5 + SQLite (`better-sqlite3`) + JWT auth

---

## ✨ Features

- 🔐 Role-based auth (Admin / Sales) with JWT
- 👥 Customer & 📦 product management (with low-stock alerts)
- 🧾 Sales orders → approval workflow → auto-generated invoices (print / PDF)
- 📊 **Analytics & reports** — revenue, top products, per-sales & per-customer
  breakdowns, filterable by day / week / month / custom date range
- 📤 Excel/CSV import & export
- 🤖 Optional Telegram notifications on new orders
- ⚙️ Configurable auto-ID formats and company/invoice settings

---

## 📋 Prerequisites

- **Node.js 18+** and **npm**
- (Optional) **PM2** + **Nginx** for VPS deployment

---

## 🚀 Run Locally (Development)

```bash
# 1. Clone
git clone https://github.com/kidsavagez/POStuni.git
cd POStuni

# 2. Backend
cd backend
cp .env.example .env        # then edit .env (set JWT_SECRET)
npm install
npm run dev                 # → http://localhost:4009  (auto-restarts on change)

# 3. Frontend (in a second terminal)
cd frontend
npm install
npm run dev                 # → http://localhost:5173 (or 5174 if 5173 is taken)
```

> On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Then open the URL Vite prints (e.g. **http://localhost:5173**).

The SQLite database (`backend/db/tuni.db`) and a default admin are **created
automatically** on first backend start — no migration step needed.

### 🔑 Default Login

| Role  | Email          | Password   |
|-------|----------------|------------|
| Admin | admin@tuni.com | Admin@123  |

> Admin creates Sales accounts under **Akun Sales** after logging in.

---

## 🏗️ Build for Production

```bash
# Frontend → static files in frontend/dist
cd frontend
# Point the build at your API (same-domain proxy shown here):
echo "VITE_API_URL=/api" > .env.production
npm install
npm run build               # outputs to frontend/dist/

# Backend runs as a normal Node process
cd ../backend
npm install --omit=dev
npm start                   # node server.js
```

---

## ⚡ Quick Deploy (one-shot script)

If your VPS already has Nginx and your subdomain's DNS A record points to it,
just run the included script — it installs Node/PM2/Certbot as needed, clones,
builds, configures Nginx, starts PM2, and sets up HTTPS:

```bash
# On the VPS:
curl -fsSL https://raw.githubusercontent.com/kidsavagez/POStuni/main/deploy.sh -o deploy.sh
sudo bash deploy.sh tuni.yourdomain.com you@email.com
#                   └─ full subdomain    └─ email for Let's Encrypt (omit to skip HTTPS)
```

For routine **code updates** afterwards, use the lightweight updater instead —
it pulls, rebuilds, and restarts **without** re-running Certbot/SSL (your cert
auto-renews on its own):

```bash
sudo bash /var/www/tuni/update.sh
```

Only re-run `deploy.sh` when infrastructure or TLS changes. For the manual
walk-through, see below.

---

## ☁️ Deploy to a VPS (Nginx + PM2)

### 1. Get the code & install

```bash
git clone https://github.com/kidsavagez/POStuni.git /var/www/tuni
cd /var/www/tuni

# Backend
cd backend
cp .env.example .env        # edit: strong JWT_SECRET, set FRONTEND_URL=https://yourdomain.com
npm install --omit=dev

# Frontend
cd ../frontend
echo "VITE_API_URL=/api" > .env.production
npm install
npm run build               # produces frontend/dist
```

### 2. Run the backend with PM2

```bash
cd /var/www/tuni/backend
npm install -g pm2
pm2 start server.js --name tuni-backend
pm2 save
pm2 startup                 # enable on boot (run the command it prints)
```

### 3. Nginx config

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (static React build)
    location / {
        root /var/www/tuni/frontend/dist;
        try_files $uri /index.html;
    }

    # Backend API (reverse proxy → matches VITE_API_URL=/api)
    location /api {
        proxy_pass http://localhost:4009;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 4. HTTPS (recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 5. PostgreSQL (optional)

The app ships with SQLite (`backend/db/tuni.db`). To switch to PostgreSQL,
replace `better-sqlite3` with `pg` and update the connection in
`backend/db/schema.js`.

---

## 🔧 Environment Variables

**`backend/.env`** (see `backend/.env.example`)

| Variable                 | Description                                              |
|--------------------------|----------------------------------------------------------|
| `PORT`                   | API port (default `4009`)                                |
| `JWT_SECRET`             | Secret for signing JWTs — **change in production**       |
| `TELEGRAM_BOT_TOKEN`     | Optional; enables order notifications                    |
| `TELEGRAM_ADMIN_CHAT_ID` | Optional; chat that receives notifications               |
| `FRONTEND_URL`           | CORS origin. Unset in dev = any localhost; set in prod   |

**`frontend/.env`** (see `frontend/.env.example`)

| Variable       | Description                                                   |
|----------------|---------------------------------------------------------------|
| `VITE_API_URL` | API base URL. Unset = `http://localhost:4009/api`; `/api` in prod |

---

## 📁 Project Structure

```
POStuni/
├── frontend/                ← React + Vite + Tailwind
│   └── src/
│       ├── pages/admin/     ← Dashboard, Customers, Products, Orders,
│       │                       Analytics, Accounts, Database, Settings
│       ├── pages/sales/     ← Dashboard, NewOrder, MyOrders, Invoice
│       ├── layouts/         ← AdminLayout, SalesLayout
│       ├── context/         ← AuthContext
│       ├── api/             ← API client
│       └── utils/           ← formatIDR, formatDate, calcOrderTotals
│
└── backend/                 ← Node.js + Express + SQLite
    ├── db/schema.js         ← Schema & seed (auto-runs on start)
    ├── routes/              ← auth, customers, products, orders, invoices,
    │                           users, settings, audit, analytics
    ├── services/            ← idGenerator, telegramBot, auditLog
    └── middleware/          ← auth (JWT), roleGuard
```

---

## 🤖 Telegram Bot Setup (optional)

1. Telegram → chat with **@BotFather** → `/newbot` → copy the **Bot Token**
2. Chat **@userinfobot** to get your **Chat ID**
3. In the app: **Admin → Pengaturan → Telegram Bot** → paste token + chat ID → Simpan

---

## 📊 Live Google Sheets Sync (optional)

Auto-append rows to a Google Sheet whenever an order, customer, product, or
invoice is created/updated — no manual export needed. One-way (app → Sheet),
real-time, via a Google Apps Script web app (no Google Cloud project required).

**Setup (once):**
1. Create a Google Sheet → **Extensions → Apps Script**.
2. Paste the code from [`google-apps-script.gs`](google-apps-script.gs); set `SECRET` to a private password.
3. **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone). Copy the Web app URL.
4. In the app: **Admin → Pengaturan → Google Sheets** → paste the URL + the same secret, tick **Aktifkan sinkronisasi**, Simpan.

Each record type lands in its own tab (Orders, Customers, Products, Invoices).
Rows keyed by id are *upserted* — an order appears on create, then updates in
place on approve/reject. Sync is fire-and-forget: if Sheets is unreachable the
app keeps working normally.

---

## 🔢 Configurable Auto-ID Formats

Edit under **Admin → Pengaturan → Format ID**:

| Type     | Default Format       | Example              |
|----------|----------------------|----------------------|
| Customer | `CUST` + 4-digit pad | `CUST-0001`          |
| Product  | `PRD` + 4-digit pad  | `PRD-0001`           |
| Order    | `ORD-{DATE}-{SEQ}`   | `ORD-20260531-001`   |
| Invoice  | `INV-{DATE}-{SEQ}`   | `INV-20260531-001`   |

---

## 📤 Import / Export

- **Export:** "Export" on any table → downloads `.xlsx`
- **Import:** "Import" → upload `.xlsx` / `.csv`. Template columns:
  - **Customers:** `name, email, phone, address`
  - **Products:** `name, price, unit, stock_qty, low_stock_alert, description`

---

## 🔒 Security Notes

- Set a strong `JWT_SECRET` before deploying
- Set `FRONTEND_URL` in production to lock CORS to your domain
- Serve over HTTPS (Let's Encrypt)
- `.env` and the SQLite DB are git-ignored — never commit secrets

<div align="center">

```
 ██████╗ █████╗ ███╗   ███╗██████╗ ██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ██╗   ██╗
██╔════╝██╔══██╗████╗ ████║██╔══██╗██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝
██║     ███████║██╔████╔██║██████╔╝██║   ██║███████╗██║     ██║   ██║██████╔╝ ╚████╔╝ 
██║     ██╔══██║██║╚██╔╝██║██╔═══╝ ██║   ██║╚════██║██║     ██║   ██║██╔═══╝   ╚██╔╝  
╚██████╗██║  ██║██║ ╚═╝ ██║██║     ╚██████╔╝███████║╚██████╗╚██████╔╝██║        ██║   
 ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝        ╚═╝  
```

**Automated PDF Printing for College Students**  
*Vishwakarma Institute of Technology, Pune*

[![Live PWA](https://img.shields.io/badge/PWA-campuscopy.pages.dev-00b894?style=for-the-badge&logo=cloudflare)](https://campuscopy.pages.dev)
[![Admin Dashboard](https://img.shields.io/badge/Dashboard-campuscopy.vercel.app-6c5ce7?style=for-the-badge&logo=vercel)](https://campuscopy.vercel.app)
[![API](https://img.shields.io/badge/API-campuscopy--api.onrender.com-0984e3?style=for-the-badge&logo=render)](https://campuscopy-api.onrender.com/health)
[![Made with Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)

</div>

---

## 🎯 What is CampusCopy?

CampusCopy eliminates the college print queue. Students upload a PDF from their phone, pay instantly via Razorpay, and collect prints without waiting. The print operator sees the job appear in real-time on the admin dashboard and processes it immediately.

> Built from scratch in March 2026 by **Atharva Vavhal** · VIT Pune

---

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Student PWA        │     │    Node.js API        │     │   Admin Dashboard   │
│  campuscopy.pages.dev│────▶│ campuscopy-api.onrender│────▶│campuscopy.vercel.app│
│  Cloudflare Pages    │     │    Express + Socket.IO │     │   React + Vite      │
└─────────────────────┘     └──────────┬───────────┘     └─────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             ┌──────────┐       ┌──────────────┐    ┌──────────────┐
             │PostgreSQL │       │    Redis      │    │Print Bridge  │
             │ Render DB │       │   Upstash     │    │ Python + GUI │
             └──────────┘       └──────────────┘    └──────────────┘
```

---

## ✅ Implementation Progress

### Phase 1 — Core UX

| Feature | Status | Notes |
|---|---|---|
| WhatsApp notifications via Twilio | ✅ Done | Sends on `printing`, `done`, `failed`. Fixed double +91 bug |
| Real-time job status via Socket.IO | ✅ Done | Admin dashboard + student PWA update instantly |
| Admin login & JWT auth | ✅ Done | bcrypt hashed, rate-limited login endpoint |
| Phone number capture on upload | ✅ Done | Stored in `jobs.phone_number` |
| PDF preview before payment | ✅ Done | PDF.js canvas render + auto page count |
| Order history by phone number | ✅ Done | Authenticated endpoint, normalised phone lookup |
| Push notifications (browser) | ✅ Done | VAPID keys set, SW live, subscribe on payment |
| Priority queue fee | ✅ Done | +₹5 shown correctly in cost calculator |

### Phase 2 — Business Features

| Feature | Status | Notes |
|---|---|---|
| Coupon system | ✅ Done | `coupons` + `coupon_uses` tables, validate checks `is_active` + `expires_at` |
| Coupon admin page | ✅ Done | Create, test, list — wired to real API |
| Loyalty points earn/redeem | ✅ Done | Earn on net amount (not gross), redeem via payment webhook |
| Loyalty admin page | ✅ Done | Summary stats, top members, route order bug fixed |
| Priority queue (⚡ badge) | ✅ Done | UI + sorting in dashboard |
| Razorpay payments | ✅ Done | Webhooks verified, coupon + loyalty discounts applied |

### Phase 3 — Platform & Admin

| Feature | Status | Notes |
|---|---|---|
| Admin routes | ✅ Done | `/api/admin/stats`, `/api/admin/analytics`, `/api/admin/jobs`, `/api/admin/settings` |
| Admin dashboard wiring | ✅ Done | All pages hit real authenticated endpoints, college-scoped |
| Printer admin CRUD | ✅ Done | Add / edit / delete / regenerate API key |
| College settings page | ✅ Done | Razorpay keys, platform fee %, college name/email |
| Analytics page | ✅ Done | 7d/14d/30d/90d selector, daily revenue + job charts, printer breakdown |
| Multi-college architecture | 🟡 Partial | `college_id` on all tables, onboarding flow not built yet |
| Per-college Razorpay routing | ⬜ Pending | Needs Razorpay marketplace/route setup |

### Phase 4 — Security Audit (20 bugs fixed)

| ID | Severity | Fix |
|---|---|---|
| BUG01 | CRITICAL | Rotated leaked Razorpay/Twilio/JWT secrets |
| BUG02 | CRITICAL | `/register` now requires JWT auth in all environments |
| BUG03 | HIGH | `/by-phone/:phone` and `/qr/:token` require auth |
| BUG04 | HIGH | `/api/loyalty/:phone` requires auth |
| BUG05 | HIGH | Login rate limiter registered before general limiter |
| BUG06 | HIGH | `bridgeAuth` now validates API key against DB |
| BUG07 | HIGH | Coupon validation checks `is_active` + `expires_at` |
| BUG08 | HIGH | Loyalty points earned on net amount, not gross |
| BUG09 | MEDIUM | Removed duplicate multer config — shared `middleware/upload.js` |
| BUG10 | MEDIUM | Phone lookup uses `RIGHT(phone,10)` instead of `LIKE '%phone'` |
| BUG11 | MEDIUM | Admin job list filtered by `college_id` — no cross-college leak |
| BUG12 | MEDIUM | Fixed `req.admin` → `req.user` in loyalty routes |
| BUG13 | MEDIUM | Fixed `req.admin` → `req.user` in coupon controller |
| BUG14 | MEDIUM | `os.system()` replaced with `subprocess.run([...])` — no shell injection |
| BUG15 | MEDIUM | Priority fee (+₹5) shown in `updateCost()` display |
| BUG16 | MEDIUM | Removed duplicate `ALTER TABLE push_subscriptions ADD COLUMN phone` |
| BUG17 | LOW | Printer queue endpoint verifies printer ID matches API key |
| BUG18 | LOW | Fixed double +91 prepend for numbers already prefixed with country code |
| BUG19 | LOW | `/api/push/notify/:jobId` requires auth |
| BUG20 | LOW | Removed hardcoded fallback printer UUID in student PWA |

### Phase 5 — Print Bridge

| Feature | Status | Notes |
|---|---|---|
| CUPS printing (macOS / Linux) | ✅ Done | Full flags: copies, duplex, color, fit-to-page, printer name |
| Windows printing | ✅ Done | SumatraPDF preferred, win32api fallback, rundll32 last resort |
| Page range extraction | ✅ Done | pikepdf slices `page_from`–`page_to` into temp PDF |
| Double-processing protection | ✅ Done | `_in_progress` set with thread lock |
| Structured logging | ✅ Done | stdout + `bridge.log` file |
| GUI (bridge_gui.py) | ✅ Done | Dark themed tkinter, live stats, manual job controls |
| Headless (bridge.py) | ✅ Done | Same print logic, runs as background service |
| Auto-registration by MAC | ✅ Done | Saves `PRINTER_ID` + `API_KEY` to `.env` on first run |
| Offline signal | ✅ Done | `POST /api/printers/:id/offline` on clean shutdown |

---

## 📊 Progress Summary

```
Phase 1 (Core UX)       ████████████████  100% ✅
Phase 2 (Business)      ████████████████  100% ✅
Phase 3 (Admin/Platform)████████████░░░░   80%
Phase 4 (Security)      ████████████████  100% ✅
Phase 5 (Print Bridge)  ████████████████  100% ✅

Overall                 ███████████████░   94%
```

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **API** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL (Render) |
| **Cache** | Redis (Upstash) |
| **Student PWA** | Vanilla JS, PDF.js, Cloudflare Pages |
| **Admin Dashboard** | React, Vite, TanStack Query, Recharts, Vercel |
| **Payments** | Razorpay (payments + webhooks) |
| **WhatsApp** | Twilio Sandbox |
| **Push Notifications** | Web Push (VAPID) |
| **File Storage** | Render Disk |
| **Print Bridge** | Python, CUPS (`lp`), SumatraPDF (Windows), pikepdf, tkinter |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- Twilio account
- Razorpay account
- Python 3.9+ with pip

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=rediss://...

# Auth
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=admin@campuscopy.in

# Render
RENDER_EXTERNAL_URL=https://campuscopy-api.onrender.com
NODE_ENV=production
```

**Generate VAPID keys (run once):**
```bash
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(k)"
```

### Run Locally

```bash
# Backend
cd backend && npm install && node server.js

# Admin dashboard
cd admin-dashboard && npm install && npm run dev

# Student PWA — open directly in browser
open frontend-pwa/app.html

# Print bridge (GUI)
cd print-bridge && pip install -r requirements.txt && python3 bridge_gui.py

# Print bridge (headless)
cd print-bridge && python3 bridge.py
```

### Print Bridge Setup

```bash
# Install dependencies
cd print-bridge
pip install -r requirements.txt
# macOS: brew install qpdf   (required by pikepdf)
# Linux: sudo apt install qpdf

# First run — auto-registers and saves PRINTER_ID + API_KEY to .env
python3 bridge_gui.py

# Subsequent runs
python3 bridge.py   # headless
python3 bridge_gui.py   # with GUI
```

Optional — set a specific CUPS printer in `print-bridge/.env`:
```env
PRINTER_NAME=HP_LaserJet_Pro   # leave blank to use system default
```

---

## 🗺️ API Reference

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | Admin login → JWT |
| `POST` | `/api/auth/register` | JWT | Create admin account |

### Jobs
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/jobs/upload` | — | Upload PDF, create job |
| `GET` | `/api/jobs/:id` | — | Get job by ID |
| `GET` | `/api/jobs/qr/:token` | JWT | Verify QR token |
| `GET` | `/api/jobs/by-phone/:phone` | JWT | Order history |
| `GET` | `/api/jobs/printer/:id` | API key | Jobs for print bridge |
| `PATCH` | `/api/jobs/:id/status` | API key | Update job status (bridge) |

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/stats` | JWT | Dashboard KPI cards |
| `GET` | `/api/admin/analytics` | JWT | Daily revenue + charts |
| `GET` | `/api/admin/jobs` | JWT | Paginated, filterable job list |
| `PATCH` | `/api/admin/jobs/:id/status` | JWT | Manual status override |
| `GET` | `/api/admin/settings` | JWT | College config |
| `PATCH` | `/api/admin/settings` | JWT | Update college config |

### Printers
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/printers` | — | List printers (student PWA) |
| `GET` | `/api/printers/admin/list` | JWT | Admin list with API key hint |
| `POST` | `/api/printers/admin/create` | JWT | Manually add printer |
| `PATCH` | `/api/printers/admin/:id` | JWT | Edit name/location |
| `DELETE` | `/api/printers/admin/:id` | JWT | Delete (blocks if active jobs) |
| `POST` | `/api/printers/admin/:id/regenerate-key` | JWT | Rotate API key |
| `POST` | `/api/printers/register` | — | Bridge auto-register by MAC |
| `POST` | `/api/printers/:id/heartbeat` | API key | Bridge heartbeat |
| `GET` | `/api/printers/:id/stats` | API key | Daily done/failed counts |
| `POST` | `/api/printers/:id/offline` | API key | Mark offline on shutdown |

### Payments, Coupons, Loyalty
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-order` | — | Create Razorpay order |
| `POST` | `/api/payments/webhook` | Razorpay sig | Payment confirmed |
| `POST` | `/api/coupons/validate` | — | Validate coupon code |
| `POST` | `/api/coupons` | JWT | Create coupon |
| `GET` | `/api/coupons` | JWT | List coupons |
| `GET` | `/api/loyalty/:phone` | JWT | Get balance + history |
| `POST` | `/api/loyalty/redeem` | — | Calculate redemption |
| `GET` | `/api/loyalty/admin/summary` | JWT | Top members + totals |
| `GET` | `/health` | — | Health check |

---

## 🔌 Real-time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `join_job` | Client → Server | Subscribe to a job's status updates |
| `join_printer` | Client → Server | Subscribe to a printer's queue |
| `job_update` | Server → Client | Job status changed (student + admin) |
| `queue_update` | Server → Client | New job added to printer queue |
| `printer_heartbeat` | Server → Client | Printer came online |
| `printer_offline` | Server → Client | Printer went offline |

---

## 🔜 What's Next

- [ ] Whitelist `campuscopy.pages.dev` in Razorpay dashboard
- [ ] End-to-end test with real test payment (use `rzp_test_...` keys)
- [ ] Student OTP login (phone-based auth)
- [ ] Loyalty balance shown on payment screen in PWA
- [ ] Order history UI in student PWA
- [ ] Multi-college onboarding flow
- [ ] Per-college Razorpay routing (marketplace)

---

## 📈 Revenue Model

| Model | Revenue |
|---|---|
| Single college (current) | ₹15,000–₹30,000/month |
| SaaS — 5 colleges | ₹45,000/month platform fees |
| Transaction fee (3%) | ₹1,350–₹9,000/month passive |
| Priority queue premium | ₹5,000/month additional |

---

## 👨‍💻 Author

**Atharva Vavhal**  
Vishwakarma Institute of Technology, Pune  
March 2026

---

<div align="center">
<sub>Built with ☕ and too many Render deploys</sub>
</div>
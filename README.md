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

### Phase 1 — Core UX *(Week 1-2)*

| Feature | Status | Notes |
|---|---|---|
| WhatsApp notifications via Twilio | ✅ **Done** | Sends on `printing`, `done`, `failed` |
| Real-time job status via Socket.IO | ✅ **Done** | Admin dashboard updates instantly |
| Admin login & auth | ✅ **Done** | JWT-based, bcrypt hashed |
| Phone number capture on upload | ✅ **Done** | Stored in `jobs.phone_number` |
| PDF preview before payment | ✅ **Done** | PDF.js canvas render + page navigation |
| Order history by phone number | ✅ **Done** | Full UI with styled job cards |
| Push notifications (browser) | ✅ **Done** | VAPID keys set, SW live, subscribe on payment |

### Phase 2 — Business Features *(Week 2-3)*

| Feature | Status | Notes |
|---|---|---|
| Coupon system DB schema | ✅ **Done** | `coupons` + `coupon_uses` tables created |
| Loyalty points DB schema | ✅ **Done** | `loyalty_transactions` + `loyalty_points` |
| Coupon validate/apply API | ✅ **Done** | Routes tested, admin UI built |
| Coupon admin page | ✅ **Done** | Create, test, list coupons in dashboard |
| Loyalty points earn/redeem | 🟡 Partial | Routes exist, needs end-to-end testing |
| Priority queue (⚡ badge) | ✅ **Done** | UI + sorting implemented in dashboard |
| Razorpay payments | 🟡 Partial | Working, needs domain whitelist in Razorpay |

### Phase 3 — Platform Scale *(Week 3-5)*

| Feature | Status | Notes |
|---|---|---|
| Multi-college SaaS architecture | ⬜ Pending | `college_id` column exists on all tables |
| College onboarding flow | ⬜ Pending | `/signup` page not built yet |
| Per-college Razorpay accounts | ⬜ Pending | Needs marketplace/route setup |
| Platform fee % per transaction | ⬜ Pending | Column planned, not implemented |
| Admin settings page | ⬜ Pending | Branding, Razorpay keys per college |

### Phase 4 — Technical Polish *(Week 5-6)*

| Feature | Status | Notes |
|---|---|---|
| Push notifications end-to-end | ✅ **Done** | VAPID live on Render, icons added to PWA |
| Print bridge GUI | ✅ **Done** | Dark themed tkinter GUI, Online/Offline status |
| Offline PWA support | ⬜ Pending | Service worker needs cache strategy |

---

## 📊 Progress Summary

```
Phase 1  ████████████████  100% complete ✅
Phase 2  ████████████░░░░   75% complete
Phase 3  ██░░░░░░░░░░░░░░   10% complete
Phase 4  ████████████░░░░   75% complete

Overall  ██████████░░░░░░   65% complete
```

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **API** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL (Render) |
| **Cache** | Redis (Upstash) |
| **Student PWA** | Vanilla JS, PDF.js, Cloudflare Pages |
| **Admin Dashboard** | React, Vite, TanStack Query, Vercel |
| **Payments** | Razorpay |
| **WhatsApp** | Twilio Sandbox |
| **Push Notifications** | Web Push (VAPID) |
| **File Storage** | Render Disk (ephemeral) |
| **Print Bridge** | Python + tkinter GUI |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- Twilio account
- Razorpay account

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Auth
JWT_SECRET=your_jwt_secret
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

### Run Locally

```bash
# Install dependencies
cd backend && npm install

# Start API
node server.js

# Start admin dashboard
cd admin-dashboard && npm install && npm run dev

# Start print bridge GUI
cd print-bridge && python3 bridge_gui.py
```

---

## 🗺️ API Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login |
| `POST` | `/api/jobs/upload` | Upload PDF + create job |
| `GET` | `/api/jobs` | List all jobs (admin) |
| `PATCH` | `/api/jobs/:id/status` | Update job status |
| `GET` | `/api/jobs/by-phone/:phone` | Order history |
| `GET` | `/api/jobs/printer/:id` | Jobs for print bridge |
| `POST` | `/api/payments/create-order` | Create Razorpay order |
| `POST` | `/api/payments/webhook` | Razorpay webhook |
| `POST` | `/api/coupons/validate` | Validate coupon code |
| `POST` | `/api/coupons` | Create coupon (admin) |
| `GET` | `/api/loyalty/:phone` | Get loyalty points |
| `POST` | `/api/push/subscribe` | Save push subscription |
| `GET` | `/health` | Health check |

---

## 🔌 Real-time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `join_printer` | Client → Server | Join printer room for updates |
| `join_job` | Client → Server | Join job room for status |
| `queue_update` | Server → Client | New job added to queue |
| `job_updated` | Server → Client | Job status changed (printer room) |
| `job_status` | Server → Client | Job status changed (student room) |

---

## 🔜 What's Next

**Immediate priorities:**
1. ✅ Push notifications — *done*
2. ✅ PDF preview — *done*
3. ✅ Coupon admin UI — *done*
4. ✅ Print bridge GUI — *done*
5. 🔲 Whitelist `campuscopy.pages.dev` in Razorpay dashboard
6. 🔲 Test full payment flow end-to-end

**Then Phase 3:**
- Multi-college onboarding
- Per-college Razorpay routing
- Platform fee collection

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

# 🖨️ CampusCopy

> **A streamlined campus document printing and queue management platform.**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=red)
![Deployed on Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

---

## 📖 Overview

**CampusCopy** modernizes the campus printing experience at **Vishwakarma Institute of Technology, Pune**. Students upload documents, pay online via Razorpay, and collect prints without standing in queues. Administrators manage the print queue in real time from a dedicated dashboard.

Built and maintained by **Atharva Vavhal**, VIT Pune · 2026.

---

## 🚀 Live URLs

| Service | URL |
|---|---|
| Student PWA | https://campuscopy.pages.dev |
| Admin Dashboard | https://campuscopy.vercel.app |
| Backend API | https://campuscopy-api.onrender.com |

---

## ✨ Features

### 🎓 For Students
- **Drag-and-drop PDF upload** with auto page count detection via PDF.js
- **PDF preview** — see page 1 thumbnail before paying
- **Razorpay payments** — UPI, cards, netbanking, wallets
- **Coupon codes** — enter discount codes at checkout
- **Real-time status tracking** via WebSocket (Socket.IO) — zero HTTP polling
- **WhatsApp notifications** via Twilio when print is ready
- **Order history** — look up past orders by phone number
- **PWA** — installable, works on any browser, no app store needed

### 🛡️ For Administrators
- **Live print queue** — all jobs in one view with real-time updates
- **One-click status updates** — Paid → Queued → Printing → Done
- **Printer management** — monitor printer health and availability
- **Analytics** — revenue, job volume, and usage stats
- **Coupon management** — create and track discount codes

---

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- PostgreSQL (Database)
- Redis via Upstash (Caching & job queue)
- BullMQ (Background processing)
- Socket.IO (Real-time WebSockets)
- Twilio WhatsApp API (Notifications)
- Razorpay (Payments)
- Multer (File uploads)

### Frontend — Student PWA
- Vanilla HTML / CSS / JavaScript
- PDF.js (Page detection & preview)
- Socket.IO client (Real-time updates)
- Progressive Web App (PWA)
- Hosted on Cloudflare Pages

### Admin Dashboard
- React + Vite
- TanStack Query
- Socket.IO client
- Hosted on Vercel

### Infrastructure
- **API:** Render (Node.js)
- **Database:** Render PostgreSQL
- **Cache:** Upstash Redis
- **Student PWA:** Cloudflare Pages
- **Admin Dashboard:** Vercel

---

## 🏗️ Architecture

```
+-------------------+     HTTP + WebSocket      +------------------+
|   Student PWA     | ─────────────────────────▶|                  |
|  (HTML/JS/PWA)    | ◀─────────────────────────|   Node.js API    |
+-------------------+   Real-time job_update    |  (Express.js)    |
                                                 |                  |
+-------------------+     HTTP + WebSocket      |                  |
| Admin Dashboard   | ─────────────────────────▶|                  |
|  (React + Vite)   | ◀─────────────────────────|                  |
+-------------------+  Real-time queue_update   +------------------+
                                                   |      |      |
              +------------------------------------+      |      +--------+
              |                                          |               |
     +----------------+                        +---------------+   +---------+
     |   PostgreSQL   |                        | Redis/Upstash |   | Twilio  |
     | (jobs, users,  |                        | (cache, queue)|   | WA API  |
     |  printers,     |                        +---------------+   +---------+
     |  coupons)      |
     +----------------+
```

---

## 📂 Project Structure

```
CampusCopy/
├── backend/
│   ├── config/
│   │   ├── db.js               # PostgreSQL connection
│   │   └── redis.js            # Redis/Upstash connection
│   ├── controllers/
│   │   └── paymentController.js
│   ├── middleware/
│   │   └── auth.js             # JWT auth middleware
│   ├── models/
│   │   ├── coupon.js
│   │   └── job.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── coupons.js
│   │   ├── jobs.js             # Print job lifecycle + socket emit + WhatsApp
│   │   ├── payments.js         # Razorpay order creation + webhook
│   │   └── printers.js
│   ├── utils/
│   │   ├── razorpay.js
│   │   └── whatsapp.js         # Twilio WhatsApp notifications
│   ├── uploads/                # Uploaded files (gitignored)
│   └── server.js               # Express + Socket.IO setup
├── frontend-pwa/
│   ├── app.html                # Main student app (all screens)
│   ├── app.js                  # Legacy (superseded by inline script)
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── admin-dashboard/
│   ├── src/
│   │   ├── api/client.js       # Axios instance
│   │   ├── components/Layout.jsx
│   │   ├── pages/
│   │   │   ├── JobQueuePage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   ├── PrintersPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── print-bridge/               # Python print bridge (local printer)
├── .env                        # Environment variables (gitignored)
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file in `backend/`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgres://user:password@localhost:5432/campuscopy
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campuscopy
DB_USER=your_user
DB_PASSWORD=your_password
DB_SSL=false

# Redis
REDIS_URL=rediss://default:password@your-upstash-url:6379

# Auth
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# File Upload
MULTER_DEST=./uploads
MAX_FILE_SIZE_MB=20

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# CORS
STUDENT_PWA_URL=http://localhost:3000
ADMIN_DASHBOARD_URL=http://localhost:5173
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL
- Redis (or Upstash account)

### Steps

```bash
# 1. Clone
git clone https://github.com/AtharvaVavhal/Campuscopy.git
cd CampusCopy

# 2. Install backend dependencies
cd backend
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Start backend
node server.js

# 5. Open student PWA
# Open frontend-pwa/app.html in browser or serve with:
npx serve frontend-pwa -p 3000

# 6. Start admin dashboard
cd admin-dashboard
npm install
npm run dev
```

---

## 🔄 Print Job Flow

```
Student uploads PDF
        ↓
Job created (status: pending)
        ↓
Razorpay payment
        ↓
Webhook → status: paid
        ↓
Admin: → Queue (status: queued)
        ↓
Admin: → Print (status: printing) ──→ WhatsApp: "Your file is printing"
        ↓
Admin: ✓ Done  (status: done)    ──→ WhatsApp: "Ready for pickup!"
        ↓
Student shows Job ID at counter
```

---

## 🔌 API Endpoints

### Jobs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/jobs/upload` | No | Upload file, create job |
| GET | `/api/jobs/:id` | No | Get job status |
| GET | `/api/jobs/by-phone/:phone` | No | Order history |
| GET | `/api/jobs` | Admin | List all jobs |
| PATCH | `/api/jobs/:id/status` | Admin | Update status + emit socket + WhatsApp |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/create-order` | No | Create Razorpay order |
| POST | `/api/payments/webhook` | No | Razorpay webhook handler |

### Coupons
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/coupons/validate` | No | Validate coupon code |
| POST | `/api/coupons` | Admin | Create coupon |
| GET | `/api/coupons` | Admin | List all coupons |

### Printers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/printers` | No | List available printers |

---

## 🔮 Roadmap

### ✅ Phase 1 — Core UX (Complete)
- [x] WhatsApp notifications via Twilio
- [x] PDF preview before payment
- [x] Phone number capture
- [x] Order history by phone
- [x] Socket-first real-time updates (zero polling)

### 🔄 Phase 2 — Business Features (In Progress)
- [ ] Coupon codes with admin management
- [ ] Loyalty points (10 prints = 1 free page)
- [ ] Print page range selection
- [ ] Priority queue (pay ₹5 to jump queue)

### 📅 Phase 3 — Multi-College SaaS
- [ ] Any print shop can sign up and get own dashboard
- [ ] Shop registration landing page
- [ ] Revenue analytics
- [ ] Platform fee system (2-5% per transaction)

### 🔧 Phase 4 — Technical Polish
- [ ] Browser push notifications (VAPID)
- [ ] Print bridge desktop GUI (Tkinter)
- [ ] Offline PWA support
- [ ] Scheduled printing

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

*CampusCopy · Vishwakarma Institute of Technology, Pune · Atharva Vavhal · 2026*

# 📄 CampusCopy

> **Automated print shop system for college students.**
> Upload a PDF, pay online, and collect your prints — no queues, no cash, no hassle.

[![Backend](https://img.shields.io/badge/API-Live-brightgreen)](https://campuscopy-api.onrender.com/health)
[![PWA](https://img.shields.io/badge/Student%20PWA-Live-brightgreen)](https://campuscopy.pages.dev)
[![Dashboard](https://img.shields.io/badge/Admin%20Dashboard-Live-brightgreen)](https://campuscopy.vercel.app)

---

## 🌐 Live URLs

| Service | URL |
|---|---|
| 🔧 Backend API | https://campuscopy-api.onrender.com |
| 📱 Student PWA | https://campuscopy.pages.dev |
| 🖥️ Admin Dashboard | https://campuscopy.vercel.app |

---

## ✨ Features

### For Students
- 📤 Upload PDF from phone or browser
- 🔍 **Auto page detection** — no manual counting needed
- 🎨 Choose B&W or Color, Single or Double-sided
- 💳 Pay securely via Razorpay
- 📡 **Live print status** updates via Socket.IO
- 📲 QR code for pickup verification
- 📱 Installable as Android PWA

### For Shop Operators
- 🖨️ Live job queue per printer
- ✅ One-click status updates (Queued → Printing → Done)
- 📊 Revenue & jobs analytics with charts
- 🖥️ Printer online/offline status
- 🔴 Real-time updates via Socket.IO

### Print Bridge (Windows PC)
- 🔄 Auto-polls for paid jobs every 10 seconds
- 📥 Downloads PDF and sends to physical printer
- 💓 Heartbeat every 30s to show printer Online status
- 🪟 Runs as a Windows background service

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js, Socket.IO |
| **Database** | PostgreSQL |
| **Cache** | Redis (Upstash) |
| **Payments** | Razorpay |
| **Student App** | Vanilla HTML/CSS/JS (PWA) |
| **Admin App** | React + Vite + TanStack Query + Recharts |
| **Print Bridge** | Python 3 |
| **Hosting** | Render (API) + Cloudflare Pages (PWA) + Vercel (Dashboard) |

---

## 📁 Project Structure

```
CampusCopy/
├── backend/                  # Node.js API
│   ├── config/
│   │   ├── db.js             # PostgreSQL pool
│   │   ├── redis.js          # Redis client
│   │   └── schema.sql        # Database schema
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── jobController.js  # Upload + PDF page detection + QR
│   │   └── paymentController.js
│   ├── middleware/
│   │   ├── auth.js           # JWT + API key auth
│   │   ├── upload.js         # Multer PDF upload
│   │   └── validate.js
│   ├── models/
│   │   ├── admin.js
│   │   └── job.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── payments.js
│   │   └── printers.js
│   ├── utils/
│   │   ├── razorpay.js
│   │   └── socket.js
│   └── server.js
│
├── frontend-pwa/             # Student mobile web app
│   ├── index.html
│   ├── app.js
│   ├── manifest.json
│   └── sw.js
│
├── admin-dashboard/          # React admin panel
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── JobQueuePage.jsx
│       │   ├── AnalyticsPage.jsx
│       │   └── PrintersPage.jsx
│       ├── components/
│       │   └── Layout.jsx
│       └── api/
│           └── client.js
│
└── print-bridge/             # Python print bridge
    └── bridge.py
```

---

## 🗄️ Database Schema

```sql
admins      -- Shop operators (login, JWT auth)
printers    -- Physical printers (API key auth, heartbeat)
jobs        -- Print requests (status: pending→paid→queued→printing→done)
payments    -- Razorpay payment records
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Python 3.9+

### 1. Clone the repo
```bash
git clone https://github.com/AtharvaVavhal/Campuscopy.git
cd Campuscopy
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # Fill in your credentials
psql -U postgres -c "CREATE DATABASE campuscopy;"
psql -U postgres -d campuscopy -f config/schema.sql
npm run dev
```

### 3. Student PWA
```bash
cd frontend-pwa
npx serve .
# → http://localhost:3000
```

### 4. Admin Dashboard
```bash
cd admin-dashboard
npm install
npm run dev
# → http://localhost:5173
```

### 5. Print Bridge
```bash
cd print-bridge
pip install requests schedule python-dotenv
# Edit .env with PRINTER_ID and API_KEY
python3 bridge.py
```

---

## ⚙️ Environment Variables

### Backend `.env`
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=campuscopy
DB_USER=postgres
DB_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

MULTER_DEST=./uploads
MAX_FILE_SIZE_MB=20
```

### Print Bridge `.env`
```env
API_URL=https://campuscopy-api.onrender.com
PRINTER_ID=your_printer_uuid
API_KEY=your_printer_api_key
PRINTER_NAME=Main Printer
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Admin login |
| GET | `/api/auth/me` | JWT | Get current admin |
| POST | `/api/jobs/upload` | — | Upload PDF + auto page count |
| GET | `/api/jobs/:id` | — | Get job status |
| PATCH | `/api/jobs/:id/status` | JWT/API Key | Update job status |
| GET | `/api/jobs/printer/:id` | JWT/API Key | List jobs for printer |
| POST | `/api/payments/create-order` | — | Create Razorpay order |
| POST | `/api/payments/webhook` | HMAC | Razorpay webhook |
| GET | `/api/printers` | — | List all printers |
| POST | `/api/printers/:id/heartbeat` | API Key | Bridge heartbeat |

---

## 💰 Pricing Logic

```
B&W:    ₹1 per page
Color:  ₹5 per page
Double-sided: 0.8× multiplier

Cost = pages × copies × price_per_page × multiplier
```

---

## 🔒 Security

- JWT authentication for admin dashboard
- API key authentication for print bridge
- Razorpay HMAC webhook signature verification
- Rate limiting (100 req/15min global, 10 req/15min for login)
- Helmet.js security headers
- PDF-only file filter (MIME type check)
- CORS restricted to known frontend origins
- Registration disabled in production

---

## 🖨️ Print Bridge (Windows Deployment)

On the Windows PC connected to the printer:

```bash
pip install requests pywin32 schedule python-dotenv
python bridge.py
```

To run as a Windows service on startup, use [NSSM](https://nssm.cc):
```bash
nssm install CampusCopyBridge python bridge.py
nssm start CampusCopyBridge
```

For actual printing, uncomment the `win32api` lines in `bridge.py`:
```python
import win32api
win32api.ShellExecute(0, "print", file_path, f'/d:"{PRINTER_NAME}"', ".", 0)
```

---

## 📊 Full Flow

```
1. Student visits campuscopy.pages.dev
2. Selects PDF → pages auto-detected
3. Chooses options → cost shown instantly
4. Clicks Upload & Continue
5. Payment screen → clicks Pay Now
6. Razorpay checkout → payment complete
7. Print bridge polls every 10s → picks up job
8. Status: paid → queued → printing → done
9. Student sees live updates on phone
10. QR code shown → student collects print
```

---

## 👨‍💻 Built By

**Atharva Vavhal**
🎓 Vishwakarma Institute of Technology, Pune
Built from scratch in a single session using Claude.

---

## 📄 License

MIT License — free to use, modify and deploy.

# 🖨️ CampusCopy

> **A streamlined campus document printing and queue management platform.**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

---

## 📖 Overview

**CampusCopy** modernizes the campus printing experience. It provides a seamless digital platform where students can upload their documents, join a virtual print queue, and monitor their status in real time. For administrators, it offers a robust dashboard to manage printers, organize queues, and process jobs efficiently without the chaos of a crowded print shop.

## 🚨 The Problem

* **Long Wait Times:** Students waste valuable time standing in physical lines at campus print centers.
* **Inefficient File Transfer:** Managing USB drives, emails, or Bluetooth transfers is slow and prone to errors or viruses.
* **Chaotic Management:** Print shop administrators struggle to prioritize jobs, track payments, and communicate delays during peak hours.

## 💡 The Solution

CampusCopy completely digitizes the queueing process. Students can submit files from anywhere on campus via a mobile-friendly Progressive Web App (PWA) and track their position in line. Administrators receive a clean, organized queue of jobs on a React-powered dashboard, allowing for rapid processing and one-click status updates.

---

## ✨ Features

### 🎓 For Students
* **Drag-and-Drop Uploads:** Easily upload PDFs, Word documents, and images.
* **Live Queue Tracking:** See exactly how many people are ahead of you in real-time.
* **No Installation Required:** Accessible via any browser as a lightweight PWA.
* **Instant Notifications:** Get alerted when your print job is complete and ready for pickup.

### 🛡️ For Administrators
* **Centralized Dashboard:** View all incoming print requests in a unified Kanban-style or list view.
* **Status Toggles:** Quickly move jobs from "Pending" to "Printing" to "Completed."
* **Printer Management:** Monitor the health and availability of multiple campus printers.
* **Asynchronous Processing:** Heavy file processing is handled seamlessly in the background.

---

## 🛠️ Tech Stack

**Backend**
* Node.js & Express
* PostgreSQL (Database)
* Redis via Upstash (Caching & Message Broker)
* BullMQ (Background Job Queue)
* Socket.io (Real-time WebSockets)

**Frontend (Student Portal)**
* HTML / CSS / Vanilla JavaScript
* Progressive Web App (PWA) Capabilities

**Admin Dashboard**
* React.js
* Vite

**Deployment**
* **Frontend:** Cloudflare Pages
* **Admin Dashboard:** Vercel
* **Backend:** Render
* **Database/Cache:** Upstash Redis

---

## 🏗️ Architecture

The system utilizes an event-driven architecture to ensure real-time updates and prevent the server from crashing during high-volume file uploads.

```text
+-------------------+        HTTP / WebSockets         +------------------+
|   Student App     | -------------------------------> |                  |
|  (PWA / HTML / JS)| <------------------------------- |                  |
+-------------------+      Real-time Status Updates    |   Node.js API    |
                                                       |  (Express.js)    |
+-------------------+        HTTP / WebSockets         |                  |
| Admin Dashboard   | -------------------------------> |                  |
|  (React + Vite)   | <------------------------------- |                  |
+-------------------+      Real-time Queue Updates     +------------------+
                                                          |    |    |
          +-----------------------------------------------+    |    +-------+
          |                                                    |            |
  +----------------+                                   +---------------+  +-------+
  |   PostgreSQL   |                                   | Redis Server  |  | BullMQ|
  | (Users, Jobs,  |                                   |  (Upstash)    |--| Worker|
  |  Printers)     |                                   |               |  |       |
  +----------------+                                   +---------------+  +-------+
```

---

## 📂 Project Structure

```text
campuscopy/
├── apps/
│   ├── student-pwa/       # Vanilla JS frontend for students
│   ├── admin-dash/        # React + Vite dashboard for admins
│   └── backend/           # Node.js + Express API
├── packages/              # Shared types, UI components, or utilities
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Installation

### Prerequisites
* Node.js (v18+)
* PostgreSQL running locally or via cloud
* Redis running locally or via Upstash

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/CampusCopy.git](https://github.com/yourusername/CampusCopy.git)
   cd CampusCopy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup:**
   Make sure PostgreSQL is running, then run migrations:
   ```bash
   npm run db:migrate
   ```

4. **Start the development servers:**
   ```bash
   # Starts the backend, student frontend, and admin dashboard concurrently
   npm run dev
   ```

---

## 🔐 Environment Variables

Create a `.env` file in the `apps/backend` directory based on the following template:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgres://user:password@localhost:5432/campuscopy

# Redis (Upstash / Local)
REDIS_URL=rediss://default:password@your-upstash-url:6379

# Client URLs (for CORS)
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:5173
```

---

## 🔮 Future Improvements

- [ ] **Payment Gateway Integration:** Direct support for Stripe or campus card payments.
- [ ] **Advanced Print Settings:** Options for double-sided, color vs. black-and-white, and stapling.
- [ ] **Cloud Storage Sync:** Import files directly from Google Drive or OneDrive.
- [ ] **Analytics Dashboard:** Insights into peak printing hours, paper usage, and revenue.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

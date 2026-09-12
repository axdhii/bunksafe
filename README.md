# 🌌 Aurora Attendance — Smart College Attendance Platform (V1 + V2)

> A production-grade **Personal Academic Attendance Assistant** built with a shared TypeScript codebase, the original **"Midnight Aurora"** aesthetic, deterministic attendance intelligence, installable PWA with iOS safe-area support, Android Capacitor APK packaging, and complete institutional governance.

---

## 💎 Design Aesthetic: "Midnight Aurora"
Designed from the ground up to feel like a high-end modern consumer application rather than a CRUD dashboard:
- **Void Obsidian & Deep Space Surfaces**: `#080C16`, `#0F172A`, `#131D33`
- **Soft Luminous Accents**: Aurora Cyan (`#00F2FE`), Sky Blue (`#4FACFE`), Mint Emerald (`#10B981`), Warning Amber (`#F59E0B`), Critical Ruby (`#EF4444`), Violet (`#8B5CF6`)
- **Micro-Interactions**: Animated SVG circular progress rings, counter tweens, celebratory streak confetti, and spring-physics bottom sheets with `prefers-reduced-motion` compliance.

---

## 🚀 Architecture & Tech Stack

### Frontend (`/client`)
- **Core**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS with custom Midnight Aurora design tokens + safe-area insets (`--sat`, `--sab`, `viewport-fit=cover`)
- **Animation**: Framer Motion & Canvas Confetti
- **Icons**: Lucide Icons
- **PWA & Offline**: `vite-plugin-pwa`, Workbox, custom Service Worker, IndexedDB/localStorage offline queuing with automatic reconciliation
- **Mobile Container**: Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`)

### Backend (`/server`)
- **Runtime**: Node.js 22+, Express, TypeScript (NodeNext ES modules)
- **Database & ORM**: PostgreSQL via **Supabase** + **Prisma ORM 6**
- **Authentication**: JWT tokens + HTTP-only cookies, password hashing with `bcryptjs`
- **File Processing**: `multer` with memory buffer + `xlsx` / `csv-parser` for spreadsheet uploads
- **Push Notifications**: Web Push with VAPID protocol
- **Testing**: Vitest automated test suite for mathematical formulas and edge cases

---

## 🗄️ Supabase / PostgreSQL Setup

The platform is designed to connect seamlessly to your Supabase PostgreSQL project.

### Step 1: Copy Connection String from Supabase
1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard) -> Select your Project.
2. Go to **Project Settings** -> **Database**.
3. Under **Connection string**, select **URI**.

### Step 2: Configure `server/.env`
Paste your credentials into `server/.env`:
```env
PORT=5000
NODE_ENV=development
API_URL=http://localhost:5000

# Transaction Pooler (Port 6543, for general queries)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Connection (Port 5432, for migrations and schema push)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

AUTH_SECRET="your_secure_jwt_secret_at_least_32_chars"
JWT_EXPIRES_IN=7d

ADMIN_EMAIL="admin@college.edu"
ADMIN_PASSWORD="Admin@123"
ADMIN_NAME="Chief Academic Administrator"
```

### Step 3: Deploy Schema to Supabase
You have two convenient options:

#### Option A: 1-Click via Supabase SQL Editor (Recommended)
Open your Supabase project's **SQL Editor**, open the pre-built script located at:
```
server/prisma/supabase_schema.sql
```
Paste and click **Run**. All tables, foreign keys, unique constraints, and indexes will be created immediately.

#### Option B: Via Prisma CLI
From the `server/` directory:
```bash
npx prisma db push
```

### Step 4: Seed Demo Data
Populate realistic academic hierarchy, subjects (DBMS, OS, DAA, CN, SE), full weekly timetable, and demo student profiles:
```bash
npm run seed
```

---

## 🔑 Demo Credentials

| Role | Identifier / Email | Password / Academic Context | Description |
| :--- | :--- | :--- | :--- |
| **Student (Demo 1)** | `1MS21CS001` | Sem: `5`, Branch: `CSE`, Sec: `A` | Aarav Sharma (DBMS: 83%, OS: 71% Critical, DAA: 88%) |
| **Student (Demo 2)** | `1MS21CS002` | Sem: `5`, Branch: `CSE`, Sec: `A` | Ananya Rao (Healthy standing) |
| **Admin** | `admin@college.edu` | `Admin@123` | Institutional Control Center |

*(Use the 1-click **"Fill Demo"** button on the sign-in screens for instant testing).*

---

## 🛠️ Development & Build Commands

Run from the root directory:

```bash
# Start both Backend & Frontend dev servers concurrently
npm run dev

# Run Backend unit tests (15 math & validation tests)
npm run test

# Build production bundles for both Server and Client
npm run build

# Seed database with academic structure & students
npm run seed

# Build Client and Sync to Android Capacitor project
npm run build:android
```

---

## 📱 Cross-Platform Deployment

### 1. Progressive Web App (PWA & iOS Safari)
- **Installability**: Meets full PWA standalone criteria with manifest and service workers.
- **iOS Notch & Dynamic Island**: Configured with `viewport-fit=cover` and CSS safe-area padding (`pt-safe`, `pb-safe`, `pb-nav`).
- **iOS Installation Walkthrough**: Built-in interactive bottom modal guiding iPhone Safari users: `Share` → `Add to Home Screen`. Dismissal state is saved to avoid repeated popups.
- **Offline Resilience**: Offline attendance marking queues locally and auto-synchronizes with idempotency keys upon reconnection.

### 2. Android APK (Capacitor)
The shared web frontend is packaged for Android using Capacitor:
```bash
cd client
npm run build
npx cap add android        # First time setup
npx cap sync android       # Sync web bundle and plugins to Android
npx cap open android       # Opens project in Android Studio to build APK
```
To generate an APK directly via Gradle (requires Android SDK installed):
```bash
cd client/android && ./gradlew assembleDebug
```
The resulting debug APK will be generated at `client/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🧮 Deterministic Attendance Math Engine

All attendance calculations are strictly deterministic and mathematically verified:

### 1. Attendance Percentage
$$\text{Percentage} = \frac{\text{Attended Classes}}{\text{Conducted Classes}} \times 100$$
*Note: Cancelled, Rescheduled, and Holiday classes are explicitly excluded from conducted count and never penalize the student.*

### 2. "Can I Skip?" Buffer Calculation
Let $A = \text{Attended}$, $C = \text{Conducted}$, and $T = \frac{\text{Threshold}}{100}$ (e.g. $0.75$).
$$\text{Safe Skips} = \max\left(0, \left\lfloor \frac{A}{T} - C \right\rfloor\right)$$

### 3. Recovery Deficit Calculation
$$\text{Recovery Required} = \max\left(0, \left\lceil \frac{T \cdot C - A}{1 - T} \right\rceil\right)$$

### 4. Risk Stratification
- **SAFE (Green)**: $\text{Percentage} \ge \text{Threshold} + 3\%$ and $\text{Safe Skips} \ge 2$.
- **WARNING (Yellow)**: $\text{Threshold} \le \text{Percentage} < \text{Threshold} + 3\%$ or $\text{Safe Skips} \le 1$.
- **CRITICAL (Red)**: $\text{Percentage} < \text{Threshold}$.

---

## 🔔 Smart Notification Deduplication & Quiet Hours

1. **Deduplication Engine**: Alerts are fingerprinted using composite keys (`category:studentId:subjectId:riskState:date`). If a student's attendance in OS remains at 71.4%, duplicate alerts are suppressed. Only state transitions (e.g., dropping into danger or achieving recovery) generate new alerts.
2. **Quiet Hours**: Non-critical notifications are automatically silenced between user-configured quiet hours (default: `23:00` to `07:00`).

---

## 🔒 Security & Data Isolation
- **Multi-Factor Student Auth**: Validates USN, Semester, Branch, and Section server-side.
- **Param Isolation Middleware**: Students cannot query or mutate records of other students by altering request parameters.
- **Admin Authorization**: Dedicated server-side `requireAdmin` guards on all governance endpoints.
- **Audit Log**: Every administrative action (student created/deleted, timetable uploaded, threshold altered) is permanently recorded with timestamp, IP, and actor credentials.

# BunkSafe Production Deployment Guide (Vercel + Railway)

This guide walks you through deploying **BunkSafe** to production with high performance, edge caching, HTTPS for PWA installation, and 24/7 always-on reliability.

---

## Architecture Overview

```mermaid
graph LR
    User[Student Mobile Device / Browser] -->|HTTPS Requests| Vercel[Vercel Edge CDN: PWA & React Frontend]
    Vercel -->|API Calls /api/...| Railway[Railway.app: Node.js Express Backend]
    Railway -->|Prisma Client| Database[(PostgreSQL Database)]
```

* **Frontend**: Hosted on **Vercel** (`client/`).
  * Instant global CDN caching for mobile PWA service workers and assets.
  * Automatic HTTPS required by iOS Safari & Android Chrome for *"Add to Home Screen"*.
  * Single Page Application (SPA) routing configured via `client/vercel.json`.
* **Backend**: Hosted on **Railway** (`server/`).
  * Always-on Node.js runtime (no cold starts).
  * Auto-configured CORS allowing your Vercel domain.
* **Database**: Managed **PostgreSQL** on Railway.

---

## Step 1: Upload Codebase to GitHub

1. Create a new repository on [GitHub](https://github.com/new) named `bunksafe` (Private or Public).
2. If using **GitHub Desktop**:
   * Open GitHub Desktop $\rightarrow$ File $\rightarrow$ Add Local Repository $\rightarrow$ Choose `C:\Users\user\Desktop\random`.
   * Click **Publish repository** to GitHub.
3. If using **Git CLI**:
   ```bash
   git init
   git add .
   git commit -m "feat: production ready bunksafe"
   git branch -M main
   git remote add origin https://github.com/<your-username>/bunksafe.git
   git push -u origin main
   ```

---

## Step 2: Deploy Backend to Railway

1. Go to [Railway.app](https://railway.app) and sign in with GitHub.
2. Click **"New Project"** $\rightarrow$ **"Deploy from GitHub repo"** $\rightarrow$ Select your `bunksafe` repository.
3. Once imported, click on the service box:
   * Go to **Settings** $\rightarrow$ **General**:
     * **Root Directory**: Set to `/server`
   * Go to **Build & Deploy**:
     * **Build Command**: `npm run build`
     * **Start Command**: `npm start`
4. **Add PostgreSQL Database**:
   * On your Railway project canvas, click **"New"** (or press `Ctrl+K`) $\rightarrow$ **"Database"** $\rightarrow$ **"Add PostgreSQL"**.
   * Railway will automatically link the database and generate a `DATABASE_URL` environment variable.
5. **Set Environment Variables on the Backend Service**:
   * Click on your backend service $\rightarrow$ **Variables** tab $\rightarrow$ Add:
     * `PORT`: `5000`
     * `NODE_ENV`: `production`
     * `AUTH_SECRET`: Generate a random secret string (e.g. `bunksafe_jwt_secret_2026_prod_key`)
     * `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (or select the linked Postgres database)
6. **Generate a Public Domain**:
   * In your backend service $\rightarrow$ **Settings** $\rightarrow$ **Networking** $\rightarrow$ Click **"Generate Domain"**.
   * You will receive a URL like:
     ```
     https://bunksafe-production.up.railway.app
     ```
   * *Copy this URL for Step 3.*
7. **Initialize Database Tables & Seed Data**:
   * In your backend service on Railway $\rightarrow$ Click the **"Settings"** or **"Deploy"** tab $\rightarrow$ Open **"Terminal"** (or CLI):
     ```bash
     npm run deploy:init
     ```
   * This creates all database tables and seeds the demo student (`1MS21CS001`) and admin (`admin@college.edu`).

---

## Step 3: Deploy Frontend to Vercel

1. Go to [Vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New..."** $\rightarrow$ **"Project"** $\rightarrow$ Import your `bunksafe` repository.
3. Configure the Project:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click **Edit** and select `client`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. **Environment Variables**:
   * Expand the **Environment Variables** section and add:
     * **Key**: `VITE_API_URL`
     * **Value**: Your Railway backend domain (from Step 2, e.g. `https://bunksafe-production.up.railway.app`)
5. Click **"Deploy"**.
   * Vercel will build the PWA and give you a live production URL like `https://bunksafe.vercel.app`.

---

## Step 4: Testing on Mobile Phone

1. On your phone, open the Vercel URL in Chrome (Android) or Safari (iOS).
2. Tap the browser menu:
   * **Chrome**: Tap `⋮` $\rightarrow$ **"Add to Home screen"** / **"Install App"**.
   * **Safari**: Tap **Share** icon $\rightarrow$ **"Add to Home Screen"**.
3. Launch BunkSafe directly from your phone's home screen.
4. Sign in with the demo account:
   * **USN**: `1MS21CS001`
   * **Password**: `password123`
   * Verify the 85% attendance safety gauges, timetable entries, and offline caching.

---

## Summary of Environment Variables

| Platform | Variable | Example Value | Description |
| :--- | :--- | :--- | :--- |
| **Vercel** (Client) | `VITE_API_URL` | `https://bunksafe-production.up.railway.app` | Target Railway backend API URL |
| **Railway** (Server) | `DATABASE_URL` | `postgresql://postgres:...@.../railway` | PostgreSQL connection string |
| **Railway** (Server) | `AUTH_SECRET` | `super_secure_random_jwt_secret_key` | JWT token signature secret |
| **Railway** (Server) | `NODE_ENV` | `production` | Enables production optimizations |
| **Railway** (Server) | `FRONTEND_URL` | `https://bunksafe.vercel.app` | Allowed CORS origin |

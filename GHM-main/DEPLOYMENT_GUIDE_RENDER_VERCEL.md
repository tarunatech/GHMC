# Deployment Guide: Render (Backend) & Vercel (Frontend)

This guide provides exact steps to deploy your **Chemical Waste Management ERP** using **Render** for the backend (Node.js + PostgreSQL) and **Vercel** for the frontend (React + Vite).

---

## 1. Prerequisites (GitHub)
Before starting, ensure your code is pushed to a GitHub repository.

1.  **Create a Repository:** Go to GitHub and create a new repository (e.g., `chem-waste-erp`).
2.  **Push Code:**
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git remote add origin https://github.com/YOUR_USERNAME/chem-waste-erp.git
    git push -u origin main
    ```
    *(If you already have a repo, skip this step.)*

---

## 2. Deploy Backend & Database on Render

Render will host your Node.js API and your PostgreSQL database.

### Step 2.1: Create Database
1.  Log in to [Render Dashboard](https://dashboard.render.com/).
2.  Click **"New +"** -> **"PostgreSQL"**.
3.  **Name:** `chemwaste-db` (or any name).
4.  **Database:** `chemwaste` (default is fine).
5.  **User:** `admin` (default is fine).
6.  **Region:** Choose a region close to you (e.g., Singapore, Frankfurt, Oregon).
7.  **Plan:** Select "Free" (for hobby) or a paid plan for production.
8.  Click **"Create Database"**.
9.  **Wait** for it to become "Available".
10. **Copy the "Internal Database URL"** (starting with `postgres://...`). You will need this for the backend service.
    *   *Note:* If you need to access the DB from your local machine (e.g., for initial seeding), copy the "External Database URL" as well.

### Step 2.2: Deploy Backend Web Service
1.  On Render Dashboard, click **"New +"** -> **"Web Service"**.
2.  Select **"Build and deploy from a Git repository"**.
3.  Connect your GitHub account and select your repository (`chem-waste-erp`).
4.  **Configure Service:**
    *   **Name:** `chemwaste-api`
    *   **Region:** Same as your database.
    *   **Branch:** `main`
    *   **Root Directory:** `backend` (Important! This tells Render the app is in the subfolder).
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
        *   *Explanation:* Installs deps, generates Prisma client, and applies DB migrations.
    *   **Start Command:** `npm start`
5.  **Environment Variables:**
    Scroll down to "Environment Variables" and click "Add Environment Variable". Add the following:
    *   `DATABASE_URL`: Paste the **Internal Database URL** from Step 2.1.
    *   `JWT_SECRET`: Enter a long, random secure string (e.g., `super_secret_key_123!`).
    *   `JWT_EXPIRES_IN`: `7d`
    *   `NODE_ENV`: `production`
    *   `FRONTEND_URL`: `https://your-frontend-domain.vercel.app` (You don't have this yet, so put `*` for now to allow all CORS, or update it after deploying frontend).
    *   `PORT`: `10000` (Render sets this automatically, but good to be explicit).
6.  Click **"Create Web Service"**.

Render will now build and deploy your backend. Watch the logs. Once it says "Live", copy the **Service URL** (e.g., `https://chemwaste-api.onrender.com`).

---

## 3. Deploy Frontend on Vercel

Vercel is optimized for frontend frameworks like React and Vite.

1.  Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository (`chem-waste-erp`).
4.  **Configure Project:**
    *   **Framework Preset:** `Vite` (Detects automatically).
    *   **Root Directory:** Click "Edit" and select `frontend`.
    *   **Build & Output Settings:** Default is usually correct (`npm run build` / `dist`).
5.  **Environment Variables:**
    Open the "Environment Variables" section and add:
    *   **Name:** `VITE_API_URL`
    *   **Value:** Your Render Backend URL from Step 2.2 (e.g., `https://chemwaste-api.onrender.com/api`)
        *   *Important:* Make sure to add `/api` at the end if your backend routes are prefixed with `/api`. Looking at your code, the base URL should point to where `apiClient` expects it. Your code defaults to `http://localhost:3000/api`, so set this to `https://chemwaste-api.onrender.com/api`.
6.  Click **"Deploy"**.

Vercel will build and deploy your site. Once done, you will get a domain (e.g., `chem-waste-erp.vercel.app`).

---

## 4. Final Configuration

### Update CORS on Backend
Now that you have your Vercel domain:
1.  Go back to **Render** -> **Web Services** -> `chemwaste-api` -> **Environment**.
2.  Edit `FRONTEND_URL` and set it to your Vercel domain (e.g., `https://chem-waste-erp.vercel.app`). This secures your API to only accept requests from your frontend.
3.  Save changes. Render will auto-redeploy.

### Initial Data Seeding (Optional)
If your database is empty, you might need to run seeders.
1.  Go to Render -> Web Service -> `chemwaste-api` -> **Shell**.
2.  Run: `npm run seed:admin` (or whatever script you use to create the initial admin user).

---

## Summary of URLs
*   **Frontend:** `https://chem-waste-erp.vercel.app` (Share this with users)
*   **Backend:** `https://chemwaste-api.onrender.com` (Used internally by frontend)

**Troubleshooting:**
*   **CORS Errors:** Check if `FRONTEND_URL` in Render matches your Vercel URL exactly (no trailing slash usually).
*   **Database Connection:** Ensure `DATABASE_URL` is correct and the IP Access List (if configured) allows connections (Render internal network handles this auto-magically).

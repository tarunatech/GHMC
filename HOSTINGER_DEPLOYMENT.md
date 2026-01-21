# Hostinger KVM2 Deployment Guide (PostgreSQL + Cloudflare R2)

This guide provides step-by-step instructions to deploy the Chemical Waste Management project on a Hostinger KVM2 VPS with a PostgreSQL database and Cloudflare R2 for invoice storage.

## Prerequisites
1. **Hostinger KVM2 VPS**: With Ubuntu 22.04 installed.
2. **Cloudflare Account**: With R2 enabled.
3. **Domain Name**: Pointed to your VPS IP.

---

## 1. Cloudflare R2 Setup
1. Log in to your Cloudflare Dashboard.
2. Navigate to **R2 > Overview** and click **Create bucket**.
3. Name your bucket (e.g., `ghm-invoices`) and choose a location.
4. Click **Create bucket**.
5. Once created, go to the bucket settings and make it **Public** if you want direct access via URL, or use the default private settings (the app uses signed URLs for security).
6. Go back to R2 Overview and click **Manage R2 API Tokens**.
7. Create a new API token with **Edit** permissions. Save the **Access Key ID** and **Secret Access Key**.
8. Note your **Account ID** (found on the R2 Overview page).

Your R2 Endpoint will be: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## 2. Server Preparation (Hostinger VPS)
SSH into your VPS:
```bash
ssh root@your_server_ip
```

### Install Node.js & Dependencies
```bash
# Update OS
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git, Nginx, and build essentials
sudo apt install -y git nginx build-essential
```

### Install & Setup PostgreSQL
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User
sudo -u postgres psql
```
Inside the `psql` shell:
```sql
CREATE DATABASE ghm_db;
CREATE USER ghm_user WITH PASSWORD 'YourStrongPassword123';
GRANT ALL PRIVILEGES ON DATABASE ghm_db TO ghm_user;
\q
```

---

## 3. Application Deployment

### Clone the Repository
```bash
cd /var/www
git clone <your-repo-url> ghm
cd ghm
```

### Backend Setup
```bash
cd backend
npm install

# Create .env file
nano .env
```
Paste and fill the following:
```env
PORT=3000
NODE_ENV=production
DATABASE_URL="postgresql://ghm_user:YourStrongPassword123@localhost:5432/ghm_db?schema=public"
JWT_SECRET="your_very_secure_random_secret"
JWT_EXPIRES_IN="1d"
FRONTEND_URL="https://yourdomain.com"

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Cloudflare R2 Configuration
R2_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your_access_key"
R2_SECRET_ACCESS_KEY="your_secret_key"
R2_BUCKET_NAME="ghm-invoices"
R2_PUBLIC_URL="https://pub-<hash>.r2.dev" # Or your custom domain
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Database Initial Migration
```bash
npx prisma generate
npx prisma migrate deploy
# Optional: Seed the superadmin
npm run seed:superadmin
```

### Start Backend with PM2
```bash
sudo npm install -g pm2
pm2 start src/server.js --name ghm-backend
pm2 save
pm2 startup
```

### Frontend Setup
```bash
cd ../frontend
npm install

# Create .env file for frontend
nano .env
```
Paste:
```env
VITE_API_URL="https://yourdomain.com/api"
```
Save and Build:
```bash
npm run build
```

---

## 4. Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/ghm
```
Paste the following (replace `yourdomain.com` with your domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/ghm/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/ghm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 5. SSL with Certbot
```bash
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d yourdomain.com
```

---

## 6. Verification
- Visit `https://yourdomain.com` to see the frontend.
- Log in with your admin credentials.
- Invoices can now be uploaded to Cloudflare R2 via the backend (R2 integration code has been added to `src/utils/storage.js`).

## Notes on Cloudflare R2 Integration
I have proactively updated the backend to support R2:
1. Created `backend/src/utils/storage.js` for R2 operations.
2. Updated `backend/src/config/env.js` with R2 configuration.
3. Added `multer` and `@aws-sdk/client-s3` to `backend/package.json`.
4. Added `POST /api/invoices/:id/upload` endpoint to handle PDF uploads.

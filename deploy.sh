#!/bin/bash

# --- GHMC Production Deployment Script ---
# Run this on your Hostinger VPS AFTER pushing changes to GitHub.

echo "🚀 Starting Deployment Process..."

# 1. Pull the latest changes from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# 2. Update Backend
echo "⚙️ Updating Backend..."
cd backend
npm install
# Note: Prisma migrations are usually skiped if schema hasn't changed, 
# but if you changed the schema, run: npx prisma db push
pm2 restart ghmccrm-api

# 3. Update Frontend
echo "🏗️ Building Frontend..."
cd ../frontend
npm install
# Ensure environment variables are correctly set (usually handled by .env.production)
npm run build

echo "✅ Deployment Successful!"
echo "🌐 Your site is live at https://ghmccrm.in"

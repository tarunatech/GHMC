#!/bin/bash

# --- GHMC Production Deployment Script (Enhanced) ---
# Run this on your Hostinger VPS AFTER pushing changes to GitHub.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 Starting Deployment Process..."

# 1. Pull the latest changes from GitHub
echo "📥 1/3: Pulling latest code from GitHub..."
git pull origin main

# 2. Update Backend
echo "⚙️ 2/3: Updating Backend & Database..."
cd backend
npm install

# Apply database changes and regenerate Prisma client
echo "🗄️ Synchronizing Database Schema..."
npx prisma db push
npx prisma generate

# Restart the API service
echo "🔄 Restarting API service..."
pm2 restart ghmccrm-api || pm2 start src/server.js --name ghmccrm-api

# 3. Update Frontend
echo "🏗️ 3/3: Building Frontend..."
cd ../frontend
npm install

# Build the production bundle
echo "🔨 Running build script..."
npm run build

echo "✅ -------------------------------------------"
echo "✅ Deployment Successful!"
echo "🌐 Your site is live at https://ghmccrm.in"
echo "✅ -------------------------------------------"

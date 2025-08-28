# 🚀 Development Setup Guide

## Overview

This guide covers setting up the complete development environment for the Don't Skip ecosystem:

- **VSCode Extension** (TypeScript)
- **Backend API** (Node.js/Express)
- **iOS App** (Swift/SwiftUI)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VSCode Ext    │    │   Backend API   │    │    iOS App      │
│   (TypeScript)  │◄──►│ (Node.js/Express)│◄──►│  (Swift/SwiftUI)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Databases     │
                       │ MongoDB + Redis │
                       └─────────────────┘
```

## 📋 Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **MongoDB** (local or Docker)
- **Redis** (local or Docker)
- **Xcode** 15+ (for iOS development)
- **VSCode** with TypeScript support

### Optional (Recommended)

- **Docker Desktop** (for easy database setup)
- **MongoDB Compass** (database GUI)
- **Postman** or **Insomnia** (API testing)

## 🗄️ Database Setup

### Option 1: Docker (Recommended)

Create `docker-compose.yml` in project root:

```yaml
version: "3.8"
services:
  mongodb:
    image: mongo:7
    container_name: dontskip-mongo
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: dontskip-dev-password
      MONGO_INITDB_DATABASE: workout-lockout
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    container_name: dontskip-redis
    restart: always
    ports:
      - "6379:6379"
    command: redis-server --requirepass dontskip-redis-password
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

Start databases:

```bash
docker-compose up -d
```

### Option 2: Local Installation

**MongoDB:**

```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt install mongodb
sudo systemctl start mongodb
```

**Redis:**

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

## 🔧 Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create `backend/.env`:

```bash
# Copy example and customize
cp .env.example .env
```

**Development `.env` file:**

```env
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database Configuration
MONGODB_URI=mongodb://admin:dontskip-dev-password@localhost:27017/workout-lockout?authSource=admin
REDIS_URL=redis://:dontskip-redis-password@localhost:6379

# Security Configuration (generate strong keys for production)
JWT_SECRET=dev-jwt-secret-key-minimum-256-bits-long-for-development-only
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=dev-encryption-key-for-tokens-minimum-256-bits-development
ENCRYPTION_SALT=dev-hex-encoded-salt-64-chars-long-development-only-use

# CORS Configuration
ALLOWED_ORIGINS=vscode-webview://*,http://localhost:3000,https://localhost:3000

# Rate Limiting (relaxed for development)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
AUTH_RATE_LIMIT_MAX=50

# Data Retention (days)
WORKOUT_RETENTION_DAYS=30
CREDIT_RETENTION_DAYS=30
INACTIVE_USER_CLEANUP_DAYS=90

# Fitness API Configuration (optional for development)
# WHOOP_CLIENT_ID=your-whoop-client-id
# WHOOP_CLIENT_SECRET=your-whoop-client-secret
# STRAVA_CLIENT_ID=your-strava-client-id
# STRAVA_CLIENT_SECRET=your-strava-client-secret
# FITBIT_CLIENT_ID=your-fitbit-client-id
# FITBIT_CLIENT_SECRET=your-fitbit-client-secret

# Security Monitoring
SECURITY_ALERT_EMAIL=dev@localhost
ENABLE_SECURITY_ALERTS=false
```

### 3. Build and Start Backend

```bash
# Development mode (auto-restart)
npm run dev

# Or build and run
npm run build
npm start
```

### 4. Verify Backend

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

## 📱 iOS App Setup

### 1. Open in Xcode

```bash
open "ios/Dont Skip/Dont Skip.xcodeproj"
```

### 2. Configure Development Team

1. Select the project in Xcode
2. Go to **Signing & Capabilities**
3. Select your **Development Team**
4. Ensure **Bundle Identifier** is unique

### 3. Update Backend URL (if needed)

The iOS app is already configured to use `http://localhost:3000/api` in debug mode.

Check `ios/Dont Skip/Dont Skip/Config/Config.swift`:

```swift
static let baseURL: String = {
    #if DEBUG
    return "http://localhost:3000/api"  // ✅ Correct for local development
    #else
    return "https://api.dontskip.app/api"
    #endif
}()
```

### 4. Build and Run

1. Select **iPhone Simulator** or connected device
2. Press **Cmd+R** to build and run
3. App should launch and attempt to connect to backend

## 🔌 VSCode Extension Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile TypeScript

```bash
npm run compile
```

### 3. Test Extension

1. Press **F5** in VSCode (or use Run > Start Debugging)
2. New VSCode window opens with extension loaded
3. Check status bar for "💪 0.0h credits | 8.0h today"

## 🧪 Testing the Complete System

### 1. Start All Services

**Terminal 1 - Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 - Extension:**

```bash
# In VSCode, press F5 to launch extension host
```

**Terminal 3 - iOS Simulator:**

```bash
# In Xcode, press Cmd+R to run iOS app
```

### 2. Test API Connectivity

**From iOS App:**

1. Launch app in simulator
2. Check dashboard loads (may show empty state initially)
3. Try registering a new account
4. Verify backend logs show API requests

**From VSCode Extension:**

1. Open Command Palette (`Cmd+Shift+P`)
2. Run "Don't Skip: Record Workout"
3. Complete workout entry
4. Check if credits appear in status bar

### 3. Test Data Flow

1. **Record workout in iOS app**
2. **Check if credits sync to VSCode extension**
3. **Use credits by typing in VSCode**
4. **Verify credit consumption in iOS app**

## 🐛 Troubleshooting

### Backend Issues

**"Cannot connect to MongoDB"**

```bash
# Check if MongoDB is running
docker ps | grep mongo
# or
brew services list | grep mongodb
```

**"Redis connection failed"**

```bash
# Check if Redis is running
docker ps | grep redis
# or
brew services list | grep redis
```

**"Port 3000 already in use"**

```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### iOS App Issues

**"Cannot connect to backend"**

1. Ensure backend is running on `http://localhost:3000`
2. Check iOS simulator can reach localhost
3. Verify no firewall blocking connections
4. Check Xcode console for network errors

**"Build failed - Signing issues"**

1. Select valid Development Team in Xcode
2. Ensure Bundle ID is unique
3. Check provisioning profiles

### VSCode Extension Issues

**"Extension not loading"**

1. Check TypeScript compilation: `npm run compile`
2. Restart extension host (Cmd+Shift+P > "Reload Window")
3. Check VSCode Developer Console for errors

## 🚀 Development Workflow

### Daily Development

1. **Start databases:** `docker-compose up -d`
2. **Start backend:** `cd backend && npm run dev`
3. **Launch iOS app:** Open Xcode, Cmd+R
4. **Test extension:** Press F5 in VSCode

### Making Changes

**Backend changes:**

- Auto-restart with `npm run dev`
- Test with Postman/curl
- Check logs for errors

**iOS changes:**

- Cmd+R to rebuild and run
- Use Xcode debugger for issues
- Test on device for HealthKit features

**Extension changes:**

- Recompile: `npm run compile`
- Reload extension host: Cmd+Shift+P > "Reload Window"

## 📊 Monitoring & Debugging

### Backend Logs

```bash
# Follow backend logs
cd backend
npm run dev

# Or check specific log files if configured
tail -f logs/app.log
```

### iOS Debugging

- Use Xcode debugger and console
- Network requests visible in console
- HealthKit permissions in Settings app

### Extension Debugging

- VSCode Developer Console: Help > Toggle Developer Tools
- Extension logs in Output panel
- Use `console.log()` for debugging

## 🔐 Security Notes

### Development vs Production

**Development (current setup):**

- Weak passwords and keys (acceptable for local dev)
- Relaxed CORS and rate limiting
- Debug logging enabled
- Local database without encryption

**Production (when deploying):**

- Strong, unique passwords and encryption keys
- Strict CORS and rate limiting
- Minimal logging
- Encrypted database connections
- HTTPS only

### Never Commit

- `.env` files with real credentials
- Database passwords
- API keys for external services
- Production configuration

## 📈 Next Steps

1. **Test basic functionality** with this setup
2. **Add fitness API integrations** (Strava, Fitbit, etc.)
3. **Implement user authentication** flow
4. **Add data synchronization** between platforms
5. **Deploy to staging environment**

---

**Need help?** Check the troubleshooting section or create an issue with:

- Operating system and versions
- Error messages and logs
- Steps to reproduce the problem

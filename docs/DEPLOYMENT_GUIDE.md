# Deployment Guide

## Quick Start with Docker

### 1. Environment Setup

```bash
# Clone the repository
git clone <your-repo>
cd workout-lockout

# Copy environment template
cp backend/.env.example backend/.env

# Edit environment variables
nano backend/.env
```

### 2. Required Environment Variables

```bash
# Security (REQUIRED)
JWT_SECRET=your-super-secure-jwt-secret-key-here-256-bits-minimum
ENCRYPTION_KEY=your-encryption-key-for-tokens-here-256-bits-minimum

# Database
MONGODB_URI=mongodb://mongo:27017/workout-lockout
REDIS_URL=redis://redis:6379

# Server
NODE_ENV=production
PORT=3000

# CORS (adjust for your domain)
ALLOWED_ORIGINS=https://your-domain.com,vscode-webview://*
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
cd backend
docker-compose up -d

# Check logs
docker-compose logs -f app

# Check health
curl http://localhost:3000/health
```

## Production Deployment

### 1. Cloud Deployment (AWS/GCP/Azure)

**Option A: Container Service**

```bash
# Build production image
docker build -t workout-lockout-backend .

# Tag for registry
docker tag workout-lockout-backend your-registry/workout-lockout:latest

# Push to registry
docker push your-registry/workout-lockout:latest

# Deploy to ECS/Cloud Run/Container Instances
```

**Option B: Kubernetes**

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workout-lockout-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: workout-lockout-backend
  template:
    metadata:
      labels:
        app: workout-lockout-backend
    spec:
      containers:
        - name: backend
          image: your-registry/workout-lockout:latest
          ports:
            - containerPort: 3000
          env:
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: workout-lockout-secrets
                  key: jwt-secret
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: workout-lockout-secrets
                  key: mongodb-uri
```

### 2. Database Setup

**MongoDB Atlas (Recommended)**

```bash
# Create cluster at mongodb.com/atlas
# Get connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/workout-lockout?retryWrites=true&w=majority
```

**Redis Cloud**

```bash
# Create instance at redis.com/cloud
# Get connection string
REDIS_URL=rediss://username:password@host:port
```

### 3. SSL/TLS Setup

**Option A: Let's Encrypt with Nginx**

```nginx
# /etc/nginx/sites-available/workout-lockout
server {
    listen 80;
    server_name api.workout-lockout.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.workout-lockout.app;

    ssl_certificate /etc/letsencrypt/live/api.workout-lockout.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.workout-lockout.app/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Option B: Cloud Load Balancer**

- AWS ALB with ACM certificate
- GCP Load Balancer with managed SSL
- Azure Application Gateway with SSL

### 4. Monitoring Setup

**Health Checks**

```bash
# Add to your monitoring system
curl -f http://localhost:3000/health || exit 1
```

**Logging**

```bash
# Centralized logging with ELK/Fluentd
docker-compose logs -f app | your-log-aggregator
```

**Metrics**

```javascript
// Add to server.js for Prometheus metrics
const prometheus = require("prom-client");
const register = new prometheus.Registry();

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
});

register.registerMetric(httpRequestDuration);
```

## VSCode Extension Configuration

### 1. Update Extension Settings

```json
// settings.json
{
  "workoutLockout.backendUrl": "https://api.workout-lockout.app",
  "workoutLockout.enableSync": true,
  "workoutLockout.offlineMode": false
}
```

### 2. Package Extension

```bash
# Install vsce
npm install -g vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish
```

## Mobile App Integration

### 1. iOS App Backend Integration

```swift
// iOS app configuration
struct BackendConfig {
    static let baseURL = "https://api.workout-lockout.app"
    static let apiVersion = "v1"
}

// HealthKit sync endpoint
POST /api/workouts/sync-healthkit
```

### 2. Android App Backend Integration

```kotlin
// Android app configuration
object BackendConfig {
    const val BASE_URL = "https://api.workout-lockout.app"
    const val API_VERSION = "v1"
}

// Google Fit sync endpoint
POST /api/workouts/sync-googlefit
```

## Security Checklist

- [ ] Strong JWT secrets (256-bit minimum)
- [ ] Encrypted database connections
- [ ] HTTPS/TLS everywhere
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation enabled
- [ ] Security headers set
- [ ] Regular security updates
- [ ] Backup encryption enabled
- [ ] Access logging enabled

## Performance Optimization

### 1. Database Indexing

```javascript
// MongoDB indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ deviceId: 1 }, { unique: true });
db.workouts.createIndex({ userId: 1, startTime: -1 });
db.credittransactions.createIndex({ userId: 1, timestamp: -1 });
```

### 2. Redis Caching

```javascript
// Cache frequently accessed data
const cacheKeys = {
  userCredits: (userId) => `credits:${userId}`,
  userSettings: (userId) => `settings:${userId}`,
  integrations: (userId) => `integrations:${userId}`,
};

// Cache TTL: 5 minutes for credits, 1 hour for settings
```

### 3. CDN Setup

```bash
# Static assets via CDN
# API responses via edge caching where appropriate
# Mobile app assets via CDN
```

## Backup Strategy

### 1. Database Backups

```bash
# MongoDB backup
mongodump --uri="$MONGODB_URI" --out=/backups/$(date +%Y%m%d)

# Redis backup
redis-cli --rdb /backups/redis-$(date +%Y%m%d).rdb
```

### 2. Automated Backups

```yaml
# Kubernetes CronJob for backups
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
spec:
  schedule: "0 2 * * *" # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: mongo:6
              command: ["/bin/bash"]
              args: ["-c", "mongodump --uri=$MONGODB_URI --out=/backup"]
```

## Troubleshooting

### Common Issues

1. **Connection Refused**

   ```bash
   # Check if services are running
   docker-compose ps

   # Check logs
   docker-compose logs app
   ```

2. **Authentication Errors**

   ```bash
   # Verify JWT secret is set
   echo $JWT_SECRET

   # Check token expiration
   # Tokens expire after 7 days by default
   ```

3. **Database Connection Issues**

   ```bash
   # Test MongoDB connection
   mongosh "$MONGODB_URI"

   # Test Redis connection
   redis-cli -u "$REDIS_URL" ping
   ```

### Performance Issues

1. **Slow API Responses**

   - Check database indexes
   - Monitor Redis cache hit rates
   - Review query performance

2. **High Memory Usage**
   - Check for memory leaks
   - Optimize Redis memory usage
   - Review connection pooling

### Support

- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Documentation: [Full Documentation](https://docs.workout-lockout.app)
- Security Issues: security@workout-lockout.app

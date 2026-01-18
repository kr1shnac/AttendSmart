# AttendSmart Deployment & Production Setup Guide

Comprehensive guide for deploying AttendSmart to production environments with security best practices, scaling strategies, and monitoring setup.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [SSL/HTTPS Setup](#sslhttps-setup)
7. [Monitoring & Logging](#monitoring--logging)
8. [Scaling & Performance](#scaling--performance)
9. [Backup & Disaster Recovery](#backup--disaster-recovery)
10. [Security Hardening](#security-hardening)

---

## Pre-Deployment Checklist

Before deploying to production:

### Code Quality

- [ ] All tests pass: `npm test`
- [ ] No console.log statements left in production code
- [ ] No API keys or secrets in code
- [ ] All environment variables documented in `.env.example`
- [ ] No hardcoded URLs (use env vars)
- [ ] Code linting passes: `npm run lint`

### Backend

- [ ] All API endpoints return standardized response format
- [ ] Error handling middleware installed
- [ ] Rate limiting configured
- [ ] CORS configured for frontend URL only
- [ ] Database connection tested
- [ ] JWT secrets are strong (min 32 characters)
- [ ] Mongoose indexes created on frequently queried fields

### Frontend

- [ ] No test/demo UI components
- [ ] All data fetched from API (no hardcoded)
- [ ] API base URL uses env var
- [ ] Axios interceptor handles 401 errors
- [ ] Loading states implemented
- [ ] Error messages user-friendly
- [ ] Build optimization: `npm run build`

### Security

- [ ] `.gitignore` includes `.env`, `node_modules/`, etc.
- [ ] No `.env` files committed to git
- [ ] `.git` history checked for leaked secrets (`git-secrets`)
- [ ] Dependencies reviewed for vulnerabilities: `npm audit`
- [ ] HTTPS/SSL certificates ready
- [ ] Passwords hashing: bcrypt with >= 12 salt rounds
- [ ] Rate limiting middleware installed
- [ ] CORS headers configured properly

---

## Environment Configuration

### Create Production Environment Files

#### Backend `.env` (Production)

```bash
# Core
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/attendsmart?retryWrites=true&w=majority
MONGODB_BACKUP_URI=mongodb+srv://backup_user:password@backup-cluster.mongodb.net/attendsmart

# Authentication
JWT_SECRET=your-very-secure-random-string-min-32-characters
JWT_EXPIRE=7d
SESSION_SECRET=another-very-secure-random-string-min-32-characters

# Frontend
FRONTEND_URL=https://attendsmart.example.com
FRONTEND_PORT=80

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@attendsmart.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM_EMAIL=noreply@attendsmart.com

# AWS S3 (for face uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=attendsmart-production

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/attendsmart/backend.log
SENTRY_DSN=https://key@sentry.io/project-id

# BLE Configuration
BLE_SCAN_INTERVAL=5000
BLE_BEACON_TIMEOUT=30000
BLE_RSSI_THRESHOLD=-85

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN=https://attendsmart.example.com
API_KEY_VALIDATION=true
```

**Generate Strong Secrets:**

```bash
# Generate JWT_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend `.env` (Production)

```bash
# API Configuration
REACT_APP_API_BASE_URL=https://api.attendsmart.example.com
REACT_APP_API_TIMEOUT=10000

# App Configuration
REACT_APP_ENV=production
REACT_APP_APP_NAME=AttendSmart
REACT_APP_VERSION=1.0.0

# Feature Flags
REACT_APP_ENABLE_FACE_RECOGNITION=true
REACT_APP_ENABLE_BLE_DETECTION=true
REACT_APP_ENABLE_GPS_VERIFICATION=true
REACT_APP_ENABLE_ANALYTICS=true

# Location Services
REACT_APP_GEOFENCE_RADIUS_METERS=100
REACT_APP_GPS_ACCURACY_THRESHOLD=50

# Biometric Settings
REACT_APP_FACE_CONFIDENCE_THRESHOLD=75
REACT_APP_BIOMETRIC_TIMEOUT_MS=30000

# BLE Settings
REACT_APP_BLE_RSSI_THRESHOLD=-85
REACT_APP_BLE_SCAN_TIMEOUT=10000

# Session Configuration
REACT_APP_SESSION_TIMEOUT_MINUTES=30
REACT_APP_AUTO_REFRESH_INTERVAL=300000
```

### Secure Secret Management

**Never commit `.env` files. Use one of these approaches:**

1. **Environment Variables on Server**

   ```bash
   # On your hosting platform (AWS, Heroku, etc.)
   # Add environment variables through web console or CLI
   ```

2. **Secrets Manager (Recommended)**

   ```bash
   # AWS Secrets Manager
   aws secretsmanager create-secret --name attendsmart/backend \
     --secret-string file://backend/.env

   # Or use HashiCorp Vault, Kubernetes Secrets, etc.
   ```

3. **Encrypted `.env.production`**
   ```bash
   # Use a tool like dotenv-vault
   npm install dotenv-vault
   dotenv-vault push
   dotenv-vault pull production
   ```

---

## Database Setup

### MongoDB Atlas Cloud Database (Recommended)

#### 1. Create MongoDB Atlas Cluster

```bash
# Visit: https://www.mongodb.com/cloud/atlas
# 1. Sign up and create organization
# 2. Create project
# 3. Create M2/M5+ cluster (avoid free tier for production)
# 4. Configure:
#    - Cluster name: attendsmart-prod
#    - Region: Closest to your users
#    - Backup: Enabled
#    - Encryption: Enabled
```

#### 2. Create Database User

```bash
# In MongoDB Atlas:
# Security > Database Access > Add Database User
# - Username: app_user
# - Password: Strong password (min 12 chars, mixed case, numbers, symbols)
# - Role: readWriteAnyDatabase
```

#### 3. Whitelist IP Addresses

```bash
# Security > Network Access > Add IP Address
# - Add all backend server IPs
# - For testing: Add your IP (0.0.0.0/0 is NOT secure)
# - Add load balancer IPs if applicable
```

#### 4. Get Connection String

```bash
# Copy from MongoDB Atlas:
mongodb+srv://app_user:password@cluster.mongodb.net/attendsmart?retryWrites=true&w=majority
```

### Backup Strategy

```bash
# Automated daily backups (set in MongoDB Atlas)
# 1. Go to Backup > Automatic Backups
# 2. Enable daily backups (7-day retention minimum)
# 3. Test restore procedure monthly

# Manual backup
mongodump --uri "mongodb+srv://..." --out ./backup

# Restore from backup
mongorestore --uri "mongodb+srv://..." ./backup
```

### Database Indexes

Ensure these indexes are created for performance:

```javascript
// In MongoDB Atlas > Collections > Indexes
// Or via code on startup:

// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// Session indexes
db.sessions.createIndex({ class: 1, status: 1 });
db.sessions.createIndex({ startTime: 1, endTime: 1 });

// Attendance indexes
db.attendances.createIndex({ session: 1, student: 1 }, { unique: true });
db.attendances.createIndex({ student: 1, class: 1 });
db.attendances.createIndex({ status: 1 });

// BiometricData indexes
db.biometricdatas.createIndex({ userId: 1 }, { unique: true });

// Log indexes
db.logs.createIndex({ type: 1, timestamp: -1 });
db.logs.createIndex({ userId: 1, timestamp: -1 });
```

---

## Backend Deployment

### Using Node.js (Recommended: PM2)

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. Create Ecosystem File (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [
    {
      name: "attendsmart-api",
      script: "./server.js",
      instances: "max", // Use all CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "500M",
      watch: false, // Disable watch in production
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
```

#### 3. Start Application

```bash
# Install dependencies
npm ci --only=production

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

#### 4. Monitor Application

```bash
# View logs
pm2 logs

# Monitor processes
pm2 monit

# Get process info
pm2 info attendsmart-api
```

### Using Docker (Alternative)

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads/faces logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 5000

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    container_name: attendsmart-backend
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      MONGODB_URI: ${MONGODB_URI}
      JWT_SECRET: ${JWT_SECRET}
      # ... other env vars
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/logs:/app/logs
    restart: unless-stopped
    networks:
      - attendsmart-network

  mongodb:
    image: mongo:6
    container_name: attendsmart-mongodb
    volumes:
      - mongo-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    restart: unless-stopped
    networks:
      - attendsmart-network

volumes:
  mongo-data:

networks:
  attendsmart-network:
    driver: bridge
```

---

## Frontend Deployment

### Build Optimization

```bash
# Create optimized production build
npm run build

# Analyze bundle size
npm install -g source-map-explorer
source-map-explorer 'build/static/js/*.js'

# Expected output size: < 500KB main bundle
```

### Using Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Configure in vercel.json
```

vercel.json:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ],
  "env": {
    "REACT_APP_API_BASE_URL": "https://api.attendsmart.example.com"
  }
}
```

### Using Netlify (Alternative)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=build

# Configure in netlify.toml
```

netlify.toml:

```toml
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/api/*"
  to = "https://api.attendsmart.example.com/:splat"
  status = 200
  force = true

[context.production.environment]
  REACT_APP_API_BASE_URL = "https://api.attendsmart.example.com"

[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "max-age=604800"

[[headers]]
  for = "/static/*"
  [headers.values]
    Cache-Control = "max-age=31536000, immutable"
```

### Using AWS S3 + CloudFront

```bash
# Build application
npm run build

# Deploy to S3
aws s3 sync build/ s3://attendsmart-frontend --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

---

## SSL/HTTPS Setup

### Obtain SSL Certificate

#### Using Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d api.attendsmart.example.com

# Certificate location: /etc/letsencrypt/live/api.attendsmart.example.com/
```

#### Using AWS Certificate Manager

```bash
# In AWS Console:
# 1. Go to Certificate Manager
# 2. Request certificate
# 3. Validate domain ownership
# 4. Attach to load balancer
```

### Configure Nginx with HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name api.attendsmart.example.com;

    ssl_certificate /etc/letsencrypt/live/api.attendsmart.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.attendsmart.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:5000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.attendsmart.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Auto-renew Let's Encrypt Certificate

```bash
# Create cron job for renewal
sudo crontab -e

# Add line:
0 0 1 * * certbot renew --quiet && systemctl reload nginx
```

---

## Monitoring & Logging

### Application Monitoring

#### Using New Relic

```bash
# Install New Relic agent
npm install newrelic

# Create newrelic.js config
cp node_modules/newrelic/newrelic.js ./

# Set environment variable
export NEW_RELIC_LICENSE_KEY=your-license-key
```

#### Using Datadog

```bash
# Install Datadog agent
npm install dd-trace

# Initialize in app startup (before other requires)
// server.js
require('dd-trace').init();
```

### Logging Strategy

#### Structured Logging with Winston

```bash
npm install winston winston-daily-rotate-file
```

#### Logger Configuration

```javascript
// backend/utils/logger.js
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const transport = new DailyRotateFile({
  filename: "logs/application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [
    transport,
    ...(process.env.NODE_ENV !== "production"
      ? [
          new winston.transports.Console({
            format: winston.format.simple(),
          }),
        ]
      : []),
  ],
});

module.exports = logger;
```

### Log Aggregation

#### Using ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
version: "3.8"

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.0.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5000:5000/udp"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

---

## Scaling & Performance

### Horizontal Scaling

```javascript
// backend/server.js - Add clustering
const cluster = require("cluster");
const os = require("os");

if (cluster.isMaster && process.env.NODE_ENV === "production") {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process code
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (PID: ${process.pid})`);
  });
}
```

### Load Balancing with Nginx

```nginx
upstream attendsmart_backend {
    least_conn; # Load balancing algorithm

    server 192.168.1.100:5000 weight=1;
    server 192.168.1.101:5000 weight=1;
    server 192.168.1.102:5000 weight=1;

    keepalive 32;
}

server {
    listen 443 ssl;
    server_name api.attendsmart.example.com;

    # ... SSL config ...

    location / {
        proxy_pass http://attendsmart_backend;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }
}
```

### Database Connection Pooling

```javascript
// backend/config/database.js
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10, // Maximum connections
  minPoolSize: 5, // Minimum connections
  maxIdleTimeMS: 45000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
});
```

### CDN for Static Assets

```bash
# Upload frontend build to CDN
aws s3 sync build/ s3://attendsmart-cdn/ --delete

# Use CloudFront or similar
# Update frontend .env:
REACT_APP_CDN_URL=https://d123.cloudfront.net
```

---

## Backup & Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/backups/attendsmart"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MongoDB
mongodump --uri "${MONGODB_URI}" --out "${BACKUP_DIR}/mongo_${DATE}"

# Backup uploaded files
tar -czf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" backend/uploads/

# Upload to S3
aws s3 sync "${BACKUP_DIR}" s3://attendsmart-backups/

# Keep only last 30 days
find "${BACKUP_DIR}" -type f -mtime +30 -delete

echo "Backup completed at $(date)" >> /var/log/backup.log
```

### Cron Job Setup

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /path/to/backup.sh
```

### Disaster Recovery Plan

```markdown
## If Database Lost:

1. Stop all services
2. Check S3 backups for latest version
3. Restore from MongoDB Atlas backup
4. Verify data integrity
5. Run tests
6. Restart services

## If Server Lost:

1. Provision new server
2. Install Node.js, MongoDB
3. Clone code from git
4. Copy .env from Secrets Manager
5. Restore database from backup
6. Start services
7. Run smoke tests
```

---

## Security Hardening

### Application Security

```bash
# Install security packages
npm install helmet express-rate-limit cors dotenv
```

#### helmet.js Configuration

```javascript
// backend/middleware/security.js
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Use Helmet
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Stricter limits for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
});

app.use("/api/auth/login", authLimiter);
```

### Infrastructure Security

```bash
# Server hardening
sudo ufw enable
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS

# Fail2ban
sudo apt-get install fail2ban
sudo systemctl enable fail2ban

# Unattended upgrades
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Secrets Scanning

```bash
# Install git-secrets
brew install git-secrets

# Scan repository
git secrets --scan

# Add patterns to detect
git secrets --add 'mongodb\+srv://.*:.*@'
git secrets --add 'JWT_SECRET'
```

### Dependency Vulnerability Scanning

```bash
# Check vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Set up GitHub dependabot (in GitHub)
# Goes to: Settings > Security > Dependabot
```

### Regular Security Audits

```bash
# Monthly vulnerability scan
npm audit

# Dependency updates
npm update

# OWASP Top 10 checklist
- Injection attacks (SQL, NoSQL)
- Broken authentication
- Sensitive data exposure
- XML external entities
- Broken access control
- Security misconfiguration
- XSS attacks
- Insecure deserialization
- Using components with known vulnerabilities
- Insufficient logging & monitoring
```

---

## Post-Deployment Checklist

- [ ] All services running: `curl https://api.attendsmart.example.com/api/health`
- [ ] Frontend loads: `https://attendsmart.example.com`
- [ ] SSL certificate valid (check in browser)
- [ ] API responds with standardized format
- [ ] Database connected and populated
- [ ] Email notifications working
- [ ] Backups running on schedule
- [ ] Monitoring alerts active
- [ ] Logs aggregating properly
- [ ] Rate limiting active
- [ ] CORS headers correct
- [ ] Password reset working
- [ ] File uploads working
- [ ] Real-time updates (Socket.IO) working
- [ ] Analytics dashboard loaded

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Status**: Ready for Production Deployment

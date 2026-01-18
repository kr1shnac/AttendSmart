# 🚀 AttendSmart Production Deployment Checklist

## Pre-Deployment

### Environment Variables

Create `.env.production` with:

```env
# ============================================
# NODE
# ============================================
NODE_ENV=production
PORT=5000

# ============================================
# DATABASE
# ============================================
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/attendsmart?retryWrites=true&w=majority

# ============================================
# REDIS (Queue)
# ============================================
REDIS_URL=rediss://<user>:<password>@<host>:<port>

# ============================================
# FACE ENGINE (Python)
# ============================================
FACE_ENGINE_URL=http://face-engine:5050
FACE_CONFIDENCE_THRESHOLD=0.6

# ============================================
# JWT
# ============================================
JWT_SECRET=<generate-32-char-secret>
JWT_EXPIRE=7d

# ============================================
# DEVICE LOCK
# ============================================
DEVICE_LOCK_ENABLED=true
```

---

## Deployment Steps

### 1. Build Docker Images

```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Or build individually
docker build -t attendsmart-face-engine ./face-engine
```

### 2. Start Services

```bash
# Production stack
docker-compose -f docker-compose.prod.yml up -d

# Verify all services running
docker-compose ps
```

### 3. Run Migrations

```bash
# Reset biometric data (forces re-enrollment)
cd backend
node scripts/reset-biometric-enrollment.js
```

### 4. Verify Health

```bash
# Check API health
curl http://localhost:5000/api/health

# Check face-engine
curl http://localhost:5050/health

# Check Redis
docker exec attendsmart-redis redis-cli ping
```

---

## Load Testing

### Run k6 Test

```bash
# Install k6: https://k6.io/docs/getting-started/installation
k6 run loadtest/rush_hour.js

# With custom base URL
k6 run -e BASE_URL=http://api.attendsmart.com loadtest/rush_hour.js
```

### Monitor Queue

```bash
# Start Bull-Board dashboard
node backend/dashboard/queueDashboard.js

# Open: http://localhost:3001/admin/queues
```

---

## Verification Checks

- [ ] API returns 200 on `/api/health`
- [ ] Queue health shows `status: healthy`
- [ ] Face-engine `/health` returns 200
- [ ] Database connected
- [ ] Redis connected
- [ ] k6 test passes all thresholds

---

## Rollback Plan

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore previous version
docker-compose -f docker-compose.prod.yml up -d --no-build
```

---

## Support Contacts

- DevOps:
- Backend:
- Mobile:

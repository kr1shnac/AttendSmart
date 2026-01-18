# Face Engine & Redis Deployment Guide

Complete deployment instructions for the critical infrastructure services required for production.

---

## 1. Face Engine Microservice

The face-engine is a Python Flask service that handles face verification using dlib/face_recognition.

### Option A: Local Docker Deployment (Development)

```bash
# From project root
cd face-engine

# Build the Docker image
docker build -t attendsmart-face-engine .

# Run the container
docker run -d \
  --name face-engine \
  -p 5050:5050 \
  -e FACE_CONFIDENCE_THRESHOLD=0.6 \
  attendsmart-face-engine

# Verify it's running
curl http://localhost:5050/health
```

**Expected Response:**

```json
{
  "status": "healthy",
  "service": "face-engine",
  "version": "1.0.0",
  "confidence_threshold": 0.6
}
```

### Option B: Docker Compose (Recommended for Development)

```bash
# From project root
docker-compose up -d face-engine

# Check status
docker-compose ps
docker-compose logs face-engine
```

### Option C: Cloud Deployment (Production)

#### AWS ECS / Fargate

1. Push to ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker tag attendsmart-face-engine:latest <account>.dkr.ecr.us-east-1.amazonaws.com/attendsmart-face-engine:latest

docker push <account>.dkr.ecr.us-east-1.amazonaws.com/attendsmart-face-engine:latest
```

2. Create ECS Service with:
   - Memory: 512MB
   - CPU: 0.5 vCPU
   - Port: 5050
   - Health check: `/health`

#### Google Cloud Run

```bash
gcloud run deploy face-engine \
  --image gcr.io/your-project/attendsmart-face-engine \
  --port 5050 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated
```

#### Render.com (Easy Option)

1. Create new Web Service
2. Connect GitHub repo
3. Set root directory: `face-engine`
4. Docker runtime
5. Set PORT=5050

### Backend Configuration

Update `.env` or `.env.production`:

```env
FACE_ENGINE_URL=http://localhost:5050
# Or for cloud:
FACE_ENGINE_URL=https://face-engine.your-domain.com
FACE_CONFIDENCE_THRESHOLD=0.6
```

### Fallback Behavior

If face-engine is not available, the backend will:

1. Log a warning
2. Skip real face verification
3. Use frontend-only MediaPipe verification
4. Mark attendance with reduced confidence

---

## 2. Redis Configuration

Redis is required for the BullMQ job queue (high-concurrency attendance processing).

### Option A: Local Docker (Development)

```bash
# Using Docker Compose (recommended)
docker-compose up -d redis

# Or standalone
docker run -d \
  --name attendsmart-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes
```

### Option B: Upstash (Free Tier - Production)

1. Go to https://upstash.com
2. Create a Redis database
3. Copy the connection string

```env
# In .env.production
REDIS_URL=rediss://default:YOUR_PASSWORD@us1-xxxxx.upstash.io:6379
```

**Free Tier Limits:**

- 10,000 commands/day
- 256MB storage
- Sufficient for ~500 students/day

### Option C: AWS ElastiCache

1. Create Redis cluster
2. Use VPC peering with your backend

```env
REDIS_URL=redis://my-redis.xxxxx.cache.amazonaws.com:6379
```

### Option D: Railway / Render

Both offer managed Redis with generous free tiers:

- Railway: 500MB free
- Render: 25MB free (sufficient for queue)

### Backend Configuration

Update `.env`:

```env
# Local development
REDIS_URL=redis://localhost:6379

# Production (Upstash)
REDIS_URL=rediss://default:password@host:port
```

### Health Check

The `/api/health` endpoint reports Redis status:

```json
{
  "status": "healthy",
  "queue": {
    "status": "connected",
    "pending": 5,
    "active": 2
  }
}
```

### Fallback Behavior

If Redis is not available:

1. Queue service logs warning
2. Falls back to synchronous processing
3. Higher latency under load
4. Still functional for normal usage

---

## Quick Start Checklist

### Development (Local)

```bash
# 1. Start Docker services
docker-compose up -d

# 2. Verify services
curl http://localhost:5050/health  # Face engine
docker exec attendsmart-redis redis-cli ping  # Redis

# 3. Start backend
cd backend
npm run dev

# 4. Check health
curl http://localhost:5000/api/health
```

### Production

- [ ] Deploy face-engine to cloud (ECS, Cloud Run, or Render)
- [ ] Set up Upstash Redis (or ElastiCache)
- [ ] Update environment variables
- [ ] Test health endpoint
- [ ] Monitor logs for connection errors

---

## Troubleshooting

### Face Engine Issues

| Problem                     | Solution                              |
| --------------------------- | ------------------------------------- |
| Container exits immediately | Check logs: `docker logs face-engine` |
| 'No face detected' errors   | Improve image quality, lighting       |
| High latency                | Increase container resources          |
| Connection refused          | Check firewall, verify URL            |

### Redis Issues

| Problem               | Solution                       |
| --------------------- | ------------------------------ |
| ECONNREFUSED          | Redis not running or wrong URL |
| Authentication failed | Check password in REDIS_URL    |
| SSL errors            | Use `rediss://` for Upstash    |
| Memory errors         | Increase Redis memory limit    |

---

## Environment Variables Summary

```env
# Face Engine
FACE_ENGINE_URL=http://localhost:5050
FACE_CONFIDENCE_THRESHOLD=0.6

# Redis
REDIS_URL=redis://localhost:6379

# Production Example
FACE_ENGINE_URL=https://face-engine.render.com
REDIS_URL=rediss://default:xxxxx@upstash.io:6379
```

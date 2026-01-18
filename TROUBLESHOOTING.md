# Troubleshooting Guide

## ❌ Issue: "ERR_CONNECTION_REFUSED" on Login

### **Cause**: Backend server not running

### **Fix**:

```bash
# Open a NEW terminal
cd backend
npm run dev

# Should see:
# 🚀 AttendSmart Server Started Successfully!
# 📍 Server: http://localhost:5000
```

**Keep this terminal open!**

---

## ❌ Issue: ESLint "unused vars" errors

### **Cause**: Icons imported but not yet used in JSX

### **Fix**: Temporarily commented out icon imports (will add them when we update UI components)

---

## ✅ How to Test Login Now

### Terminal Setup:

```bash
# Terminal 1 - Backend (MUST BE RUNNING!)
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### Test Teacher Login:

1. Open http://localhost:3000
2. Click "Teacher" tab
3. Email: `rajesh.kumar@attendsmart.com`
4. Password: `Teacher@123`
5. Click "Access System"

### Test Student Login:

1. Click "Student" tab
2. Click "Manual Login"
3. USN: `1MS21CS001`
4. DOB: `2002-12-13` (from latest seed)
5. Click "Access System"

---

## 🔍 Common Errors Explained

### `POST http://localhost:5000/api/auth/login net::ERR_CONNECTION_REFUSED`

- **Meaning**: Backend not running
- **Fix**: Start backend with `npm run dev`

### `POST http://localhost:3000/api/logs 404 (Not Found)`

- **Meaning**: Logging trying wrong port (harmless for now)
- **Impact**: Logs won't save, but login still works
- **Fix later**: Optional - not critical

### Chrome extension errors (`pejdijmoenmkgeppbflobdenhhabjlaj`)

- **Meaning**: Password manager extension issue
- **Impact**: None - completely ignore these
- **Fix**: Not needed

---

## ✅ Success Indicators

When backend is running, you'll see:

```
🚀 AttendSmart Server Started Successfully!
📍 Server: http://localhost:5000
💾 Database: Connected
```

When login works, you'll see:

- Redirect to dashboard
- No "ERR_CONNECTION_REFUSED" errors
- Welcome message with your name

---

## ❌ Issue: "Data Not Loading" or Network Errors

### **Causes**:

1. Backend server not running
2. MongoDB Atlas connection timeout
3. Missing or incorrect environment variables

### **Diagnostic Steps**:

#### 1. Check Backend Health

```powershell
# Run this in PowerShell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

Expected response:

```json
{
  "status": "healthy",
  "database": { "connected": true, "status": "connected" }
}
```

#### 2. Check Backend Terminal

Look for these messages:

```
✅ MongoDB Connected Successfully
📍 Host: ac-wiy7w*.mongodb.net
📦 Cache service initialized
🚀 AttendSmart Server Started Successfully!
```

### **Common Fixes**:

| Issue               | Symptom                       | Fix                                                            |
| ------------------- | ----------------------------- | -------------------------------------------------------------- |
| Backend not started | "ERR_CONNECTION_REFUSED"      | Run `npm run dev` in backend folder                            |
| MongoDB timeout     | Very slow loading, then error | Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0)             |
| Missing .env        | "MONGODB_URI not defined"     | Copy `.env.example` to `.env` and fill in values               |
| Wrong API URL       | "Network Error" on frontend   | Set `REACT_APP_API_URL=http://localhost:5000` in frontend/.env |

### **MongoDB Atlas Checklist**:

1. ✅ IP Address whitelisted (0.0.0.0/0 for development)
2. ✅ Database user has correct password
3. ✅ Connection string copied correctly to `.env`
4. ✅ Network allows outbound connections on port 27017

---

## 🔧 Configuration Files

### Backend `.env` (Required Variables):

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/attendsmart
JWT_SECRET=your-secure-secret
PORT=5000
```

### Frontend `.env` (Required Variables):

```env
REACT_APP_API_URL=http://localhost:5000
```

**Note**: See `.env.example` files for complete configuration templates.

---

## 🔄 Connection Auto-Recovery

The application includes production-grade connection handling:

- **Automatic Reconnection**: MongoDB reconnects automatically after network issues
- **Retry Logic**: API calls retry up to 3 times with exponential backoff
- **Heartbeat**: Database connection checked every 30 seconds
- **Graceful Fallback**: Cache service falls back to in-memory if Redis unavailable

If you see "Reconnecting..." messages, the system is recovering automatically. Just wait a few seconds.

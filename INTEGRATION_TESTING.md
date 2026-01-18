# AttendSmart Integration Testing Guide

This guide walks through comprehensive testing of all core features to verify backend-frontend integration is working correctly.

## Prerequisites

- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:3000`
- MongoDB connected and accessible
- `.env` files configured in both backend and frontend

## Test Environment Setup

### 1. Check Backend Health

```bash
curl -X GET http://localhost:5000/api/health
```

**Expected Response:**

```json
{
  "status": "success",
  "message": "AttendSmart API is running",
  "timestamp": "2025-11-19T10:00:00.000Z",
  "environment": "development"
}
```

### 2. Check Frontend Loads

Open browser to `http://localhost:3000` and verify:

- [ ] Login page appears
- [ ] Console has no network errors
- [ ] Network tab shows `/api/health` succeeds

---

## Core Integration Tests

### Test 1: Authentication Flow

**Objective**: Verify login, JWT token generation, and user profile retrieval

#### 1.1 Login with Valid Credentials

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePassword123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "user-id",
      "name": "Student Name",
      "email": "student@example.com",
      "role": "student",
      "usn": "1MS21CS001"
    }
  },
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

**Store Token**: Copy the token for subsequent requests

#### 1.2 Get Profile with JWT Token

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_1.2>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "_id": "user-id",
      "name": "Student Name",
      "email": "student@example.com",
      "role": "student",
      "usn": "1MS21CS001"
    }
  },
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

**Frontend Verification:**

- [ ] Login page accepts credentials
- [ ] Redirects to dashboard after successful login
- [ ] Token stored in localStorage
- [ ] Profile page loads with real user data (no hardcoded "Test Student")

---

### Test 2: Class Discovery

**Objective**: Verify teacher can create class, student can discover it

#### 2.1 Teacher Creates Class (Teacher JWT Required)

```bash
curl -X POST http://localhost:5000/api/classes \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "className": "Data Structures - Section A",
    "subject": "Data Structures",
    "courseCode": "CS301",
    "semester": 5,
    "schedule": [
      {
        "day": "Monday",
        "startTime": "09:00",
        "endTime": "10:00",
        "room": "Room 301"
      }
    ]
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Class created successfully",
  "data": {
    "class": {
      "_id": "class-id",
      "className": "Data Structures - Section A",
      "subject": "Data Structures",
      "courseCode": "CS301",
      "semester": 5,
      "teacher": "teacher-user-id"
    }
  }
}
```

**Store Class ID**: Note the `class._id` for session creation

#### 2.2 Student Retrieves My Classes

```bash
curl -X GET http://localhost:5000/api/classes/my-classes \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "classes": [
      {
        "_id": "class-id",
        "className": "Data Structures - Section A",
        "subject": "Data Structures",
        "courseCode": "CS301",
        "teacher": {
          "_id": "teacher-id",
          "name": "Prof. Smith"
        }
      }
    ]
  }
}
```

**Frontend Verification:**

- [ ] StudentHome displays real classes from API (no mock classes fallback)
- [ ] ClassSelector shows created class in dropdown
- [ ] No hardcoded "demo-class-1" appears

---

### Test 3: Session Creation & Discovery

**Objective**: Verify teacher can create session, student can discover active sessions

#### 3.1 Teacher Creates Session

```bash
curl -X POST http://localhost:5000/api/sessions \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "class-id-from-test-2.1",
    "topic": "Binary Search Trees",
    "startTime": "2025-11-19T09:00:00Z",
    "endTime": "2025-11-19T10:00:00Z",
    "room": "Room 301",
    "location": {
      "latitude": 12.9716,
      "longitude": 77.5946
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Session created successfully",
  "data": {
    "session": {
      "_id": "session-id",
      "class": "class-id",
      "topic": "Binary Search Trees",
      "status": "scheduled",
      "startTime": "2025-11-19T09:00:00Z"
    }
  }
}
```

**Store Session ID**: Note the `session._id` for starting session

#### 3.2 Teacher Starts Session

```bash
curl -X POST http://localhost:5000/api/sessions/session-id/start \
  -H "Authorization: Bearer <TEACHER_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Session started",
  "data": {
    "session": {
      "_id": "session-id",
      "status": "live",
      "startTime": "2025-11-19T09:00:00Z"
    }
  }
}
```

#### 3.3 Student Retrieves Active Sessions

```bash
curl -X GET http://localhost:5000/api/ble/sessions/active \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "sessions": [
      {
        "_id": "session-id",
        "activeSession": {
          "sessionName": "Data Structures - Binary Search Trees",
          "room": "Room 301",
          "startTime": "2025-11-19T09:00:00Z"
        }
      }
    ]
  }
}
```

**Frontend Verification:**

- [ ] StudentHome displays active session (not mock demo sessions)
- [ ] BLEScanner shows real session ID (not hardcoded "demo-session")
- [ ] Session details match API response exactly

---

### Test 4: Multi-Modal Verification Flow

**Objective**: Verify complete attendance marking with GPS + BLE + Face verification

#### 4.1 Student Starts Check-in

```bash
curl -X POST http://localhost:5000/api/attendance/start-checkin \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-id-from-test-3.1",
    "platform": "web"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Check-in started",
  "data": {
    "attendanceId": "attendance-id",
    "nextStep": "gps"
  }
}
```

**Store Attendance ID**: Note this for subsequent verification steps

#### 4.2 Verify GPS Location

```bash
curl -X POST http://localhost:5000/api/attendance/verify-gps \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "attendanceId": "attendance-id-from-4.1",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 10
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "GPS verified",
  "data": {
    "verified": true,
    "distance": 0.5,
    "nextStep": "ble"
  }
}
```

**Frontend Verification:**

- [ ] GPS permission request appears
- [ ] Coordinates captured from device
- [ ] No fallback to mock GPS data

#### 4.3 Verify BLE Proximity

```bash
curl -X POST http://localhost:5000/api/attendance/verify-ble \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "attendanceId": "attendance-id-from-4.1",
    "deviceId": "beacon-device-id",
    "rssi": -55
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "BLE verified",
  "data": {
    "verified": true,
    "distance": "2.5m",
    "nextStep": "biometric"
  }
}
```

**Frontend Verification:**

- [ ] BLE scan executes (not mock simulateBLEScanning)
- [ ] RSSI values from real beacons captured
- [ ] Distance calculation matches API

#### 4.4 Verify Biometric (Face Recognition)

```bash
curl -X POST http://localhost:5000/api/biometric/verify-face \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -F "faceImage=@/path/to/face.jpg"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Face verified",
  "data": {
    "verified": true,
    "confidence": 95,
    "faceDetected": true,
    "livenessCheck": true
  }
}
```

**Frontend Verification:**

- [ ] Face recognition calls real API (not mock WebAuthn fallback)
- [ ] Real-time video feed shows for face capture
- [ ] Confidence score displayed (95% not hardcoded 100%)

#### 4.5 Complete Verification

```bash
curl -X POST http://localhost:5000/api/attendance/verify-biometric \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "attendanceId": "attendance-id-from-4.1",
    "biometricType": "face",
    "confidence": 95,
    "biometricDataId": "biometric-id"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Check-in completed",
  "data": {
    "attendance": {
      "_id": "attendance-id",
      "status": "present",
      "verificationScore": 94,
      "method": "GPS+BLE+Face",
      "checkInTime": "2025-11-19T09:05:00Z"
    }
  }
}
```

**Database Verification:**

```bash
db.attendances.findOne({ _id: ObjectId("attendance-id") })
```

Should show:

- `status: "present"`
- `verificationData` with all three methods verified
- `checkInTime` populated with current timestamp

---

### Test 5: Attendance History & Analytics

**Objective**: Verify attendance data persists and is accurately retrieved

#### 5.1 Student Retrieves Attendance History

```bash
curl -X GET http://localhost:5000/api/attendance/history \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "history": [
      {
        "_id": "attendance-id",
        "status": "present",
        "checkInTime": "2025-11-19T09:05:00Z",
        "verificationMethod": "GPS+BLE+Face"
      }
    ],
    "summary": {
      "total": 1,
      "present": 1,
      "absent": 0,
      "percentage": 100
    }
  }
}
```

**Frontend Verification:**

- [ ] StudentHistory displays API data (no mock `attendanceHistory` array)
- [ ] Attendance percentage calculated correctly
- [ ] Subject-wise breakdown matches API response

#### 5.2 Teacher Gets Live Attendance

```bash
curl -X GET http://localhost:5000/api/attendance/live/session-id \
  -H "Authorization: Bearer <TEACHER_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "attendanceList": [
      {
        "student": {
          "_id": "student-id",
          "name": "Student Name",
          "usn": "1MS21CS001"
        },
        "status": "present",
        "checkInTime": "09:05 AM",
        "verificationMethod": "GPS+BLE+Face"
      }
    ],
    "summary": {
      "total": 60,
      "present": 1,
      "absent": 59,
      "attendancePercentage": 1.67
    }
  }
}
```

**Frontend Verification:**

- [ ] LiveMonitor displays real student check-ins (no simulateLiveCheckIns)
- [ ] Real-time updates via Socket.IO when students check in
- [ ] Verification methods displayed accurately

#### 5.3 Get Analytics Dashboard

```bash
curl -X GET http://localhost:5000/api/dashboard/teacher \
  -H "Authorization: Bearer <TEACHER_TOKEN>"
```

**Expected Response:**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "overview": {
      "totalSessions": 1,
      "studentCount": 60,
      "avgAttendance": 1.67
    },
    "classWise": [
      {
        "className": "Data Structures - Section A",
        "avgAttendance": 1.67,
        "sessions": 1
      }
    ],
    "recentAttendance": [...]
  }
}
```

**Frontend Verification:**

- [ ] TeacherAnalytics displays real data from API
- [ ] No mock `analyticsData` array used
- [ ] Charts render with actual database values

---

### Test 6: Error Handling

**Objective**: Verify proper error responses and status codes

#### 6.1 Invalid Credentials

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "WrongPassword"
  }'
```

**Expected Response** (HTTP 400):

```json
{
  "success": false,
  "status": "error",
  "message": "Invalid email or password",
  "error": "INVALID_CREDENTIALS",
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

#### 6.2 Unauthorized (No Token)

```bash
curl -X GET http://localhost:5000/api/classes/my-classes
```

**Expected Response** (HTTP 401):

```json
{
  "success": false,
  "status": "error",
  "message": "Not authorized to access this route",
  "error": "UNAUTHORIZED",
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

#### 6.3 Invalid Token

```bash
curl -X GET http://localhost:5000/api/classes/my-classes \
  -H "Authorization: Bearer invalid.token.here"
```

**Expected Response** (HTTP 401):

```json
{
  "success": false,
  "status": "error",
  "message": "Invalid token",
  "error": "INVALID_TOKEN",
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

**Frontend Verification:**

- [ ] Axios interceptor catches 401 errors
- [ ] User redirected to login page on 401
- [ ] localStorage token cleared on 401
- [ ] Error messages displayed to user (no silent failures)

#### 6.4 Session Not Found

```bash
curl -X GET http://localhost:5000/api/sessions/invalid-session-id \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response** (HTTP 404):

```json
{
  "success": false,
  "status": "error",
  "message": "Session not found",
  "error": "NOT_FOUND",
  "timestamp": "2025-11-19T10:00:00.000Z"
}
```

---

## Checklist: Production Readiness

### Frontend

- [ ] No hardcoded `"test"`, `"demo"`, or `"mock"` in component JSX
- [ ] All data displayed comes from API responses
- [ ] Loading states appear while fetching
- [ ] Error messages shown on API failures
- [ ] Token persists in localStorage
- [ ] Logout clears token and redirects to login
- [ ] Axios interceptor handles 401 auto-logout

### Backend

- [ ] All endpoints return standardized format: `{success, status, message, data, error}`
- [ ] HTTP status codes correct: 200, 201, 400, 401, 403, 404, 409, 500
- [ ] All protected routes checked with `protect` middleware
- [ ] Role-based access enforced: `restrictTo("student")`, `restrictTo("teacher")`
- [ ] No error messages leak sensitive information
- [ ] JWT tokens expire after configured time
- [ ] MongoDB queries use indexes on frequently searched fields
- [ ] CORS allows only frontend origin
- [ ] Rate limiting applied to sensitive endpoints (login, biometric)

### Database

- [ ] 0 hardcoded mock records in seeding
- [ ] Mongoose schemas validated on create/update
- [ ] All foreign keys use proper `ref` relationships
- [ ] Indexes created on frequently queried fields
- [ ] No circular references in population chains

### Security

- [ ] Passwords hashed with bcrypt (salt rounds >= 12)
- [ ] JWT secrets stored in `.env` (never in code)
- [ ] HTTPS enforced in production
- [ ] API rate limiting active
- [ ] Sensitive data not logged or transmitted in plain text
- [ ] `.env` files in `.gitignore`
- [ ] No secrets in `.git` history

---

## Troubleshooting

### Issue: Frontend shows "Loading..." permanently

**Solution**:

1. Check browser console for network errors
2. Verify backend is running: `curl http://localhost:5000/api/health`
3. Check Network tab: Are API calls being made?
4. Check `.env` in frontend: Is `REACT_APP_API_BASE_URL` correct?

### Issue: 401 Unauthorized on authenticated endpoints

**Solution**:

1. Verify token is stored in localStorage: `localStorage.getItem('token')`
2. Check Axios interceptor adds `Authorization: Bearer <token>` header
3. Verify JWT secret in backend `.env` matches token generation
4. Check token hasn't expired: decode at `https://jwt.io`

### Issue: Attendance marked but not appearing in history

**Solution**:

1. Verify attendance record created: `db.attendances.findOne()`
2. Check session ID in attendance matches active session
3. Verify API response includes attendance in history query
4. Check frontend is calling correct endpoint: `/api/attendance/history`

### Issue: BLE verification always fails

**Solution**:

1. Verify beacon device is powered and broadcasting
2. Check RSSI value received: Should be between -90 and -30
3. Verify geofence location set in session creation
4. Check BLE permissions granted on client device

---

## Performance Benchmarks

Expected response times (developer machine):

- Login: < 200ms
- Fetch classes: < 150ms
- Create session: < 300ms
- Mark attendance: < 500ms (GPS + BLE + Face)
- Get analytics: < 400ms

If exceeding these, check:

- Database indexes on frequently queried fields
- Unnecessary population of relationships in queries
- Large arrays being returned instead of paginated results

---

**Last Updated**: November 2025  
**Status**: Ready for Production Testing

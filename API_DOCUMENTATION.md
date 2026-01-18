# AttendSmart API Documentation

## Base URL

```
Development: http://localhost:5000
Production: https://api.attendsmart.com
```

## Authentication

All endpoints except login and health check require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

## Response Format

### Success Response

```json
{
  "success": true,
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response payload
  }
}
```

### Error Response

```json
{
  "success": false,
  "status": "error",
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

## HTTP Status Codes

- **200**: OK - Request succeeded
- **201**: Created - Resource created successfully
- **400**: Bad Request - Invalid parameters or validation error
- **401**: Unauthorized - Authentication required or token invalid
- **403**: Forbidden - Permission denied
- **404**: Not Found - Resource not found
- **409**: Conflict - Resource already exists
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Internal Server Error - Server-side error

---

# API Endpoints

## Authentication

### Login

**POST** `/api/auth/login`

Authenticate user and receive JWT token.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "student"
    }
  }
}
```

### Get Profile

**GET** `/api/auth/profile`

Retrieve current authenticated user's profile.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "user": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "student",
      "usn": "1MS21CS001"
    }
  }
}
```

### Verify Token

**GET** `/api/auth/verify`

Verify if the current JWT token is valid.

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Token is valid"
}
```

---

## Classes

### Get My Classes

**GET** `/api/classes/my-classes`

Get all classes assigned to current user (student) or taught by teacher.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "classes": [
      {
        "_id": "class-id",
        "className": "CSE 3rd Year Section A",
        "subject": "Data Structures",
        "courseCode": "CS301",
        "semester": 5,
        "totalStudents": 60,
        "teacher": { "_id": "teacher-id", "name": "Prof. Smith" }
      }
    ]
  }
}
```

### Get Class Details

**GET** `/api/classes/:classId`

Get detailed information about a specific class.

**Parameters**

- `classId` (path): Class ID

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "class": {
      "_id": "class-id",
      "className": "CSE 3rd Year Section A",
      "subject": "Data Structures",
      "courseCode": "CS301",
      "semester": 5,
      "totalStudents": 60,
      "students": [
        { "_id": "student-id", "name": "Alice", "usn": "1MS21CS001" }
      ],
      "schedule": [
        {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "10:00",
          "room": "Room 301"
        }
      ]
    }
  }
}
```

### Create Class (Teacher/Admin)

**POST** `/api/classes`

Create a new class.

**Request Body**

```json
{
  "className": "CSE 3rd Year Section A",
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
}
```

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Class created successfully",
  "data": {
    "class": { "_id": "new-class-id", ... }
  }
}
```

---

## Sessions

### Get My Sessions

**GET** `/api/sessions/my-sessions`

Get all sessions for current user.

**Query Parameters**

- `status` (optional): Filter by status (live, completed, scheduled, cancelled)
- `classId` (optional): Filter by class ID

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "sessions": [
      {
        "_id": "session-id",
        "class": { "_id": "class-id", "subject": "Data Structures" },
        "startTime": "2025-11-19T09:00:00Z",
        "endTime": "2025-11-19T10:00:00Z",
        "status": "live",
        "location": { "latitude": 12.9716, "longitude": 77.5946 },
        "attendanceCount": 45,
        "expectedCount": 60
      }
    ]
  }
}
```

### Get Active Sessions

**GET** `/api/ble/sessions/active`

Get active sessions nearby student's current location.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "sessions": [
      {
        "_id": "session-id",
        "activeSession": {
          "sessionName": "Data Structures",
          "room": "Room 301",
          "startTime": "2025-11-19T09:00:00Z"
        },
        "userId": { "_id": "teacher-id", "name": "Prof. Smith" }
      }
    ]
  }
}
```

### Create Session

**POST** `/api/sessions`

Create a new session (teacher only).

**Request Body**

```json
{
  "classId": "class-id",
  "startTime": "2025-11-19T09:00:00Z",
  "endTime": "2025-11-19T10:00:00Z",
  "topic": "Binary Search Trees",
  "room": "Room 301",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}
```

### Start Session

**POST** `/api/sessions/:sessionId/start`

Mark session as live and start accepting check-ins.

### End Session

**POST** `/api/sessions/:sessionId/end`

Mark session as completed.

---

## Attendance

### Mark Attendance

**POST** `/api/attendance/mark`

Mark student attendance with multi-modal verification.

**Request Body**

```json
{
  "sessionId": "session-id",
  "verifications": {
    "gps": {
      "verified": true,
      "latitude": 12.9716,
      "longitude": 77.5946,
      "accuracy": 10
    },
    "ble": {
      "verified": true,
      "rssi": -55,
      "distance": 2.5
    },
    "biometric": {
      "verified": true,
      "method": "face",
      "confidence": 95
    }
  }
}
```

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Attendance marked successfully",
  "data": {
    "attendance": {
      "_id": "attendance-id",
      "student": "student-id",
      "session": "session-id",
      "status": "present",
      "verificationMethod": "GPS+BLE+Face",
      "confidence": 94,
      "checkInTime": "2025-11-19T09:05:00Z"
    }
  }
}
```

### Get Attendance History

**GET** `/api/attendance/history`

Get current student's attendance history.

**Query Parameters**

- `month` (optional): Filter by month (current, last, all)
- `subject` (optional): Filter by course code
- `page` (optional): Pagination page number

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "history": [
      {
        "_id": "attendance-id",
        "session": { "class": "Data Structures", "date": "2025-11-15" },
        "status": "present",
        "checkInTime": "09:05 AM",
        "verificationMethod": "Face+BLE+GPS"
      }
    ],
    "summary": {
      "total": 40,
      "present": 34,
      "absent": 6,
      "percentage": 85
    }
  }
}
```

### Get Attendance Statistics

**GET** `/api/attendance/statistics`

Get attendance statistics for analytics.

**Query Parameters**

- `classId` (optional): Filter by class
- `dateRange` (optional): month, semester, year

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "overview": {
      "totalSessions": 120,
      "avgAttendance": 87,
      "totalClasses": 8
    },
    "classWise": [
      {
        "class": "CS301 - Data Structures",
        "attendance": 92,
        "sessions": 18,
        "students": 60
      }
    ]
  }
}
```

---

## Biometric

### Enroll Face

**POST** `/api/biometric/enroll-face`

Enroll student's face for future verification.

**Request Body** (multipart/form-data)

- `faceImage` (file): Face image file

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Face enrolled successfully",
  "data": {
    "enrollment": {
      "_id": "biometric-id",
      "userId": "student-id",
      "type": "face",
      "enrolledAt": "2025-11-19T10:00:00Z"
    }
  }
}
```

### Verify Face

**POST** `/api/biometric/verify-face`

Verify student's identity using face recognition.

**Request Body** (multipart/form-data)

- `faceImage` (file): Face image to verify

**Response**

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

### Verify Fingerprint

**POST** `/api/biometric/verify-fingerprint`

Verify using WebAuthn fingerprint (uses device hardware).

**Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Fingerprint verified",
  "data": {
    "verified": true,
    "confidence": 99,
    "method": "webauthn"
  }
}
```

---

## BLE (Bluetooth Low Energy)

### Scan for Beacons

**GET** `/api/ble/scan`

Scan and detect nearby BLE beacons.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "devices": [
      {
        "id": "beacon-1",
        "name": "ClassroomBeacon",
        "uuid": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
        "rssi": -55,
        "distance": 2.5,
        "isWithinRange": true
      }
    ]
  }
}
```

### Record Proximity

**POST** `/api/ble/scan/record`

Record proximity detection for attendance verification.

**Request Body**

```json
{
  "beaconUUID": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "beaconDeviceId": "beacon-1",
  "sessionId": "session-id",
  "rssi": -55,
  "txPower": -59
}
```

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "proximity": {
      "distance": 2.5,
      "signalQuality": "good",
      "withinGeofence": true,
      "confidence": 85
    }
  }
}
```

### Verify BLE Proximity

**GET** `/api/ble/verify?sessionId=:sessionId`

Verify if student is within BLE range of session.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "success": true,
    "confidence": 85,
    "distance": "2.5m",
    "message": "Within range"
  }
}
```

---

## Dashboard & Analytics

### Get Teacher Dashboard

**GET** `/api/dashboard/teacher`

Get teacher dashboard data.

**Query Parameters**

- `classId` (optional): Filter by class
- `dateRange` (optional): month, semester

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "overview": {
      "totalSessions": 20,
      "studentCount": 60,
      "avgAttendance": 87
    },
    "activeSessions": [...],
    "recentAttendance": [...],
    "lowAttendanceStudents": [...]
  }
}
```

### Get Student Dashboard

**GET** `/api/dashboard/student`

Get student dashboard data.

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "stats": {
      "overallAttendance": 85,
      "totalClasses": 40,
      "presentClasses": 34,
      "streak": 5
    },
    "activeSessions": [...],
    "recentAttendance": [...]
  }
}
```

### Get Analytics

**GET** `/api/analytics/dashboard?classId=...&dateRange=...`

Get comprehensive analytics data.

**Query Parameters**

- `classId` (optional): Filter by class
- `dateRange` (optional): month, semester, year

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "overview": {...},
    "classWise": [...],
    "weeklyTrend": {...},
    "topPerformers": [...],
    "lowAttendance": [...]
  }
}
```

---

## Logs

### Get Logs

**GET** `/api/logs?page=1&limit=50&type=login`

Get system audit logs (admin only).

**Query Parameters**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 50)
- `type` (optional): Log type (login, attendance, biometric, error)
- `userId` (optional): Filter by user ID
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response**

```json
{
  "success": true,
  "status": "success",
  "data": {
    "logs": [
      {
        "_id": "log-id",
        "type": "login",
        "user": "student-id",
        "action": "User logged in",
        "timestamp": "2025-11-19T09:00:00Z",
        "metadata": { "ipAddress": "192.168.1.1" }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1500
    }
  }
}
```

---

## Error Codes

| Code                  | Description              | HTTP Status |
| --------------------- | ------------------------ | ----------- |
| `INVALID_CREDENTIALS` | Email/password incorrect | 400         |
| `UNAUTHORIZED`        | No valid token provided  | 401         |
| `FORBIDDEN`           | Permission denied        | 403         |
| `NOT_FOUND`           | Resource not found       | 404         |
| `VALIDATION_ERROR`    | Invalid input parameters | 400         |
| `DUPLICATE_ENTRY`     | Resource already exists  | 409         |
| `RATE_LIMIT_EXCEEDED` | Too many requests        | 429         |
| `SERVER_ERROR`        | Internal server error    | 500         |

---

## Rate Limiting

- **Login**: 5 attempts per minute
- **Biometric**: 10 verifications per minute per user
- **Attendance**: 1 check-in per session per student
- **General API**: 100 requests per 15 minutes

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1637332800
```

---

**Last Updated**: November 2025  
**API Version**: 1.0.0

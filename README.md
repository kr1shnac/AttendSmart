# AttendSmart - AI-Driven Attendance Platform

A production-grade, multi-modal attendance system combining face recognition, Bluetooth Low Energy (BLE) proximity detection, GPS geofencing, and biometric verification to provide proxy-proof attendance tracking.

## 🌟 Features

- **Multi-Modal Verification**

  - Face Recognition + Liveness Detection
  - BLE Beacon Proximity Detection
  - GPS Geofencing (Campus-wide)
  - Biometric Authentication (Fingerprint via WebAuthn)

- **Role-Based Access Control**

  - **Students**: Mark attendance, view history, manage profile
  - **Teachers**: Create sessions, monitor live attendance, view analytics
  - **Admin**: User management, system configuration, comprehensive reporting

- **Real-Time Monitoring**

  - Live attendance dashboard with Socket.IO updates
  - Real-time attendance verification status
  - Alert system for low attendance/suspicious patterns

- **Analytics & Reporting**
  - Per-student attendance trends
  - Class-wise analytics
  - Biometric failure tracking
  - System audit logs

## 🏗️ Project Structure

```
AttendSmartt/
├── frontend/                    # React.js UI
│   ├── src/
│   │   ├── components/         # React components (Auth, Dashboard, etc.)
│   │   ├── services/           # API integration, utilities
│   │   ├── styles/             # CSS (Aurora theme)
│   │   └── utils/              # Helper functions
│   ├── package.json
│   └── .env.example
│
├── backend/                     # Node.js/Express API
│   ├── models/                 # Mongoose schemas
│   ├── controllers/            # Business logic
│   ├── routes/                 # API endpoints
│   ├── middleware/             # Auth, validation, error handling
│   ├── config/                 # Database configuration
│   ├── server.js               # Express app setup
│   ├── package.json
│   └── .env.example
│
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 14.0.0
- **npm** >= 6.0.0
- **MongoDB** >= 4.4 (local or Atlas)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Configure environment variables
# - Set MONGODB_URI
# - Set JWT_SECRET
# - Set FRONTEND_URL

# Start the server
npm run dev

# Server runs on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Configure environment variables
# - Set REACT_APP_API_URL=http://localhost:5000

# Start the development server
npm start

# App runs on http://localhost:3000
```

## 🔑 Environment Variables

### Backend (.env)

| Variable           | Description                   | Example                                 |
| ------------------ | ----------------------------- | --------------------------------------- |
| `NODE_ENV`         | Environment mode              | `development` or `production`           |
| `PORT`             | API server port               | `5000`                                  |
| `MONGODB_URI`      | Database connection string    | `mongodb://localhost:27017/attendsmart` |
| `JWT_SECRET`       | JWT signing key (KEEP SECURE) | `your-secret-key`                       |
| `FRONTEND_URL`     | Frontend origin for CORS      | `http://localhost:3000`                 |
| `CAMPUS_LATITUDE`  | Campus center latitude        | `12.9716`                               |
| `CAMPUS_LONGITUDE` | Campus center longitude       | `77.5946`                               |
| `CAMPUS_RADIUS`    | Geofence radius in meters     | `5000`                                  |

### Frontend (.env)

| Variable                     | Description             | Example                 |
| ---------------------------- | ----------------------- | ----------------------- |
| `REACT_APP_API_URL`          | Backend API endpoint    | `http://localhost:5000` |
| `REACT_APP_ENVIRONMENT`      | Environment mode        | `development`           |
| `REACT_APP_ENABLE_BIOMETRIC` | Enable face recognition | `true`                  |
| `REACT_APP_ENABLE_BLE`       | Enable BLE scanning     | `true`                  |
| `REACT_APP_ENABLE_GPS`       | Enable geofencing       | `true`                  |

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token

### Classes

- `GET /api/classes/my-classes` - Get user's classes
- `GET /api/classes/:classId` - Get class details
- `POST /api/classes` - Create class (teacher/admin)
- `PUT /api/classes/:classId` - Update class
- `DELETE /api/classes/:classId` - Delete class

### Sessions

- `GET /api/sessions/my-sessions` - Get user's sessions
- `GET /api/ble/sessions/active` - Get active nearby sessions
- `POST /api/sessions` - Create session (teacher)
- `POST /api/sessions/:sessionId/start` - Start session
- `POST /api/sessions/:sessionId/end` - End session

### Attendance

- `GET /api/attendance/history` - Get attendance history
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/statistics` - Get attendance stats
- `GET /api/attendance/session/:sessionId/live` - Get live check-ins

### Biometric

- `POST /api/biometric/enroll-face` - Enroll face
- `POST /api/biometric/verify-face` - Verify face
- `POST /api/biometric/verify-fingerprint` - Verify fingerprint
- `GET /api/biometric/statistics` - Get biometric stats

### BLE

- `GET /api/ble/scan` - Start BLE scan
- `POST /api/ble/scan/record` - Record proximity
- `GET /api/ble/verify` - Verify BLE proximity
- `GET /api/ble/devices` - Get registered devices

### Analytics

- `GET /api/analytics/dashboard` - Get analytics dashboard
- `GET /api/dashboard/teacher` - Teacher dashboard
- `GET /api/dashboard/student` - Student dashboard

### Logs

- `GET /api/logs` - Get system logs (admin)
- `GET /api/logs/:logType` - Get logs by type

## 🔐 Security Considerations

1. **JWT Tokens**

   - Tokens are signed with a secret key and expire after 7 days
   - Always use `HTTPS` in production
   - Store tokens securely (httpOnly cookies preferred)

2. **Password Security**

   - Passwords are hashed with bcrypt (salt rounds: 10)
   - Minimum password complexity enforced

3. **CORS Protection**

   - CORS is configured to only allow the frontend domain
   - Credentials are required for cross-origin requests

4. **Rate Limiting**

   - Login endpoints are rate-limited (100 requests per 15 minutes)
   - Biometric verification endpoints have per-user limits

5. **Database Security**

   - Use environment variables for MongoDB credentials
   - Enable MongoDB authentication in production
   - Use MongoDB Atlas with IP whitelisting

6. **Secrets Management**
   - Never commit `.env` files with real secrets
   - Use `.env.example` as a template
   - Rotate JWT_SECRET regularly in production

## 🔄 Response Format

All API responses follow this standardized format:

```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

Error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "error": "error_code"
}
```

## 📝 Database Models

### User

- Stores student, teacher, and admin profiles
- Biometric credentials for face/fingerprint authentication
- Password hashing and login tracking

### Class

- Course/subject information
- Teacher and student associations
- Schedule and room details

### Session

- Active class sessions
- Start/end times and location data
- Expected vs actual attendance

### Attendance

- Individual student attendance records
- Verification method (face, BLE, GPS, etc.)
- Confidence scores and device information

### BiometricData

- Enrolled face templates
- Fingerprint authentication records
- Enrollment and verification timestamps

### BLEScanRecord

- Beacon proximity detections
- RSSI and distance calculations
- Session associations

### Log

- System audit trail
- Login, verification, and error events
- Timestamps and user information

## 🧪 Testing

### Manual Testing Workflow

1. **Login Flow**

   - Create test users (student, teacher) via database
   - Test login with valid/invalid credentials
   - Verify JWT token is stored

2. **Class & Session Management**

   - Create a class (teacher)
   - Create a session for that class
   - Verify session appears in student's active sessions

3. **Attendance Marking**

   - Student initiates check-in
   - Verify GPS location check
   - Complete biometric verification
   - Confirm attendance record created

4. **Analytics**
   - Mark multiple attendances
   - View teacher dashboard
   - Verify attendance trends are calculated

### Automated Testing

```bash
# Backend tests (Jest)
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 🚢 Production Deployment

### Backend Deployment (Heroku, AWS, DigitalOcean)

```bash
# Build for production
npm run build

# Use production environment file
cp .env.production .env

# Deploy using your hosting platform
# Example: heroku create attendsmart-api
#          git push heroku main
```

### Frontend Deployment (Netlify, Vercel, AWS S3)

```bash
# Build React app
npm run build

# Deploy build folder
# Example: netlify deploy --prod --dir=build
```

### MongoDB Atlas Setup

1. Create cluster on MongoDB Atlas
2. Create database user with strong password
3. Add IP whitelist
4. Copy connection string to `MONGODB_URI` in production `.env`

### SSL/HTTPS

- Use Let's Encrypt for free SSL certificates
- Configure HTTPS on backend
- Update `FRONTEND_URL` and `REACT_APP_API_URL` to use HTTPS

## 📊 Monitoring & Observability

- Check system health: `GET /api/health`
- Monitor logs via `/api/logs` endpoints
- Set up log aggregation (ELK, Datadog, etc.) for production
- Configure alerts for high failure rates

## 🤝 Contributing

1. Clone the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m "Add feature"`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 📞 Support

For issues, questions, or support, contact the development team or create an issue in the repository.

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Status**: Production-Ready

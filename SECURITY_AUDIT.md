# AttendSmart Security Audit Checklist

Comprehensive security audit checklist for AttendSmart to ensure production readiness and compliance with security best practices.

## 1. Authentication & Authorization

### Password Security

- [ ] Passwords hashed with bcrypt (verify in User.js model)
  ```bash
  grep -n "bcrypt\|saltRounds" backend/models/User.js
  ```
- [ ] Salt rounds >= 12
- [ ] Passwords never logged or transmitted in plain text
- [ ] Password reset tokens have expiration (15-30 minutes)
- [ ] Password reset links single-use only
- [ ] Password requirements enforced:
  - [ ] Minimum 8 characters
  - [ ] At least one uppercase letter
  - [ ] At least one number
  - [ ] At least one special character

### JWT Security

- [ ] JWT secret is strong (>= 32 characters)
  ```bash
  echo $JWT_SECRET | wc -c  # Should output > 32
  ```
- [ ] JWT secret stored in `.env` (not in code)
  ```bash
  grep -r "JWT_SECRET" backend/ --exclude-dir=node_modules | grep -v ".env"  # Should return nothing
  ```
- [ ] JWT token expiration set appropriately (7-30 days recommended)
- [ ] Refresh token mechanism implemented (if applicable)
- [ ] JWT signing algorithm is HS256 or RS256 (not "none")
- [ ] Token stored in httpOnly cookie OR localStorage
- [ ] Tokens cleared on logout
- [ ] 401 responses force re-authentication

### Role-Based Access Control

- [ ] All protected routes check user role
  ```bash
  grep -r "restrictTo" backend/routes/ | wc -l  # Check for access control
  ```
- [ ] Roles enforced: student, teacher, admin
- [ ] Students cannot access teacher endpoints
- [ ] Teachers cannot access admin endpoints
- [ ] Admin has all permissions
- [ ] No privilege escalation possible

### Session Management

- [ ] Session timeout implemented (10-30 minutes recommended)
- [ ] Session tokens regenerated after login
- [ ] Concurrent session limits (optional but recommended)
- [ ] Session data cleared on logout
- [ ] No session hijacking vulnerabilities

---

## 2. Data Security

### Sensitive Data Protection

- [ ] Passwords never returned in API responses
  ```bash
  grep -r "password" backend/controllers/ --include="*.js" | grep "res.json\|res.send" | wc -l  # Should be 0
  ```
- [ ] API keys/secrets not logged
- [ ] Biometric data encrypted (face descriptors, fingerprints)
- [ ] Personal information (USN, email) protected with encryption
- [ ] Attendance records not publicly accessible

### Data Validation & Sanitization

- [ ] All inputs validated on backend
  ```bash
  grep -r "validator\|joi\|yup" backend/ --include="*.js" | wc -l  # Check for validation library
  ```
- [ ] SQL/NoSQL injection prevention
  ```bash
  # Verify using parameterized queries (Mongoose does this by default)
  grep -r "find(" backend/ --include="*.js" | head -5  # Should use Mongoose methods
  ```
- [ ] XSS prevention (output encoding)
- [ ] CSRF tokens on state-changing operations
- [ ] Rate limiting on sensitive endpoints

### Data Encryption

- [ ] HTTPS/TLS enforced (HTTP redirects to HTTPS)
- [ ] Data at rest encrypted (MongoDB encryption enabled)
- [ ] Biometric data encrypted in database
- [ ] API keys encrypted in `.env`

---

## 3. API Security

### Input Validation

- [ ] Request body size limits enforced
  ```bash
  grep -r "limit:" backend/server.js  # Check body parser limits
  ```
- [ ] File upload size limits enforced
- [ ] File type validation (whitelist only image files)
- [ ] Special character filtering
- [ ] SQL injection prevention verified

### API Response Security

- [ ] Error messages don't leak sensitive info
  ```bash
  grep -r "stack\|stacktrace\|password\|secret\|token" backend/middleware/responseHandler.js
  ```
- [ ] Stack traces hidden in production
- [ ] Generic error messages to clients ("Operation failed")
- [ ] Detailed errors only in logs
- [ ] Response format consistent

### CORS Configuration

- [ ] CORS restricted to frontend origin only
  ```bash
  grep -A5 "cors(" backend/server.js
  ```
- [ ] Credentials allowed only for same-origin
- [ ] Preflight requests handled correctly
- [ ] No wildcard "\*" in CORS origin

### Rate Limiting

- [ ] Rate limiting middleware installed
  ```bash
  grep -r "rateLimit\|rate-limit" backend/ --include="*.js" | wc -l
  ```
- [ ] Applied to login endpoint (5 attempts/minute)
- [ ] Applied to biometric endpoints (10 attempts/minute)
- [ ] Applied to password reset (3 attempts/hour)
- [ ] Rate limit headers sent in response

---

## 4. Infrastructure Security

### HTTPS/SSL/TLS

- [ ] SSL certificate valid and not expired
- [ ] HTTPS enforced (HTTP 301 redirect to HTTPS)
- [ ] TLS 1.2 or higher only
- [ ] Strong cipher suites used
- [ ] Certificate auto-renewal configured

### Security Headers

- [ ] Strict-Transport-Security (HSTS) header set
  ```bash
  curl -I https://api.attendsmart.example.com | grep -i "Strict-Transport"
  ```
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Content-Security-Policy headers configured

### Database Security

- [ ] MongoDB authentication enabled
- [ ] Database users have minimal required permissions
- [ ] No default/weak credentials
- [ ] Database whitelist IPs only (no 0.0.0.0)
- [ ] Encrypted connections to MongoDB (TLS)

### Server Hardening

- [ ] Firewall enabled (UFW, fail2ban)
- [ ] SSH key authentication only (no password login)
- [ ] SSH port changed from default 22 (optional)
- [ ] Unattended security updates enabled
- [ ] No unnecessary services running
- [ ] Regular OS patches applied

---

## 5. Application Security

### Dependency Security

- [ ] No npm packages with known vulnerabilities
  ```bash
  npm audit
  ```
- [ ] Dependencies regularly updated
- [ ] Supply chain attacks mitigated (npm lockfile)
- [ ] No malicious packages installed
- [ ] Production dependencies only (no devDependencies)

### Code Security

- [ ] No hardcoded secrets in code
  ```bash
  grep -r "password\|secret\|token\|key" backend/ --include="*.js" | grep -v ".env\|process.env\|jwt.sign\|findByIdAndUpdate" | wc -l
  ```
- [ ] `.gitignore` includes `.env`, `node_modules/`, keys
- [ ] No secrets in git history
  ```bash
  git log --all --oneline --source -- .env  # Should return nothing
  ```
- [ ] No debugging code in production
- [ ] No console.log in production code

### Logging & Monitoring

- [ ] Failed login attempts logged
- [ ] API errors logged with context
- [ ] Biometric verification attempts logged
- [ ] Sensitive operations audited
- [ ] Logs don't contain sensitive data
- [ ] Log retention policy (90 days minimum)
- [ ] Alerts for suspicious activity

---

## 6. Frontend Security

### XSS Prevention

- [ ] React escapes output by default
- [ ] No `dangerouslySetInnerHTML` used unnecessarily
- [ ] User input sanitized before display
- [ ] CSP headers configured

### CSRF Prevention

- [ ] CSRF tokens used for state changes (if not using SameSite)
- [ ] SameSite cookie flag set
- [ ] Tokens regenerated per session

### Local Storage Security

- [ ] Only non-sensitive data in localStorage (JWT token OK if httpOnly not possible)
- [ ] Sensitive data encrypted if stored client-side
- [ ] localStorage cleared on logout
- [ ] No PII in localStorage

### API Request Security

- [ ] All API calls use HTTPS
- [ ] JWT token in Authorization header (Bearer scheme)
- [ ] Credentials sent only to same origin
- [ ] Axios interceptor handles 401 (redirect to login)

---

## 7. Biometric & Privacy

### Biometric Data Security

- [ ] Face descriptors encrypted in database
- [ ] Face images encrypted or not stored (prefer AWS S3 with encryption)
- [ ] Fingerprint data never stored (use WebAuthn attestation objects only)
- [ ] Biometric data tied only to authenticated user
- [ ] Single face enrollment per user (anti-spoofing)

### Privacy Compliance

- [ ] Privacy policy displays biometric data usage
- [ ] User consent obtained before enrollment
- [ ] Liveness check enforced (smile detection, blink detection)
- [ ] No biometric data shared with third parties
- [ ] Deletion policy: biometric data deleted on user request
- [ ] GDPR compliant (if applicable)

---

## 8. Third-Party Integrations

### AWS S3 (File Uploads)

- [ ] AWS access keys stored in `.env`
- [ ] S3 bucket not publicly readable
- [ ] Server-side encryption enabled
- [ ] Versioning enabled (optional)
- [ ] CORS configured properly

### Email Service

- [ ] SMTP credentials in `.env`
- [ ] TLS/SSL used for SMTP
- [ ] Sensitive data not in emails
- [ ] Email templates sanitized

---

## 9. Testing & Validation

### Security Testing

- [ ] OWASP Top 10 testing completed
- [ ] Penetration testing considered
- [ ] SQL injection tests passed
- [ ] XSS tests passed
- [ ] CSRF tests passed
- [ ] Authentication bypass tests passed

### Validation Testing

- [ ] Boundary value testing (very large numbers, empty strings)
- [ ] Type validation (strings vs numbers)
- [ ] Authorization testing (role-based access)
- [ ] API response schema validation

---

## 10. Incident Response

### Monitoring & Alerts

- [ ] Error tracking (Sentry) configured
- [ ] Failed login alerts
- [ ] Unusual activity detected
- [ ] On-call rotation established
- [ ] Incident response plan documented

### Backup & Recovery

- [ ] Daily automated backups running
- [ ] Backup encryption enabled
- [ ] Backup integrity verified monthly
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined

---

## Security Verification Commands

```bash
# Check for hardcoded secrets
grep -r "password\|secret\|token\|api.key" backend/ --include="*.js" | grep -v ".env\|process.env"

# Check for SQL injection vulnerabilities
grep -r "exec\|query" backend/ --include="*.js" | grep -v "find\|Mongoose"

# Check for insecure dependencies
npm audit

# Check git history for secrets
git log -p | grep -i "password\|secret\|token"

# Check HTTPS configuration
curl -I https://api.attendsmart.example.com | grep -i "strict\|x-content\|x-frame"

# Check rate limiting
curl -X POST http://localhost:5000/api/auth/login -d '...' -w '\nHeaders: %{http_code}\n' -H "X-RateLimit-Remaining"

# Check database connection string
echo $MONGODB_URI | grep "@"  # Should NOT echo plain password if using secrets manager
```

---

## Security Incident Response Plan

### If Security Breach Discovered:

1. **Immediate Actions** (Within 1 hour)

   - [ ] Disable affected user accounts
   - [ ] Rotate all secrets (JWT_SECRET, API keys, DB password)
   - [ ] Check git history for exposed secrets
   - [ ] Review logs for breach scope

2. **Investigation** (Within 4 hours)

   - [ ] Identify root cause
   - [ ] Determine affected users/data
   - [ ] Check for lateral movement
   - [ ] Document timeline

3. **Containment** (Within 24 hours)

   - [ ] Deploy security patches
   - [ ] Update security rules/WAF rules
   - [ ] Block suspicious IPs
   - [ ] Notify users if personal data exposed

4. **Recovery** (Within 48 hours)

   - [ ] Restore from clean backup
   - [ ] Re-enable affected services
   - [ ] Re-authenticate users
   - [ ] Monitor for recurrence

5. **Communication**
   - [ ] Notify affected users
   - [ ] Post-mortem meeting
   - [ ] Update security documentation
   - [ ] Implement preventive measures

---

## Compliance Checklist

- [ ] **GDPR**: Personal data protected, consent obtained, deletion available
- [ ] **SOC 2**: Access controls, encryption, audit logs
- [ ] **OWASP Top 10**: All items mitigated
- [ ] **PCI DSS** (if handling payments): Encryption, access control, monitoring
- [ ] **HIPAA** (if health data): Encryption, audit logs, breach notification

---

**Last Updated**: November 2025  
**Status**: Ready for Security Audit  
**Next Review**: Every quarter or after major updates

---

## To Complete Security Audit:

1. [ ] Run all verification commands above
2. [ ] Perform manual code review (focus on auth, database, API)
3. [ ] Conduct penetration testing (or hire external firm)
4. [ ] Review logs for suspicious activity
5. [ ] Validate incident response plan works
6. [ ] Get sign-off from security team/stakeholder

# AttendSmart Load Testing Guide

## Prerequisites

1. Install k6:

   ```bash
   # Windows (chocolatey)
   choco install k6

   # Or download from: https://k6.io/docs/get-started/installation/
   ```

2. Start your backend:

   ```bash
   cd backend && npm run dev
   ```

3. Create test users (optional, for realistic tests):
   ```bash
   node scripts/create-test-users.js
   ```

---

## Scenarios

### Scenario 1: Sustained Load

Tests 200 concurrent users submitting verifications.

```bash
k6 run --env BASE_URL=http://localhost:5000 loadtest/scenario1_sustained_load.js
```

**Thresholds:**

- p95 latency < 2000ms
- Error rate < 1%

---

### Scenario 2: Concurrent Sessions

Tests 50 simultaneous classes with 20 students each.

```bash
k6 run --env BASE_URL=http://localhost:5000 loadtest/scenario2_concurrent_sessions.js
```

**Thresholds:**

- Session creation p95 < 3000ms
- Nonce errors < 10
- DB connection errors < 5

---

### Scenario 3: Offline Sync Storm

Tests 500 devices syncing 3 verifications each after network restore.

```bash
k6 run --env BASE_URL=http://localhost:5000 loadtest/scenario3_offline_sync.js
```

**Thresholds:**

- Sync p95 < 5000ms
- Duplicates < 10
- Success rate > 95%

---

## Interpreting Results

### Passed ✅

All thresholds met. Ready for canary.

### Failed ❌

Check bottlenecks:

| Issue            | Likely Cause   | Fix                 |
| ---------------- | -------------- | ------------------- |
| High p95 latency | KMS throttling | Add key caching     |
| DB errors        | Pool exhausted | Increase pool size  |
| Nonce errors     | Redis overload | Check TTL cleanup   |
| Duplicates       | Missing dedup  | Add offlineId check |

---

## Environment Variables

| Variable    | Description  | Default                   |
| ----------- | ------------ | ------------------------- |
| BASE_URL    | API endpoint | http://localhost:5000     |
| ADMIN_TOKEN | Admin JWT    | (required for some tests) |

---

## Results

Results are saved to `loadtest/results/`:

- `scenario1_summary.json`
- `scenario2_summary.json`
- `scenario3_summary.json`

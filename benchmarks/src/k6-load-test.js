import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 virtual users
    { duration: '1m', target: 50 },   // Sustained load at 50 virtual users
    { duration: '30s', target: 100 },  // Peak stress test at 100 virtual users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

export default function () {
  // 1. Health check & API documentation
  const healthRes = http.get(`${BASE_URL}/docs`);
  check(healthRes, {
    'docs status 200': (r) => r.status === 200,
  });

  // 2. Create verification request session
  const sessionPayload = JSON.stringify({
    verifierName: `LoadTester-${__VU}`,
    domain: 'loadtest.verify.org',
    request: {
      mode: 'MODE_B',
      revealMask: [false, false, true, false, true, false, false, false],
      requiredAttributes: [2, 4],
      requiredPredicates: [{ index: 5, minThreshold: 300 }],
    },
  });

  const sessionRes = http.post(`${BASE_URL}/v1/sessions`, sessionPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const sessionOk = check(sessionRes, {
    'create session status 201': (r) => r.status === 201,
  });

  if (sessionOk) {
    const sessionData = JSON.parse(sessionRes.body);
    const sessionId = sessionData.sessionId;

    // 3. Holder scans / fetches session details
    const fetchRes = http.get(`${BASE_URL}/v1/sessions/${sessionId}`);
    check(fetchRes, {
      'fetch session status 200': (r) => r.status === 200,
      'session status is PENDING': (r) => JSON.parse(r.body).status === 'PENDING',
    });
  }

  // 4. IPFS CID metadata lookup simulation
  const ipfsCheckRes = http.get(`${BASE_URL}/v1/sessions?limit=5`);
  check(ipfsCheckRes, {
    'list sessions status 200': (r) => r.status === 200,
  });

  sleep(1);
}

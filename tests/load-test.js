// Load test — Month 5.5 (k6)
// Install k6: https://k6.io/docs/get-started/installation
// Run:        k6 run tests/load-test.js
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 50,            // 50 virtual users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

export default function () {
  // Point at your Cloudflare router URL in production.
  http.get('https://your-router-url.workers.dev/health');
  sleep(1);
}

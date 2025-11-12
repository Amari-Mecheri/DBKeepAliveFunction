/**
 * ** Azure Function Timer — keepAlive.js **
 * 
 * Keeps the HTTP-triggered API and database warm to reduce cold starts.
 * Runs every minute; performs:
 *   • LIGHT warmup (API only) every minute → expects HTTP 400
 *   • FULL warmup (API + DB) every N min (WARMUP_INTERVAL_MINUTES) → expects HTTP 200
 * 
 * Env vars:
 *   HTTP_TRIGGER_URL, WARMUP_INTERVAL_MINUTES (2–60, default 5)
 * 
 * Axios handles success/failure via `validateStatus`.
 * Logs duration, status, and errors; rethrows on failure for Azure monitoring.
 */

const { app } = require('@azure/functions');
const axios = require('axios');

const HTTP_TRIGGER_URL = process.env.HTTP_TRIGGER_URL;
const DB_WARMUP_EMAIL = 'warmup-system@artificialbug.com';
const LIGHT_WARMUP_EMAIL = 'ping-api-only';

const HEAVY_WARMUP_INTERVAL = (() => {
  const v = parseInt(process.env.WARMUP_INTERVAL_MINUTES, 10);
  return (v >= 2 && v <= 60) ? v : 5;
})();

app.timer('keepAlive', {
  schedule: '0 * * * * *',
  handler: async (_myTimer, context) => {
    if (!HTTP_TRIGGER_URL) {
      context.log.error('❌ Missing HTTP_TRIGGER_URL');
      return;
    }

    const isHeavy = new Date().getUTCMinutes() % HEAVY_WARMUP_INTERVAL === 0;
    const email = isHeavy ? DB_WARMUP_EMAIL : LIGHT_WARMUP_EMAIL;
    const mode = isHeavy ? 'FULL (API+DB)' : 'LIGHT (API only)';
    const start = Date.now();

    if(!isHeavy) {
      context.log(`🔆 Performed ${mode} warmup...`);
      return;
    };

    try {
      await axios.post(HTTP_TRIGGER_URL, { email }, {
        timeout: 130_000,
        validateStatus: status => (isHeavy ? status === 200 : status === 400)
      });
      const dur = Date.now() - start;
      context.log(`✅ ${mode} warmup OK in ${dur}ms`);
    } catch (err) {
      const dur = Date.now() - start;
      const msg = err.response ? `HTTP ${err.response.status}` : err.message;
      context.log.error(`❌ ${mode} warmup failed in ${dur}ms: ${msg}`);
      throw err;
    }
  }
});
/**
 * Azure Function Timer — keepAlive.js
 * Pings the HTTP API every minute with a dummy invalid email
 * to keep the function warm (cold start mitigation).
 */

import { app } from '@azure/functions';
import axios from 'axios';

const HTTP_TRIGGER_URL = process.env.HTTP_TRIGGER_URL;
const DUMMY_EMAIL = 'keepalive';

let consecutiveFailures = 0;
let skipCount = 0;

app.timer('keepAlive', {
  schedule: '0 * * * * *',
  handler: async (_myTimer, context) => {    
  
    if (skipCount > 0) {
      skipCount--;
      context.log(`⏭️ Skipping ping. Backoff in effect (${consecutiveFailures} min interval). Skips remaining: ${skipCount}.`);
      return;
    }
    
    if (!HTTP_TRIGGER_URL) {
      context.error('❌ Missing HTTP_TRIGGER_URL'); 
      return;
    }

    const start = Date.now();

    try {
      await axios.post(HTTP_TRIGGER_URL, { email: DUMMY_EMAIL }, {
        timeout: 30_000,
        validateStatus: status => status === 400 
      });
      
      const dur = Date.now() - start;
      context.log(`🔆 keepAlive ping OK in ${dur}ms`);
      
      consecutiveFailures = 0; 
      skipCount = 0;
      
    } catch (err) {
      const dur = Date.now() - start;
      const msg = err.response ? `HTTP ${err.response.status}` : err.message;
      
      consecutiveFailures =  Math.min(consecutiveFailures+1, 5);
      skipCount = consecutiveFailures; 

      context.error(`❌ keepAlive ping failed (${consecutiveFailures} consecutive). Next interval: ${skipCount + 1} min (Skips: ${skipCount}). Error: ${msg}`);      
    }
  }
});
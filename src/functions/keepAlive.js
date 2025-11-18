/**
 * Azure Function Timer — keepAlive.js
 *
 * Executes a periodic health check (ping) call to the HTTP endpoint.
 *
 * If PING_REQUEST_HEADER is set in the environment:
 * - Sends the ping header and expects 200 OK (Cost-saving mode).
 * If PING_REQUEST_HEADER is NOT set:
 * - Sends only the DUMMY_EMAIL and expects 400 Bad Request (Fallback mode).
 *
 * Includes an exponential backoff mechanism to reduce ping frequency during failures.
 */

import { app } from '@azure/functions';
import axios from 'axios';

// --- Configuration and Constants ---
const HTTP_TRIGGER_URL = process.env.HTTP_TRIGGER_URL;
const DUMMY_EMAIL = 'keepalive';

// PING_REQUEST_HEADER is read strictly, no default value
const PING_HEADER_NAME = process.env.PING_REQUEST_HEADER; 
const PING_VALUE = 'true';

// --- Failure Management Variables ---
let consecutiveFailures = 0;
let skipCount = 0;
const MAX_BACKOFF = 5; // Max interval in minutes

app.timer('keepAlive', {
    schedule: '0 * * * * *',
    handler: async (_myTimer, context) => { 
        
        // --- 1. BACKOFF MANAGEMENT ---
        if (skipCount > 0) {
            skipCount--;
            context.log(`⏭️ Skipping ping. Backoff interval active (${consecutiveFailures + 1} min). Skips remaining: ${skipCount}.`);
            return;
        }
        
        // --- 2. CONFIGURATION CHECK ---
        if (!HTTP_TRIGGER_URL) {
            context.error('❌ Missing configuration: HTTP_TRIGGER_URL'); 
            return;
        }

        const start = Date.now();
        
        // --- 3. DYNAMIC REQUEST SETUP ---
        const requestBody = { email: DUMMY_EMAIL }; // Always send the dummy email
        let requestConfig = {
            timeout: 30_000,
            headers: {},
            validateStatus: status => status === 400 // Default: expect 400 Bad Request
        };

        const isPingConfigured = PING_HEADER_NAME && PING_HEADER_NAME.length > 0;

        if (isPingConfigured) {
            // COST-SAVING MODE: Send headers and expect 200 OK
            requestConfig.headers = { [PING_HEADER_NAME]: PING_VALUE };
            // Omitting validateStatus relies on the default 200-299 success range.
            delete requestConfig.validateStatus; 
        }

        const expectedStatus = isPingConfigured ? '200 OK' : '400 Bad Request';
        const logTag = isPingConfigured ? 'OPTIMIZED' : 'FALLBACK';

        try {
            // --- 4. EXECUTION ---
            await axios.post(HTTP_TRIGGER_URL, requestBody, requestConfig);
            
            // 5. SUCCESS
            const dur = Date.now() - start;
            context.log(`🔆 keepAlive [${logTag}] ping OK in ${dur}ms (Expected: ${expectedStatus}).`);
            
            consecutiveFailures = 0; 
            skipCount = 0; 
            
        } catch (err) {
            // 6. FAILURE
            const dur = Date.now() - start;
            const status = err.response ? err.response.status : 'N/A';
            const msg = err.response ? `HTTP ${status}` : err.message;
            
            // Increment backoff
            consecutiveFailures = Math.min(consecutiveFailures + 1, MAX_BACKOFF);
            skipCount = consecutiveFailures; 

            context.error(`❌ keepAlive [${logTag}] ping failed (Expected: ${expectedStatus}, Received: ${status}). Consecutive: ${consecutiveFailures}. Next interval: ${skipCount + 1} min. Error: ${msg}.`); 
        }
    }
});
// keepAlive.js

const { app } = require('@azure/functions');
const axios = require('axios'); 

const HTTP_FUNCTION_URL = process.env.HTTP_TRIGGER_URL; 
const DB_WARMUP_EMAIL = 'warmup-system@artificialbug.com'; 
const LIGHT_WARMUP_EMAIL = 'ping-api-only';

const HEAVY_WARMUP_INTERVAL = ((interval = parseInt(process.env.WARMUP_INTERVAL_MINUTES, 10)) >= 2 ? interval : 5);

app.timer('keepAlive', {
    // Schedule: Runs every minute (0 * * * * *)
    schedule: '0 * * * * *', 
    handler: async (_myTimer, context) => {
        if (!HTTP_FUNCTION_URL) {
            context.log.error('❌ Configuration error: HTTP_TRIGGER_URL missing.');
            return;
        }

        const currentMinute = new Date().getUTCMinutes(); 
        // Full Warmup (API + DB) every HEAVY_WARMUP_INTERVAL minutes
        const isHeavyWarmup = currentMinute % HEAVY_WARMUP_INTERVAL === 0;
        
        const mode = isHeavyWarmup ? 'FULL (API + DB)' : 'LIGHT (API only)';
        const emailToSend = isHeavyWarmup ? DB_WARMUP_EMAIL : LIGHT_WARMUP_EMAIL;
        
        const startTime = Date.now();
        context.log(`🔥 Warmup ${mode} started: ${HTTP_FUNCTION_URL}. Heavy interval configured: ${HEAVY_WARMUP_INTERVAL} min.`);

        try {
            const response = await axios.post(HTTP_FUNCTION_URL, {
                email: emailToSend
            }, {
                // IMPORTANT: Tell axios status 400 is not an error for our light warmup check (otherwise it throws)
                validateStatus: (status) => {
                    // Accept 2xx and 400
                    return (status >= 200 && status < 300) || status === 400; 
                }
            });
            
            const duration = Date.now() - startTime;
            
            if (isHeavyWarmup) {
                // Full Warmup (expecting status 200)
                if (response.status === 200 && response.data.success) {
                     context.log(`✅ Complete service chain (${mode}) warmed up in ${duration}ms. Message: ${response.data.message}`);
                } else {
                     context.log.error(`⚠️ FAILED Full Warmup. Status: ${response.status}. Message: ${response.data.message}`);
                }
            } else {
                // Light Warmup (expecting status 400)
                if (response.status === 400) {
                    context.log(`⚡ SUCCESSFUL Light Warmup in ${duration}ms. (API warmed up)`);
                } else {
                    context.log.error(`⚠️ FAILED Light Warmup: Unexpected Status. Expected 400, got ${response.status}. Message: ${response.data.message || 'No message'}`);
                }
            }

        } catch (error) {
            // This catch block handles genuine connection errors (5xx, timeout, network failure).
            context.log.error(`❌ Warmup ${mode} FAILED. Error:`, error.message);
            throw error; 
        }
    }
});
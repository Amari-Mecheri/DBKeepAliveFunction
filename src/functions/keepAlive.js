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
            // No validateStatus needed. Axios will throw for 400, which we handle below.
            const response = await axios.post(HTTP_FUNCTION_URL, {
                email: emailToSend
            });
            
            const duration = Date.now() - startTime;
            
            // If we are here, the status must be 2xx. This should only happen for FULL Warmup.
            if (isHeavyWarmup) {
                if (response.status === 200 && response.data.success) {
                     context.log(`✅ Complete service chain (${mode}) warmed up in ${duration}ms. Message: ${response.data.message}`);
                } else {
                     context.log.error(`⚠️ FAILED Full Warmup. Status: ${response.status}. Message: ${response.data.message}`);
                }
            } else {
                // CRITICAL FAIL: Light Warmup should NEVER return 2xx (validation failed).
                context.log.error(`⚠️ FAILED Light Warmup: Unexpected Success Status (${response.status}). Validation logic was skipped.`);
            }

        } catch (error) {
            
            const duration = Date.now() - startTime;
            
            // ----------------------------------------------------
            // CRITICAL CHECK FOR LIGHT WARMUP SUCCESS (Expected 400)
            // ----------------------------------------------------
            if (!isHeavyWarmup && error.response && error.response.status === 400) {
                // This is the SUCCESSFUL path for the Light Warmup.
                context.log(`⚡ SUCCESSFUL Light Warmup in ${duration}ms. (API warmed up)`);
                
                // IMPORTANT: We exit the function successfully here.
                return; 
            }
            // ----------------------------------------------------
            
            // If we reach here, it's a genuine failure for either mode (5xx, timeout, network error).
            context.log.error(`❌ Warmup ${mode} FAILED. Error:`, error.message);
            
            // Re-throw the error to signal the Azure Functions host to mark the invocation as 'Failed'.
            throw error; 
        }
    }
});
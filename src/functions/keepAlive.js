const { app } = require('@azure/functions');
const axios = require('axios'); 

const HTTP_FUNCTION_URL = process.env.HTTP_TRIGGER_URL; 
const DB_WARMUP_EMAIL = 'warmup-system@artificialbug.com'; 
const LIGHT_WARMUP_EMAIL = 'ping';

const HEAVY_WARMUP_INTERVAL = (() => {
    const interval = parseInt(process.env.WARMUP_INTERVAL_MINUTES, 10);
    return (interval >= 2 && interval <= 60) ? interval : 5;
})();

app.timer('keepAlive', {
    schedule: '0 * * * * *', 
    handler: async (_myTimer, context) => {
        if (!HTTP_FUNCTION_URL) {
            context.log.error('❌ Configuration error: HTTP_TRIGGER_URL missing');
            return;
        }

        const currentMinute = new Date().getUTCMinutes(); 
        const isHeavyWarmup = currentMinute % HEAVY_WARMUP_INTERVAL === 0;
        
        const mode = isHeavyWarmup ? 'FULL (API + DB)' : 'LIGHT (API only)';
        const emailToSend = isHeavyWarmup ? DB_WARMUP_EMAIL : LIGHT_WARMUP_EMAIL;
        
        const startTime = Date.now();
        context.log(`🔥 Warmup ${mode} started (interval: ${HEAVY_WARMUP_INTERVAL}min)`);

        try {
            const response = await axios.post(
                HTTP_FUNCTION_URL, 
                { email: emailToSend },
                { 
                    timeout: 125000,
                    validateStatus: (status) => {
                        // Accept 2xx and 400 only
                        return (status >= 200 && status < 300) || status === 400;
                    }
                }
            );
            
            const duration = Date.now() - startTime;
            
            // Light warmup: expect 400
            if (!isHeavyWarmup) {
                if (response.status === 400) {
                    context.log(`⚡ Light Warmup SUCCESS in ${duration}ms (API warmed)`);
                } else {
                    // Should never happen with validateStatus, but defensive
                    context.log.error(`⚠️ Light Warmup: Unexpected ${response.status}`);
                }
                return;
            }
            
            // Heavy warmup: expect 200
            if (response.status === 200 && response.data?.success) {
                context.log(`✅ Full Warmup SUCCESS in ${duration}ms - ${response.data.message}`);
            } else {
                context.log.error(`⚠️ Full Warmup: Unexpected response ${response.status}`);
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Network errors, timeouts, 404, 500, etc.
            if (error.response) {
                // HTTP error (404, 500, 502, etc.)
                context.log.error(`❌ Warmup ${mode} FAILED in ${duration}ms: HTTP ${error.response.status}`);
            } else {
                // Network/timeout error
                context.log.error(`❌ Warmup ${mode} FAILED in ${duration}ms: ${error.message}`);
            }
            
            throw error; // Mark function as failed
        }
    }
});
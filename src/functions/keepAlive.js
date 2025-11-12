// keepAlive.js

const { app } = require('@azure/functions');
const axios = require = require('axios'); // Note: L'utilisation de require('axios') est correcte

const HTTP_FUNCTION_URL = process.env.HTTP_TRIGGER_URL; 
const DB_WARMUP_EMAIL = 'warmup-system@artificialbug.com'; 
// Invalid e-mail that will be rejected by the WaitList function (!email.includes('@'))
const LIGHT_WARMUP_EMAIL = 'ping-api-only';

// defaults to 5 minutes if no env var set or if set to less than 2
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
            // AUCUN TIMEOUT EXPLICITE D'AXIOS. La durée sera contrôlée par le timeout de 60s de la DB.
            const response = await axios.post(HTTP_FUNCTION_URL, {
                email: emailToSend
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
                // Light Warmup (expecting validation error status 400)
                if (response.status === 400 && !response.data.success && response.data.message === 'Invalid email address') {
                    context.log(`⚡ SUCCESSFUL Light Warmup in ${duration}ms. (API warmed, validation OK)`);
                } else {
                    context.log.error(`⚠️ FAILED Light Warmup: Unexpected Status. Status: ${response.status}. Message: ${response.data.message || 'No message'}`);
                }
            }

        } catch (error) {
            // Le seul risque est un échec de connexion (DNS, 404, etc.) ou un timeout côté réseau de l'hôte.
            context.log.error(`❌ Warmup ${mode} FAILED. Error:`, error.message);
            throw error; 
        }
    }
});
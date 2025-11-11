const { app } = require('@azure/functions');
const axios = require('axios'); 

const HTTP_FUNCTION_URL = process.env.HTTP_TRIGGER_URL; 
const DUMMY_EMAIL = 'warmup-system@artificialbug.com'; 

app.timer('keepAlive', {
    // Schedule: Runs every 5 minutes
    schedule: '0 */5 * * * *',
    handler: async (_myTimer, context) => {
        if (!HTTP_FUNCTION_URL) {
            context.log.error('❌ Configuration error: HTTP_TRIGGER_URL is missing. Please define it.');
            return;
        }

        const startTime = Date.now();
        context.log(`🔥 Warmup of the HTTP Trigger function started: ${HTTP_FUNCTION_URL}`);

        try {
            // 📡 Call the HTTP Trigger function
            const response = await axios.post(HTTP_FUNCTION_URL, {
                email: DUMMY_EMAIL
            });
            
            const duration = Date.now() - startTime;
            
            if (response.status === 200 && response.data.success) {
                 context.log(`✅ Complete service chain (API + DB) warmed up in ${duration}ms.`);
                 context.log(`API Message: ${response.data.message}`);
            } else {
                 context.log.error(`⚠️ HTTP Warmup succeeded, but the API returned a logical error.`);
                 context.log.error('API Details:', JSON.stringify(response.data));
            }

        } catch (error) {
            context.log.error('❌ Warmup FAILED: The HTTP Trigger function call failed.');
            
            if (error.response && error.response.data) {
                context.log.error('API Error Details (5xx response):', JSON.stringify(error.response.data));
            } else {
                // This could be a connection error (404, DNS, etc.)
                context.log.error('Connection Error Details:', error.message);
            }
            
            throw error; 
        }
    }
});
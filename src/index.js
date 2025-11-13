import { app } from '@azure/functions';
import './functions/keepAlive.js';
import { post } from 'axios';

app.setup({
    enableHttpStream: true,
});

app.timer('keepAlive', {
    schedule: '0 * * * * *', // toutes les minutes
    handler: async (_myTimer, context) => {
        
        const HTTP_TRIGGER_URL = process.env.HTTP_TRIGGER_URL;
        const DUMMY_EMAIL = 'keepalive'; // invalide, déclenche HTTP 400

        if (!HTTP_TRIGGER_URL) {
            context.log.error('❌ Missing HTTP_TRIGGER_URL');
            return;
        }

        const start = Date.now();

        try {
            await post(HTTP_TRIGGER_URL, { email: DUMMY_EMAIL }, {
                timeout: 30_000,
                validateStatus: status => status === 400 // attendu pour email invalide
            });
            const dur = Date.now() - start;
            context.log(`🔆 keepAlive ping OK in ${dur}ms`);
        } catch (err) {
            const dur = Date.now() - start;
            const msg = err.response ? `HTTP ${err.response.status}` : err.message;
            context.log.error(`❌ keepAlive ping failed in ${dur}ms: ${msg}`);
            throw err;
        }
    }
});

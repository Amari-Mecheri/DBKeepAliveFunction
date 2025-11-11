const { app } = require('@azure/functions');
const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    // CRITICAL: Use the extended timeouts from index.js
    connectionTimeout: 60000, // 60 seconds
    requestTimeout: 60000,     // 60 seconds
    pool: {
        idleTimeoutMillis: 30000 // Added pool config for consistency
    }
};

/**
 * Tente de se connecter à la DB avec retry si elle est en pause
 */
async function connectWithRetry(context, maxRetries = 2, delayMs = 5000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sql.connect(config);
            return true;
        } catch (error) {
            // Check for timeout or connection failure messages
            if (attempt < maxRetries && 
                (error.code === 'ETIMEOUT' || 
                 error.message.includes('timeout') ||
                 error.message.includes('Failed to connect'))) {
                
                context.log(`Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw error; // Throw if last attempt or a different error
        }
    }
    return false;
}

app.timer('keepAlive', {
    // Schedule remains the same: '0 */5 * * * *' (Every 5 minutes)
    schedule: '0 */5 * * * *',
    handler: async (_myTimer, context) => {
        const startTime = Date.now();
        let connected = false;
        
        try {
            context.log('🔥 Warmup function started');
            
            context.log('📡 Connecting to database with retry logic...');
            
            // Use the adapted retry logic
            connected = await connectWithRetry(context);
            
            if (!connected) {
                // Throw an error if retries failed
                throw new Error('Could not establish connection to database after retries.');
            }

            context.log('✅ Connected! Running test query...');
            const result = await sql.query`SELECT GETDATE() as CurrentTime`;
            
            const duration = Date.now() - startTime;
            context.log(`✅ Database warmed up in ${duration}ms`);
            context.log(`Database time: ${result.recordset[0].CurrentTime}`);
            
        } catch (error) {
            // Log the failure details
            context.log.error('❌ Warmup failed:', error.message);
            // This throw will mark the Timer Trigger execution as failed in Azure logs
            throw error; 
        } finally {
            try {
                // The sql.close() must be done, whether we successfully connected or not.
                // We assume sql.close() can handle closing a non-established connection 
                // gracefully, but it's safer to attempt it.
                await sql.close();
                context.log('🔌 Connection closed');
            } catch (e) {
                // Log only if closing the connection failed (e.g., if it was already closed)
                context.log.error('Error closing connection:', e.message);
            }
        }
    }
});
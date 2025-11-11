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
    connectionTimeout: 60000,
    requestTimeout: 60000
};

app.timer('keepAlive', {
    schedule: '0 */5 * * * *',
    handler: async (_myTimer, context) => {
        const startTime = Date.now();
        
        try {
            context.log('🔥 Warmup function started');
            
            context.log('📡 Connecting to database...');
            await sql.connect(config);
            
            context.log('✅ Connected! Running test query...');
            const result = await sql.query`SELECT GETDATE() as CurrentTime`;
            
            const duration = Date.now() - startTime;
            context.log(`✅ Database warmed up in ${duration}ms`);
            context.log(`Database time: ${result.recordset[0].CurrentTime}`);
            
        } catch (error) {
            context.log.error('❌ Warmup failed:', error.message);
            throw error;
        } finally {
            try {
                await sql.close();
                context.log('🔌 Connection closed');
            } catch (e) {
                context.log.error('Error closing connection:', e.message);
            }
        }
    }
});
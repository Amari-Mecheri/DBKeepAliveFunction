const { app } = require('@azure/functions');

app.timer('keepAlive', {
    schedule: '0 */5 * * * *',
    handler: async (_myTimer, context) => {
        const sql = require('mssql');
        try {
            await sql.connect(config);
            await sql.query`SELECT 1`;
            context.log('Database warmed up successfully');
        } catch (error) {
            context.log.error('Warmup failed:', error);
        } finally {
            await sql.close();
        }
    }
});

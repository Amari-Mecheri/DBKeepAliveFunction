const { app } = require('@azure/functions');
const axios = require('axios'); 

// L'URL est récupérée depuis les variables d'environnement (sans code=...)
const HTTP_FUNCTION_URL = process.env.HTTP_TRIGGER_URL; 
const DUMMY_EMAIL = 'warmup-system@artificialbug.com'; 

app.timer('keepAlive', {
    schedule: '0 */5 * * * *',
    handler: async (_myTimer, context) => {
        if (!HTTP_FUNCTION_URL) {
            context.log.error('❌ Configuration error: HTTP_TRIGGER_URL est manquant. Veuillez le définir.');
            return;
        }

        const startTime = Date.now();
        context.log(`🔥 Warmup de la fonction HTTP Trigger démarré : ${HTTP_FUNCTION_URL}`);

        try {
            // 📡 Appel de la fonction HTTP Trigger
            const response = await axios.post(HTTP_FUNCTION_URL, {
                email: DUMMY_EMAIL
            });
            
            const duration = Date.now() - startTime;
            
            if (response.status === 200 && response.data.success) {
                 context.log(`✅ Chaîne de service complète (API + DB) réveillée en ${duration}ms.`);
                 context.log(`Message API : ${response.data.message}`);
            } else {
                 context.log.error(`⚠️ Warmup HTTP réussi, mais l'API a retourné une erreur logique.`);
                 context.log.error('Détails de l\'API:', JSON.stringify(response.data));
            }

        } catch (error) {
            context.log.error('❌ Warmup FAILED: La fonction HTTP Trigger a échoué.');
            
            if (error.response && error.response.data) {
                context.log.error('Détails de l\'erreur API (réponse 5xx):', JSON.stringify(error.response.data));
            } else {
                // Cela peut être une erreur de connexion (404, DNS, etc.)
                context.log.error('Détails de l\'erreur de connexion:', error.message);
            }
            
            throw error; 
        }
    }
});

// const { app } = require('@azure/functions');
// const sql = require('mssql');

// const config = {
//     user: process.env.SQL_USER,
//     password: process.env.SQL_PASSWORD,
//     server: process.env.SQL_SERVER,
//     database: process.env.SQL_DATABASE,
//     options: {
//         encrypt: true,
//         trustServerCertificate: false
//     },
//     // CRITICAL: Use the extended timeouts from index.js
//     connectionTimeout: 60000, // 60 seconds
//     requestTimeout: 60000,     // 60 seconds
//     pool: {
//         idleTimeoutMillis: 30000 // Added pool config for consistency
//     }
// };

// /**
//  * Tente de se connecter à la DB avec retry si elle est en pause
//  */
// async function connectWithRetry(context, maxRetries = 2, delayMs = 5000) {
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//             await sql.connect(config);
//             return true;
//         } catch (error) {
//             // Check for timeout or connection failure messages
//             if (attempt < maxRetries && 
//                 (error.code === 'ETIMEOUT' || 
//                  error.message.includes('timeout') ||
//                  error.message.includes('Failed to connect'))) {
                
//                 context.log(`Connection attempt ${attempt} failed, retrying in ${delayMs}ms...`);
//                 await new Promise(resolve => setTimeout(resolve, delayMs));
//                 continue;
//             }
//             throw error; // Throw if last attempt or a different error
//         }
//     }
//     return false;
// }

// app.timer('keepAlive', {
//     // Schedule remains the same: '0 */5 * * * *' (Every 5 minutes)
//     schedule: '0 */5 * * * *',
//     handler: async (_myTimer, context) => {
//         const startTime = Date.now();
//         let connected = false;
        
//         try {
//             context.log('🔥 Warmup function started');
            
//             context.log('📡 Connecting to database with retry logic...');
            
//             // Use the adapted retry logic
//             connected = await connectWithRetry(context);
            
//             if (!connected) {
//                 // Throw an error if retries failed
//                 throw new Error('Could not establish connection to database after retries.');
//             }

//             context.log('✅ Connected! Running test query...');
//             const result = await sql.query`SELECT GETDATE() as CurrentTime`;
            
//             const duration = Date.now() - startTime;
//             context.log(`✅ Database warmed up in ${duration}ms`);
//             context.log(`Database time: ${result.recordset[0].CurrentTime}`);
            
//         } catch (error) {
//             // Log the failure details
//             context.log.error('❌ Warmup failed:', error.message);
//             // This throw will mark the Timer Trigger execution as failed in Azure logs
//             throw error; 
//         } finally {
//             try {
//                 // The sql.close() must be done, whether we successfully connected or not.
//                 // We assume sql.close() can handle closing a non-established connection 
//                 // gracefully, but it's safer to attempt it.
//                 await sql.close();
//                 context.log('🔌 Connection closed');
//             } catch (e) {
//                 // Log only if closing the connection failed (e.g., if it was already closed)
//                 context.log.error('Error closing connection:', e.message);
//             }
//         }
//     }
// });
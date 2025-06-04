const { Pool } = require('pg');
const Logger = require('../src/utils/Logger');

async function testPostgreSQLPool() {
    const logger = new Logger();
    
    // Test dengan konfigurasi yang dioptimalkan
    const poolConfig = {
        connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
        
        // Optimized pool settings
        max: parseInt(process.env.DB_POOL_MAX) || 25,
        min: parseInt(process.env.DB_POOL_MIN) || 5,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
        acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 10000,
        createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 5000,
        destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,
        reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL) || 1000,
        createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL) || 200,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
        application_name: process.env.APP_NAME || 'whatsapp-financial-bot-test',
    };

    logger.info('Testing PostgreSQL pool with optimized configuration...');
    logger.info('Pool config:', {
        max: poolConfig.max,
        min: poolConfig.min,
        idleTimeout: poolConfig.idleTimeoutMillis,
        connectionTimeout: poolConfig.connectionTimeoutMillis
    });

    const pool = new Pool(poolConfig);
    
    // Set up event handlers for testing
    pool.on('connect', (client) => {
        logger.info('New client connected to pool');
    });

    pool.on('acquire', (client) => {
        logger.info('Client acquired from pool');
    });

    pool.on('remove', (client) => {
        logger.info('Client removed from pool');
    });

    pool.on('error', (err, client) => {
        logger.error('Unexpected error on idle client', err);
    });

    try {
        // Test 1: Basic connection
        logger.info('Test 1: Basic connection test...');
        const start1 = Date.now();
        const client1 = await pool.connect();
        const duration1 = Date.now() - start1;
        logger.info(`✅ Connection established in ${duration1}ms`);
        
        // Test query
        const result1 = await client1.query('SELECT 1 as test');
        logger.info('✅ Basic query successful:', result1.rows[0]);
        client1.release();

        // Test 2: Pool statistics
        logger.info('Test 2: Pool statistics...');
        const stats = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            max: pool.options.max,
            min: pool.options.min
        };
        logger.info('Pool stats:', stats);

        // Test 3: Multiple concurrent connections
        logger.info('Test 3: Multiple concurrent connections...');
        const concurrentPromises = [];
        const concurrentCount = 5;
        
        for (let i = 0; i < concurrentCount; i++) {
            concurrentPromises.push(
                (async () => {
                    const start = Date.now();
                    const client = await pool.connect();
                    const duration = Date.now() - start;
                    const result = await client.query('SELECT $1 as connection_id', [i]);
                    client.release();
                    return { id: i, duration, result: result.rows[0] };
                })()
            );
        }

        const concurrentResults = await Promise.all(concurrentPromises);
        logger.info('✅ Concurrent connections successful:');
        concurrentResults.forEach(result => {
            logger.info(`  Connection ${result.id}: ${result.duration}ms`);
        });

        // Test 4: Pool stats after concurrent usage
        logger.info('Test 4: Pool statistics after concurrent usage...');
        const statsAfter = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            utilizationRate: ((pool.totalCount - pool.idleCount) / pool.options.max * 100).toFixed(2) + '%'
        };
        logger.info('Pool stats after concurrent usage:', statsAfter);

        // Test 5: Health check simulation
        logger.info('Test 5: Health check simulation...');
        const healthStart = Date.now();
        const healthClient = await pool.connect();
        const healthResult = await healthClient.query('SELECT NOW() as current_time');
        const healthDuration = Date.now() - healthStart;
        healthClient.release();
        
        const healthStatus = {
            status: 'healthy',
            responseTime: healthDuration,
            serverTime: healthResult.rows[0].current_time,
            poolStats: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            }
        };
        logger.info('✅ Health check result:', healthStatus);

        // Test 6: Error handling test (optional)
        try {
            logger.info('Test 6: Error handling test...');
            const errorClient = await pool.connect();
            await errorClient.query('SELECT * FROM non_existent_table_test');
            errorClient.release();
        } catch (error) {
            logger.info('✅ Error handling working correctly:', error.message);
        }

        logger.info('🎉 All PostgreSQL pool tests completed successfully!');
        
        // Final pool statistics
        const finalStats = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
            max: pool.options.max,
            min: pool.options.min
        };
        logger.info('Final pool statistics:', finalStats);

    } catch (error) {
        logger.error('❌ PostgreSQL pool test failed:', error);
        throw error;
    } finally {
        logger.info('Closing pool...');
        await pool.end();
        logger.info('Pool closed successfully');
    }
}

// Jalankan test
if (require.main === module) {
    testPostgreSQLPool()
        .then(() => {
            console.log('PostgreSQL pool test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('PostgreSQL pool test failed:', error);
            process.exit(1);
        });
}

module.exports = testPostgreSQLPool;
'use strict';

require('dotenv').config();
const app = require('./src/app');
const config = require('./src/config');
const { pool } = require('./src/db/pool');

async function startServer() {
  try {
    // Verify database connectivity before starting
    await pool.query('SELECT 1');
    console.log('✅ Database connected.');

    const server = app.listen(config.port, () => {
      console.log(`🚀 ERP Server running on port ${config.port} [${config.nodeEnv}]`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(async () => {
        await pool.end();
        console.log('Server closed.');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    console.error('\nMake sure PostgreSQL is running and the .env file is correctly configured.');
    process.exit(1);
  }
}

startServer();

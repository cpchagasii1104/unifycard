// src/core/health/health.module.ts
import { FastifyPluginAsync } from 'fastify';
import { pool } from '@core/database/pool';

const healthModule: FastifyPluginAsync = async (fastify) => {
  // GET /health
  fastify.get('/', async () => {
    const packageJson = require('../../../package.json');
    const { getDatabaseInfo } = await import('@core/database/pool');
    const dbInfo = await getDatabaseInfo();
    
    // 🔴 INSTRUMENTAÇÃO: Retornar informações de runtime para diagnóstico
    const serverAddress = fastify.server.address();
    const actualPort = typeof serverAddress === 'string' 
      ? null 
      : serverAddress?.port || null;
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: packageJson.version || '1.0.0',
      runtime: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        port: actualPort,
        env: process.env.NODE_ENV || 'development',
      },
      database: dbInfo ? {
        connected: true,
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        schema: dbInfo.currentSchema,
        user: dbInfo.currentUser,
        connectionCount: dbInfo.connectionCount,
      } : {
        connected: false,
      },
    };
  });

  // GET /health/ready
  fastify.get('/ready', async (_req, reply) => {
    try {
      // Verifica conexão com banco
      await pool.query('SELECT 1');
      return { status: 'ready', database: 'connected' };
    } catch {
      return reply.status(503).send({
        status: 'not ready',
        database: 'disconnected',
      });
    }
  });

  // GET /health/live
  fastify.get('/live', async () => {
    return { status: 'live' };
  });
};

export default healthModule;

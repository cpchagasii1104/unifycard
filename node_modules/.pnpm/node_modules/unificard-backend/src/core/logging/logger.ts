// src/core/logging/logger.ts
// Logger estruturado para produção
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Formato para produção (JSON estruturado)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato para desenvolvimento (legível)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: nodeEnv === 'production' ? productionFormat : developmentFormat,
  defaultMeta: {
    service: 'unificard-backend',
    environment: nodeEnv,
  },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Adicionar transporte de arquivo em produção
if (nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

// Helpers para contextos específicos
export const billingLogger = logger.child({ context: 'billing' });
export const feedLogger = logger.child({ context: 'feed' });
export const eventsLogger = logger.child({ context: 'events' });
export const authLogger = logger.child({ context: 'auth' });














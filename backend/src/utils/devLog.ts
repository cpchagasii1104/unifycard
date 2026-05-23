import { logger } from '@core/logging/logger';

type LogMeta = Record<string, unknown>;

function log(level: 'info' | 'error', event: string, meta?: LogMeta): void {
  logger.log(level, event, meta ?? {});
}

export const devLog = {
  info(event: string, meta?: LogMeta): void {
    log('info', event, meta);
  },

  success(event: string, meta?: LogMeta): void {
    log('info', event, meta);
  },

  error(event: string, meta?: LogMeta): void {
    log('error', event, meta);
  },
};
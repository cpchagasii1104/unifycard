// src/utils/devLog.ts
// Utilitário para logs apenas em desenvolvimento

const isDev = process.env.NODE_ENV === 'development';

export const devLog = {
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`[DEV] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (isDev) {
      console.error(`[DEV] ${message}`, ...args);
    }
  },
  log: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[DEV] ${message}`, ...args);
    }
  },
};



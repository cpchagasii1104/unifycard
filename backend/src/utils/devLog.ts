// src/utils/devLog.ts
// Utilitário para logs estruturados apenas em desenvolvimento
// 🔴 GOLDEN_PATH: Logs nunca via console.log direto. Apenas devLog.

const isDev = process.env.NODE_ENV !== 'production';

export const devLog = {
  info: (namespace: string, context?: any) => {
    if (isDev) console.log(`[DEV:${namespace}]`, context ?? '');
  },
  warn: (namespace: string, context?: any) => {
    if (isDev) console.warn(`[DEV:${namespace}]`, context ?? '');
  },
  error: (namespace: string, context?: any) => {
    if (isDev) console.error(`[DEV:${namespace}]`, context ?? '');
  },
  success: (namespace: string, context?: any) => {
    if (isDev) console.log(`[DEV:${namespace}] ✅`, context ?? '');
  },
};

export default devLog;

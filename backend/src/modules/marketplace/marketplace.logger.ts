// backend/src/modules/marketplace/marketplace.logger.ts
// Logger estruturado para o Marketplace
// Padrão: [MARKETPLACE][CATEGORIA] mensagem

type LogCategory = 'INIT' | 'API' | 'PAYMENT' | 'ORDER' | 'DELIVERY' | 'SERVICE' | 'ERROR';

function log(category: LogCategory, message: string, data?: any): void {
  const prefix = `[MARKETPLACE][${category}]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function logError(category: LogCategory, message: string, error: any): void {
  const prefix = `[MARKETPLACE][${category}]`;
  console.error(`${prefix} ${message}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export const marketplaceLogger = {
  init: (message: string, data?: any) => log('INIT', message, data),
  api: (message: string, data?: any) => log('API', message, data),
  payment: (message: string, data?: any) => log('PAYMENT', message, data),
  order: (message: string, data?: any) => log('ORDER', message, data),
  delivery: (message: string, data?: any) => log('DELIVERY', message, data),
  service: (message: string, data?: any) => log('SERVICE', message, data),
  error: (message: string, error: any) => logError('ERROR', message, error),
};






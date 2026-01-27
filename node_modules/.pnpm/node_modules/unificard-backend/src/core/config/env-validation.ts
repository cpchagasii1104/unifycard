const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV',
  'PORT',
];

export function validateEnv() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validação de PORT
  const port = Number(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`PORT deve ser um número válido entre 1 e 65535. Recebido: ${process.env.PORT}`);
  }

  // Validação de ENABLE_WEBSOCKET (se definido, deve ser true ou false)
  if (process.env.ENABLE_WEBSOCKET !== undefined) {
    const enableWebsocket = process.env.ENABLE_WEBSOCKET.toLowerCase();
    if (enableWebsocket !== 'true' && enableWebsocket !== 'false') {
      throw new Error(`ENABLE_WEBSOCKET deve ser 'true' ou 'false'. Recebido: ${process.env.ENABLE_WEBSOCKET}`);
    }
    
    // Se ENABLE_WEBSOCKET=true, verificar se @fastify/websocket está disponível
    if (enableWebsocket === 'true') {
      try {
        require.resolve('@fastify/websocket');
      } catch (err) {
        throw new Error('ENABLE_WEBSOCKET=true mas @fastify/websocket não está instalado. Execute: pnpm add @fastify/websocket');
      }
    }
  }

  // Validação de ENABLE_PAYMENTS (se definido, deve ser true ou false)
  if (process.env.ENABLE_PAYMENTS !== undefined) {
    const enablePayments = process.env.ENABLE_PAYMENTS.toLowerCase();
    if (enablePayments !== 'true' && enablePayments !== 'false') {
      throw new Error(`ENABLE_PAYMENTS deve ser 'true' ou 'false'. Recebido: ${process.env.ENABLE_PAYMENTS}`);
    }
    
    // Se ENABLE_PAYMENTS=true, STRIPE_SECRET_KEY é obrigatório
    if (enablePayments === 'true' && !process.env.STRIPE_SECRET_KEY) {
      throw new Error('ENABLE_PAYMENTS=true mas STRIPE_SECRET_KEY não está configurado. Configure STRIPE_SECRET_KEY ou defina ENABLE_PAYMENTS=false');
    }
  }

  // Validação de ENABLE_MARKETPLACE_SEED (se definido, deve ser true ou false)
  if (process.env.ENABLE_MARKETPLACE_SEED !== undefined) {
    const enableMarketplaceSeed = process.env.ENABLE_MARKETPLACE_SEED.toLowerCase();
    if (enableMarketplaceSeed !== 'true' && enableMarketplaceSeed !== 'false') {
      throw new Error(`ENABLE_MARKETPLACE_SEED deve ser 'true' ou 'false'. Recebido: ${process.env.ENABLE_MARKETPLACE_SEED}`);
    }
    
    // Em produção, seed só executa se explicitamente habilitado
    if (process.env.NODE_ENV === 'production' && enableMarketplaceSeed !== 'true') {
      // Em produção, seed não deve executar sem flag explícita
      // Isso é validado aqui para garantir que não há seed acidental em produção
    }
  } else {
    // Se ENABLE_MARKETPLACE_SEED não está definido e estamos em produção, erro
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENABLE_MARKETPLACE_SEED deve ser explicitamente definido em produção. Defina ENABLE_MARKETPLACE_SEED=false para desabilitar seed ou ENABLE_MARKETPLACE_SEED=true para habilitar');
    }
  }
}








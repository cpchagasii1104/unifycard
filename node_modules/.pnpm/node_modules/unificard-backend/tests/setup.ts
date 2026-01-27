// tests/setup.ts
// Setup global para smoke tests

// Configurar timezone para testes
process.env.TZ = 'UTC';

// Configurar variáveis de ambiente de teste
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';


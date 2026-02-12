// backend/src/core/authorization/soft-block.config.ts
// Configuração do Kill-Switch para Soft-Block (Fase 3)

/**
 * Verifica se o soft-block está habilitado
 * Kill-switch: AUTHZ_SOFTBLOCK_ENABLED
 * 
 * Comportamento:
 * - false ou não definido → comportamento 100% legado
 * - true → soft-block ativo conforme escopo da Fase 3
 */
export function isSoftBlockEnabled(): boolean {
  const enabled = process.env.AUTHZ_SOFTBLOCK_ENABLED;
  return enabled === 'true' || enabled === '1';
}





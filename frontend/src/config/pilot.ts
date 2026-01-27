// frontend/src/config/pilot.ts
// CONTINUOUS PRODUCTION: Configuração de Modo Piloto - SPRINT 13
// Configuração para observação silenciosa em uso real

/**
 * Modo piloto ativado
 * Ativado apenas por variável de ambiente
 * Não visível ao usuário
 */
export const PILOT_MODE = import.meta.env.VITE_PILOT_MODE === 'true';

/**
 * Verifica se modo piloto está ativo
 */
export function isPilotMode(): boolean {
  return PILOT_MODE;
}








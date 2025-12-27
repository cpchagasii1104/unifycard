// backend/src/utils/isTestOverrideUser.ts
// Utilitário centralizado para verificar override de teste
// REGRA: Esta é a ÚNICA porta de override no sistema

import { isTestOverrideUser as checkOverride } from '../config/testOverrideUsers';

/**
 * Verifica se um usuário tem acesso total (override de teste)
 * 
 * @param userId UUID do usuário (user_id da tabela users)
 * @returns true se o usuário está na lista de override
 * 
 * @example
 * ```ts
 * if (isTestOverrideUser(user.id)) {
 *   // Permitir acesso total
 * }
 * ```
 */
export function isTestOverrideUser(userId: string): boolean {
  return checkOverride(userId);
}














/**
 * Modo de resolução de autoridade — módulo compartilhado.
 * Extraído de authority-decision.service.ts para uso em múltiplos módulos.
 * Ref: C53 remediação — DECISION-0013
 */

export type AuthorityResolutionMode = 'strict' | 'permissive';

/**
 * GUARD ANTI-VAZAMENTO: permissive é PROIBIDO fora de NODE_ENV=development.
 * Lança erro crítico se tentado em outro ambiente.
 */
export function getAuthorityMode(): AuthorityResolutionMode {
  const raw = process.env.AUTHORITY_MODE?.toLowerCase();
  const mode = raw === 'permissive' ? 'permissive' : 'strict';
  if (mode === 'permissive') {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error(
        `[authority-decision] CRITICAL: AUTHORITY_MODE=permissive proibido fora de NODE_ENV=development. ` +
        `Ambiente atual: NODE_ENV=${process.env.NODE_ENV ?? '<undefined>'}. Abortando.`
      );
    }
    return 'permissive';
  }
  return 'strict';
}

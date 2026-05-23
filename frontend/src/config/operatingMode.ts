// frontend/src/config/operatingMode.ts
// 2026-05-16: tipo canônico para modo operante (camada de intenção contextual
// dentro do actor).
//
// Diretriz Clayton (memory project_modo_operante.md):
//   actor          = quem sou         (identidade soberana)
//   modo operante  = o que faço agora (intenção momentânea)
//
// Frase-âncora: "Modo operante prioriza, não esconde."
// MVP: 2 modos apenas. Não expandir cedo.

export type OperatingMode = 'consumir' | 'operar';

/**
 * Default do modo por actor_type quando não há preferência salva em localStorage.
 *  - PF (user)     → consumir (assume primeiro contato como consumidor)
 *  - Empresa(page) → operar
 *  - Grupo / Canal → operar (governam/publicam por natureza)
 */
export function defaultModeForActorType(actorType: string | null | undefined): OperatingMode {
  if (actorType === 'user') return 'consumir';
  return 'operar';
}

/**
 * Chave canônica de persistência em localStorage. Por actor.
 * Trocar de actor lê a preferência DESSE actor — não carrega inércia.
 */
export function operatingModeStorageKey(actorId: string): string {
  return `unificard:operating-mode:${actorId}`;
}

// backend/src/modules/marketplace/contact-feature.guard.ts
// F-CONTACTS-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT
//
// 🔴 CONTENÇÃO FAIL-CLOSED de schema ghost. A tabela `contacts` NÃO existe no schema vivo
//    (to_regclass('public.contacts') = NULL). Os callers (rotas + serviços internos) passam TODOS
//    por `contactService`, que chega ao `contactRepository` (que faz INSERT/SELECT/UPDATE em `contacts`)
//    → 42P01 / 500 cru. Este guard intercepta ANTES do repository e devolve falha HONESTA e controlada
//    (501 CONTACTS_SCHEMA_GHOST_CONTAINED).
//
// 🔴 NÃO é gênese de contacts. NÃO cria tabela, migration, owner, ou dado fake. A gênese de contacts é
//    frente própria com ownership institucional. Quando a tabela existir, o probe `to_regclass` passa a
//    retornar verdadeiro e a feature destrava sozinha (a frente de gênese remove/ajusta este guard).

import { pool } from '@core/database/pool';
import { AppError } from '@core/errors';

export const CONTACTS_SCHEMA_GHOST_CODE = 'CONTACTS_SCHEMA_GHOST_CONTAINED';

// Cache APENAS do positivo: uma tabela não desaparece após criada. Enquanto ausente, re-checa (caminho de
// erro, baixa frequência) — assim a gênese futura é detectada sem exigir restart, sem cachear "false" stale.
let contactsTablePresent = false;

/** Probe read-only: a tabela `contacts` existe no schema vivo? */
export async function isContactsFeatureAvailable(): Promise<boolean> {
  if (contactsTablePresent) return true;
  const r = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.contacts') AS t`);
  contactsTablePresent = r.rows[0]?.t != null;
  return contactsTablePresent;
}

/**
 * Fail-closed: lança 501 CONTACTS_SCHEMA_GHOST_CONTAINED quando `contacts` está ausente.
 * Chamar no INÍCIO de cada método de `contactService` que alcança o repository — ANTES do SQL.
 */
export async function assertContactsFeatureAvailable(): Promise<void> {
  if (await isContactsFeatureAvailable()) return;
  throw new AppError(
    501,
    'CONTACTS_SCHEMA_GHOST_CONTAINED: a feature de Contatos não está disponível (tabela `contacts` ausente no schema vivo). ' +
      'A gênese de contacts é frente própria com ownership institucional — esta superfície está contida fail-closed.',
    CONTACTS_SCHEMA_GHOST_CODE
  );
}

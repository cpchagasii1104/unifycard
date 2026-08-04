// backend/src/scripts/helpers/demo-seed-manifest.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — o registro do que os seeds de demonstração criaram
// ║ NORMA:   Lei 7 (identidade é o id; `slug`/`metadata` NUNCA são identidade)
// ║ NÃO:     NÃO identificar linha de tabela transacional por `metadata->>'demo_seed'`.
// ║ EM VEZ:  o seed ANOTA os ids que criou; a faxina apaga POR ID.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO EXISTE (2026-08-04) ═══
// A 1ª versão da faxina achava os eventos por `WHERE metadata->>'demo_seed' = 'true'`.
// `audit-schema-coherence-ratchet` mordeu (C7-METADATA-DECISION) e está certo: `events` é tabela
// TRANSACIONAL, e decidir sobre ela por metadata é a doença que a Lei 7 nomeia — dois caminhos para
// dizer "quem é esta linha", divergindo em silêncio.
//
// Além de conformar, o manifesto é ESTRITAMENTE mais seguro: a faxina passa a apagar exatamente o
// que o seed criou, e nada mais. Um evento que alguém marcasse à mão com `demo_seed` não era do
// seed e sairia junto na versão antiga.
//
// ⚠️ `metadata.demo_seed` CONTINUA sendo escrito pelos seeds — como RASTRO legível por humano
// ("de onde veio esta linha?"). O que mudou é que ele não DECIDE mais nada.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Vive na raiz do backend, fora de `src` — é estado operacional, não código. */
const CAMINHO = join(process.cwd(), '.demo-seed-manifest.json');

/** Grupos de linhas rastreadas. Só o que é TRANSACIONAL precisa de manifesto. */
export type GrupoDoManifesto = 'demo_events' | 'completed_events';

type Manifesto = Partial<Record<GrupoDoManifesto, string[]>>;

function ler(): Manifesto {
  if (!existsSync(CAMINHO)) return {};
  try {
    const bruto = JSON.parse(readFileSync(CAMINHO, 'utf8')) as Manifesto;
    return bruto && typeof bruto === 'object' ? bruto : {};
  } catch {
    // Manifesto ilegível NÃO vira `{}` silencioso: vazio afirmaria "o seed não criou nada", e a
    // faxina apagaria zero linha achando que terminou. Falha ALTO.
    throw new Error(`DEMO_SEED_MANIFEST_UNREADABLE: ${CAMINHO} existe e não é JSON válido. Conserte ou remova à mão.`);
  }
}

/** Anota ids criados. Idempotente: rodar o seed 2× não duplica entrada. */
export function registrarNoManifesto(grupo: GrupoDoManifesto, ids: string[]): void {
  if (ids.length === 0) return;
  const m = ler();
  m[grupo] = Array.from(new Set([...(m[grupo] ?? []), ...ids]));
  writeFileSync(CAMINHO, JSON.stringify(m, null, 2), 'utf8');
}

/** Ids que o seed registrou. Vazio = o seed não rodou (ou já foi limpo) — afirmação, não erro. */
export function lerDoManifesto(grupo: GrupoDoManifesto): string[] {
  return ler()[grupo] ?? [];
}

/** Esquece um grupo (chamado pela faxina DEPOIS do COMMIT, nunca antes). */
export function esquecerDoManifesto(grupo: GrupoDoManifesto): void {
  const m = ler();
  delete m[grupo];
  writeFileSync(CAMINHO, JSON.stringify(m, null, 2), 'utf8');
}

export const CAMINHO_DO_MANIFESTO = CAMINHO;

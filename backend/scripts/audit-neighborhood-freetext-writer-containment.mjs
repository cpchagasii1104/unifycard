#!/usr/bin/env node
// Guard estrutural — F-NEIGHBORHOOD-CANONICAL-IDENTITY / N0.1 ANTI-REVIVAL.
// DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER · DECISION-0079 §6 · DECISION-0166 D4.
//
// Régua: enquanto a fundação canônica de bairro (F-NEIGHBORHOOD-CANONICAL-IDENTITY, N1/N2) NÃO
// estiver aberta e governada por DECISION ratificada, NENHUM código runtime de backend/src pode:
//   (A) escrever no catálogo canônico `neighborhoods` (INSERT/UPDATE/DELETE);
//   (B) reviver o writer legado por nome (`findOrCreateNeighborhood`);
//   (C) resolver `neighborhood_id` por igualdade de nome (matching textual do bairro);
//   (D) derivar `neighborhood_id` de texto de exibição/provider (neighborhood_display_text /
//       provider.bairro / neighborhood_name).
// O bairro do CEP/provider/usuário só pode circular como TEXTO DE EXIBIÇÃO. A identidade
// (`neighborhood_id`) permanece RESERVADA até a casa canônica nascer (catálogo com
// fonte/curadoria/aprovação) — e ABRIR essa casa será uma alteração CONSCIENTE deste guard,
// numa fatia futura com DECISION ratificada (allowlist abaixo, hoje vazia).
//
// NÃO MORDE (leitura/exibição legítima por id — nunca por nome):
//   - SELECT ... FROM neighborhoods WHERE neighborhood_id = $1 / city_id = $1 (list/lookup/exists)
//   - JOIN neighborhoods n ON n.neighborhood_id = ...  (display)
//   - ORDER BY name / SELECT name  (projeção de exibição, não filtro por nome)
//   - FK reservada addresses.neighborhood_id · FKs de regional_fund_accounts · migrations · comentários.
//
// Heurística textual comment-stripped (não AST): falso positivo torna o gate MAIS restritivo.
// Em validate:regression-guards.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const norm = (p) => p.split(sep).join('/');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Casa canônica futura: quando uma DECISION ratificada abrir a fundação de bairro, o(s)
// arquivo(s) do writer governado entram AQUI, conscientemente. Vazio = ninguém pode escrever bairro.
const CANONICAL_WRITER_ALLOW = new Set([
  // ex. (futuro N2, com DECISION): 'src/core/location/neighborhood-catalog.writer.ts'
]);

// FASE B (RFC B1-D · D-G, decisão ratificada em docs/02_decisions/RFC_ADDRESS_POSTAL_RESOLUTION_
// AND_CITY_GOVERNANCE.md): reconciliação NOMINAL consciente — o resolver postal canônico pode
// consultar `neighborhoods` por nome DENTRO da MESMA city EXCLUSIVAMENTE para sugerir um
// CANDIDATO read-only (`neighborhoodCandidateId`, status candidate_requires_confirmation), que
// exige confirmação humana e NUNCA vira `neighborhoodId` nem é persistido. A exceção vale por
// CAMINHO RELATIVO EXATO e SOMENTE para o check `name-resolution-sql`; TODOS os demais checks
// (writes, findOrCreateNeighborhood, matching em memória, id-from-display) continuam mordendo
// este arquivo. Qualquer outro arquivo que resolva bairro por nome segue proibido. A trava
// complementar (candidato nunca alimenta neighborhoodId; arquivo é read-only) vive no guard
// audit-postal-resolution-canonical-boundary.mjs.
const POSTAL_CANDIDATE_LOOKUP_ALLOW = new Set([
  'src/core/location/postal-territorial-evidence.repository.ts',
]);

const SRC = join(ROOT, 'src');
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === '__tests__' || e === 'node_modules' || e === 'scripts') continue;
      walk(p, acc);
    } else if (e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.d.ts')) {
      acc.push({ rel: norm(p.slice(ROOT.length + 1)), src: stripTs(readFileSync(p, 'utf-8')) });
    }
  }
  return acc;
}

const CHECKS = [
  { id: 'write-insert',        re: /INSERT\s+INTO\s+neighborhoods\b/i,
    msg: 'INSERT INTO neighborhoods — escrita no catálogo canônico proibida até F-NEIGHBORHOOD-CANONICAL-IDENTITY.' },
  { id: 'write-update',        re: /UPDATE\s+neighborhoods\b/i,
    msg: 'UPDATE neighborhoods — mutação do catálogo canônico proibida até a fundação governada.' },
  { id: 'write-delete',        re: /DELETE\s+FROM\s+neighborhoods\b/i,
    msg: 'DELETE FROM neighborhoods — remoção no catálogo canônico proibida até a fundação governada.' },
  { id: 'legacy-symbol',       re: /\bfindOrCreateNeighborhood\b/,
    msg: 'findOrCreateNeighborhood — writer legado de bairro por nome REVIVIDO (removido na N0.1).' },
  { id: 'name-resolution-sql', re: /FROM\s+neighborhoods\b[\s\S]{0,260}?\bWHERE\b[\s\S]{0,260}?(LOWER\s*\(\s*TRIM\s*\(\s*(\w+\.)?name|\b(\w+\.)?(name|name_normalized)\s*(=|ILIKE|LIKE)\s)/i,
    msg: 'resolução SQL de neighborhoods por igualdade de NOME (WHERE name =/ILIKE/LOWER(TRIM(name))) — bairro nunca é identidade por texto livre (DECISION-0079 §6).' },
  // LHS neighborhood_id/neighborhoodId recebendo texto de exibição/provider como FONTE. O window
  // para em separador de propriedade (, } ; \n) para NÃO cruzar para a próxima chave de um objeto
  // (ex.: `neighborhoodId: input.neighborhoodId ?? null, neighborhoodDisplay: ...` é passthrough legítimo).
  { id: 'id-from-display',     re: /(neighborhood_id|neighborhoodId)\s*[:=]\s*[^;\n,}]{0,70}?(neighborhood_display_text|neighborhoodDisplay|\.bairro\b|neighborhood_name|neighborhoodName)/,
    msg: 'neighborhood_id/neighborhoodId derivado de texto de exibição/provider (display_text/bairro/neighborhood_name) — proibido; texto de bairro só circula como exibição.' },
  // Resolução EM MEMÓRIA (o furo achado pela Yala no N0.1): carregar a lista de bairros da cidade
  // e casar por nome em JS. findNeighborhoodsByCity é legítimo SÓ para retornar a lista (getNeighborhoodsByCity);
  // segui-lo de .find/.filter/.some/.findIndex = resolver identidade a partir do nome.
  { id: 'name-resolution-mem', re: /findNeighborhoodsByCity\s*\([\s\S]{0,240}?\.(find|filter|some|findIndex)\s*\(/,
    msg: 'resolução EM MEMÓRIA de neighborhood a partir da lista da cidade (findNeighborhoodsByCity + .find/.filter/.some) — use findNeighborhoodById por id; bairro não é identidade por nome.' },
  // Casamento de uma lista pelo TEXTO de bairro do provider/exibição (variante do anterior sem depender
  // do nome do método repo — pega query builder/alias/outra fonte de lista).
  { id: 'name-match-display',  re: /\.(find|filter|some|findIndex)\s*\([\s\S]{0,140}?(neighborhoodName|neighborhoodDisplay|neighborhood_display_text|\.bairro\b)/,
    msg: 'matching de lista pelo TEXTO de bairro (provider/exibição) dentro de .find/.filter/.some — resolução textual de bairro proibida (DECISION-0079 §6).' },
];

const failures = [];
const files = existsSync(SRC) ? walk(SRC) : [];
for (const f of files) {
  if (CANONICAL_WRITER_ALLOW.has(f.rel)) continue;
  for (const c of CHECKS) {
    if (c.id === 'name-resolution-sql' && POSTAL_CANDIDATE_LOOKUP_ALLOW.has(f.rel)) continue;
    const m = c.re.exec(f.src);
    if (m) {
      const snippet = m[0].replace(/\s+/g, ' ').slice(0, 90);
      failures.push(`[${c.id}] ${f.rel}: ${c.msg}\n        ↳ "${snippet}"`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-freetext-writer-containment]:');
  for (const f of failures) console.error('   ❌ ' + f);
  console.error('\n→ Identidade de bairro é HOLD (DECISION-0079 §6 / DECISION-0166 D4). O texto de bairro só circula como exibição; neighborhood_id só nasce na fundação governada F-NEIGHBORHOOD-CANONICAL-IDENTITY. Para abrir a casa canônica: DECISION ratificada + registrar o writer em CANONICAL_WRITER_ALLOW (alteração consciente deste guard).');
  process.exit(1);
}
console.log(`GATE OK [neighborhood-freetext-writer-containment] — ${files.length} arquivos varridos; nenhum writer runtime (INSERT/UPDATE/DELETE) nem padrão conhecido de resolução textual→neighborhood_id (SQL por nome, matching em memória, derivação de display/provider, símbolo findOrCreateNeighborhood) detectado em backend/src; identidade de bairro em HOLD até F-NEIGHBORHOOD-CANONICAL-IDENTITY.`);

#!/usr/bin/env node
// Guard estrutural — F-SELFNAME-ALIAS-AT-BIRTH (2026-08-04).
//
// ╔═ O QUE ESTE GUARD CONSERTA — E NÃO É "FALTOU ALIAS" ══════════════════════════════════════
// A regra é sua e é de 2026-07-02: *"self-name = GARANTIA ESTRUTURAL (não deve depender de alguém
// lembrar de curar)"*. O que falhou não foi a regra: foi a FORMA da garantia.
//
//   · o backfill (20260702120000) é de DATA FIXA → protegeu o passado, não o futuro;
//   · o gate que vigia (validate-service-search-alias-selfname-invariant.ts) precisa de banco
//     vivo, então ficou FORA do runner estático → existe, está correto, e ninguém rodava.
//
// Resultado medido em 2026-08-04, cinco semanas depois: **141 de 175** canonical_services
// global/active sem self-name alias — 81% do catálogo indescobrível digitando o próprio nome do
// serviço, sem erro e sem log (search-by-term devolve lista vazia no miss).
//
// A pergunta que revela essa família (formulada pela instância de ARQUITETURA):
//     "esta garantia dispara no NASCIMENTO da linha nova, ou só numa varredura que alguém precisa
//      lembrar de rodar?"
//
// Este guard é a resposta: ele dispara no NASCIMENTO — sobre a migration, estaticamente, dentro do
// runner que já roda. Migration que cria canonical_service e não cria o alias fica vermelha ANTES
// de ser aplicada. O gate de banco continua existindo e valendo; ele varre, este previne.
//
// TETO SÓ-DESCE: as 17 migrations anteriores a hoje que criam serviço sem alias estão congeladas
// por NOME. Não são perdoadas — o backfill de reaplicação (20260804210000) já cobriu o dado delas;
// a lista existe para que uma migration NOVA não se esconda no meio de dívida velha. Some da lista
// só quem for corrigido; ninguém entra.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'migrations');
const failures = [];

/** Migrations ANTERIORES a 2026-08-04 que criam canonical_service sem alias. Congeladas por nome. */
const DIVIDA_CONGELADA = new Set([
  '20260611150000_canonical_variants_services_units_foundation.sql',
  '20260629120000_seed_beauty_service_catalog_bridge.sql',
  '20260629130000_seed_beauty_service_catalog_bridge_slice_b.sql',
  '20260707150000_canonical_services_work_labels.sql',
  '20260707160000_concepts_guincho_mudanca.sql',
  '20260707180000_rentable_resources_concepts_and_metadata.sql',
  '20260707210000_bens_imoveis_n0_ratificado.sql',
  '20260707250000_equipment_catalog_high_turn_seed.sql',
  '20260708260000_space_concepts_seed_and_applicability.sql',
  '20260708261000_repair_space_canonical_services.sql',
  '20260708300000_seed_event_format_concepts.sql',
  '20260708320000_shared_subject_concepts_seed.sql',
  '20260708350000_seed_event_service_concepts.sql',
  '20260722100000_seed_musical_performance_service_concept.sql',
  '20260722120000_seed_musical_equipment_concepts.sql',
  '20260803130000_show_orchestration_roles_not_equipment.sql',
  '20260803140000_musician_role_concepts.sql',
]);

if (!existsSync(DIR)) {
  failures.push('migrations/ ausente — fail-closed.');
} else {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
  if (arquivos.length === 0) failures.push('migrations/ sem .sql — fail-closed.');

  // Comentário SQL fora: um `--` explicando não conta como criar serviço nem como criar alias.
  const semComentario = (s) => s.replace(/--[^\n]*/g, '');

  let novasVerificadas = 0;
  for (const nome of arquivos) {
    const sql = semComentario(readFileSync(join(DIR, nome), 'utf-8'));
    const criaServico = /INSERT\s+INTO\s+(public\.)?canonical_services/i.test(sql);
    if (!criaServico) continue;
    const criaAlias = /INSERT\s+INTO\s+(public\.)?service_search_aliases/i.test(sql);

    if (DIVIDA_CONGELADA.has(nome)) {
      // Se alguém CONSERTAR uma da lista, ela deve sair da lista no mesmo commit.
      if (criaAlias) {
        failures.push(
          `${nome}: agora cria o alias — REMOVA da lista DIVIDA_CONGELADA neste guard, no MESMO commit. ` +
          'Teto que não desce quando o conserto acontece vira permissão.'
        );
      }
      continue;
    }

    novasVerificadas++;
    if (!criaAlias) {
      failures.push(
        `${nome}: cria canonical_service e NÃO cria self-name alias em service_search_aliases. ` +
        'Regra promulgada 2026-07-02 (self-name = garantia estrutural). O serviço nasceria ' +
        'indescobrível pelo próprio nome, sem erro e sem log. Molde: 20260804210000.'
      );
    }
  }

  if (novasVerificadas === 0 && failures.length === 0) {
    // Não é falha: só significa que nenhuma migration fora da dívida cria serviço. Registrado
    // para que "0 verificadas" nunca passe por "tudo certo" sem alguém notar.
    console.log('   (nenhuma migration fora da dívida congelada cria canonical_service)');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [canonical-service-selfname-alias-at-birth]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  'GATE OK [canonical-service-selfname-alias-at-birth] — toda migration NOVA que cria ' +
  'canonical_service também cria o self-name alias. A garantia dispara no NASCIMENTO da linha, ' +
  'não numa varredura que alguém precisa lembrar de rodar. 17 migrations de dívida congeladas por ' +
  'nome (dado já coberto pela reaplicação 20260804210000); a lista só encolhe.'
);

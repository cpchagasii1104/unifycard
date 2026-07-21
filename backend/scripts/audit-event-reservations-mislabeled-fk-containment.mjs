#!/usr/bin/env node
// Guard — F-EVENT-RESERVATIONS-MISLABELED-FK-CONTAIN (achado B7 do auditoria.md,
// DT-IDENTITY-TRIAD-AND-MISLABELED-FK parte c).
//
// A FK que mentia: event_reservations.global_user_id era `UUID REFERENCES actors(id)` — nome
// dizia global_user_id, FK apontava actors(id). Coluna redundante do actor_id genesis (NOT NULL,
// actor-first, o que home-feed ja le). Escrita so por codigo morto (occupancy.createReservation
// sem caller). RESOLUCAO: (1) codigo corrigido p/ actor_id; (2) migration 20260703120000 dropa a
// coluna fail-closed. Este guard impede a REGRESSAO da mentira.
//
// IMPORTANTE (escopo): os IRMAOS event_attendees.global_user_id e event_staff.global_user_id
// referenciam global_users(global_user_id) — nome HONESTO, fora de escopo. O guard morde SO
// event_reservations. NAO toca a triade CPF (DECISION-0062 F4/F5 = norm-blocked). Δbank=0.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { stripSqlComments, maskStringLiterals, splitStatements, referencesTarget, tokenPresent, extractExecuteLiterals } from './lib/sql-shape.mjs';

const ROOT = process.cwd();
const failures = [];

function read(p) {
  try { return readFileSync(join(ROOT, p), 'utf-8'); } catch { return ''; }
}
// remove comentarios (bloco, trailing/full // e --) para a heuristica textual olhar so codigo.
// Trailing tambem: senao um comentario explicativo "era global_user_id" dispara falso-positivo.
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')  // bloco /* */
    .replace(/--[^\n]*/g, '')          // SQL line (trailing ou full)
    .replace(/\/\/[^\n]*/g, '');       // JS line (trailing ou full)
}

// ── CHECK 1: occupancy.service.ts nao usa global_user_id em event_reservations ──
{
  const src = stripComments(read('src/modules/events/occupancy.service.ts'));
  if (/global_user_id/.test(src)) {
    failures.push('occupancy.service.ts voltou a referenciar global_user_id — a coluna FK que mentia foi DROPADA (migration 20260703120000). Use actor_id (canonico actor-first, o que home-feed ja le). [B7]');
  }
  // o INSERT/RETURNING de event_reservations deve nomear actor_id
  if (/INSERT\s+INTO\s+event_reservations/i.test(src) && !/occupancy_model_id,\s*actor_id/i.test(src)) {
    failures.push('occupancy.service.ts: INSERT INTO event_reservations nao lista actor_id na posicao canonica — a correcao B7 escreve actor_id (nao global_user_id).');
  }
}

// ── CHECK 2: occupancy.types.ts (EventReservation/ReservationRow) usa actor_id ──
{
  const src = stripComments(read('src/modules/events/occupancy.types.ts'));
  if (/global_user_id/.test(src)) {
    failures.push('occupancy.types.ts (EventReservation) voltou a declarar global_user_id — use actor_id. [B7]');
  }
}

// ── CHECK 3: a migration de DROP existe (prova que o schema foi corrigido) ──
{
  const drop = read('migrations/20260703120000_drop_event_reservations_mislabeled_global_user_id.sql');
  if (!/ALTER\s+TABLE\s+event_reservations\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+global_user_id/i.test(drop)) {
    failures.push('migration de DROP (20260703120000) ausente ou alterada — deve dropar event_reservations.global_user_id (a FK que mentia). [B7]');
  }
  // fail-closed preservado: deve abortar se houver dado divergente
  if (!/RAISE\s+EXCEPTION/i.test(drop) || !/IS\s+DISTINCT\s+FROM\s+actor_id/i.test(drop)) {
    failures.push('migration de DROP perdeu a guarda fail-closed (RAISE se global_user_id divergir de actor_id) — substrato de identidade exige recusar destruir sob incerteza. [B7]');
  }
}

// ── CHECK 4: nenhuma migration NOVA (> drop) re-adiciona a coluna mentirosa ──
// ENDURECIDO (F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION): reconhecimento estrutural via sql-shape.
// Fecha as evasoes do reconhecedor de forma unica — pega REFERENCES actors em FK inline E em
// ADD CONSTRAINT ... FOREIGN KEY (global_user_id) ... separado, com schema-qualification (public.actors),
// identifiers quoted ("actors"), multiline, ALTER TABLE ONLY, e coluna criada em statement anterior.
// PRECISAO (nao over-broaden): so morde o statement que toca event_reservations E menciona a COLUNA
// global_user_id E referencia actors. actor_id -> actors (canonico) e global_user_id -> global_users
// (irmaos honestos) permanecem legitimos; nome alternativo arbitrario (ex. actor_ref_id -> actors) e
// OUT_OF_SCOPE declarado desta tranche (o vicio documentado e o nome global_user_id).
{
  const HIST_ADD = '20260530470000_fix_occupancy_schema.sql';        // ADD original (historia imutavel, superada pelo DROP)
  const DROP_MIG = '20260703120000_drop_event_reservations_mislabeled_global_user_id.sql';
  let files = [];
  try { files = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')); } catch {}
  for (const f of files) {
    if (f === HIST_ADD || f === DROP_MIG) continue; // allowlist: historia + a propria migration de drop
    const raw = read(join('migrations', f));
    if (!/event_reservations/i.test(raw) || !/global_user_id/i.test(raw)) continue; // fora do escopo
    // codigo sem comentarios, com strings de dado mascaradas (dollar-quote preservado = codigo executavel)
    const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
    for (const stmt of splitStatements(clean)) {
      // o statement deve alterar event_reservations, nomear a COLUNA global_user_id e referenciar actors
      const touchesTable = /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?[a-zA-Z_][\w$]*"?\.)?"?event_reservations"?\b/i.test(stmt);
      const namesColumn = tokenPresent(stmt, 'global_user_id');
      const refsActors = referencesTarget(stmt, 'actors', { mode: 'fk' }).hit;
      if (touchesTable && namesColumn && refsActors) {
        failures.push(`migration ${f} RE-INTRODUZ event_reservations.global_user_id REFERENCES actors (forma: FK inline ou ADD CONSTRAINT separado, incl. schema-qualified/quoted) — a FK que mente foi dropada de proposito (B7). Use actor_id.`);
        break;
      }
    }
    // corpos EXECUTE estaticos que reintroduzem o vinculo (DDL em string literal resolvivel)
    for (const u of extractExecuteLiterals(raw)) {
      const body = u.resolvableText;
      if (body && tokenPresent(body, 'global_user_id') && referencesTarget(body, 'actors', { mode: 'fk' }).hit) {
        failures.push(`migration ${f}: EXECUTE reintroduz global_user_id REFERENCES actors em DDL dinamico resolvivel (B7). Use actor_id.`);
        break;
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-reservations-mislabeled-fk-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-reservations-mislabeled-fk-containment] — a FK que mentia (event_reservations.global_user_id → actors(id)) foi eliminada: codigo usa actor_id canonico (igual ao leitor vivo home-feed), migration dropa a coluna fail-closed, e nenhuma migration nova a re-introduz. Irmaos legitimos (event_attendees/event_staff → global_users) intocados. [B7/DT-IDENTITY-TRIAD-AND-MISLABELED-FK parte c]');

#!/usr/bin/env node
// audit-venue-location-name-ssot.mjs — Guard da SLICE S2 (VENUE ENRICHMENT) do arco "evento em si".
//
// TESE §2 (o CORAÇÃO desta fatia): o local do evento REUTILIZA o vocabulário JÁ canônico, NUNCA cunha
// sinônimo. Nome do Local = a chave EXISTENTE events.metadata.location_name (a mesma que o legacy
// events.service lê/escreve e o frontend "Nome do Local" liga). Logradouro = as colunas EXISTENTES
// addresses.street/number/complement. Papel = 'OPERATIONAL' (o mesmo já usado). Capacidade = events.max_attendees.
// ZERO coluna/tabela/role/migration nova.
//
// MORDE se (drift de nomeação — exatamente o erro que esta disciplina previne):
//  (a) uma coluna `venue_name`/`place_name` OU uma COLUNA `events.location_name` for criada em qualquer
//      migration — seria um SINÔNIMO da chave metadata.location_name (§2/§3);
//  (b) uma NOVA coluna de capacidade/audiência (venue_capacity/max_capacity/audience_size/lotacao/...) for
//      adicionada a events/addresses — o cluster de capacidade já é fundo (max_attendees é a verdade);
//  (c) o valor 'VENUE' for adicionado ao CHECK de address_assignments.role — o papel já é 'OPERATIONAL'.
//  (d) o material perder a REUTILIZAÇÃO: o writer de endereço do evento deixar de usar role='OPERATIONAL',
//      OU passar a gravar `location_name` como COLUNA de events (em vez do merge metadata), OU o INSERT
//      de addresses perder street/number.
//
// Comment-aware (strip de comentário SQL/JS) + literal-masked onde o scan é de CÓDIGO (a prosa pt-BR cita
// "nome do local"/"local"). Fail-closed. NÃO executa nada; lê tudo como DADOS.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSqlLiterals = (s) => s.replace(/'(?:''|[^'])*'/g, "''");
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);
const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

// Tokens PROIBIDOS (sinônimos da chave metadata.location_name).
const SYNONYM_COL = /\b(venue_name|place_name)\b/i;
// Sinônimos de CAPACIDADE proibidos em events/addresses (max_attendees é a verdade; NUNCA outra coluna).
const CAPACITY_SYNONYM = /\b(venue_capacity|event_capacity|max_capacity|audience_capacity|attendee_capacity|seat_capacity|audience_size|lota[cç][aã]o)\b/i;

// ══════════════════════ (a)(b)(c) MIGRATIONS: nenhum sinônimo/role/capacidade nova ══════════════════════
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = stripSql(raw);
      const sqlNoLit = stripSqlLiterals(sql);

      // (a1) venue_name / place_name em qualquer lugar (identificador de coluna) — sinônimo direto.
      if (SYNONYM_COL.test(sqlNoLit)) {
        note('SYNONYM-COL', `${f}: coluna venue_name/place_name PROIBIDA — é sinônimo de events.metadata.location_name (§2). REUSE a chave metadata.`);
      }

      // Statements DDL, separados por ';'. (usa versão sem literais p/ estrutura; literais p/ 'VENUE').
      const stmtsNoLit = sqlNoLit.split(';');
      const stmts = sql.split(';');
      for (let i = 0; i < stmtsNoLit.length; i += 1) {
        const sNoLit = stmtsNoLit[i];
        const sLit = stmts[i] ?? '';
        const isEventsDDL = /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(sNoLit) && /\bevents\b/i.test(sNoLit);
        const isAddrDDL = /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(sNoLit) && /\baddresses\b/i.test(sNoLit);
        const isAssignDDL = /\b(CREATE\s+TABLE|ALTER\s+TABLE|ALTER\s+TYPE)\b/i.test(sNoLit) && /\baddress_assignments\b/i.test(sNoLit);

        // (a2) COLUNA events.location_name (a chave é metadata, NÃO coluna).
        if (isEventsDDL && /\blocation_name\b/i.test(sNoLit)) {
          note('LOCATION-NAME-COL', `${f}: COLUNA events.location_name PROIBIDA — location_name vive em events.metadata (§2/§3). NÃO promova a coluna nesta fatia.`);
        }
        // (b) capacidade nova em events/addresses (cluster já fundo; max_attendees é a verdade).
        if ((isEventsDDL || isAddrDDL) && CAPACITY_SYNONYM.test(sNoLit)) {
          note('CAPACITY-SYNONYM', `${f}: nova coluna de capacidade/audiência PROIBIDA em events/addresses — REUSE events.max_attendees (§2, sem 2ª verdade de capacidade).`);
        }
        // (c) role 'VENUE' em address_assignments (o papel já é 'OPERATIONAL').
        if (isAssignDDL && /\brole\b/i.test(sNoLit) && /'VENUE'/i.test(sLit)) {
          note('ROLE-VENUE', `${f}: valor de role 'VENUE' PROIBIDO em address_assignments — REUSE 'OPERATIONAL' (§2, sem role sinônimo).`);
        }
      }
    }
  }
}

// ══════════════════════ (d) MATERIAL: a REUTILIZAÇÃO está presente no writer ══════════════════════
{
  const svc = readOrFail('src/core/events/event.service.ts', 'MATERIAL');
  if (svc) {
    const code = stripTs(svc);
    // O writer de endereço do evento usa role='OPERATIONAL' (papel reutilizado).
    if (!/'OPERATIONAL'/.test(code) || !/owner_type\s*,\s*owner_id\s*,\s*address_id\s*,\s*role/i.test(code)) {
      note('REUSE-ROLE', "event.service.ts: writer de endereço do evento deve inserir role='OPERATIONAL' (papel reutilizado; §2).");
    }
    // location_name é persistido pelo MERGE de metadata, NUNCA como coluna de events.
    if (/updates\.push\(\s*[`'"]location_name\s*=/.test(code)) {
      note('REUSE-METADATA-KEY', 'event.service.ts: location_name NÃO pode ser gravado como COLUNA de events (updates.push location_name = ...) — use o merge metadata (§2/§3).');
    }
    if (!/metaMerge\.location_name\s*=\s*input\.locationName/.test(code) && !/location_name/.test(code)) {
      note('REUSE-METADATA-KEY', 'event.service.ts: location_name deve ser persistido via merge de metadata (chave canônica reutilizada).');
    }
    // O INSERT de addresses do evento inclui street/number (colunas EXISTENTES reutilizadas).
    const addrInsert = code.match(/INSERT\s+INTO\s+addresses\s*\(([\s\S]*?)\)/i);
    if (!addrInsert || !/\bstreet\b/i.test(addrInsert[1]) || !/\bnumber\b/i.test(addrInsert[1])) {
      note('REUSE-STREET-NUMBER', 'event.service.ts: INSERT INTO addresses deve incluir street e number (colunas existentes reutilizadas; sem migration).');
    }
  }
}

// ══════════════════════ VEREDITO ══════════════════════
if (fails.length > 0) {
  console.error('GATE FAIL [venue-location-name-ssot] — drift de nomeação / reutilização perdida:');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('✅ audit-venue-location-name-ssot — S2 reutiliza metadata.location_name + street/number/complement + OPERATIONAL + max_attendees; zero sinônimo; zero coluna/role de capacidade nova.');
process.exit(0);

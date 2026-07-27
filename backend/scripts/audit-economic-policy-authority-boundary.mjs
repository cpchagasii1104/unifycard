#!/usr/bin/env node
// audit-economic-policy-authority-boundary.mjs — Guard da F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1
// (authority key + read-only consumer).
//
// A chave `economic_policy:manage` (permission-keys.ts) autoriza DEFINIR/LER a REGRA de split
// (economic_policies/economic_policy_lines) — NUNCA autoriza MOVER DINHEIRO (DECISION-0166 D6:
// "Admin configura policy; admin NÃO move dinheiro. O Bank executa."). Esta fatia é SÓ leitura
// (GET /economy/admin/policies); a escrita (Fatia 3) e a tela (Fatia 4) são fatias FUTURAS.
//
// MORDE se:
//  (a) `economic_policy:manage` aparecer dentro do array PORTA_HOLD_KEYS (company-policy-registry.ts)
//      — a chave nasce FORA do hold de dinheiro por construção; entrar no hold trancaria a tela de
//      REGRA atrás da porta de dinheiro (falha inversa ao que a fatia existe para provar);
//  (b) a chave for usada (como argumento real de requirePermission/fastify.requirePermission, fora
//      de comentário) no MESMO ARQUIVO em que aparece, também fora de comentário, um token de writer
//      do Bank (bankTransactionService, createTransaction*, transfer, bank_ledger, bank_transactions,
//      bank_splits, bank_accounts) — a chave gateando um caminho que toca o Bank rompe a fronteira
//      RULE≠MONEY;
//  (c) a rota admin (economic-policy-admin.routes.ts) perder o gate de autoridade REAL
//      (requireRole(['admin'])) OU o segundo gate explícito da chave (requirePermission(...)), OU
//      passar a ler o tenant de req.query/req.body em vez de req.tenant.id (mesma disciplina de
//      DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE);
//  (d) uma rota de ESCRITA (POST/PUT/PATCH/DELETE) aparecer na superfície admin de economic-policy
//      (economic-policy-admin.routes.ts) — esta fatia é READ-ONLY por construção; escrita = Fatia 3,
//      com seu próprio GATE/GO/proof, nunca introduzida por baixo aqui — OU se, em QUALQUER outro
//      arquivo do repositório, uma rota de escrita for gateada pela chave sem essa disciplina.
//
// Region-anchored (regionBetween, mesmo helper de audit-event-sector-meia-floor.mjs); comment/
// literal-aware (strip TS antes de qualquer match de código real). Fail-closed.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// Extrai a REGIÃO entre dois marcadores (mesmo mecanismo de audit-event-sector-meia-floor.mjs) —
// vai do INÍCIO do marcador inicial até o INÍCIO do marcador final (exclusive); sem marcador final,
// vai até o fim do texto; sem marcador inicial, região vazia.
const regionBetween = (code, startMarker, endMarker) => {
  const s = code.indexOf(startMarker);
  if (s < 0) return '';
  const rest = code.slice(s + startMarker.length);
  const eRel = endMarker ? rest.indexOf(endMarker) : -1;
  return eRel >= 0 ? code.slice(s, s + startMarker.length + eRel) : code.slice(s);
};

const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

const KEY = 'economic_policy:manage';
const KEY_LITERAL_RE = /['"]economic_policy:manage['"]/;
const BANK_TOKEN = /\b(bankTransactionService|createTransaction\w*|bank_ledger|bank_transactions|bank_splits|bank_accounts)\b|(?<![\w-])transfer(?![\w-])/;

const REGISTRY_PATH = 'src/core/authorization/company-policy-registry.ts';
const ROUTE_PATH = 'src/modules/economy/policy-engine/economic-policy-admin.routes.ts';
const KEYS_PATH = 'src/core/authorization/permission-keys.ts';

// ══════════════════════ (a) PORTA_HOLD_KEYS NÃO pode conter a chave ═══════════════════════════
{
  const raw = readOrFail(REGISTRY_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const region = regionBetween(code, 'export const PORTA_HOLD_KEYS', 'export function isPorta01Closed');
    if (!region) {
      note('PORTA-HOLD-REGION', `${REGISTRY_PATH}: array PORTA_HOLD_KEYS não encontrado (marcador ausente) — não foi possível ancorar o check.`);
    } else if (KEY_LITERAL_RE.test(region)) {
      note('BORN-OUTSIDE-HOLD', `${REGISTRY_PATH}: '${KEY}' apareceu dentro de PORTA_HOLD_KEYS — a chave de RULE (define policy) NUNCA pode entrar no hold de dinheiro (trancaria a tela de regra atrás da porta de dinheiro; DECISION-0166 D6).`);
    }

    // Classificação exaustiva (defesa em profundidade): a chave precisa estar classificada no
    // COMPANY_POLICY_REGISTRY (boot fail-closed já exige isso) — sem entrada aqui o boot cairia,
    // mas se alguém a classificar como company_grant* por engano, ela passaria a exigir grantColumn
    // de company_users (autoridade de MEMBERSHIP, nunca a intenção desta chave institucional).
    const registryRegion = regionBetween(code, 'export const COMPANY_POLICY_REGISTRY', '\n};');
    if (registryRegion && KEY_LITERAL_RE.test(registryRegion)) {
      const entryMatch = registryRegion.match(/'economic_policy:manage':\s*([a-zA-Z]+)\(/);
      if (!entryMatch) {
        note('CLASSIFICATION', `${REGISTRY_PATH}: '${KEY}' não tem uma classificação reconhecível (esperado algo como manual()) no COMPANY_POLICY_REGISTRY.`);
      } else if (entryMatch[1] === 'g') {
        note('CLASSIFICATION', `${REGISTRY_PATH}: '${KEY}' classificada como company_grant (g(...)) — isso a tornaria autoridade de MEMBERSHIP de empresa (company_users), nunca a intenção institucional/manual desta chave (DECISION-0166 D6).`);
      }
    } else if (!registryRegion) {
      note('REGISTRY-REGION', `${REGISTRY_PATH}: COMPANY_POLICY_REGISTRY não encontrado (marcador ausente).`);
    } else {
      note('CLASSIFICATION', `${REGISTRY_PATH}: '${KEY}' ausente do COMPANY_POLICY_REGISTRY — o boot (assertCompanyPolicyRegistryExhaustive) falharia.`);
    }
  }
}

// ══════════════════════ (b) fronteira RULE≠MONEY: chave nunca no MESMO arquivo que um writer do Bank ═══
{
  function* walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        yield* walk(p);
      } else if (entry.endsWith('.ts')) {
        yield p;
      }
    }
  }
  const SRC_DIR = join(ROOT, 'src');
  if (existsSync(SRC_DIR)) {
    for (const abs of walk(SRC_DIR)) {
      const raw = readFileSync(abs, 'utf8');
      const code = stripTs(raw);
      if (!KEY_LITERAL_RE.test(code)) continue; // chave só aparece em comentário (ou ausente) — não é uso real
      const bk = code.match(BANK_TOKEN);
      if (bk) {
        const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
        note('RULE-VS-MONEY', `${rel}: '${KEY}' e token de writer do Bank ('${bk[0]}') no MESMO arquivo, ambos fora de comentário — a chave de REGRA nunca pode compartilhar arquivo/gate com um writer de dinheiro (DECISION-0166 D6).`);
      }
    }
  }
}

// ══════════════════════ (c) rota admin: gate real presente + tenant SEMPRE de req.tenant ═══════════
{
  const raw = readOrFail(ROUTE_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    if (!/requireRole\(\['admin'\]\)/.test(code)) {
      note('ADMIN-GATE-MISSING', `${ROUTE_PATH}: gate real requireRole(['admin']) ausente — mesmo mecanismo institucional de ssot-admin.routes.ts/trust.routes.ts (actor_has_any_role, funcional).`);
    }
    if (!/requirePermission\(\s*ECONOMIC_POLICY_MANAGE_KEY\s*\)/.test(code) && !KEY_LITERAL_RE.test(code)) {
      note('KEY-GATE-MISSING', `${ROUTE_PATH}: a chave '${KEY}' não é referenciada no gate da rota — a chave viraria vocabulário fantasma (Fatia 1 existe para provar o contrário).`);
    }
    if (!/req\.tenant\.id/.test(code) && !/req\.tenant\?\.id/.test(code)) {
      note('TENANT-SOURCE-MISSING', `${ROUTE_PATH}: nenhuma leitura de tenantId a partir de req.tenant.id encontrada.`);
    }
    // Tenant NUNCA de query/body do cliente (mesma disciplina de DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE).
    if (/req\.query[^\n;]*tenantId/i.test(code) || /req\.body[^\n;]*tenantId/i.test(code)) {
      note('TENANT-SCOPE-LEAK', `${ROUTE_PATH}: tenantId parece ser lido de req.query/req.body — tenant é SEMPRE req.tenant.id (nunca cliente), sob pena de escopo cross-tenant.`);
    }
  }
}

// ══════════════════════ (d) esta fatia é READ-ONLY: nenhuma rota de escrita na superfície admin ═══
{
  const raw = readOrFail(ROUTE_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const WRITE_METHOD = /fastify\.(post|put|patch|delete)\s*[<(]/;
    const wm = code.match(WRITE_METHOD);
    if (wm) {
      note('WRITE-ROUTE-FORBIDDEN', `${ROUTE_PATH}: método de escrita '${wm[1]}' encontrado — Fatia 1 é READ-ONLY por construção; a escrita (POST/PUT/PATCH/DELETE) é a Fatia 3, com seu próprio GATE/GO/proof (nunca introduzida por baixo aqui).`);
    }
  }
  // Repo-wide: nenhuma OUTRA rota de escrita gateada por esta chave.
  function* walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        yield* walk(p);
      } else if (entry.endsWith('.routes.ts')) {
        yield p;
      }
    }
  }
  const SRC_DIR = join(ROOT, 'src');
  if (existsSync(SRC_DIR)) {
    for (const abs of walk(SRC_DIR)) {
      const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
      if (rel === ROUTE_PATH) continue; // já checado acima
      const code = stripTs(readFileSync(abs, 'utf8'));
      if (!KEY_LITERAL_RE.test(code)) continue;
      if (/fastify\.(post|put|patch|delete)\s*[<(]/.test(code)) {
        note('WRITE-ROUTE-FORBIDDEN', `${rel}: referencia '${KEY}' e registra rota de ESCRITA — a chave desta fatia só autoriza a superfície READ-ONLY (economic-policy-admin.routes.ts); qualquer escrita é Fatia 3, com GATE/GO próprios.`);
      }
    }
  }
}

// ══════════════════════ chave declarada no vocabulário canônico (permission-keys.ts) ═══════════════
{
  const raw = readOrFail(KEYS_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    if (!KEY_LITERAL_RE.test(code)) {
      note('KEY-DECLARATION-MISSING', `${KEYS_PATH}: '${KEY}' ausente do union PermissionKey / PERMISSION_CAPABILITIES.`);
    }
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [economic-policy-authority-boundary]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  "GATE OK [economic-policy-authority-boundary] — 'economic_policy:manage' nasce FORA de " +
  'PORTA_HOLD_KEYS (RULE≠MONEY); nunca compartilha arquivo com um token de writer do Bank; a rota ' +
  "admin (economic-policy-admin.routes.ts) mantém requireRole(['admin']) + gate explícito da chave, " +
  'tenant sempre de req.tenant.id (nunca query/body); superfície é READ-ONLY (zero rota POST/PUT/' +
  'PATCH/DELETE gateada por esta chave, aqui ou em qualquer outro arquivo).'
);

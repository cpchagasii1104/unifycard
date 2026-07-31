#!/usr/bin/env node
// audit-economic-policy-authority-boundary.mjs — Guard da F-ECONOMIC-POLICY-ADMIN-FRONT.
// FATIA 1 (authority key + read-only consumer) EVOLUÍDO para FATIA 2 (write API versionado) —
// mesmo guard, escopo estendido (a escrita chegou de forma GOVERNADA; o guard passa a vigiar
// a DISCIPLINA da escrita, não mais a ausência dela).
//
// A chave `economic_policy:manage` (permission-keys.ts) autoriza DEFINIR/LER a REGRA de divisão
// de valores (economic_policies/economic_policy_lines) — NUNCA autoriza MOVER DINHEIRO
// (DECISION-0166 D6: "Admin configura policy; admin NÃO move dinheiro. O Bank executa."). A
// Fatia 1 era SÓ leitura; a Fatia 2 adiciona a publicação de VERSÕES NOVAS (nunca edição de uma
// policy existente — Artigo V) e a ativação (draft→active, única transição permitida). A tela
// (Fatia 4) continua fatia FUTURA.
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
//  (b2) QUALQUER arquivo do write path desta fatia (rota, repository, validação) referenciar um
//      token de writer do Bank fora de comentário — mesma fronteira RULE≠MONEY, agora vigiada nos
//      arquivos de escrita independentemente de conterem o literal da chave;
//  (c) a rota admin (economic-policy-admin.routes.ts) perder o gate de autoridade REAL
//      (requireRole(['admin'])) OU o segundo gate explícito da chave (requirePermission(...)), OU
//      passar a ler o tenant de req.query/req.body em vez de req.tenant.id (mesma disciplina de
//      DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE);
//  (d) uma rota PUT/PATCH/DELETE aparecer na superfície admin de economic-policy — Artigo V ("não
//      existe ajuste administrativo"): esta superfície NUNCA edita uma policy existente, só
//      publica versões novas (POST) e ativa (POST .../activate). Ou se uma rota POST aparecer em
//      um path diferente dos dois mandatados (drift de superfície não revisado) — OU se, em
//      QUALQUER outro arquivo do repositório, uma rota de escrita for gateada pela chave sem essa
//      disciplina;
//  (e) createdByActorId/tenantId passarem a ser lidos de req.body em vez de
//      req.actionContext.actorId / req.tenant.id (autoria e tenant sempre server-derived —
//      Artigo I, "não existem contas-deus");
//  (f) changeReason deixar de ser obrigatório na validação de escrita (Artigo XI — "emendas
//      públicas, justificadas, nunca silenciosas");
//  (g) o repository passar a executar UPDATE em economic_policies fora do padrão exato
//      "SET status = 'active' ... WHERE ... status = 'draft'" — qualquer outro UPDATE seria uma
//      edição de policy existente por baixo da trava de imutabilidade (Artigo V);
//  (h) a função assertPolicyLinesValid (ponto de extensão único de limites) perder a checagem de
//      faixa de bps (0..10000), a checagem de soma fechando 10000, ou a exigência de linha
//      revenue_share — a regressão silenciosa do único portão de percentual;
//  (i) DT-ECONOMIC-POLICY-PANEL-FE-BE-DIVERGENCE (2026-07-31): o FRONTEND (EconomicPoliciesPage.tsx)
//      voltar a decidir SOZINHO se uma policy é válida — reimplementando a regra de revenue_share
//      dentro de `canSubmit` ("espelho" que divergiu quando o backend mudou de propósito e ficou
//      pra trás: painel mostrava verde pra policy que o servidor recusava, e bloqueava policy que
//      o servidor aceitava). O backend é a ÚNICA autoridade (400 com mensagem pronta); o FE só
//      projeta o input do usuário. Cross-check read-only sobre frontend/src, mesmo padrão de
//      audit-economic-v2-containment.mjs (e) / audit-disputes-frontend-honest-containment.mjs.
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
const REPO_PATH = 'src/modules/economy/policy-engine/economic-policy.repository.ts';
const VALIDATION_PATH = 'src/modules/economy/policy-engine/economic-policy-write-validation.ts';
/** Os únicos 3 arquivos do WRITE PATH desta fatia — usados pelos checks (b2)/(e)/(f)/(g)/(h). */
const WRITE_PATH_FILES = [ROUTE_PATH, REPO_PATH, VALIDATION_PATH];

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

// ══════════════════════ (b2) RULE≠MONEY nos arquivos do WRITE PATH — independente do literal da chave ═══
{
  for (const rel of WRITE_PATH_FILES) {
    const raw = readOrFail(rel, 'FILE');
    if (!raw) continue;
    const code = stripTs(raw);
    const bk = code.match(BANK_TOKEN);
    if (bk) {
      note('RULE-VS-MONEY-WRITE-PATH', `${rel}: token de writer do Bank ('${bk[0]}') encontrado fora de comentário — o write path desta fatia grava REGRA (economic_policies/economic_policy_lines), nunca pode tocar o Bank (RULE≠MONEY, DECISION-0166 D6, Lei 5).`);
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

// ══════════════════════ (d) Artigo V: nunca PUT/PATCH/DELETE; POST só nos 2 paths mandatados ═══════
{
  const raw = readOrFail(ROUTE_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const EDIT_METHOD = /fastify\.(put|patch|delete)\s*[<(]/;
    const em = code.match(EDIT_METHOD);
    if (em) {
      note('EDIT-ROUTE-FORBIDDEN', `${ROUTE_PATH}: método de EDIÇÃO '${em[1]}' encontrado — esta superfície nunca edita uma policy existente (Artigo V, "não existe ajuste administrativo"); toda mudança de regra é POST de uma versão nova.`);
    }
    const postPaths = [...code.matchAll(/fastify\.post[^(]*\(\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
    const ALLOWED_POST_PATHS = new Set(['/admin/policies', '/admin/policies/:id/activate']);
    for (const p of postPaths) {
      if (!ALLOWED_POST_PATHS.has(p)) {
        note('POST-PATH-DRIFT', `${ROUTE_PATH}: POST em path não mandatado '${p}' — os únicos 2 paths de escrita previstos pela Fatia 2 são ${[...ALLOWED_POST_PATHS].join(' e ')}.`);
      }
    }
    for (const expected of ALLOWED_POST_PATHS) {
      if (!postPaths.includes(expected)) {
        note('POST-PATH-MISSING', `${ROUTE_PATH}: POST '${expected}' esperado pela Fatia 2 não foi encontrado.`);
      }
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
        note('WRITE-ROUTE-FORBIDDEN', `${rel}: referencia '${KEY}' e registra rota de ESCRITA — o write path desta chave é exclusivamente economic-policy-admin.routes.ts; qualquer outra rota é drift não revisado.`);
      }
    }
  }
}

// ══════════════════════ (e) autoria/tenant SEMPRE server-derived — nunca do corpo da requisição ═══
{
  const raw = readOrFail(ROUTE_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    // Self-bound (R8F, mesmo padrão de core/plan/plan.routes.ts): actor do PRÓPRIO admin
    // resolvido de req.user.userId via findByUserId — NUNCA de actionContext.actorId (canal
    // client-declared, DECISION-0113 canal-1). Ver audit-actor-authority-boundary.mjs.
    if (!/findByUserId\(\s*tenantId\s*,\s*req\.user\.userId\s*\)/.test(code)) {
      note('AUTHOR-SOURCE-MISSING', `${ROUTE_PATH}: nenhuma resolução self-bound de actor (findByUserId(tenantId, req.user.userId)) encontrada — created_by_actor_id precisa ser SEMPRE o actor do PRÓPRIO admin autenticado, nunca actionContext.actorId (Artigo I + DECISION-0113 canal-1).`);
    }
    if (/actionContext\??\.actorId/.test(code)) {
      note('AUTHOR-CLIENT-DECLARED-CHANNEL', `${ROUTE_PATH}: actionContext.actorId (canal client-declared) foi reintroduzido — a autoria desta escrita é self-bound (req.user.userId), nunca um actorId declarado pelo cliente (DECISION-0113 canal-1, audit-actor-authority-boundary.mjs).`);
    }
    if (/req\.body[^\n;]*createdByActorId/i.test(code) || /req\.body[^\n;]*\.actorId/i.test(code)) {
      note('AUTHOR-SCOPE-LEAK', `${ROUTE_PATH}: createdByActorId/actorId parece ser lido de req.body — autoria é SEMPRE server-derived (Artigo I, "não existem contas-deus").`);
    }
  }
}

// ══════════════════════ (f) Artigo XI: changeReason obrigatório na validação de escrita ═══════════
{
  const raw = readOrFail(VALIDATION_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const region = regionBetween(code, 'export function assertCreatePolicyVersionRequestValid', '\n}');
    if (!region) {
      note('CHANGE-REASON-REGION', `${VALIDATION_PATH}: função assertCreatePolicyVersionRequestValid não encontrada (marcador ausente).`);
    } else if (!/changeReason/.test(region) || !/badRequest/.test(region)) {
      note('CHANGE-REASON-NOT-MANDATORY', `${VALIDATION_PATH}: assertCreatePolicyVersionRequestValid não parece rejeitar changeReason ausente/vazio com HttpError.badRequest — Artigo XI exige justificativa obrigatória em toda versão nova.`);
    }
  }
}

// ══════════════════════ (g) repository: único UPDATE em economic_policies é a ativação draft→active ═
{
  const raw = readOrFail(REPO_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const updateMatches = [...code.matchAll(/UPDATE\s+economic_policies\b/gi)];
    for (const m of updateMatches) {
      // Janela de contexto após o UPDATE (até 400 chars) para validar o padrão exato permitido.
      const window = code.slice(m.index, m.index + 400);
      const isActivationPattern =
        /SET\s+status\s*=\s*'active'/i.test(window) && /status\s*=\s*'draft'/i.test(window);
      if (!isActivationPattern) {
        note('UPDATE-BEYOND-ACTIVATION', `${REPO_PATH}: UPDATE em economic_policies fora do padrão exato de ativação (SET status='active' ... WHERE status='draft') — qualquer outro UPDATE seria edição de policy existente por baixo da trava de imutabilidade (Artigo V).`);
      }
    }
  }
}

// ══════════════════════ (h) assertPolicyLinesValid mantém faixa/soma/revenue_share — ponto de extensão ═
{
  const raw = readOrFail(VALIDATION_PATH, 'FILE');
  if (raw) {
    const code = stripTs(raw);
    const region = regionBetween(code, 'export function assertPolicyLinesValid', '\nexport function');
    if (!region) {
      note('BPS-VALIDATION-REGION', `${VALIDATION_PATH}: função assertPolicyLinesValid não encontrada (marcador ausente) — o ponto de extensão único de limites precisa existir e ser nomeado assim.`);
    } else {
      if (!/[<>]=?\s*10000/.test(region) && !/10000/.test(region)) {
        note('BPS-RANGE-MISSING', `${VALIDATION_PATH}: assertPolicyLinesValid não parece validar a faixa 0..10000 de bps.`);
      }
      if (!/bpsSum\s*!==\s*10000/.test(region) && !/10000/.test(region)) {
        note('BPS-SUM-MISSING', `${VALIDATION_PATH}: assertPolicyLinesValid não parece exigir que a soma dos bps feche 10000.`);
      }
      if (!/revenue_share/.test(region)) {
        note('REVENUE-SHARE-MISSING', `${VALIDATION_PATH}: assertPolicyLinesValid não parece exigir uma linha revenue_share para absorver o resíduo de arredondamento (K_pe_7).`);
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

// ══════════════════════ (i) FE não decide validade de policy por regra própria (canSubmit) ═══════
{
  const FE_PATH = 'frontend/src/admin/EconomicPoliciesPage.tsx';
  const feAbs = resolve(ROOT, '..', FE_PATH);
  if (!existsSync(feAbs)) {
    note('FE-FILE-MISSING', `${FE_PATH}: arquivo ausente — cross-check de FE não decidir validade não verificável.`);
  } else {
    const feCode = stripTs(readFileSync(feAbs, 'utf8'));
    const canSubmitRegion = regionBetween(feCode, 'const canSubmit =', ';');
    if (!canSubmitRegion) {
      note('FE-CANSUBMIT-REGION', `${FE_PATH}: definição de canSubmit não encontrada (marcador ausente) — DT-ECONOMIC-POLICY-PANEL-FE-BE-DIVERGENCE não verificável.`);
    } else {
      if (/revenue_share/i.test(canSubmitRegion)) {
        note('FE-CANSUBMIT-REVENUE-SHARE', `${FE_PATH}: canSubmit voltou a referenciar 'revenue_share' — o frontend voltou a decidir validade de policy por regra própria; o backend é a única autoridade (400 com mensagem pronta).`);
      }
      if (/\bsumOk\b/.test(canSubmitRegion)) {
        note('FE-CANSUBMIT-SUMOK', `${FE_PATH}: canSubmit voltou a referenciar 'sumOk' (a variável composta que causou a divergência FE/BE original) — reimplementação de regra de negócio no cliente.`);
      }
    }
    if (/Falta uma linha revenue_share/i.test(feCode)) {
      note('FE-DEAD-ERROR-TEXT', `${FE_PATH}: texto "Falta uma linha revenue_share" reapareceu — era o veredito ERRADO do espelho divergente; a mensagem correta vem do backend (400), nunca de texto fixo no cliente.`);
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
  'PORTA_HOLD_KEYS (RULE≠MONEY); nunca compartilha arquivo com um token de writer do Bank, nos 3 ' +
  "arquivos do write path; a rota admin mantém requireRole(['admin']) + gate explícito da chave, " +
  'tenant sempre de req.tenant.id e autor sempre SELF-BOUND (req.user.userId via findByUserId, ' +
  'nunca actionContext.actorId — DECISION-0113 canal-1); zero rota PUT/PATCH/DELETE (Artigo V); ' +
  'POST restrito aos 2 paths mandatados (versão nova + ' +
  'ativação draft→active); changeReason obrigatório (Artigo XI); o único UPDATE em ' +
  'economic_policies é a ativação; assertPolicyLinesValid preserva faixa/soma/revenue_share; ' +
  'frontend (EconomicPoliciesPage.tsx) não decide validade de policy — canSubmit sem revenue_share/sumOk.'
);

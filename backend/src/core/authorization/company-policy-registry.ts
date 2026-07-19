// backend/src/core/authorization/company-policy-registry.ts
// DECISION-0189 (F-COMPANY-ACCESS-AUTHORITY-FOUNDATION, F2) — REGISTRY EXAUSTIVO DE POLICIES.
//
// R3 ratificada: TODA PermissionKey precisa de classificação EXPLÍCITA aqui. Chave sem
// classificação, ou classificação company_grant* sem coluna mapeada, QUEBRA O BOOT
// (assertCompanyPolicyRegistryExhaustive — chamada em BOOT.ts, mesmo padrão de
// assertSensitivePermissionsHaveCapabilityMapping). Não existe fallback implícito para
// ownership/role/is_primary/capability-base: chave nova nasce classificada ou o servidor não sobe.
//
// A TRÍADE (R2): PermissionKey (aqui) × Actor capability (PERMISSION_CAPABILITIES) ×
// Subject grant (coluna can_* de company_users — allowlist TIPADA abaixo; NUNCA SQL de
// string vinda do cliente).
//
// O CATÁLOGO PERSISTIDO (company_permission_catalog) é MATERIALIZAÇÃO deste registro
// (R16): companyCatalogRows() gera as linhas convidáveis/delegáveis; o digest SHA-256 da
// serialização canônica é comparado com o do banco no boot (divergência = boot falha).

import { createHash } from 'crypto';
import type { PermissionKey } from './permission-keys';
import { getAllPermissionKeys, PERMISSION_CAPABILITIES } from './permission-keys';

/** Allowlist TIPADA das colunas de subject grant em company_users (DECISION-0189 §2.3). */
export const COMPANY_GRANT_COLUMNS = [
  'can_view_financial',
  'can_manage_financial',
  'can_manage_members',
  'can_manage_company',
  'can_publish_feed',
  'can_interact_feed',
  'can_create_events',
  'can_manage_employees',
  'can_manage_services',
  'can_view_reports',
] as const;
export type CompanyGrantColumn = (typeof COMPANY_GRANT_COLUMNS)[number];

/** Grants PROTEGIDOS (§2.3 nota 3): só company:manage_governance concede/revoga/transfere. */
export const PROTECTED_GRANT_COLUMNS: readonly CompanyGrantColumn[] = [
  'can_manage_company',
  'can_manage_members',
  'can_manage_financial',
];

export type CompanyPolicyClassification =
  /** autorizada por subject grant em company_users (membro ativo + coluna true) */
  | 'company_grant'
  /** como company_grant e TERMINAL: nenhum fallback de ownership/role/is_primary/capability-base */
  | 'company_grant_terminal'
  /** só o próprio actor humano (recurso prova o dono server-side) */
  | 'self_only'
  /** atribuição manual/institucional (admin:*, view_all_ledger etc.) — nunca por membership */
  | 'manual_assignment'
  /** decisor legado mantido (ownership de gestão SEM role) até frente própria — resíduo CONTIDO */
  | 'legacy_ownership_contained'
  /** vocabulário territorial (actor_capability_grants) — fora do domínio empresa */
  | 'territory';

export interface CompanyPolicyEntry {
  classification: CompanyPolicyClassification;
  /** obrigatória quando classification = company_grant | company_grant_terminal */
  grantColumn?: CompanyGrantColumn;
  /** comportamento quando o actor alvo é um GRUPO (R6): default herdado do legado; 'fail_closed' nega SEMPRE enquanto o substrato D9.2 dorme */
  groupBehavior?: 'fail_closed';
  /** pode compor convite (F5)? Protegidas NUNCA (§2.3 nota 2). */
  invitable?: boolean;
  /** pode viver em actor_delegations para representante EXTERNO (não-membership)? */
  delegable?: boolean;
  /** grant protegido (§4.2 — só governança administra)? */
  protected?: boolean;
  /**
   * Override da actor capability NO CONTEXTO EMPRESA (tríade §2.3) quando o mapa global
   * (PERMISSION_CAPABILITIES) ainda carrega o valor legado de outro contexto.
   * Caso único v1: manage_members → can_manage_members (global segue can_delegate p/ grupo
   * até o dispatch matar o contexto grupo em fail-closed).
   */
  companyActorCapability?: string;
}

const g = (
  grantColumn: CompanyGrantColumn,
  opts: { terminal?: boolean; invitable?: boolean; delegable?: boolean; protected?: boolean; groupBehavior?: 'fail_closed' } = {}
): CompanyPolicyEntry => ({
  classification: opts.terminal ? 'company_grant_terminal' : 'company_grant',
  grantColumn,
  invitable: opts.invitable ?? false,
  delegable: opts.delegable ?? false,
  protected: opts.protected ?? false,
  ...(opts.groupBehavior ? { groupBehavior: opts.groupBehavior } : {}),
});
const legacy = (): CompanyPolicyEntry => ({ classification: 'legacy_ownership_contained' });
const manual = (): CompanyPolicyEntry => ({ classification: 'manual_assignment' });
const territory = (): CompanyPolicyEntry => ({ classification: 'territory' });
const selfOnly = (): CompanyPolicyEntry => ({ classification: 'self_only' });

/**
 * CLASSIFICAÇÃO EXAUSTIVA (uma linha por PermissionKey do mapa v1.7).
 * `legacy_ownership_contained` NÃO é fallback silencioso: é classificação EXPLÍCITA de resíduo
 * contido (decisor atual sem role — DT-CANREPRESENTACTOR-PER-ROUTE-EXACT-PERMISSION /
 * DT-COMPANY-FINE-GRANTS-PERMISSION-KEYS listam a fila de migração por rota).
 */
export const COMPANY_POLICY_REGISTRY: Record<PermissionKey, CompanyPolicyEntry> = {
  // FEED
  publish_feed: g('can_publish_feed', { invitable: true, delegable: true }),
  // DECISION-0189B D4: interagir (reactions/comments) = grant fino próprio can_interact_feed,
  // convidável e delegável, NÃO protegido; nunca por role/can_manage_company/canRepresentActor.
  // grupos/canais SEM substrato promulgado → fail-closed (nega no dispatch antes de ownership).
  interact_feed: g('can_interact_feed', { invitable: true, delegable: true, groupBehavior: 'fail_closed' }),
  moderate_feed: legacy(),

  // BANK — leituras financeiras privadas são TERMINAIS via can_view_financial;
  // gestão/execução financeira TERMINAL via can_manage_financial (R5).
  manage_financial: g('can_manage_financial', { terminal: true, protected: true }),
  receive_funds: legacy(), // recepção passiva (conta da empresa recebe) — não é ação de membro
  view_financial: g('can_view_financial', { terminal: true, invitable: true }),
  'financial_terms:view': g('can_view_financial', { terminal: true }),
  'financial_terms:confirm': g('can_manage_financial', { terminal: true, protected: true }),
  'split:view': g('can_view_financial', { terminal: true }),
  'split:create': g('can_manage_financial', { terminal: true, protected: true }),
  'financial:execute_payout': g('can_manage_financial', { terminal: true, protected: true }),
  'financial:view_ledger': g('can_view_financial', { terminal: true }),
  'financial:view_all_ledger': manual(), // + PORTA_HOLD (0189A D7: sem assignment explícito → deny SEMPRE)
  'calendar:view': legacy(),
  'calendar:block': legacy(),
  'calendar:unblock': legacy(),

  // EVENTS
  create_events: g('can_create_events', { invitable: true, delegable: true }),
  manage_events: legacy(),
  manage_attendees: legacy(),

  // GROUPS — manage_members é CONTEXTUAL (R6): empresa → grant; grupo → substrato D9.2
  // DORMENTE ⇒ fail-closed (nega SEMPRE; nunca cai no fallback antigo de ownership).
  create_groups: legacy(),
  manage_groups: legacy(),
  manage_members: {
    ...g('can_manage_members', { terminal: true, protected: true, groupBehavior: 'fail_closed' }),
    companyActorCapability: 'can_manage_members',
  },

  // SERVICES (catálogo/pedidos — decisores próprios já selados por frentes anteriores)
  offer_services: legacy(),
  manage_bookings: legacy(),
  'service_order:create': legacy(),
  'service_order:view': legacy(),
  'service_order:confirm': legacy(),
  'service_order:start': legacy(),
  'service_order:complete': legacy(),
  'service_order:cancel': legacy(),
  'service_order:confirm_completion': legacy(),
  'services:create': legacy(),
  'services:edit': legacy(),
  'services:disable': legacy(),
  'rfq:create': legacy(),
  'rfq:view': legacy(),
  'rfq:close': legacy(),
  'rfq:convert': legacy(),
  'quote:submit': legacy(),
  'quote:view': legacy(),
  'bundle:create': legacy(),
  'bundle:view': legacy(),
  'bundle:confirm': legacy(),

  // RIDES
  request_ride: selfOnly(),
  accept_ride: legacy(),
  manage_ride: legacy(),

  // COMPANIES
  delegate: legacy(), // representação entre actors — writer próprio (company-members/bridge) gateia
  'company:manage_governance': g('can_manage_company', { terminal: true, protected: true }),
  'company:manage_employees': g('can_manage_employees', { invitable: true }),
  'company:manage_services': g('can_manage_services', { invitable: true }),
  'company:view_reports': g('can_view_reports', { invitable: true }),

  // VOTES
  create_vote: legacy(),
  cast_vote: legacy(),

  // INSTITUTIONAL
  invite_pilot_user: manual(),
  'admin:view_regional_fund': manual(),
  'admin:view_consolidated_balance': manual(),
  'admin:view_fund_reports': manual(),
  'admin:view_audit_logs': manual(),

  // MARKETPLACE (capability can_manage_marketplace + decisores próprios — contido)
  marketplace_manage_catalog: legacy(),
  marketplace_manage_products: legacy(),
  marketplace_manage_inventory: legacy(),
  marketplace_manage_orders: legacy(),
  marketplace_execute_payments: legacy(),
  // 0189A D7: payouts/splits SAEM de legacy_ownership_contained → manual + PORTA_HOLD
  // (terminais fail-closed enquanto PORTA 01 fechada; religar = decisão da PORTA 01).
  marketplace_manage_splits: manual(),
  marketplace_execute_payouts: manual(),
  marketplace_pdv_sell: legacy(),
  marketplace_pdv_manage_customers: legacy(),
  marketplace_pdv_view_customers: legacy(),
  MARKETPLACE_STORE_CREATE: legacy(),
  MARKETPLACE_STORE_VIEW: legacy(),
  MY_ORDERS_VIEW: legacy(),
  'canonical_products:create': legacy(),

  // REPORTS
  view_consolidated_reports: manual(),
  'reports:view_operational': legacy(),
  'dashboard:view': legacy(),

  // TERRITORY
  'territory:create_neighborhood': territory(),
  'territory:approve_neighborhood': territory(),
  'territory:correct_neighborhood': territory(),
  'territory:deactivate_neighborhood': territory(),
  'territory:manage_neighborhood_aliases': territory(),
  'territory:register_neighborhood_succession': territory(),
};

/**
 * 🔒 DECISION-0189A §5 (D7) — PORTA_HOLD: chaves de dinheiro SENSÍVEL sem mecanismo de
 * atribuição explícita vivo. DENY TERMINAL para QUALQUER actor/principal (inclusive self —
 * "ownership genérico" nunca as concede) enquanto a PORTA 01 estiver fechada. O deny é
 * ESTRUTURAL no decisor — não depende de tabela fantasma ("zero linhas" não é segurança).
 */
export const PORTA_HOLD_KEYS: readonly PermissionKey[] = [
  'financial:view_all_ledger',
  'marketplace_execute_payouts',
  'marketplace_manage_splits',
  // 0189B D3: HOLD terminal EXAUSTIVO das chaves que movimentam/capturam/pagam/liquidam/dividem
  // dinheiro (inventário `F_COMPANY_ACCESS_AUTHORITY_FINANCIAL_INVENTORY_2026-07-19.md`). O deny
  // precede self/ownership/role/capability/delegation/grants/canRepresentActor enquanto a PORTA 01
  // estiver fechada. Religar = campanha própria da PORTA 01 (nunca afrouxar aqui).
  'financial:execute_payout',
  'marketplace_execute_payments',
  'split:create',
];

/** Chaves com dispatch TERMINAL para actor de EMPRESA (curto-circuito antes de ownership). */
export function isCompanyTerminalKey(key: PermissionKey): boolean {
  return COMPANY_POLICY_REGISTRY[key]?.classification === 'company_grant_terminal';
}

/** Chaves resolvidas por subject grant (terminais ou não) para actor de EMPRESA. */
export function companyGrantColumnFor(key: PermissionKey): CompanyGrantColumn | null {
  const entry = COMPANY_POLICY_REGISTRY[key];
  if (!entry) return null;
  if (entry.classification === 'company_grant' || entry.classification === 'company_grant_terminal') {
    return entry.grantColumn ?? null;
  }
  return null;
}

const GRANT_COLUMN_RE = /^can_[a-z_]+$/;

/**
 * BOOT FAIL-CLOSED (R3): exaustividade + validade das colunas. Chamada síncrona em BOOT.ts.
 */
export function assertCompanyPolicyRegistryExhaustive(): void {
  for (const key of getAllPermissionKeys()) {
    const entry = COMPANY_POLICY_REGISTRY[key];
    if (!entry) {
      throw new Error(
        `[AUTH CONFIG ERROR] PermissionKey "${key}" sem classificação no COMPANY_POLICY_REGISTRY (DECISION-0189 R3 — chave nova nasce classificada ou o boot falha)`
      );
    }
    const isGrant =
      entry.classification === 'company_grant' || entry.classification === 'company_grant_terminal';
    if (isGrant) {
      if (!entry.grantColumn || !(COMPANY_GRANT_COLUMNS as readonly string[]).includes(entry.grantColumn)) {
        throw new Error(
          `[AUTH CONFIG ERROR] PermissionKey "${key}" classificada como ${entry.classification} sem grantColumn válida na allowlist COMPANY_GRANT_COLUMNS`
        );
      }
      if (!GRANT_COLUMN_RE.test(entry.grantColumn)) {
        throw new Error(`[AUTH CONFIG ERROR] grantColumn "${entry.grantColumn}" com formato inválido`);
      }
      if (entry.protected && !PROTECTED_GRANT_COLUMNS.includes(entry.grantColumn)) {
        throw new Error(
          `[AUTH CONFIG ERROR] PermissionKey "${key}" marcada protected mas coluna "${entry.grantColumn}" fora de PROTECTED_GRANT_COLUMNS`
        );
      }
      if (entry.invitable && entry.protected) {
        throw new Error(
          `[AUTH CONFIG ERROR] PermissionKey "${key}" não pode ser convidável E protegida (DECISION-0189 §2.3 nota 2)`
        );
      }
    } else if (entry.grantColumn) {
      throw new Error(
        `[AUTH CONFIG ERROR] PermissionKey "${key}" (${entry.classification}) não pode carregar grantColumn`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO MATERIALIZADO (R16) — código soberano; banco = materialização versionada
// ─────────────────────────────────────────────────────────────────────────────

// v2 (DECISION-0189B D4): + interact_feed (reactions/comments). Materializado por
// migration 20260719200000 (novo digest); boot compara e falha em divergência (R16).
export const COMPANY_PERMISSION_CATALOG_VERSION = 2;

export interface CompanyCatalogRow {
  permissionKey: PermissionKey;
  actorCapability: string | null;
  subjectGrantColumn: CompanyGrantColumn;
  classification: 'company_grant' | 'company_grant_terminal';
  invitable: boolean;
  delegable: boolean;
  protected: boolean;
}

/** Linhas do catálogo V1 = exatamente as chaves da tabela normativa DECISION-0189 §2.3. */
export const COMPANY_CATALOG_KEYS: readonly PermissionKey[] = [
  'publish_feed',
  'interact_feed',
  'create_events',
  'view_financial',
  'manage_financial',
  'manage_members',
  'company:manage_governance',
  'company:manage_employees',
  'company:manage_services',
  'company:view_reports',
];

export function companyCatalogRows(): CompanyCatalogRow[] {
  return COMPANY_CATALOG_KEYS.map((key) => {
    const entry = COMPANY_POLICY_REGISTRY[key];
    if (!entry?.grantColumn) {
      throw new Error(`[CATALOG ERROR] chave de catálogo "${key}" sem grantColumn no registry`);
    }
    return {
      permissionKey: key,
      actorCapability: entry.companyActorCapability ?? PERMISSION_CAPABILITIES[key] ?? null,
      subjectGrantColumn: entry.grantColumn,
      classification: entry.classification as 'company_grant' | 'company_grant_terminal',
      invitable: entry.invitable === true,
      delegable: entry.delegable === true,
      protected: entry.protected === true,
    };
  });
}

/**
 * Digest canônico do catálogo: linhas ordenadas por permissionKey, campos unidos por '|',
 * linhas por '\n', SHA-256 hex. A migration insere ESTE digest; o boot compara (R16).
 */
export function computeCompanyCatalogDigest(): string {
  const lines = companyCatalogRows()
    .slice()
    .sort((a, b) => (a.permissionKey < b.permissionKey ? -1 : 1))
    .map((r) =>
      [
        r.permissionKey,
        r.actorCapability ?? '',
        r.subjectGrantColumn,
        r.classification,
        String(r.invitable),
        String(r.delegable),
        String(r.protected),
      ].join('|')
    );
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

/**
 * BOOT FAIL-CLOSED assíncrono (R16): compara o digest do código com o materializado no banco.
 * Divergência (tabela ausente quando esperada, versão errada, digest diferente) → throw.
 * `queryable` = pool/client já conectado (chamado em startServer após o preflight de DB).
 */
export async function assertCompanyPermissionCatalogInSync(queryable: {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
}): Promise<void> {
  const t = await queryable.query(`SELECT to_regclass('public.company_permission_catalog_meta') AS reg`);
  if (!t.rows[0]?.reg) {
    throw new Error(
      '[CATALOG BOOT ERROR] company_permission_catalog_meta ausente — aplicar a migration 20260719120000 (DECISION-0189 F2) antes de subir o servidor'
    );
  }
  const res = await queryable.query(
    `SELECT digest FROM company_permission_catalog_meta WHERE catalog_version = $1`,
    [COMPANY_PERMISSION_CATALOG_VERSION]
  );
  const dbDigest = res.rows[0]?.digest as string | undefined;
  const codeDigest = computeCompanyCatalogDigest();
  if (!dbDigest) {
    throw new Error(
      `[CATALOG BOOT ERROR] catálogo v${COMPANY_PERMISSION_CATALOG_VERSION} sem digest materializado no banco`
    );
  }
  if (dbDigest !== codeDigest) {
    throw new Error(
      `[CATALOG BOOT ERROR] digest do catálogo divergente (código=${codeDigest} banco=${dbDigest}) — chave não muda de significado silenciosamente; materialize nova versão (DECISION-0189 R16)`
    );
  }
}

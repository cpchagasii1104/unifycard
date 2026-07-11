// business-template-checklist.service.ts
// F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-2 (DECISION-0169 §4/§9/§10) — checklist fiscal READ-MODEL.
//
// Este serviço DERIVA, NUNCA PERSISTE (0169 §9: estado é read-model recomputável, não coluna de
// verdade) e NUNCA ATIVA (0169 §4: a Fase B NÃO escreve em tax_types/tax_rules/actor_fiscal_profiles).
// Fórmula canônica (0169 §4):
//
//   template fiscal PUBLICADO (business_template_fiscal_profiles/items, casado por território §8)
//   + aplicação do template pela empresa (company_template_applications)
//   + configuração fiscal ATIVA do tenant (tax_rules via taxCatalogRepository — SÓ LEITURA)
//   = pendências/coberturas (checklist)
//
// Matching sugestão↔regra ativa = HEURÍSTICA DE EXIBIÇÃO em runtime, por dimensões governadas
// (scope_level + taxpayer_kind + território + concept + regime quando houver) — NUNCA FK/vínculo
// persistido entre template (global) e tax_rule (tenant); `matchedRuleId` existe SÓ na resposta.
// Ausência de regra = pendência honesta ("configuração fiscal pendente — validar com contador") —
// nunca alíquota inventada, nunca provisão, nunca bloqueio (D9.2; 0169 §5).
// SEM cálculo: rate_bps NUNCA é multiplicado aqui — provisão é o motor 4d (0167), com GO próprio.
// SEM rota/admin/frontend/PDV: superfície = B-3, fatia futura com GO próprio.
// Teto da B-2: `ready_for_activation`. `activated_by_accountant` PERTENCE À FASE C — este serviço
// não retorna nem simula esse estado.

import { pool } from '../database/pool';
import { businessTemplatesService } from './business-templates.service';
import { businessTemplateSuggestionService } from './business-template-suggestion.service';
import { taxCatalogRepository } from '@modules/fiscal/tax-catalog.repository';
import type { TaxRule } from '@modules/fiscal/tax-catalog.types';
import type { TerritoryMatch } from './business-template-suggestion.service';

/**
 * 0169 §9 — vocabulário conceitual GOVERNADO dos estados do onboarding fiscal, DERIVADO (recomputável).
 * NÃO é coluna nem tabela (guard T7 morde persistência). `activated_by_accountant` é da FASE C e
 * está deliberadamente FORA deste vocabulário — a B-2 não o alcança nem o exibe.
 */
export const ONBOARDING_STATES = [
  'no_template', 'suggested', 'applied_draft', 'fiscal_pending', 'partially_validated', 'ready_for_activation',
] as const;
export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export type ChecklistItemStatus = 'pending' | 'covered' | 'not_applicable' | 'needs_review';

/** 0169 §5 — mensagem conceitual fixa da pendência (contrato do read-model; guard exige). */
export const FISCAL_PENDING_MESSAGE = 'configuração fiscal pendente — validar com contador';
/** 0167 §9 / 0169 §10 — rótulo obrigatório de toda superfície que exibir este read-model. */
export const CHECKLIST_DISCLAIMER = 'configuração sugerida — requer validação';

export interface FiscalChecklistItem {
  itemId: string;
  itemKind: string;
  conceptId: string | null;
  suggestedTaxCode: string | null;
  suggestedTaxName: string | null;
  taxpayerKind: string | null;
  scopeLevel: string | null;
  taxRegime: string | null;
  baseType: string | null;
  status: ChecklistItemStatus;
  /** Id da regra ativa que COBRE a sugestão — SÓ em memória/resposta; nunca persistido (0169 §4). */
  matchedRuleId: string | null;
  rationale: string;
  warnings: string[];
}

export interface ApplicationFiscalChecklist {
  companyId: string;
  templateApplicationId: string;
  templateId: string;
  templateVersionId: string;
  templateSlug: string;
  /** Fiscal profile PUBLICADO casado por território; null = ausência honesta (não bloqueio). */
  fiscalProfileId: string | null;
  territoryMatch: TerritoryMatch;
  state: OnboardingState;
  items: FiscalChecklistItem[];
  warnings: string[];
}

export interface CompanyFiscalChecklist {
  companyId: string;
  /** Estado agregado CONSERVADOR: o menos avançado entre as aplicações (pendência em qualquer uma
   *  impede a empresa de aparecer "pronta"). */
  onboardingState: OnboardingState;
  territory: { countryId: string | null; stateId: string | null; cityId: string | null };
  applications: ApplicationFiscalChecklist[];
  disclaimer: typeof CHECKLIST_DISCLAIMER;
  warnings: string[];
}

interface ProfileRow { id: string; scope_level: string; country_id: string; state_id: string | null; city_id: string | null }
interface ItemRow {
  id: string;
  item_kind: string;
  scope_level: string | null;
  taxpayer_kind: string | null;
  tax_regime: string | null;
  suggested_tax_code: string | null;
  suggested_tax_name: string | null;
  base_type: string | null;
  concept_id: string | null;
  rationale: string;
}

/** Ordem do §9 — usada só para agregar conservadoramente (menor índice = menos avançado). */
const STATE_ORDER: Record<OnboardingState, number> = {
  no_template: 0, suggested: 1, applied_draft: 2, fiscal_pending: 3, partially_validated: 4, ready_for_activation: 5,
};

export const businessTemplateChecklistService = {
  /**
   * Read-model completo do onboarding fiscal da empresa. READ-ONLY: zero escrita, zero ativação,
   * zero cálculo. Recomputável a qualquer momento — a verdade continua nas tabelas canônicas
   * (aplicações + catálogo fiscal ativo do tenant).
   */
  async checklistForCompany(tenantId: string, companyId: string): Promise<CompanyFiscalChecklist> {
    const warnings: string[] = [];
    const applications = (await businessTemplatesService.listApplications(tenantId, companyId))
      .filter((a) => a.status === 'applied');

    const territory = await this.resolveCadastralTerritory(tenantId, companyId);

    // §9: sem aplicação → no_template OU suggested (se a B-1 encontrar sugestões para a empresa).
    if (applications.length === 0) {
      const sug = await businessTemplateSuggestionService.suggestForCompany(tenantId, companyId);
      const state: OnboardingState = sug.suggestions.length > 0 ? 'suggested' : 'no_template';
      if (state === 'suggested') {
        warnings.push(`há ${sug.suggestions.length} template(s) sugerido(s) — nada foi aplicado automaticamente (0169 §1.R)`);
      }
      return { companyId, onboardingState: state, territory, applications: [], disclaimer: CHECKLIST_DISCLAIMER, warnings };
    }

    // Regras ativas são localizadas por item via taxCatalogRepository (leitura; tenant-scoped).
    // Mapa code→ (referência textual do tributo da regra) para o aviso de divergência de código.
    const typeCodeById = new Map<string, string>();
    for (const t of await taxCatalogRepository.listTaxTypes(tenantId, { status: 'active' })) {
      typeCodeById.set(t.id, t.code);
    }

    const perApplication: ApplicationFiscalChecklist[] = [];
    for (const app of applications) {
      perApplication.push(await this.checklistForApplication(tenantId, app.companyId, {
        templateApplicationId: app.applicationId,
        templateId: app.templateId,
        templateVersionId: app.templateVersionId,
        templateSlug: app.templateSlug,
      }, territory, typeCodeById));
    }

    // Agregado conservador: pendência em QUALQUER aplicação segura a empresa no estado menos avançado.
    const onboardingState = perApplication
      .map((c) => c.state)
      .reduce<OnboardingState>((min, s) => (STATE_ORDER[s] < STATE_ORDER[min] ? s : min), 'ready_for_activation');

    return { companyId, onboardingState, territory, applications: perApplication, disclaimer: CHECKLIST_DISCLAIMER, warnings };
  },

  /** Jurisdição CADASTRAL (0169 §8; mesmo D0 da B-1): endereço primário; fallback cidade do tenant. */
  async resolveCadastralTerritory(
    tenantId: string, companyId: string
  ): Promise<{ countryId: string | null; stateId: string | null; cityId: string | null }> {
    const r = await pool.query<{ country_id: string | null; state_id: string | null; city_id: string | null; tenant_city_id: string | null }>(
      `SELECT a.country_id, a.state_id, a.city_id, t.city_id AS tenant_city_id
         FROM companies c
         LEFT JOIN addresses a ON a.address_id = c.primary_address_id
         LEFT JOIN tenants t ON t.id = c.tenant_id
        WHERE c.company_id = $1::uuid AND c.tenant_id = $2::uuid LIMIT 1`,
      [companyId, tenantId]
    );
    const row = r.rows[0];
    if (!row) return { countryId: null, stateId: null, cityId: null };
    if (row.city_id) return { countryId: row.country_id, stateId: row.state_id, cityId: row.city_id };
    if (row.tenant_city_id) {
      const t = await pool.query<{ city_id: string; state_id: string; country_id: string }>(
        `SELECT ci.city_id, ci.state_id, s.country_id
           FROM cities ci JOIN states s ON s.state_id = ci.state_id
          WHERE ci.city_id = $1::uuid LIMIT 1`,
        [row.tenant_city_id]
      );
      if (t.rows[0]) return { countryId: t.rows[0].country_id, stateId: t.rows[0].state_id, cityId: t.rows[0].city_id };
    }
    return { countryId: row.country_id, stateId: row.state_id, cityId: null };
  },

  /** Checklist de UMA aplicação: profile publicado casado por território + itens vs regras ativas. */
  async checklistForApplication(
    tenantId: string,
    companyId: string,
    app: { templateApplicationId: string; templateId: string; templateVersionId: string; templateSlug: string },
    territory: { countryId: string | null; stateId: string | null; cityId: string | null },
    typeCodeById: Map<string, string>
  ): Promise<ApplicationFiscalChecklist> {
    const warnings: string[] = [];

    // Fiscal profile PUBLICADO do template, do específico ao amplo (city→state→country) — fallback
    // SÓ DE EXIBIÇÃO (0169 §8): nunca vira regra ativa.
    const profiles = await pool.query<ProfileRow>(
      `SELECT id, scope_level, country_id, state_id, city_id
         FROM business_template_fiscal_profiles
        WHERE template_version_id = $1::uuid AND status = 'published'`,
      [app.templateVersionId]
    );
    let profile: ProfileRow | null = null;
    let territoryMatch: TerritoryMatch = 'none';
    if (territory.cityId) {
      profile = profiles.rows.find((p) => p.scope_level === 'city' && p.city_id === territory.cityId) ?? null;
      if (profile) territoryMatch = 'city';
    }
    if (!profile && territory.stateId) {
      profile = profiles.rows.find((p) => p.scope_level === 'state' && p.state_id === territory.stateId) ?? null;
      if (profile) territoryMatch = 'state';
    }
    if (!profile && territory.countryId) {
      profile = profiles.rows.find((p) => p.scope_level === 'country' && p.country_id === territory.countryId) ?? null;
      if (profile) territoryMatch = 'country';
    }

    if (!profile) {
      // Ausência honesta (0169 §7/§8): template comercial segue aplicável; nada é inventado.
      warnings.push('sem template fiscal publicado para este template/território — ausência honesta, não bloqueio');
      return {
        companyId, ...app, fiscalProfileId: null, territoryMatch: 'none',
        state: 'applied_draft', items: [], warnings,
      };
    }

    const itemRows = await pool.query<ItemRow>(
      `SELECT id, item_kind, scope_level, taxpayer_kind, tax_regime, suggested_tax_code,
              suggested_tax_name, base_type, concept_id, rationale
         FROM business_template_fiscal_items
        WHERE fiscal_profile_id = $1::uuid
        ORDER BY display_order NULLS LAST, created_at ASC`,
      [profile.id]
    );

    const items: FiscalChecklistItem[] = [];
    for (const row of itemRows.rows) {
      items.push(await this.evaluateItem(tenantId, row, territory, typeCodeById));
    }

    // Estado da aplicação (§9), derivado dos itens:
    //   aberto (pending/needs_review) sem coberto → fiscal_pending
    //   coberto + aberto → partially_validated
    //   tudo coberto/não-aplicável (com ≥1 coberto) → ready_for_activation
    //   publicação sem itens = anomalia de curadoria → fiscal_pending (fail-closed honesto)
    const covered = items.filter((i) => i.status === 'covered').length;
    const open = items.filter((i) => i.status === 'pending' || i.status === 'needs_review').length;
    let state: OnboardingState;
    if (items.length === 0) {
      warnings.push('modelo fiscal publicado sem itens — revisar curadoria com o contador');
      state = 'fiscal_pending';
    } else if (open > 0 && covered > 0) {
      state = 'partially_validated';
    } else if (open > 0) {
      state = 'fiscal_pending';
    } else {
      state = 'ready_for_activation';
    }

    return { companyId, ...app, fiscalProfileId: profile.id, territoryMatch, state, items, warnings };
  },

  /**
   * Um item do template vs a configuração ATIVA do tenant — heurística de EXIBIÇÃO (0169 §4):
   * dimensões governadas, em runtime, sem vínculo persistido. Não calcula NADA.
   */
  async evaluateItem(
    tenantId: string,
    row: ItemRow,
    territory: { countryId: string | null; stateId: string | null; cityId: string | null },
    typeCodeById: Map<string, string>
  ): Promise<FiscalChecklistItem> {
    const base: Omit<FiscalChecklistItem, 'status' | 'matchedRuleId' | 'warnings'> = {
      itemId: row.id,
      itemKind: row.item_kind,
      conceptId: row.concept_id,
      suggestedTaxCode: row.suggested_tax_code,
      suggestedTaxName: row.suggested_tax_name,
      taxpayerKind: row.taxpayer_kind,
      scopeLevel: row.scope_level,
      taxRegime: row.tax_regime,
      baseType: row.base_type,
      rationale: row.rationale,
    };

    // Itens de checklist/documento/hint são ATO HUMANO — não são cobríveis por tax_rules.
    if (row.item_kind !== 'tax_suggestion') {
      return { ...base, status: 'needs_review', matchedRuleId: null, warnings: ['item de revisão humana — não é verificável por regra fiscal'] };
    }

    // Sugestão de fiscalidade da PLATAFORMA não é pendência da EMPRESA (D9.3).
    if (row.taxpayer_kind === 'platform') {
      return { ...base, status: 'not_applicable', matchedRuleId: null, warnings: ['fiscalidade da própria plataforma — fora do checklist da empresa'] };
    }

    if (!territory.countryId) {
      return {
        ...base, status: 'pending', matchedRuleId: null,
        warnings: ['jurisdição cadastral não resolvida — cadastre o endereço da empresa', FISCAL_PENDING_MESSAGE],
      };
    }

    // LOCALIZA regras ativas do tenant (leitura 4c-2; vigência/território/regime/concept no SQL).
    const rules: TaxRule[] = await taxCatalogRepository.resolveApplicableRules({
      tenantId,
      taxpayerKind: 'actor',
      taxRegime: (row.tax_regime as TaxRule['taxRegime']) ?? null,
      conceptId: row.concept_id,
      countryId: territory.countryId,
      stateId: territory.stateId,
      cityId: territory.cityId,
    });

    if (rules.length === 0) {
      return { ...base, status: 'pending', matchedRuleId: null, warnings: [FISCAL_PENDING_MESSAGE] };
    }

    // Cobertura exige regra na MESMA esfera da sugestão (tributo municipal não é coberto por regra
    // federal); regra em outra esfera = revisão humana, nunca cobertura silenciosa.
    const sameScope = row.scope_level ? rules.find((r) => r.scopeLevel === row.scope_level) : rules[0];
    if (!sameScope) {
      return {
        ...base, status: 'needs_review', matchedRuleId: null,
        warnings: ['há regra ativa em OUTRA esfera territorial — conferir com o contador se cobre esta sugestão', FISCAL_PENDING_MESSAGE],
      };
    }

    const itemWarnings: string[] = [];
    const ruleCode = typeCodeById.get(sameScope.taxTypeId) ?? null;
    if (row.suggested_tax_code && ruleCode && row.suggested_tax_code.toLowerCase() !== ruleCode.toLowerCase()) {
      // Código é REFERÊNCIA TEXTUAL (Fase A) — divergência não descobre a cobertura, mas é exposta.
      itemWarnings.push(`código sugerido "${row.suggested_tax_code}" difere do código da regra ativa "${ruleCode}" — conferir com o contador`);
    }
    return { ...base, status: 'covered', matchedRuleId: sameScope.id, warnings: itemWarnings };
  },
};

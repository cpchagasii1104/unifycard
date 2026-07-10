// business-template-suggestion.service.ts
// F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-1 (DECISION-0169) — sugestão READ-ONLY de templates.
//
// Este serviço RECOMENDA, NUNCA APLICA (0169 §1.R): não escreve em NADA (nem em
// company_template_applications — aplicar é ato humano via applyTemplate, com autoridade);
// não cria tax_type/tax_rule; não chama o catálogo fiscal; não calcula nada.
//
// Fontes (ranqueadas por força probatória — 0169 §1/§7):
//   1. CNAE PRIMÁRIO da empresa (fiscal_identity_economic_activities.is_primary) — o mais
//      defensável: é o que a empresa declarou ao governo. Ponte CURADA:
//      CNAE → cnae_concept_suggestions (confidence/rationale/source/review_status) → concepts →
//      categories.concept_id (derivação governada §2.3.5) → slugs → composition dos templates.
//   2. company_type cadastral — sugere navegação/estrutura; NÃO é verdade fiscal (0169 §7).
//   3. CNAE secundário — força menor; nunca decide sozinho.
// Conflito company_type × CNAE é EXPOSTO, nunca resolvido silenciosamente.
//
// Território (0169 §8): jurisdição CADASTRAL da empresa (primary_address_id → addresses, fallback
// tenants.city_id); fiscal_profile publicado casado city→state→country — fallback SÓ DE EXIBIÇÃO,
// nunca vira regra ativa. Sem publicado = ausência honesta ("sem template fiscal publicado").

import { pool } from '../database/pool';
import { businessTemplatesService } from './business-templates.service';
import type { BusinessTemplateView } from './business-templates.service';

/** 0169 §7 — company_type sugere estrutura; a frase é contrato do read-model (guard exige). */
export const COMPANY_TYPE_DISCLAIMER =
  'tipo cadastral sugere estrutura comercial — não é verdade fiscal; valide com seu contador';

export type SuggestionSource = 'manual' | 'company_type' | 'cnae';
export type TerritoryMatch = 'city' | 'state' | 'country' | 'none';

export interface TemplateSuggestion {
  templateId: string;
  templateVersionId: string;
  templateSlug: string;
  source: SuggestionSource;
  confidence: string | null;
  rationale: string;
  matchingCnaeCode: string | null;
  territoryMatch: TerritoryMatch;
  hasPublishedFiscalProfile: boolean;
  warnings: string[];
}

export interface CompanyTemplateSuggestions {
  suggestions: TemplateSuggestion[];
  /** Conflitos EXPOSTOS (0169 §7) — ex.: company_type aponta um template, CNAE aponta outro. */
  conflicts: string[];
  /** Jurisdição cadastral resolvida (IDs Location Core) — null quando irresolvível. */
  territory: { countryId: string | null; stateId: string | null; cityId: string | null };
}

interface CnaeRow { cnae_code: string; is_primary: boolean }
interface CnaeSuggestionRow {
  cnae_code: string;
  suggested_concept_id: string;
  confidence: string;
  rationale: string;
  source: string;
  review_status: string;
}

function compositionSlugs(t: BusinessTemplateView): string[] {
  return [
    ...t.composition.departmentCategorySlugs,
    ...t.composition.branchCategorySlugs,
    ...t.composition.serviceCategorySlugs,
  ];
}

export const businessTemplateSuggestionService = {
  /**
   * Sugere templates para a empresa. READ-ONLY: zero escrita, zero aplicação, zero fiscal.
   * Retorna lista RANQUEADA (cnae-primário > company_type > cnae-secundário) com motivo por item;
   * confidence baixa/não-aprovada NUNCA sobe no ranking (0169 §7).
   */
  async suggestForCompany(tenantId: string, companyId: string): Promise<CompanyTemplateSuggestions> {
    const company = await pool.query<{
      company_type_slug: string | null;
      fiscal_identity_id: string | null;
      country_id: string | null;
      state_id: string | null;
      city_id: string | null;
      tenant_city_id: string | null;
    }>(
      `SELECT ct.slug AS company_type_slug, c.fiscal_identity_id,
              a.country_id, a.state_id, a.city_id, t.city_id AS tenant_city_id
         FROM companies c
         LEFT JOIN company_types ct ON ct.id = c.primary_company_type_id
         LEFT JOIN addresses a ON a.address_id = c.primary_address_id
         LEFT JOIN tenants t ON t.id = c.tenant_id
        WHERE c.company_id = $1::uuid AND c.tenant_id = $2::uuid LIMIT 1`,
      [companyId, tenantId]
    );
    if (company.rowCount === 0) {
      return { suggestions: [], conflicts: [], territory: { countryId: null, stateId: null, cityId: null } };
    }
    const row = company.rows[0];

    // Jurisdição cadastral: endereço primário; fallback cidade do tenant (só exibição — 0169 §8).
    let territory = { countryId: row.country_id, stateId: row.state_id, cityId: row.city_id };
    if (!territory.cityId && row.tenant_city_id) {
      const t = await pool.query<{ city_id: string; state_id: string; country_id: string }>(
        `SELECT ci.city_id, ci.state_id, s.country_id
           FROM cities ci JOIN states s ON s.state_id = ci.state_id
          WHERE ci.city_id = $1::uuid LIMIT 1`,
        [row.tenant_city_id]
      );
      if (t.rows[0]) territory = { countryId: t.rows[0].country_id, stateId: t.rows[0].state_id, cityId: t.rows[0].city_id };
    }

    const templates = await businessTemplatesService.listActiveTemplates();
    const suggestions: TemplateSuggestion[] = [];
    const conflicts: string[] = [];

    // ── fonte 2: company_type (estrutura, NÃO verdade fiscal) ──
    const byType = row.company_type_slug
      ? templates.filter((t) => t.composition.companyTypeSlug === row.company_type_slug)
      : [];

    // ── fontes 1/3: CNAE via ponte curada ──
    const cnaeMatches: Array<{ template: BusinessTemplateView; cnae: CnaeRow; sug: CnaeSuggestionRow }> = [];
    if (row.fiscal_identity_id) {
      const cnaes = await pool.query<CnaeRow>(
        `SELECT cnae_code, is_primary FROM fiscal_identity_economic_activities
          WHERE fiscal_identity_id = $1::uuid ORDER BY is_primary DESC, cnae_code ASC`,
        [row.fiscal_identity_id]
      );
      if (cnaes.rows.length > 0) {
        const sugs = await pool.query<CnaeSuggestionRow>(
          `SELECT s.cnae_code, s.suggested_concept_id, s.confidence, s.rationale, s.source, s.review_status
             FROM cnae_concept_suggestions s
            WHERE s.cnae_code = ANY($1::text[])`,
          [cnaes.rows.map((c) => c.cnae_code)]
        );
        if (sugs.rows.length > 0) {
          // concepts → slugs de categorias (derivação governada categories.concept_id — §2.3.5)
          const slugRows = await pool.query<{ concept_id: string; slug: string }>(
            `SELECT concept_id, slug FROM categories
              WHERE concept_id = ANY($1::uuid[]) AND is_active = true`,
            [sugs.rows.map((s) => s.suggested_concept_id)]
          );
          const slugsByConcept = new Map<string, string[]>();
          for (const r of slugRows.rows) {
            slugsByConcept.set(r.concept_id, [...(slugsByConcept.get(r.concept_id) ?? []), r.slug]);
          }
          for (const sug of sugs.rows) {
            const slugs = slugsByConcept.get(sug.suggested_concept_id) ?? [];
            if (slugs.length === 0) continue;
            const cnae = cnaes.rows.find((c) => c.cnae_code === sug.cnae_code)!;
            for (const template of templates) {
              if (compositionSlugs(template).some((s) => slugs.includes(s))) {
                cnaeMatches.push({ template, cnae, sug });
              }
            }
          }
        }
      }
    }

    // ── monta sugestões com território/fiscal_profile por template ──
    const pushSuggestion = async (
      t: BusinessTemplateView, source: SuggestionSource, confidence: string | null,
      rationale: string, cnaeCode: string | null, extraWarnings: string[]
    ) => {
      if (suggestions.some((s) => s.templateId === t.templateId && s.source === source)) return;
      const fiscal = await this.matchPublishedFiscalProfile(t.latestVersionId, territory);
      const warnings = [...extraWarnings];
      if (!fiscal.has) warnings.push('sem template fiscal publicado para este território — ausência honesta, não bloqueio');
      suggestions.push({
        templateId: t.templateId,
        templateVersionId: t.latestVersionId,
        templateSlug: t.slug,
        source, confidence, rationale,
        matchingCnaeCode: cnaeCode,
        territoryMatch: fiscal.match,
        hasPublishedFiscalProfile: fiscal.has,
        warnings,
      });
    };

    // ranking: CNAE primário > company_type > CNAE secundário (0169 §7)
    for (const m of cnaeMatches.filter((x) => x.cnae.is_primary)) {
      const weak = m.sug.review_status !== 'approved' || m.sug.confidence === 'low';
      await pushSuggestion(m.template, 'cnae', m.sug.confidence,
        `CNAE primário ${m.sug.cnae_code} (${m.sug.source}): ${m.sug.rationale}`, m.sug.cnae_code,
        weak ? ['sugestão fraca (curadoria não-aprovada ou confidence baixa) — não pré-selecionar'] : []);
    }
    for (const t of byType) {
      await pushSuggestion(t, 'company_type', null, COMPANY_TYPE_DISCLAIMER, null, []);
    }
    for (const m of cnaeMatches.filter((x) => !x.cnae.is_primary)) {
      const weak = m.sug.review_status !== 'approved' || m.sug.confidence === 'low';
      await pushSuggestion(m.template, 'cnae', m.sug.confidence,
        `CNAE secundário ${m.sug.cnae_code} (${m.sug.source}): ${m.sug.rationale}`, m.sug.cnae_code,
        ['CNAE secundário — força menor, nunca decide sozinho', ...(weak ? ['sugestão fraca — não pré-selecionar'] : [])]);
    }

    // conflito EXPOSTO (0169 §7): company_type aponta template que nenhum CNAE aponta (e vice-versa)
    const cnaeTplIds = new Set(cnaeMatches.map((m) => m.template.templateId));
    const typeTplIds = new Set(byType.map((t) => t.templateId));
    if (typeTplIds.size > 0 && cnaeTplIds.size > 0) {
      const disjoint = [...typeTplIds].every((id) => !cnaeTplIds.has(id));
      if (disjoint) {
        conflicts.push(
          'seu tipo cadastral e seu CNAE apontam para templates DIFERENTES — escolha consciente necessária (nada foi aplicado automaticamente)'
        );
      }
    }

    return { suggestions, conflicts, territory };
  },

  /**
   * Casa fiscal_profile PUBLICADO por território, do específico ao amplo (city→state→country).
   * FALLBACK É SÓ DE EXIBIÇÃO (0169 §8) — nunca vira regra ativa; ativação = Fase C com contador.
   */
  async matchPublishedFiscalProfile(
    templateVersionId: string,
    territory: { countryId: string | null; stateId: string | null; cityId: string | null }
  ): Promise<{ has: boolean; match: TerritoryMatch }> {
    const rows = await pool.query<{ scope_level: string; country_id: string; state_id: string | null; city_id: string | null }>(
      `SELECT scope_level, country_id, state_id, city_id
         FROM business_template_fiscal_profiles
        WHERE template_version_id = $1::uuid AND status = 'published'`,
      [templateVersionId]
    );
    if (rows.rowCount === 0) return { has: false, match: 'none' };
    if (territory.cityId && rows.rows.some((r) => r.scope_level === 'city' && r.city_id === territory.cityId)) {
      return { has: true, match: 'city' };
    }
    if (territory.stateId && rows.rows.some((r) => r.scope_level === 'state' && r.state_id === territory.stateId)) {
      return { has: true, match: 'state' };
    }
    if (territory.countryId && rows.rows.some((r) => r.scope_level === 'country' && r.country_id === territory.countryId)) {
      return { has: true, match: 'country' };
    }
    return { has: false, match: 'none' };
  },
};

// business-templates.service.ts
// DECISION-0117 E — templates empresariais versionados, aplicação MANUAL-ASSISTIDA.
//
// O template é REFERÊNCIA (recortes de categorias/serviços/módulos governados),
// nunca cópia nem SSOT de dados da empresa. A aplicação registra template +
// versão + empresa + actor aplicador + timestamp + módulos (auditável,
// idempotente). NÃO cria oferta, estoque, preço, agenda nem autoridade.
// Mudança futura do template = NOVA versão; aplicações antigas intactas.

import { pool } from '../database/pool';
import { socialPortsRegistry } from '../social/ports-registry';
import { companiesService } from './companies.service';

export class BusinessTemplateError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'BusinessTemplateError';
  }
}

export interface TemplateComposition {
  companyTypeSlug?: string;
  departmentCategorySlugs: string[];
  branchCategorySlugs: string[];
  serviceCategorySlugs: string[];
  modules: string[];
}

/**
 * DECISION-0169 §3 — vocabulário GOVERNADO da proveniência de recomendação (espelhado no CHECK
 * chk_cta_recommendation_origin). Registrado no manifesto de vocabulários governados.
 * Sugestão NUNCA autoaplica (§1.R): isto só rastreia a ORIGEM quando um humano autorizado aplica.
 */
export const RECOMMENDATION_ORIGINS = ['manual', 'company_type', 'cnae', 'accountant', 'admin'] as const;
export type RecommendationOrigin = (typeof RECOMMENDATION_ORIGINS)[number];

export interface TemplateRecommendationTrace {
  origin: RecommendationOrigin;
  confidence?: string | null;
  rationale?: string | null;
  cnaeCode?: string | null;
  source?: string | null;
}

export interface BusinessTemplateView {
  templateId: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  latestVersionId: string;
  latestVersion: number;
  composition: TemplateComposition;
}

export interface TemplateApplicationView {
  applicationId: string;
  templateId: string;
  templateSlug: string;
  templateVersionId: string;
  templateVersion: number;
  companyId: string;
  appliedByActorId: string;
  appliedAt: string;
  modulesApplied: string[];
  customizations: Record<string, unknown>;
  status: string;
}

function parseComposition(raw: unknown): TemplateComposition {
  const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    companyTypeSlug: typeof c.companyTypeSlug === 'string' ? c.companyTypeSlug : undefined,
    departmentCategorySlugs: arr(c.departmentCategorySlugs),
    branchCategorySlugs: arr(c.branchCategorySlugs),
    serviceCategorySlugs: arr(c.serviceCategorySlugs),
    modules: arr(c.modules),
  };
}

async function assertCompanyTemplateAuthority(input: {
  tenantId: string;
  userId: string;
  globalUserId: string;
  companyId: string;
}): Promise<{ actorId: string }> {
  const actor = await socialPortsRegistry.getActorRepository().findByUserId(input.tenantId, input.userId);
  if (!actor?.actor_id) {
    throw new BusinessTemplateError(403, 'TEMPLATE_ACTOR_MISSING',
      'Actor humano do usuário autenticado não existe — aplicação de template não cria/cura actors.');
  }
  const canManage = await companiesService.canManageCompany(input.tenantId, input.companyId, input.globalUserId);
  if (!canManage) {
    throw new BusinessTemplateError(403, 'TEMPLATE_FORBIDDEN',
      'Sem autoridade (canManageCompany) para aplicar template nesta empresa.');
  }
  return { actorId: actor.actor_id };
}

interface TemplateRow {
  template_id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  version_id: string;
  version: number;
  composition: unknown;
}

export const businessTemplatesService = {
  /** Templates ativos com a versão mais recente (catálogo recomendável). */
  async listActiveTemplates(): Promise<BusinessTemplateView[]> {
    const r = await pool.query<TemplateRow>(
      `SELECT t.id AS template_id, t.slug, t.name, t.description, t.status,
              v.id AS version_id, v.version, v.composition
         FROM business_templates t
         JOIN LATERAL (
           SELECT id, version, composition FROM business_template_versions
            WHERE template_id = t.id ORDER BY version DESC LIMIT 1
         ) v ON true
        WHERE t.status = 'active'
        ORDER BY t.slug ASC`
    );
    return r.rows.map((row) => ({
      templateId: row.template_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      status: row.status,
      latestVersionId: row.version_id,
      latestVersion: row.version,
      composition: parseComposition(row.composition),
    }));
  },

  /** Recomendação por company_type da empresa CLASSIFICADA (sugestão, nunca auto-aplicação). */
  async recommendForCompany(tenantId: string, companyId: string): Promise<BusinessTemplateView | null> {
    const company = await pool.query<{ slug: string | null }>(
      `SELECT ct.slug FROM companies c
         LEFT JOIN company_types ct ON ct.id = c.primary_company_type_id
        WHERE c.company_id = $1::uuid AND c.tenant_id = $2 LIMIT 1`,
      [companyId, tenantId]
    );
    const typeSlug = company.rows[0]?.slug ?? null;
    if (!typeSlug) return null;
    const templates = await this.listActiveTemplates();
    return templates.find((t) => t.composition.companyTypeSlug === typeSlug) ?? null;
  },

  /**
   * Aplicação MANUAL-ASSISTIDA («Aplicar» explícito — RFC vigente; nunca
   * auto-aplica). Idempotente por (company, version). Auditável. Zero efeito
   * comercial: NÃO cria oferta/estoque/preço/agenda; NÃO concede autoridade.
   */
  async applyTemplate(input: {
    tenantId: string;
    userId: string;
    globalUserId: string;
    companyId: string;
    templateId: string;
    templateVersionId?: string | null;
    /** DECISION-0169 §3 — proveniência OPCIONAL da recomendação. Ausente = aplicação manual sem rastreio. */
    recommendation?: TemplateRecommendationTrace | null;
  }): Promise<{ application: TemplateApplicationView; alreadyApplied: boolean }> {
    const auth = await assertCompanyTemplateAuthority(input);

    const rec = input.recommendation ?? null;
    if (rec) {
      if (!RECOMMENDATION_ORIGINS.includes(rec.origin)) {
        throw new BusinessTemplateError(422, 'RECOMMENDATION_ORIGIN_INVALID',
          `Origem de recomendação fora do vocabulário governado (${RECOMMENDATION_ORIGINS.join(', ')}) — DECISION-0169 §3.`);
      }
      if (rec.origin === 'cnae' && (!rec.rationale || !rec.source)) {
        throw new BusinessTemplateError(422, 'RECOMMENDATION_CNAE_REQUIRES_CONTEXT',
          'Recomendação por CNAE exige rationale e source (curadoria — DECISION-0169 §3/§6).');
      }
    }

    const tpl = await pool.query<{ id: string; slug: string; status: string }>(
      `SELECT id, slug, status FROM business_templates WHERE id = $1::uuid LIMIT 1`,
      [input.templateId]
    );
    if (tpl.rowCount === 0) throw new BusinessTemplateError(404, 'TEMPLATE_NOT_FOUND', 'Template inexistente.');
    if (tpl.rows[0].status !== 'active') {
      throw new BusinessTemplateError(422, 'TEMPLATE_RETIRED', 'Template não está ativo.');
    }

    const ver = await pool.query<{ id: string; version: number; composition: unknown }>(
      input.templateVersionId
        ? `SELECT id, version, composition FROM business_template_versions
            WHERE id = $2::uuid AND template_id = $1::uuid LIMIT 1`
        : `SELECT id, version, composition FROM business_template_versions
            WHERE template_id = $1::uuid ORDER BY version DESC LIMIT 1`,
      input.templateVersionId ? [input.templateId, input.templateVersionId] : [input.templateId]
    );
    if (ver.rowCount === 0) throw new BusinessTemplateError(404, 'TEMPLATE_VERSION_NOT_FOUND', 'Versão do template inexistente.');
    const composition = parseComposition(ver.rows[0].composition);

    const ins = await pool.query<{ id: string; applied_at: Date; modules_applied: unknown; customizations: unknown; status: string }>(
      `INSERT INTO company_template_applications (
         tenant_id, company_id, template_id, template_version_id, applied_by_actor_id, modules_applied,
         recommendation_origin, recommendation_confidence, recommendation_rationale,
         recommended_from_cnae_code, recommendation_source
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::jsonb, $7, $8, $9, $10, $11)
       ON CONFLICT (company_id, template_version_id) DO NOTHING
       RETURNING id, applied_at, modules_applied, customizations, status`,
      [input.tenantId, input.companyId, input.templateId, ver.rows[0].id, auth.actorId, JSON.stringify(composition.modules),
       rec?.origin ?? null, rec?.confidence ?? null, rec?.rationale ?? null, rec?.cnaeCode ?? null, rec?.source ?? null]
    );

    let row = ins.rows[0];
    let alreadyApplied = false;
    if (!row) {
      alreadyApplied = true;
      const existing = await pool.query<{ id: string; applied_at: Date; modules_applied: unknown; customizations: unknown; status: string; applied_by_actor_id: string }>(
        `SELECT id, applied_at, modules_applied, customizations, status, applied_by_actor_id
           FROM company_template_applications
          WHERE company_id = $1::uuid AND template_version_id = $2::uuid LIMIT 1`,
        [input.companyId, ver.rows[0].id]
      );
      row = existing.rows[0] as never;
    }

    return {
      alreadyApplied,
      application: {
        applicationId: row.id,
        templateId: input.templateId,
        templateSlug: tpl.rows[0].slug,
        templateVersionId: ver.rows[0].id,
        templateVersion: ver.rows[0].version,
        companyId: input.companyId,
        appliedByActorId: auth.actorId,
        appliedAt: row.applied_at.toISOString(),
        modulesApplied: Array.isArray(row.modules_applied) ? (row.modules_applied as string[]) : [],
        customizations: (row.customizations as Record<string, unknown>) ?? {},
        status: row.status,
      },
    };
  },

  /** Personalização da empresa (ex.: desativar módulos opcionais) — nunca toca o template. */
  async customizeApplication(input: {
    tenantId: string;
    userId: string;
    globalUserId: string;
    companyId: string;
    applicationId: string;
    customizations: Record<string, unknown>;
  }): Promise<void> {
    await assertCompanyTemplateAuthority(input);
    const r = await pool.query(
      `UPDATE company_template_applications
          SET customizations = $4::jsonb, updated_at = NOW()
        WHERE id = $3::uuid AND tenant_id = $1::uuid AND company_id = $2::uuid`,
      [input.tenantId, input.companyId, input.applicationId, JSON.stringify(input.customizations ?? {})]
    );
    if ((r.rowCount ?? 0) === 0) {
      throw new BusinessTemplateError(404, 'TEMPLATE_APPLICATION_NOT_FOUND', 'Aplicação inexistente para esta empresa.');
    }
  },

  /** Aplicações da empresa (membership-scoped na rota). */
  async listApplications(tenantId: string, companyId: string): Promise<TemplateApplicationView[]> {
    const r = await pool.query<{
      id: string; template_id: string; slug: string; template_version_id: string; version: number;
      applied_by_actor_id: string; applied_at: Date; modules_applied: unknown; customizations: unknown; status: string;
    }>(
      `SELECT a.id, a.template_id, t.slug, a.template_version_id, v.version,
              a.applied_by_actor_id, a.applied_at, a.modules_applied, a.customizations, a.status
         FROM company_template_applications a
         JOIN business_templates t ON t.id = a.template_id
         JOIN business_template_versions v ON v.id = a.template_version_id
        WHERE a.tenant_id = $1::uuid AND a.company_id = $2::uuid
        ORDER BY a.applied_at ASC`,
      [tenantId, companyId]
    );
    return r.rows.map((row) => ({
      applicationId: row.id,
      templateId: row.template_id,
      templateSlug: row.slug,
      templateVersionId: row.template_version_id,
      templateVersion: row.version,
      companyId,
      appliedByActorId: row.applied_by_actor_id,
      appliedAt: row.applied_at.toISOString(),
      modulesApplied: Array.isArray(row.modules_applied) ? (row.modules_applied as string[]) : [],
      customizations: (row.customizations as Record<string, unknown>) ?? {},
      status: row.status,
    }));
  },

  /** Módulos efetivos da empresa (união das aplicações − desativados) — consumido pelo menu (F). */
  async effectiveModulesForCompany(tenantId: string, companyId: string): Promise<string[]> {
    const apps = await this.listApplications(tenantId, companyId);
    const enabled = new Set<string>();
    for (const a of apps) {
      for (const m of a.modulesApplied) enabled.add(m);
      const disabled = Array.isArray(a.customizations?.disabledModules)
        ? (a.customizations.disabledModules as string[])
        : [];
      for (const d of disabled) enabled.delete(d);
    }
    return [...enabled];
  },
};

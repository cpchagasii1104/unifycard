// module-projection.routes.ts
// DECISION-0117 F — PROJEÇÃO do menu de módulos (GET /navigation/modules).
//
// O menu é PROJEÇÃO, nunca autoridade: considera contexto (PF/empresa), vínculo
// (membership ativa), KYB e módulos habilitados por template aplicado — mas toda
// ação continua revalidada pela rota de destino. Rotas mortas (STUB/TOMBSTONE)
// NÃO aparecem como operacionais. Frontend consome; não inventa.

import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../database/pool';
import { liveEntriesForContext, type ModuleRegistryEntry } from './module-registry';
import { businessTemplatesService } from '../companies/business-templates.service';

interface ProjectedGroup {
  title: string;
  items: Array<{ moduleKey: string; label: string; icon: string; route: string; exact: boolean }>;
}

function groupEntries(entries: ModuleRegistryEntry[], routeParams?: Record<string, string>): ProjectedGroup[] {
  const groups = new Map<string, ProjectedGroup>();
  for (const e of entries) {
    let route = e.route;
    if (routeParams) {
      for (const [k, v] of Object.entries(routeParams)) route = route.replace(`:${k}`, v);
    }
    const g = groups.get(e.group) ?? { title: e.group, items: [] };
    g.items.push({ moduleKey: e.moduleKey, label: e.label, icon: e.icon, route, exact: e.exact === true });
    groups.set(e.group, g);
  }
  return [...groups.values()];
}

const moduleProjectionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /navigation/modules            → menu PESSOAL (PF).
   * GET /navigation/modules?companyId= → menu da EMPRESA (membership ativa exigida;
   *   módulos por template aplicado + KYB; visualização ≠ poder).
   */
  fastify.get<{ Querystring: { companyId?: string } }>('/modules', async (req, reply) => {
    const userId = (req as { user?: { userId?: string; globalUserId?: string } }).user?.userId;
    const globalUserId = (req as { user?: { globalUserId?: string } }).user?.globalUserId;
    if (!userId || !globalUserId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });

    const companyId = String(req.query.companyId ?? '').trim();
    if (!companyId) {
      return reply.send({ ok: true, data: { context: 'personal', groups: groupEntries(liveEntriesForContext('personal')) } });
    }

    // Contexto EMPRESA: vínculo ATIVO obrigatório (leitura membership-scoped).
    const member = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM company_users
        WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid
          AND is_active = true AND member_status = 'active'`,
      [req.tenant.id, companyId, globalUserId]
    );
    if (member.rows[0].n === '0') {
      return reply.status(403).send({ ok: false, code: 'NAV_COMPANY_FORBIDDEN', message: 'Sem vínculo ativo com a empresa.' });
    }

    const kyb = await pool.query<{ kyb_status: string | null }>(
      `SELECT fi.kyb_status FROM companies c
         LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
        WHERE c.company_id = $1::uuid AND c.tenant_id = $2 LIMIT 1`,
      [companyId, req.tenant.id]
    );
    const kybApproved = kyb.rows[0]?.kyb_status === 'approved';
    const enabledModules = new Set(await businessTemplatesService.effectiveModulesForCompany(req.tenant.id, companyId));

    const entries = liveEntriesForContext('company').filter((e) => {
      if (e.requiresTemplateModule && !enabledModules.has(e.requiresTemplateModule)) return false;
      if (e.requiresKybApproved && !kybApproved) return false;
      return true;
    });
    return reply.send({
      ok: true,
      data: {
        context: 'company',
        companyId,
        kybApproved,
        enabledModules: [...enabledModules],
        groups: groupEntries(entries, { companyId }),
      },
    });
  });
};

export default moduleProjectionRoutes;

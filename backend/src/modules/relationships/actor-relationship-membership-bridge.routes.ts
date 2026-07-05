// backend/src/modules/relationships/actor-relationship-membership-bridge.routes.ts
// F-ACTOR-RELATIONSHIP-MEMBERSHIP-BRIDGE-SLICE-2 — a PONTE colaborador→autoridade
// (DESENHO_PAGINA_DO_ACTOR.md §5 SELADO: "ao aceitar o colaborador, o dono pode atribuir as
// permissões ali mesmo" — MAS o grant é ato SEPARADO, explícito e autorizado do dono).
//
// COMPOSIÇÃO, não módulo novo (Lei de Coerência §5): esta rota NÃO escreve autoridade por conta
// própria — ela VALIDA a aresta (Fatia 1) e ROTEIA para o fluxo VIVO de membros
// (companyMembersService.createMember → upsert company_users, o SSOT único de membership
// DECISION-0042; delegação escopada por role quando ACTIVE — herda a contenção de escopo ①:
// staff/contractor NUNCA ganham representação em branco).
//
// TRAVAS INVIOLÁVEIS (DESENHO §5, guia §6 — o vetor onde um erro reabriria os IDORs fechados):
//  (a) só quem tem canManageCompany sobre a empresa REAL da aresta concede (revalidado server-side,
//      fail-closed 401/403) — o funcionário enviar/aceitar NÃO concede nada a si mesmo;
//  (b) função = vocabulário GOVERNADO (CompanyMemberRole/Status do fluxo vivo) — sem texto livre;
//  (c) escreve o substrato REAL via o service vivo — NUNCA INSERT paralelo em company_users,
//      NUNCA can_manage_company (dono continua sendo mintado só pelo nascimento da empresa);
//  (d) alvo e empresa derivados DA ARESTA server-side — body não carrega actorId/companyId.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorRelationshipRepository } from './actor-relationship.repository';
import { companyMembersService } from '@core/companies/company-members.service';
import { companiesService } from '@core/companies/companies.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { CompanyMemberRole, CompanyMemberStatus } from '@core/companies/company-members.types';

const grantSchema = z.object({
  role: z.nativeEnum(CompanyMemberRole).optional(),
  status: z.nativeEnum(CompanyMemberStatus).optional(),
});

const actorRelationshipMembershipBridgeRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /relationships/:id/grant-membership — o ATO DO DONO que materializa o acesso do
   * colaborador DEPOIS da conexão aceita. Precondições server-side (tudo derivado da aresta):
   *   · aresta existe e está 'accepted';
   *   · um lado é page-actor de empresa, o outro é PF (actor_type='user');
   *   · a ÓTICA DA EMPRESA sobre a PF é 'colaborador' (requester_label se a empresa enviou,
   *     target_label se a empresa aceitou — o fluxo bidirecional converge aqui);
   *   · o CALLER tem canManageCompany sobre a empresa (o funcionário não se auto-concede).
   * Efeito: companyMembersService.createMember (fluxo vivo → company_users SSOT; role/status
   * do vocabulário governado; delegação escopada só quando ACTIVE, pelo fluxo vivo).
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof grantSchema> }>(
    '/relationships/:id/grant-membership',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const parsed = grantSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Body inválido (role/status fora do vocabulário governado)', details: parsed.error.errors });
      }

      // 1 · a aresta (Fatia 1) — servidor resolve tudo a partir dela
      const edge = await actorRelationshipRepository.findById(tenantId, req.params.id);
      if (!edge) return reply.status(404).send({ error: 'Relação não encontrada' });
      if (edge.status !== 'accepted') {
        return reply.status(409).send({ error: `Relação não está aceita (status=${edge.status}) — o grant só existe após o aceite` });
      }

      // 2 · identifica os lados: empresa (page com company_id) × pessoa (PF)
      const [fromRow, toRow] = await Promise.all([
        actorRelationshipRepository.findActorKindRow(tenantId, edge.fromActorId),
        actorRelationshipRepository.findActorKindRow(tenantId, edge.toActorId),
      ]);
      if (!fromRow || !toRow) return reply.status(404).send({ error: 'Actors da relação não encontrados' });

      const fromIsCompany = !!fromRow.company_id;
      const toIsCompany = !!toRow.company_id;
      if (fromIsCompany === toIsCompany) {
        return reply.status(422).send({ error: 'A ponte de membership exige exatamente um lado empresa (page) e um lado pessoa (PF)' });
      }
      const companyRow = fromIsCompany ? fromRow : toRow;
      const personRow = fromIsCompany ? toRow : fromRow;
      if (personRow.actor_type !== 'user') {
        return reply.status(422).send({ error: 'O lado pessoa da relação precisa ser actor PF (actor_type=user)' });
      }

      // 3 · a ótica da EMPRESA sobre a PF precisa ser 'colaborador' (bidirecional converge aqui)
      const companyLabelForPerson = fromIsCompany ? edge.requesterLabel : edge.targetLabel;
      if (companyLabelForPerson !== 'colaborador') {
        return reply.status(422).send({
          error: `A relação não classifica a pessoa como 'colaborador' pela ótica da empresa (label=${companyLabelForPerson ?? 'null'})`,
        });
      }

      // 4 · 🔴 A CATRACA (inline no handler — o gate baseline-ratchet exige o binding NO segmento):
      //     o PRINCIPAL autenticado (req.user, nunca actionContext) precisa gerenciar a empresa REAL
      //     da aresta via canManageCompany, fail-closed. Funcionário que enviou/aceitou NÃO passa
      //     aqui — não existe auto-grant (DECISION-0125: aceite social não concede poder).
      const companyId = companyRow.company_id as string;
      const callerUserId = (req as any).user?.userId ?? (req as any).user?.id;
      if (!callerUserId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória para conceder acesso' });
      }
      let callerGlobalUserId: string | null = null;
      try {
        callerGlobalUserId = await resolveGlobalUserId(callerUserId, tenantId);
      } catch {
        callerGlobalUserId = null;
      }
      let callerCanManage = false;
      if (callerGlobalUserId) {
        try {
          callerCanManage = await companiesService.canManageCompany(tenantId, companyId, callerGlobalUserId);
        } catch {
          callerCanManage = false;
        }
      }
      if (!callerCanManage) {
        return reply.status(403).send({
          error: 'Apenas quem gerencia a empresa concede acesso — aceite social não concede poder (DECISION-0125)',
          code: 'RELATIONSHIP_GRANT_FORBIDDEN',
        });
      }

      // 5 · roteia pro fluxo VIVO (SSOT company_users; delegação escopada por role se ACTIVE)
      try {
        const member = await companyMembersService.createMember(tenantId, actionContext.actorId, {
          companyId,
          actorId: personRow.id,
          role: parsed.data.role,
          status: parsed.data.status,
          metadata: { grantedViaRelationshipId: edge.id },
        });
        return reply.status(201).send({
          ok: true,
          data: {
            memberId: member.memberId,
            companyId: member.companyId,
            actorId: member.actorId,
            role: member.role,
            status: member.status,
            relationshipId: edge.id,
          },
        });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao conceder membership' });
      }
    }
  );
};

export default actorRelationshipMembershipBridgeRoutes;

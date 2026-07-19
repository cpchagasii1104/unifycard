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
      // 🔒 DECISION-0189 (F4/R17 — FAIL-CLOSED): a bridge social NÃO pode materializar
      // membership 'active' — só bootstrap e o aceite canônico de convite criam active.
      // Quando o fluxo de convite (F5) existir, esta rota poderá, no máximo, CRIAR CONVITE.
      // Até lá: 410 fail-closed (aceite social não concede poder — DECISION-0125 preservada).
      return reply.status(410).send({
        error:
          'Materialização de membership pela bridge social morreu (DECISION-0189 R17): membership nasce pelo aceite canônico de convite (company_access_invitations).',
        code: 'MEMBERSHIP_VIA_INVITATION_REQUIRED',
      });
      // Corpo legado removido (referenciava createMember, morto na F4). Historia no git.
    }
  );
};

export default actorRelationshipMembershipBridgeRoutes;

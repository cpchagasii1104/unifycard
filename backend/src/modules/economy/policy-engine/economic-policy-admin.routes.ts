// backend/src/modules/economy/policy-engine/economic-policy-admin.routes.ts
//
// F-ECONOMIC-POLICY-ADMIN-FRONT — FATIA 1 (authority key + read-only consumer) + FATIA 2
// (write API versionado).
//
// 🔒 BLINDAGEM (DECISION-0166 D6): esta rota é o consumidor que prova que a chave
// `economic_policy:manage` (permission-keys.ts) NÃO é vocabulário fantasma. Lista, cria VERSÕES
// novas e ativa policies — NUNCA aprova nem executa nada financeiro. "Admin configura policy;
// admin NÃO move dinheiro. O Bank executa." A tela (Fatia 4) é fatia FUTURA, com seu próprio
// GATE/GO — não vive aqui.
//
// GATE REAL: `requireRole(['admin'])` — o MESMO mecanismo institucional já usado por
// `core/categories/ssot-admin.routes.ts`, `core/unifybank/transparency-admin.routes.ts`,
// o irmão de leitura consolidada do módulo Bank (unifybank) e `modules/trust/trust.routes.ts`
// (RBAC V2, `actor_has_any_role` — função REAL, restaurada em 20260530551000). Tenant SEMPRE
// de `req.tenant` (nunca query/body) — mesma disciplina de
// DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE.
//
// SEGUNDA CAMADA (prova que a chave NÃO é ghost): `requirePermission('economic_policy:manage')`
// (authority.service/canActAs — vocabulário PermissionKey) roda DEPOIS do requireRole e
// referencia a chave literalmente. Deliberadamente NÃO usamos `fastify.requirePermission([...])`
// (o decorator RBAC V2 baseado em `role_permissions`) porque `actor_has_permission` é um STUB
// fail-closed que retorna FALSE SEMPRE (DECISION-0013/C47, `20260422000100_...sql`) — gatear
// com ele tornaria esta rota permanentemente inacessível, mesmo para admins reais.
//
// PONTO DE EXTENSÃO (comentário, não implementação): hoje a autoridade sobre a regra de uma
// cidade é platform-admin (DECISION-0177). Um futuro 2º nível de autoridade (local/comunitário)
// é questão em aberto — NÃO decidida aqui. Se vier, o ponto de extensão é o preHandler abaixo
// (trocar/adicionar um segundo requireRole/requirePermission), não um mecanismo paralelo.
//
// 🔒 FATIA 2 — DISCIPLINA CONSTITUCIONAL (ARTIGO V + XI):
//   • Artigo V ("não existe ajuste administrativo"): NÃO existe PATCH/PUT nesta superfície —
//     nenhuma rota edita uma policy existente. Toda mudança de regra é POST de uma VERSÃO NOVA
//     (createPolicyVersionWithLines). A ÚNICA outra escrita é a ativação (draft→active), uma
//     transição de ciclo de vida própria — não um editor genérico de campo.
//   • Artigo XI ("emendas públicas, justificadas, nunca silenciosas"): change_reason é
//     obrigatório e validado ANTES de qualquer INSERT (assertCreatePolicyVersionRequestValid).
//   • tenant_id SEMPRE de req.tenant.id; created_by_actor_id SEMPRE de
//     req.actionContext.actorId (resolvido pelo actionContextPlugin a partir do JWT) — nunca do
//     corpo da requisição.
//   • RULE≠MONEY (Lei 5 / SSOT_EXCLUSIVE_BANK_RULE): esta rota grava `economic_policies` +
//     `economic_policy_lines` — nunca chama um writer do Bank, nunca toca bank_ledger/
//     bank_transactions/bank_splits/bank_accounts.

import { FastifyPluginAsync } from 'fastify';
import { economicPolicyRepository } from './economic-policy.repository';
import { requirePermission } from '@core/authorization/require-permission.guard';
import type { PermissionKey } from '@core/authorization/permission-keys';
import { HttpError } from '@core/errors/http-error';
import {
  assertCreatePolicyVersionRequestValid,
  type CreatePolicyVersionRequestBody,
} from './economic-policy-write-validation';
import {
  REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP,
  REGIONAL_FUND_LEVEL_RESOLVABLE_MVP,
} from './economic-policy.types';

/** Chave de autoridade desta fatia — DECISION-0166 D6 (define REGRA; nunca move dinheiro). */
const ECONOMIC_POLICY_MANAGE_KEY: PermissionKey = 'economic_policy:manage';

/**
 * Traduz erros do Postgres não previstos pela validação de aplicação em um 4xx honesto — nunca
 * deixa a mensagem crua da constraint (ou o erro genérico do trigger de imutabilidade) vazar como
 * 500. Cobre os poucos casos que só o banco consegue detectar: coerência territorial (FK
 * composta — Fatia 0) e corrida de publicação (UNIQUE tenant+code+version).
 */
function translatePolicyWriteError(error: unknown): { statusCode: number; message: string } | null {
  const err = error as { code?: string; constraint?: string } | null | undefined;
  if (!err || typeof err !== 'object' || !err.code) return null;

  if (err.code === '23503') {
    if (
      err.constraint === 'fk_economic_policies_country_state' ||
      err.constraint === 'fk_economic_policies_state_city'
    ) {
      return {
        statusCode: 400,
        message:
          'economic_policy: combinação territorial incoerente — o estado informado não pertence ' +
          'ao país informado, ou a cidade informada não pertence ao estado informado.',
      };
    }
    return { statusCode: 400, message: `economic_policy: referência territorial inválida (${err.constraint ?? 'FK'}).` };
  }
  if (err.code === '23505') {
    if (err.constraint === 'uq_policy_lines_regional_level_basis') {
      return {
        statusCode: 400,
        message: 'economic_policy: duas linhas regional_fund com o mesmo nível e a mesma origem — configuração duplicada.',
      };
    }
    return {
      statusCode: 409,
      message: 'economic_policy: corrida ao publicar esta versão — tente novamente.',
    };
  }
  if (err.code === '23514') {
    return {
      statusCode: 400,
      message: `economic_policy: dados violam uma regra de composição da policy (${err.constraint ?? 'check'}).`,
    };
  }
  return null;
}

const economicPolicyAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // Mesmo gate nas 3 rotas — requireRole real (actor_has_any_role) + a chave explícita da fatia
  // (mesmo padrão de core/categories/ssot-admin.routes.ts).
  const adminGate = [
    async (req: any, reply: any) => {
      await (fastify as any).requireRole(['admin'])(req, reply);
    },
    requirePermission(ECONOMIC_POLICY_MANAGE_KEY),
  ];

  /**
   * GET /economy/admin/regional-fund-vocabulary
   * READ-ONLY. Expõe o subconjunto de regionalOriginBasis/regionalLevel que o resolver de
   * pagamento (service-payment-execution.service.ts, byte-pinned) REALMENTE resolve hoje —
   * REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP / REGIONAL_FUND_LEVEL_RESOLVABLE_MVP
   * (economic-policy.types.ts), a declaração guard-policiada contra o resolver. O painel admin
   * DEVE construir seus seletores a partir DESTA rota — nunca de uma lista própria — para nunca
   * oferecer uma combinação que o resolver rejeitaria em tempo de pagamento real. Mesmo gate das
   * demais rotas desta superfície (é vocabulário de configuração, não dado sensível, mas a
   * superfície inteira é admin-gated por padrão).
   */
  fastify.get(
    '/admin/regional-fund-vocabulary',
    { preHandler: adminGate },
    async (req, reply) => {
      if (!req.user || !req.tenant?.id) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      return reply.send({
        ok: true,
        data: {
          regionalOriginBasisResolvable: REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP,
          regionalFundLevelResolvable: REGIONAL_FUND_LEVEL_RESOLVABLE_MVP,
        },
      });
    }
  );

  /**
   * GET /economy/admin/policies
   * Lista as economic_policies (+ linhas) do TENANT AUTENTICADO. READ-ONLY.
   * Nenhum filtro de ESCOPO (tenant) aceito via query/body — tenant é SEMPRE req.tenant.id.
   *
   * Query opcional `includeDeprecated` (legibilidade do painel — Task 2, 2026-07-27): NÃO é
   * filtro de escopo, é filtro de STATUS. Default preserva a resposta ATUAL (todos os status,
   * igual a antes desta mudança) — só `?includeDeprecated=false` some com `deprecated` (histórico
   * não-acionável; nenhuma linha é apagada, só não listada nesta chamada). Outros consumidores
   * desta rota (ex.: harness E2E validate-pipeline-e2e-economic-policy-authority.ts) que não
   * passam o parâmetro continuam vendo exatamente o shape de antes.
   */
  fastify.get(
    '/admin/policies',
    { preHandler: adminGate },
    async (req, reply) => {
      if (!req.user || !req.tenant?.id) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      const tenantId = req.tenant.id;
      const includeDeprecatedQuery = (req.query as Record<string, unknown> | undefined)?.includeDeprecated;
      const includeDeprecated = includeDeprecatedQuery !== 'false' && includeDeprecatedQuery !== '0';
      try {
        const policies = await economicPolicyRepository.listPoliciesForTenant(tenantId, { includeDeprecated });
        const withLines = await Promise.all(
          policies.map(async (policy) => ({
            ...policy,
            lines: await economicPolicyRepository.findPolicyLines(tenantId, policy.id),
          }))
        );
        return reply.send({ ok: true, data: withLines });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar economic policies (admin read-only)');
        return reply.status(500).send({ ok: false, message: 'Erro ao listar economic policies' });
      }
    }
  );

  /**
   * POST /economy/admin/policies
   * FATIA 2 — publica uma NOVA VERSÃO de policy + suas linhas, ATOMICAMENTE. Nasce SEMPRE
   * 'draft' (Artigo V — nenhuma regra entra em vigor por escrita implícita; ativação é uma ação
   * explícita separada, ver POST .../activate). tenant_id e created_by_actor_id são SEMPRE
   * server-derived; version é SEMPRE calculado (nunca aceito do corpo).
   */
  fastify.post<{ Body: CreatePolicyVersionRequestBody }>(
    '/admin/policies',
    { preHandler: adminGate },
    async (req, reply) => {
      if (!req.user || !req.tenant?.id) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      const tenantId = req.tenant.id;
      // ARTIGO I — "não existem contas-deus": o autor é SEMPRE o PRÓPRIO actor do admin
      // autenticado, resolvido server-side a partir de req.user.userId (findByUserId) — NUNCA
      // de actionContext.actorId (canal client-declared, DECISION-0113 canal-1: "cliente declara
      // intenção, servidor decide autoridade"). Mesmo padrão self-bound de core/plan/plan.routes.ts
      // (R8F): não há razão legítima para o admin "agir como" outro actor ao publicar uma regra
      // institucional — ele autora com a PRÓPRIA identidade.
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const callerActor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, req.user.userId);
      if (!callerActor) {
        return reply.status(403).send({ ok: false, message: 'Actor do usuário autenticado não encontrado' });
      }
      const actorId = callerActor.actor_id;

      try {
        assertCreatePolicyVersionRequestValid(req.body);
      } catch (error) {
        if (error instanceof HttpError) {
          return reply.status(error.statusCode).send({ ok: false, message: error.message });
        }
        throw error;
      }

      const body = req.body;
      try {
        const { policy, lines } = await economicPolicyRepository.createPolicyVersionWithLines(
          tenantId,
          {
            policyCode: body.policyCode,
            policyType: body.policyType as any,
            moduleContext: body.moduleContext,
            vertical: body.vertical ?? null,
            actorType: body.actorType ?? null,
            serviceType: body.serviceType ?? null,
            pricingModel: body.pricingModel ?? null,
            settlementFlow: body.settlementFlow ?? null,
            countryId: body.countryId ?? null,
            stateId: body.stateId ?? null,
            cityId: body.cityId ?? null,
            categoryId: body.categoryId ?? null,
            channel: body.channel ?? null,
            campaignId: body.campaignId ?? null,
            priority: body.priority ?? 0,
            effectiveFrom: new Date(body.effectiveFrom),
            effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
            metadata: body.metadata ?? {},
            createdByActorId: actorId,
            changeReason: body.changeReason,
          },
          body.lines.map((line) => ({
            lineType: line.lineType as any,
            destinationType: line.destinationType as any,
            destinationKey: line.destinationKey ?? null,
            regionalOriginBasis: (line.regionalOriginBasis as any) ?? null,
            regionalLevel: (line.regionalLevel as any) ?? null,
            bps: line.bps ?? null,
            fixedAmountCents: line.fixedAmountCents ?? null,
            appliesTo: line.appliesTo as any,
            conditionType: line.conditionType ?? null,
            conditionJson: line.conditionJson ?? {},
            priority: line.priority ?? 0,
            metadata: line.metadata ?? {},
          }))
        );
        return reply.status(201).send({ ok: true, data: { ...policy, lines } });
      } catch (error) {
        const translated = translatePolicyWriteError(error);
        if (translated) {
          return reply.status(translated.statusCode).send({ ok: false, message: translated.message });
        }
        fastify.log.error({ err: error }, 'Erro ao publicar nova versão de economic policy');
        return reply.status(500).send({ ok: false, message: 'Erro ao publicar nova versão de economic policy' });
      }
    }
  );

  /**
   * POST /economy/admin/policies/:id/activate
   * FATIA 2 — a ÚNICA transição de status desta superfície: draft → active. NÃO é um editor
   * genérico (Artigo V): tentar ativar uma policy que já não está 'draft' devolve 409 com uma
   * mensagem clara apontando para publicar uma versão nova — o trigger de imutabilidade do banco
   * nunca chega a ser acionado por esta rota (o pré-check roda antes do UPDATE).
   */
  fastify.post<{ Params: { id: string } }>(
    '/admin/policies/:id/activate',
    { preHandler: adminGate },
    async (req, reply) => {
      if (!req.user || !req.tenant?.id) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      const tenantId = req.tenant.id;
      try {
        const activated = await economicPolicyRepository.activatePolicy(tenantId, req.params.id);
        if (activated) {
          return reply.send({ ok: true, data: activated });
        }
        const existing = await economicPolicyRepository.findPolicyById(tenantId, req.params.id);
        if (!existing) {
          return reply.status(404).send({ ok: false, message: 'economic_policy não encontrada.' });
        }
        return reply.status(409).send({
          ok: false,
          message:
            `economic_policy ${existing.id} já está '${existing.status}' — não existe edição de ` +
            'policy ativa/deprecated (Artigo V). Publique uma NOVA VERSÃO via POST /economy/admin/policies.',
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao ativar economic policy');
        return reply.status(500).send({ ok: false, message: 'Erro ao ativar economic policy' });
      }
    }
  );
};

export default economicPolicyAdminRoutes;

// src/core/economy/accounts/account.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { accountService } from '../account.service';
import {
  createAccountSchema,
  accountIdSchema,
  ownerIdSchema,
} from './account.schemas';
import type { OwnerType } from './account.types';
import { z } from 'zod';

// Schema para query params de listagem
const listAccountsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  ownerType: z.enum(['user', 'merchant', 'community_fund', 'platform_ops', 'group']).optional(),
});

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /economy/accounts - Criar nova conta
  fastify.post('/', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const legacyOwnerType = parsed.data.ownerType;
      const bankOwnerType =
        legacyOwnerType === 'user' ? 'user' as const :
        legacyOwnerType === 'platform_ops' ? 'system' as const :
        'company' as const;
      const account = await accountService.createAccount(tenantId, {
        ownerId: parsed.data.ownerId,
        ownerType: bankOwnerType,
        currency: parsed.data.currency,
      });
      return reply.status(201).send(account);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /economy/accounts/me - Buscar conta do usuário autenticado
  // IMPORTANTE: Esta rota deve vir ANTES de /:accountId para não ser capturada como parâmetro
  fastify.get('/me', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const tenantId = req.tenant!.id;
    const userId = req.user.id;

    // 🔴 VALIDAÇÃO CRÍTICA: userId não pode ser null/undefined
    if (!userId) {
      fastify.log.error({ tenantId, user: req.user }, 'userId é null/undefined em /economy/accounts/me');
      return reply.status(400).send({ error: 'User ID não encontrado na sessão' });
    }

    try {
      // Buscar ou criar conta primária do usuário (BRL)
      const account = await accountService.getOrCreateUserPrimaryAccount(tenantId, userId, 'BRL');
      
      return {
        accountId: account.accountId,
        balanceCents: account.balanceCents,
        currency: account.currency,
        status: 'active', // Conta sempre ativa se existe
      };
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      fastify.log.error({ err: error, userId, tenantId }, 'Erro ao buscar conta do usuário');
      
      // 🔴 NUNCA retornar 500 - sempre retornar 200 com payload vazio se houver erro
      // Isso previne que sidebar quebre
      // Log específico para erros de owner_id, mas todos os erros retornam 200
      if (err.message?.includes('owner_id') || err.message?.includes('null value')) {
        fastify.log.warn({ userId, tenantId }, 'Erro ao criar conta (owner_id null) - retornando payload vazio');
      }
      
      // SEMPRE retornar 200 com payload vazio para não quebrar sidebar
      return reply.status(200).send({
        accountId: null,
        balanceCents: 0,
        currency: 'BRL',
        status: 'unavailable',
      });
    }
  });

  // 🔴 DECISION-0113 canal-5 financeiro: LISTAGEM cross-actor/cross-owner com saldo NÃO é self-read (self tem /me;
  // conta única tem /:accountId). ownerId legado NÃO é actor → NÃO canRepresentActor. Exige permissão financeira
  // admin existente (financial:view_all_ledger); senão fail-closed (403). 401 sem user.
  // status?: never no braço ok:true — com strict:false (tsconfig.build, config do GATE) o narrowing
  // de união discriminada por `if (!auth.ok)` NÃO funciona e `.status` ficava inacessível (parte dos
  // 34 erros do gate, achado B4 do auditoria.md). Acesso legal nos 2 configs; zero mudança de runtime.
  async function assertFinancialAdmin(
    tenantId: string,
    callerUserId: string | undefined,
  ): Promise<{ ok: true; status?: never } | { ok: false; status: 401 | 403 }> {
    if (!callerUserId) return { ok: false, status: 401 };
    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      const callerActor = await getActiveActor(tenantId, callerUserId);
      if (!callerActor) return { ok: false, status: 403 };
      await businessAuthorizationService.requirePermission(tenantId, callerUserId, callerActor.actor_id, 'financial:view_all_ledger', 'account_list');
      return { ok: true };
    } catch {
      return { ok: false, status: 403 };
    }
  }

  // GET /economy/accounts - Listar contas
  fastify.get('/', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const auth = await assertFinancialAdmin(tenantId, (req.user as { userId?: string } | undefined)?.userId);
    if (!auth.ok) {
      return reply.status(auth.status).send({
        error: auth.status === 401 ? 'Authentication required' : 'Sem permissão financeira (financial:view_all_ledger)',
      });
    }

    const parsed = listAccountsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    const { limit, offset, ownerType } = parsed.data;
    const bankOwnerType =
      ownerType === 'user' ? 'user' as const :
      ownerType === 'platform_ops' ? 'system' as const :
      ownerType ? 'company' as const : undefined;
    return accountService.listAccounts(tenantId, { limit, offset, ownerType: bankOwnerType });
  });

  // 🔴 DECISION-0113 canal-5 financeiro by-id: autoridade de READ de conta. accountId = bank_accounts.id; o dono
  // autoritativo é bank_accounts.actor_id (via bankAccountService — o toLegacyAccount DROPA o actorId, então não é
  // cartório de authority). actor != null → representar o actor dono (403); actor == null (system/escrow = cofre da
  // plataforma) → exige financial:view_all_ledger (admin/finance existente), senão fail-closed (403).
  async function assertAccountReadAuthority(
    tenantId: string,
    callerUserId: string | undefined,
    accountId: string,
  ): Promise<{ ok: true; status?: never } | { ok: false; status: 401 | 403 | 404 }> {
    if (!callerUserId) return { ok: false, status: 401 };
    const { bankAccountService } = await import('@modules/bank/bank-account.service');
    const account = await bankAccountService.getAccountById(tenantId, accountId);
    if (!account) return { ok: false, status: 404 };
    if (account.actorId) {
      let canRep = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canRep = await authorizationService.canRepresentActor(tenantId, callerUserId, account.actorId);
      } catch {
        canRep = false;
      }
      return canRep ? { ok: true } : { ok: false, status: 403 };
    }
    // system/escrow (sem actor): cofre da plataforma → exige permissão financeira admin existente; senão fail-closed.
    let adminOk = false;
    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      const callerActor = await getActiveActor(tenantId, callerUserId);
      if (callerActor) {
        await businessAuthorizationService.requirePermission(tenantId, callerUserId, callerActor.actor_id, 'financial:view_all_ledger', 'account');
        adminOk = true;
      }
    } catch {
      adminOk = false;
    }
    return adminOk ? { ok: true } : { ok: false, status: 403 };
  }

  // GET /economy/accounts/:accountId - Buscar conta por ID
  fastify.get<{ Params: { accountId: string } }>('/:accountId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = accountIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsed.error.errors,
      });
    }

    const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
    const auth = await assertAccountReadAuthority(tenantId, callerUserId, parsed.data.accountId);
    if (!auth.ok) {
      return reply.status(auth.status).send({
        error: auth.status === 404 ? 'Account not found' : auth.status === 401 ? 'Authentication required' : 'Sem autoridade sobre a conta',
      });
    }

    const account = await accountService.getAccountById(tenantId, parsed.data.accountId);

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    return account;
  });

  // GET /economy/accounts/:accountId/balance - Buscar saldo
  fastify.get<{ Params: { accountId: string } }>('/:accountId/balance', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = accountIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsed.error.errors,
      });
    }

    const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
    const auth = await assertAccountReadAuthority(tenantId, callerUserId, parsed.data.accountId);
    if (!auth.ok) {
      return reply.status(auth.status).send({
        error: auth.status === 404 ? 'Account not found' : auth.status === 401 ? 'Authentication required' : 'Sem autoridade sobre a conta',
      });
    }

    const account = await accountService.getAccountById(tenantId, parsed.data.accountId);

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    return {
      accountId: account.accountId,
      balanceCents: account.balanceCents,
      currency: account.currency,
    };
  });

  // GET /economy/accounts/owner/:ownerId - Listar contas por owner
  fastify.get<{
    Params: { ownerId: string };
    Querystring: { ownerType?: OwnerType };
  }>('/owner/:ownerId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    // 🔴 DECISION-0113 canal-5 financeiro: lista por ownerId LEGADO (não actor) → listagem admin/financeira.
    const auth = await assertFinancialAdmin(tenantId, (req.user as { userId?: string } | undefined)?.userId);
    if (!auth.ok) {
      return reply.status(auth.status).send({
        error: auth.status === 401 ? 'Authentication required' : 'Sem permissão financeira (financial:view_all_ledger)',
      });
    }

    const parsedParams = ownerIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid owner ID',
        details: parsedParams.error.errors,
      });
    }

    const { ownerType } = req.query;
    if (!ownerType) {
      return reply.status(400).send({ error: 'ownerType query parameter is required' });
    }

    const accounts = await accountService.getAccountsByOwnerWithLegacyType(
      tenantId,
      parsedParams.data.ownerId,
      ownerType
    );
    return { accounts };
  });
};

export default accountRoutes;

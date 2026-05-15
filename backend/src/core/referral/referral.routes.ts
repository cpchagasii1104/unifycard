// src/core/referral/referral.routes.ts
// Rotas de código de indicação/afiliado

import { FastifyPluginAsync } from 'fastify';
import { referralService } from './referral.service';
import { runQueryWithTenant } from '@core/database/pool';

const referralRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /referral/code
   * Obtém ou gera código de indicação do usuário autenticado
   */
  fastify.get('/code', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const code = await referralService.getOrCreateReferralCode(req.tenant.id, req.user.id);
      return { referralCode: code };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar código de indicação');
      return reply.status(500).send({ error: 'Erro ao buscar código de indicação' });
    }
  });

  /**
   * POST /referral/apply
   * Aplica código de indicação (usado no registro)
   */
  fastify.post<{
    Body: {
      referralCode: string;
    };
  }>('/apply', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const result = await referralService.applyReferralCode(
        req.tenant.id,
        req.user.id,
        req.body.referralCode
      );
      return result;
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao aplicar código de indicação');
      return reply.status(500).send({ error: 'Erro ao aplicar código de indicação' });
    }
  });

  /**
   * GET /referral/earnings
   * A6 (2026-05-15): retorna ganhos acumulados do user com código de indicação.
   * Substrato material: bank_splits com split_type='referral' já são gerados pelo
   * bank-split-engine (linha 196) quando user transactor tem referrer ativo. Esta
   * rota agrega esses splits para a conta do user autenticado.
   */
  fastify.get('/earnings', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { bankAccountService } = await import('../../modules/bank/bank-account.service');
      const userAccount = await bankAccountService.getAccountByOwner(
        req.tenant.id,
        req.user.id,
        'user',
        'BRL'
      );

      if (!userAccount) {
        return reply.send({ ok: true, data: { totalCents: 0, count: 0, hasAccount: false } });
      }

      const result = await runQueryWithTenant<{ total_cents: string; cnt: string }>(
        req.tenant.id,
        `
          SELECT
            COALESCE(SUM(amount_cents), 0)::text AS total_cents,
            COUNT(*)::text AS cnt
          FROM bank_splits
          WHERE tenant_id = $1
            AND target_account_id = $2
            AND split_type = 'referral'
        `,
        [req.tenant.id, userAccount.accountId]
      );

      const totalCents = parseInt(result?.total_cents ?? '0', 10);
      const count = parseInt(result?.cnt ?? '0', 10);

      return reply.send({
        ok: true,
        data: {
          totalCents,
          count,
          hasAccount: true,
          currency: 'BRL',
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar ganhos de indicação');
      return reply.status(500).send({ error: 'Erro ao buscar ganhos de indicação' });
    }
  });

  /**
   * GET /referral/validate
   * 🔧 FIX: Valida se um código de indicação existe (para UX em tempo real)
   * Não aplica o código, apenas verifica existência
   */
  fastify.get<{
    Querystring: {
      code?: string;
      tenantId?: string;
    };
  }>('/validate', async (req, reply) => {
    const { code, tenantId: queryTenantId } = req.query;
    
    // Validação: código ausente ou vazio
    if (!code || code.trim() === '') {
      return reply.status(400).send({ error: 'Código de indicação é obrigatório' });
    }

    // Validação: formato do código (alfanumérico, 4-32 caracteres)
    const codeRegex = /^[A-Za-z0-9]{4,32}$/;
    if (!codeRegex.test(code.trim())) {
      return reply.status(400).send({ error: 'Formato de código de indicação inválido' });
    }

    // 🔧 FIX (tenant resolution): Resolver tenantId automaticamente nesta ordem
    const tenantId = req.tenant?.id || (req.headers['x-tenant-id'] as string) || queryTenantId;
    
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID é obrigatório para validação' });
    }

    try {
      // Reutilizar lógica existente do applyReferralCode (busca sem aplicar)
      const referrer = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `
          SELECT user_id
          FROM users
          WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
          LIMIT 1
        `,
        [tenantId, code.trim()]
      );

      if (!referrer || !referrer.user_id) {
        return reply.status(404).send({ error: 'Código de indicação não encontrado' });
      }

      return reply.status(200).send({ valid: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao validar código de indicação');
      return reply.status(500).send({ error: 'Erro ao validar código de indicação' });
    }
  });
};

export default referralRoutes;












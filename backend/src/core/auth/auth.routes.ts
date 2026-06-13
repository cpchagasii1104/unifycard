// src/core/auth/auth.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { authService } from '@core/auth/auth.service';
import { validateCpfOrThrow, normalizeCpf } from '@utils/cpf.validator';
import { authRateLimitService } from '@core/rate-limiting/auth-rate-limit.service';
import { RateLimitError } from '@core/errors';
import { z } from 'zod';
import { GENDER_VALUES, type Gender } from '@unificard/contracts';

const GENDER_ZOD_ENUM = [...GENDER_VALUES] as [Gender, Gender, ...Gender[]];

// Schemas de validação
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  cpf: z.string().min(11).max(11),
  fullName: z.string().min(1).optional(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(GENDER_ZOD_ENUM).optional(),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

// Types para Fastify
interface RegisterBody {
  email: string;
  password: string;
  cpf: string;
  fullName?: string;
  birthdate?: string;
  gender?: Gender;
  referralCode?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/register
  fastify.post<{ Body: RegisterBody }>('/register', async (req, reply) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado
    const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
    fastify.log.info({
      pid: process.pid,
      route: '/auth/register',
      method: 'POST',
      tenantIdProvided: !!tenantIdHeader,
      tenantId: tenantIdHeader || null,
      email: req.body?.email ? req.body.email.substring(0, 3) + '***' : null,
    }, '[RUNTIME] POST /auth/register');

    // Validação
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { email, password, cpf, fullName, birthdate, gender, referralCode } = parsed.data;

    // 🔴 RATE LIMITING: Verificar limite antes de processar
    try {
      const rateLimitCheck = await authRateLimitService.checkRateLimit(
        'auth.register',
        req,
        tenantIdHeader,
        undefined, // userId ainda não existe
        email
      );

      if (!rateLimitCheck.allowed) {
        // 🔴 LOG CANÔNICO: Abuso detectado
        fastify.log.warn({
          route: '/auth/register',
          ip: authRateLimitService.extractClientIp(req),
          tenantId: tenantIdHeader,
          email: email.substring(0, 3) + '***',
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [AUTH] Rate limit excedido em /auth/register');

        throw new RateLimitError(
          `Limite de tentativas de registro excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
      fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
    }

    // Tenant é opcional no registro - será criado automaticamente se não fornecido
    const tenantId = tenantIdHeader;

    try {
      // 🔴 SCHEMA GUARD COMENTADO: Schema já é validado no boot/migrations
      // O guard não deve bloquear runtime - validação de schema ocorre na inicialização
      // Validação de schema: verificar se coluna token_version existe
      // const hasTokenVersion = await hasTokenVersionColumn();
      // if (!hasTokenVersion) {
      //   fastify.log.error({
      //     route: '/auth/register',
      //     pid: process.pid,
      //   }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
      //   
      //   return reply.status(500).send({
      //     success: false,
      //     error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
      //     details: 'Execute as migrations do banco de dados para atualizar o schema.',
      //   });
      // }

      const result = await authService.register(
        tenantId, 
        email, 
        password, 
        cpf, 
        fullName, 
        birthdate, 
        gender, 
        referralCode
      );

      // 🔴 LOG CANÔNICO: tenant criado vs fornecido
      // Garantir que tenantId final está sempre presente
      if (!result.tenantId || typeof result.tenantId !== 'string') {
        fastify.log.error({
          pid: process.pid,
          route: '/auth/register',
          email: email.substring(0, 3) + '***',
        }, '❌ [AUTH] tenantId ausente no resultado do registro - estado inválido');
        return reply.status(500).send({
          success: false,
          error: 'Erro interno: tenantId não foi retornado após registro',
        });
      }

      // 🔴 GARANTIA CANÔNICA: tenantId já validado no authService.register
      // Token foi gerado pelo próprio serviço, não há necessidade de validar imediatamente
      // Log canônico de sucesso
      // F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC: tenant é SEMPRE resolvido server-side
      // (unificard-inicial); o header x-tenant-id NÃO escolhe tenant. Sem "criado/fornecido".
      fastify.log.info({
        pid: process.pid,
        route: '/auth/register',
        tenantIdFinal: result.tenantId,
        tenantResolution: 'server-side:unificard-inicial',
      }, '[RUNTIME] POST /auth/register - sucesso');

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number; code?: string };
      const status = err.statusCode ?? 500;
      fastify.log.error({ err: error, status }, 'Erro no registro');
      
      return reply.status(status).send({
        success: false,
        error: err.message || 'Erro interno do servidor',
      });
    }
  });

  // POST /auth/login
  fastify.post<{ Body: LoginBody }>('/login', async (req, reply) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
    const tenantId = req.headers['x-tenant-id'] as string;
    fastify.log.info({
      pid: process.pid,
      route: '/auth/login',
      method: 'POST',
      tenantId,
      email: req.body?.email ? req.body.email.substring(0, 3) + '***' : null,
    }, '[RUNTIME] POST /auth/login');
    
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      fastify.log.warn({
        route: '/auth/login',
        body: req.body,
        errors: parsed.error.errors,
      }, '❌ [AUTH] Validação de body falhou no login');
      
      return reply.status(400).send({
        error: 'Dados de login inválidos',
        message: 'Email e senha são obrigatórios. Email deve ser válido e senha deve ter no mínimo 6 caracteres.',
        details: parsed.error.errors,
      });
    }

    const { email, password } = parsed.data;

    // 🔴 RATE LIMITING: Verificar limite antes de processar
    try {
      const rateLimitCheck = await authRateLimitService.checkRateLimit(
        'auth.login',
        req,
        tenantId,
        undefined, // userId ainda não conhecido
        email
      );

      if (!rateLimitCheck.allowed) {
        // 🔴 LOG CANÔNICO: Abuso detectado
        fastify.log.warn({
          route: '/auth/login',
          ip: authRateLimitService.extractClientIp(req),
          tenantId,
          email: email.substring(0, 3) + '***',
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [AUTH] Rate limit excedido em /auth/login');

        throw new RateLimitError(
          `Limite de tentativas de login excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
      fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
    }

    // tenantId é opcional no login - será obtido do usuário encontrado
    try {
      // 🔴 SCHEMA GUARD COMENTADO: Schema já é validado no boot/migrations
      // O guard não deve bloquear runtime - validação de schema ocorre na inicialização
      // Validação de schema: verificar se coluna token_version existe
      // const hasTokenVersion = await hasTokenVersionColumn();
      // if (!hasTokenVersion) {
      //   fastify.log.error({
      //     route: '/auth/login',
      //   }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
      //   
      //   return reply.status(500).send({
      //     success: false,
      //     error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
      //     details: 'Execute as migrations do banco de dados para atualizar o schema.',
      //   });
      // }

      // tenantId do header é opcional - o login busca usuário apenas por email
      const result = await authService.login(tenantId || undefined, email, password);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number; code?: string };
      const status = err.statusCode ?? 500;
      fastify.log.error({ err: error, status }, 'Erro no login');
      
      return reply.status(status).send({
        success: false,
        error: err.message || 'Erro interno do servidor',
      });
    }
  });

  // POST /auth/refresh
  fastify.post<{ Body: RefreshBody }>('/refresh', async (req, reply) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado
    const tenantId = req.headers['x-tenant-id'] as string;
    fastify.log.info({
      pid: process.pid,
      route: '/auth/refresh',
      method: 'POST',
      tenantId: tenantId || null,
      hasTenantId: !!tenantId,
    }, '[RUNTIME] POST /auth/refresh');

    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { refreshToken } = parsed.data;

    // 🔴 GARANTIA CANÔNICA: refresh exige tenantId obrigatório
    if (!tenantId) {
      fastify.log.warn({
        pid: process.pid,
        route: '/auth/refresh',
      }, '❌ [AUTH] refresh sem tenantId');
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    // 🔴 RATE LIMITING: Verificar limite antes de processar
    try {
      // Tentar extrair userId do refresh token (opcional, para rate limit mais preciso)
      let userId: string | undefined;
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(refreshToken) as any;
        userId = decoded?.userId || decoded?.sub;
      } catch {
        // Ignorar erro de decode (token pode estar inválido)
      }

      const rateLimitCheck = await authRateLimitService.checkRateLimit(
        'auth.refresh',
        req,
        tenantId,
        userId
      );

      if (!rateLimitCheck.allowed) {
        // 🔴 LOG CANÔNICO: Abuso detectado
        fastify.log.warn({
          route: '/auth/refresh',
          ip: authRateLimitService.extractClientIp(req),
          tenantId,
          userId,
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [AUTH] Rate limit excedido em /auth/refresh');

        throw new RateLimitError(
          `Limite de tentativas de refresh excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
      fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
    }

    try {
      // 🔴 SCHEMA GUARD COMENTADO: Schema já é validado no boot/migrations
      // O guard não deve bloquear runtime - validação de schema ocorre na inicialização
      // 🔴 GARANTIA CANÔNICA: Schema guard - fail fast
      // const hasTokenVersion = await hasTokenVersionColumn();
      // if (!hasTokenVersion) {
      //   fastify.log.error({
      //     route: '/auth/refresh',
      //     pid: process.pid,
      //   }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
      //   
      //   return reply.status(500).send({
      //     success: false,
      //     error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
      //     details: 'Execute as migrations do banco de dados para atualizar o schema.',
      //   });
      // }

      const tokens = await authService.refreshToken(tenantId, refreshToken);
      
      // 🔴 LOG CANÔNICO: Refresh success (log já existe no service, mas adicionar aqui também para rastreabilidade na rota)
      const { canonicalLogger } = await import('@core/logging/canonical-logger');
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(refreshToken) as any;
        canonicalLogger.info(req, 'Refresh success', {
          tenantId,
          userId: decoded?.sub || decoded?.userId,
        });
      } catch {
        // Ignorar se não conseguir decodificar (já logado no service)
      }
      
      return reply.send({
        success: true,
        data: tokens,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const status = err.statusCode ?? 500;
      
      // 🔴 LOG CANÔNICO: Refresh failure (log já existe no service, mas adicionar aqui também para rastreabilidade na rota)
      if (status === 401 || status === 404) {
        const { canonicalLogger } = await import('@core/logging/canonical-logger');
        canonicalLogger.warn(req, 'Refresh failure', {
          tenantId,
          statusCode: status,
          error: err.message,
        });
      }
      
      return reply.status(status).send({
        success: false,
        error: err.message,
      });
    }
  });

  // POST /auth/logout
  fastify.post<{ Body: RefreshBody }>('/logout', async (req, reply) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado
    const tenantId = req.headers['x-tenant-id'] as string;
    fastify.log.info({
      pid: process.pid,
      route: '/auth/logout',
      method: 'POST',
      tenantId: tenantId || null,
      hasTenantId: !!tenantId,
    }, '[RUNTIME] POST /auth/logout');

    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { refreshToken } = parsed.data;

    // 🔴 GARANTIA CANÔNICA: logout exige tenantId obrigatório
    if (!tenantId) {
      fastify.log.warn({
        pid: process.pid,
        route: '/auth/logout',
      }, '❌ [AUTH] logout sem tenantId');
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    try {
      // Verificar token para obter userId
      const decoded = authService.verifyJWT<{ sub: string; tenantId: string }>(refreshToken);
      
      if (decoded.tenantId !== tenantId) {
        // 🔴 LOG CANÔNICO: Cross-tenant violation detectada
        const { canonicalLogger } = await import('@core/logging/canonical-logger');
        canonicalLogger.abuse(req, 'Cross-tenant violation: tenantId do token não corresponde ao header', {
          tenantIdFromHeader: tenantId,
          tenantIdFromToken: decoded.tenantId,
          userId: decoded.sub,
        });
        return reply.status(401).send({
          success: false,
          error: 'Invalid tenant for token',
        });
      }

      // Invalidar tokens antigos incrementando tokenVersion
      await authService.logout(tenantId, decoded.sub);

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const status = err.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: err.message,
      });
    }
  });

  // GET /auth/check-cpf
  // Verifica se um CPF já está cadastrado no sistema
  fastify.get<{ Querystring: { cpf: string } }>('/check-cpf', async (req, reply) => {
    const rawCpf = req.query.cpf;
    const tenantId = req.headers['x-tenant-id'] as string | undefined;

    if (!rawCpf || typeof rawCpf !== 'string') {
      return reply.status(400).send({
        error: 'CPF é obrigatório',
        message: 'Forneça o CPF como query parameter: ?cpf=XXXXXXXXXXX',
      });
    }

    // 🔴 RATE LIMITING: Verificar limite antes de processar
    try {
      const rateLimitCheck = await authRateLimitService.checkRateLimit(
        'auth.check-cpf',
        req,
        tenantId
      );

      if (!rateLimitCheck.allowed) {
        // 🔴 LOG CANÔNICO: Abuso detectado
        fastify.log.warn({
          route: '/auth/check-cpf',
          ip: authRateLimitService.extractClientIp(req),
          tenantId,
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [AUTH] Rate limit excedido em /auth/check-cpf');

        throw new RateLimitError(
          `Limite de verificações de CPF excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: se houver erro no rate limit, continuar (não quebrar fluxo)
      fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit (fail-open)');
    }

    try {
      // 🔒 SEGURANÇA: Validar e normalizar CPF antes da consulta
      // validateCpfOrThrow valida formato e dígitos verificadores
      validateCpfOrThrow(rawCpf);
      
      // Normalizar CPF (remover formatação, deixar apenas números)
      const normalizedCpf = normalizeCpf(rawCpf);

      // Consultar banco de dados usando CPF normalizado
      const { pool } = await import('@core/database/pool');
      const result = await pool.query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM global_users WHERE cpf = $1) as exists',
        [normalizedCpf]
      );

      const exists = result.rows[0]?.exists === true;

      return reply.send({
        exists,
      });
    } catch (error) {
      const err = error as Error;
      
      // Se for erro de validação de CPF, retornar 400
      if (err.message.includes('CPF') || err.message.includes('dígitos')) {
        return reply.status(400).send({
          error: 'CPF inválido',
          message: err.message,
        });
      }

      // Outros erros retornam 500
      fastify.log.error({ err: error }, 'Erro ao verificar CPF');
      return reply.status(500).send({
        error: 'Erro interno ao verificar CPF',
      });
    }
  });

  // GET /auth/check-referral?code=<CODE>
  // Validação PÚBLICA (pré-sessão) de código de indicação para UX em tempo real.
  // F-REGISTER-PRELAUNCH-BLOCKERS A1 (Opção A): resolve o tenant institucional
  // `unificard-inicial` SERVER-SIDE (mesma decisão TENANT do cadastro orgânico,
  // DECISION-0115 D1) — NUNCA confia em x-tenant-id do cliente como autoridade.
  // Shape estável { valid: boolean }; não aplica, não escreve, não cria actor.
  fastify.get<{ Querystring: { code?: string } }>('/check-referral', async (req, reply) => {
    const rawCode = req.query.code;

    if (!rawCode || typeof rawCode !== 'string' || rawCode.trim() === '') {
      return reply.status(400).send({ error: 'Código de indicação é obrigatório' });
    }
    // Reusa o MESMO formato de /referral/validate (alfanumérico, 4-32).
    const code = rawCode.trim();
    const codeRegex = /^[A-Za-z0-9]{4,32}$/;
    if (!codeRegex.test(code)) {
      return reply.status(400).send({ error: 'Formato de código de indicação inválido' });
    }

    // 🔴 RATE LIMITING (equivalente ao check-cpf). IP/sem-tenant — pré-sessão.
    try {
      const rateLimitCheck = await authRateLimitService.checkRateLimit('auth.check-referral', req);
      if (!rateLimitCheck.allowed) {
        fastify.log.warn({
          route: '/auth/check-referral',
          ip: authRateLimitService.extractClientIp(req),
          reason: rateLimitCheck.reason,
          limit: rateLimitCheck.limit,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        }, '🚫 [AUTH] Rate limit excedido em /auth/check-referral');
        throw new RateLimitError(
          `Limite de verificações de indicação excedido. Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`,
          rateLimitCheck.resetAt,
          rateLimitCheck.remaining
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).send({
          success: false,
          error: error.message,
          resetAt: error.resetAt?.toISOString(),
          remaining: error.remaining,
        });
      }
      // Fail-open: erro no rate limit não quebra o fluxo de UX.
      fastify.log.warn({ err: error }, '[AUTH] Erro ao verificar rate limit referral (fail-open)');
    }

    try {
      // TENANT server-side — x-tenant-id do cliente é IGNORADO por desenho.
      const { tenantService } = await import('@core/tenants/tenant.service');
      const { runQueryWithTenant } = await import('@core/database/pool');
      const institutionalTenant = await tenantService.getTenantBySlug('unificard-inicial');
      const tenantId = institutionalTenant.tenantId;

      const referrer = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `SELECT user_id
           FROM users
          WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
          LIMIT 1`,
        [tenantId, code]
      );

      // Shape simples e estável; existência ⇒ valid:true, ausência ⇒ valid:false.
      return reply.status(200).send({ valid: !!(referrer && referrer.user_id) });
    } catch (error) {
      // Erro técnico pré-sessão NÃO é "código inválido" confirmado → 500 honesto
      // (o frontend mantém o status como indeterminado, não bloqueia o cadastro).
      fastify.log.error({ err: error }, 'Erro ao validar código de indicação (público)');
      return reply.status(500).send({ error: 'Erro ao validar código de indicação' });
    }
  });
};

export default authRoutes;

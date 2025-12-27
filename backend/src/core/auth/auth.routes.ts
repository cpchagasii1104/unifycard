// src/core/auth/auth.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { authService } from '@core/auth/auth.service';
import { hasTokenVersionColumn } from '@core/database/schema-validator';
import { z } from 'zod';

// Schemas de validação
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

// Types para Fastify
interface RegisterBody {
  email: string;
  password: string;
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
    // Validação
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { email, password } = parsed.data;

    // Auth é público, mas precisa de tenant para multi-tenancy
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    try {
      // Validação de schema: verificar se coluna token_version existe
      const hasTokenVersion = await hasTokenVersionColumn();
      if (!hasTokenVersion) {
        fastify.log.error({
          route: '/auth/register',
        }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
        
        return reply.status(500).send({
          success: false,
          error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
          details: 'Execute as migrations do banco de dados para atualizar o schema.',
        });
      }

      const result = await authService.register(tenantId, email, password);
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
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { email, password } = parsed.data;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    try {
      // Validação de schema: verificar se coluna token_version existe
      const hasTokenVersion = await hasTokenVersionColumn();
      if (!hasTokenVersion) {
        fastify.log.error({
          route: '/auth/login',
        }, '❌ [AUTH] Schema inválido: coluna users.token_version não existe.');
        
        return reply.status(500).send({
          success: false,
          error: 'Schema do banco de dados está desatualizado. A coluna users.token_version não existe.',
          details: 'Execute as migrations do banco de dados para atualizar o schema.',
        });
      }

      const result = await authService.login(tenantId, email, password);
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
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { refreshToken } = parsed.data;

    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    try {
      const tokens = await authService.refreshToken(tenantId, refreshToken);
      return reply.send({
        success: true,
        data: tokens,
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

  // POST /auth/logout
  fastify.post<{ Body: RefreshBody }>('/logout', async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const { refreshToken } = parsed.data;

    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }

    try {
      // Verificar token para obter userId
      const decoded = authService.verifyJWT<{ sub: string; tenantId: string }>(refreshToken);
      
      if (decoded.tenantId !== tenantId) {
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
};

export default authRoutes;

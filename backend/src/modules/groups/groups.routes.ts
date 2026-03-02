// src/modules/groups/groups.routes.ts

import { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groupsService } from './groups.service';
import { groupImageService } from './services/group-image.service';
import { rbacService } from '@core/rbac/rbac.service';
import type { PermissionString } from '@core/rbac/rbac.types';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000), // Obrigatória
  audience_description: z.string().max(500).optional(), // Opcional - Descrição do público-alvo
  category_id: z.string().uuid(), // Obrigatória
  visibility: z.enum(['public', 'private', 'secret']).optional().default('public'),
  scope: z.enum(['national', 'state', 'city', 'neighborhood']).optional().default('national'),
  country_id: z.string().uuid(), // Obrigatório
  state_id: z.string().uuid().optional(), // Obrigatório se scope >= 'state'
  city_id: z.string().uuid().optional(), // Obrigatório se scope >= 'city'
  neighborhood: z.string().max(255).optional(), // Obrigatório se scope == 'neighborhood'
  avatar_url: z.string().url().optional(),
  cover_url: z.string().url().optional(),
  rules_text: z.string().max(5000).optional(),
  financial_purpose: z.string().min(20).max(2000).optional(), // Obrigatório se hasFinancialIntent = true
  slug: z.string().max(255).optional(), // Opcional - será gerado automaticamente se não fornecido
  metadata: z.record(z.any()).optional(),
  // 🔴 REMOVIDO: owner_actor_id não é necessário - sistema não suporta páginas criando grupos
}).refine((data) => {
  // Validar campos obrigatórios baseado no scope
  if (data.scope !== 'national' && !data.state_id) {
    return false;
  }
  if ((data.scope === 'city' || data.scope === 'neighborhood') && !data.city_id) {
    return false;
  }
  if (data.scope === 'neighborhood' && !data.neighborhood) {
    return false;
  }
  return true;
}, (data) => {
  // Mensagens de erro específicas por scope
  if (data.scope !== 'national' && !data.state_id) {
    return { message: `Estado é obrigatório para abrangência ${data.scope === 'state' ? 'estadual' : data.scope === 'city' ? 'municipal' : 'de bairro'}` };
  }
  if ((data.scope === 'city' || data.scope === 'neighborhood') && !data.city_id) {
    return { message: `Cidade é obrigatória para abrangência ${data.scope === 'city' ? 'municipal' : 'de bairro'}` };
  }
  if (data.scope === 'neighborhood' && !data.neighborhood) {
    return { message: 'Bairro é obrigatório para abrangência de bairro' };
  }
  return { message: 'Campos obrigatórios não fornecidos para o scope selecionado' };
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  audience_description: z.string().max(500).optional(), // Opcional - Descrição do público-alvo
  isActive: z.boolean().optional(),
  financial_purpose: z.string().min(20).max(2000).optional(), // Obrigatório se hasFinancialIntent = true
  metadata: z.record(z.any()).optional(),
  profitBps: z.number().min(0).max(100).optional(),
});

/**
 * Guards tipo-safe para objetos que podem ter id/icon/metadata (ex.: Category ou extensões).
 * Usado em GET /categories para acessar campos sem cast inseguro.
 */
function hasId(x: unknown): x is { id: string } {
  return typeof x === 'object' && x !== null && 'id' in x && typeof (x as { id?: unknown }).id === 'string';
}
function hasIcon(x: unknown): x is { icon: string } {
  return typeof x === 'object' && x !== null && 'icon' in x && typeof (x as { icon?: unknown }).icon === 'string';
}
function hasMetadata(x: unknown): x is { metadata: unknown } {
  return typeof x === 'object' && x !== null && 'metadata' in x;
}

/**
 * Helper: Verifica se o usuário é owner do grupo OU tem permission RBAC
 * Owner tem permissão implícita para gerenciar seu grupo
 */
async function requireGroupOwnerOrPermission(
  fastify: FastifyInstance,
  req: FastifyRequest<{ Params: { groupId?: string; id?: string } }>,
  reply: FastifyReply,
  permission: PermissionString
): Promise<void> {
  const tenantId = req.tenant?.id;
  
  // ActionContext é obrigatório (V2)
  if (!req.actionContext || !req.actionContext.actorId) {
    throw fastify.httpErrors.badRequest('ActionContext obrigatório');
  }

  const actorId = req.actionContext.actorId;

  if (!tenantId) {
    throw fastify.httpErrors.unauthorized('Authentication required');
  }

  const groupId = req.params.groupId || req.params.id;

  if (!groupId) {
    throw fastify.httpErrors.badRequest('Group ID is required');
  }

  // Resolver userId a partir do actorId para uso em isUserAdminOrOwner e logs
  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const actorRepository = socialPortsRegistry.getActorRepository();
  const actor = await actorRepository.findById(tenantId, actorId);
  if (!actor || !actor.user_id) {
    throw fastify.httpErrors.badRequest('Actor não encontrado ou não é do tipo user');
  }
  const userIdForCheck = actor.user_id;

  // 1. Verificar se é owner do grupo OU admin (permissão implícita)
  try {
    const group = await groupsService.getGroup(tenantId, groupId);
    if (group) {
      // ActionContext é obrigatório (V2)
      const isOwner = group.ownerUserId === req.actionContext.actorId;
      
      if (isOwner) {
        /**
         * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
         * Motivo: Owner tem permissão implícita que bypassa RBAC (exceção ao modelo padrão de permissões)
         * Contexto: Regra de negócio específica para grupos - owner tem acesso total
         * Tipo: estrutural
         */
        // Owner tem permissão implícita - bypass RBAC
        req.log.info({
          tenantId,
          actorId,
          userId: userIdForCheck,
          groupId,
          ownerUserId: group.ownerUserId,
          permission,
          action: 'group_owner_bypass',
        }, 'Group owner access granted (bypass RBAC)');
        return;
      }

      // 🔴 CORREÇÃO UX: Verificar se usuário é admin do grupo
      const { groupsRepository } = await import('./groups.repository');
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, userIdForCheck);
      if (isAdmin) {
        /**
         * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
         * Motivo: Admin de grupo tem permissão implícita que bypassa RBAC (exceção ao modelo padrão)
         * Contexto: Regra de negócio específica para grupos - admin tem acesso total
         * Tipo: estrutural
         */
        req.log.info({
          tenantId,
          userId: userIdForCheck,
          groupId,
          permission,
          action: 'group_admin_bypass',
        }, 'Group admin access granted (bypass RBAC)');
        return;
      }
    }
  } catch (err) {
    // Se grupo não existe, deixar a rota principal tratar o 404
    // Não bloquear aqui para permitir que a rota retorne 404 apropriado
  }

  // 2. Se não é owner, verificar RBAC (actor já resolvido acima)
  if (!req.actionContext || !req.actionContext.actorId) {
    throw fastify.httpErrors.badRequest('ActionContext obrigatório');
  }

  const check = await rbacService.userHasAllPermissions(tenantId, userIdForCheck, [permission]);
  if (!check.hasPermission) {
    req.log.warn({
      tenantId,
      userId: userIdForCheck,
      rbacUserId: userIdForCheck,
      groupId,
      permission,
      action: 'group_access_denied',
    }, 'User lacks permission and is not group owner');
    throw fastify.httpErrors.forbidden(
      check.reason || `User is missing required permission: ${permission}`
    );
  }

  req.log.info({
    tenantId,
    userId: userIdForCheck,
    rbacUserId: userIdForCheck,
    groupId,
    permission,
    action: 'group_rbac_access_granted',
  }, 'Group access granted via RBAC');
}

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /groups
   * Criar novo grupo
   */
  fastify.post(
    '/',
    {
      preHandler: fastify.requirePermission(['groups:create']),
    },
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // Resolver userId a partir do actorId (temporário, até services migrarem para actorId)
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(tenantId, req.actionContext.actorId);
      if (!actor || !actor.user_id) {
        return reply.status(404).send({ error: 'Actor não encontrado ou não é do tipo user' });
      }
      const userId = actor.user_id;
      const requestId = (req as any).requestId || req.id;

      // 🔴 GATE: Validar identity_status COMPLETE antes de criar grupo
      try {
        const { coreService } = await import('@core/core.service');
        const profile = await coreService.getCompleteProfile(tenantId, userId);
        
        if (profile.identity_status !== 'COMPLETE') {
          return reply.status(403).send({
            error: 'Cadastro incompleto',
            message: 'Para criar um grupo, você precisa concluir seu cadastro básico (nome, CPF, data de nascimento e sexo).',
            identity_status: profile.identity_status,
          });
        }
      } catch (identityErr) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          err: identityErr,
          action: 'identity_status_check',
        }, 'Erro ao verificar identity_status');
        return reply.status(500).send({
          error: 'Erro ao verificar status do cadastro',
          message: 'Não foi possível verificar se seu cadastro está completo.',
        });
      }

      // 🔴 REMOVIDO: Validação de owner_actor_id - sistema não suporta páginas criando grupos
      // O grupo sempre será criado pelo actor do usuário autenticado

      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const group = await groupsService.createGroup(tenantId, userId, parsed.data);

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId: group.groupId,
          action: 'group_created',
          source: 'groups',
        }, 'Group created');

        return reply.status(201).send(group);
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          err: error,
          action: 'group_created',
          source: 'groups',
        }, 'Error creating group');

        // 🔴 TRATAMENTO: ForbiddenError (incluindo GROUP_CREATION_LIMIT_REACHED) é tratado pelo error handler global
        // O error handler já formata a resposta com { ok: false, message, code }
        // Apenas re-lançar o erro para que o error handler global o processe
        throw error;
      }
    }
  );

  /**
   * GET /groups/categories
   * Listar categorias de grupos disponíveis (CORE - fonte única)
   * Busca da tabela categories com scope='group' e is_active=true
   * Retorna allowed_scopes da categoria raiz (se categoria tiver parent_id, busca a raiz)
   * TODO: ADAPTER -> categories (core) - Já usa categories core, apenas confirmar que está correto
   */
  fastify.get('/categories', async (req, reply) => {
    try {
      const { categoriesService } = await import('@core/categories/categories.service');
      const { CategoryRepository } = await import('@core/categories/categories.repository');
      const { CategoryModel } = await import('@core/categories/categories.model');

      // Buscar categorias com scope='group' usando o repository canônico
      const categoryRepository = new CategoryRepository();
      const allRows = await categoryRepository.findAll(undefined, 'group' as any);
      const categories = CategoryModel.fromRows(allRows).filter((c) => c.scope === 'group');

      // Para cada categoria, buscar allowed_scopes da categoria raiz
      const categoriesWithAllowedScopes = await Promise.all(
        categories.map(async (category) => {
          let rootCategory = category;
          
          // Se categoria tem parent_id, buscar categoria raiz
          if (category.parentId) {
            let currentCategory = category;
            while (currentCategory.parentId) {
              const parent = await categoriesService.getCategoryById(currentCategory.parentId);
              if (!parent) break;
              currentCategory = parent;
            }
            rootCategory = currentCategory;
          }

          // Extrair allowed_scopes do metadata da categoria raiz (acesso tipo-safe)
          const rootMeta = hasMetadata(rootCategory) ? rootCategory.metadata : undefined;
          const allowedScopes =
            typeof rootMeta === 'object' && rootMeta !== null && 'allowed_scopes' in rootMeta && Array.isArray((rootMeta as { allowed_scopes: unknown }).allowed_scopes)
              ? (rootMeta as { allowed_scopes: string[] }).allowed_scopes
              : undefined;

          return {
            categoryId: category.categoryId,
            name: category.name,
            slug: category.slug,
            icon: hasIcon(category) ? category.icon : undefined,
            description: category.description ?? undefined,
            allowedScopes: allowedScopes ?? ['national', 'state', 'city', 'neighborhood'],
          };
        })
      );

      return reply.send({
        categories: categoriesWithAllowedScopes,
      });
    } catch (error) {
      req.log.error({ err: error }, 'Erro ao buscar categorias de grupos');
      return reply.status(500).send({
        error: 'Erro ao buscar categorias',
      });
    }
  });

  /**
   * POST /groups/:groupId/media
   * Upload e processamento de imagem (avatar ou capa)
   */
  fastify.post<{
    Params: { groupId: string };
  }>(
    '/:groupId/media',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { groupId } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        // Verificar se o grupo existe
        // Nota: A verificação de ownership já foi feita no preHandler (requireGroupOwnerOrPermission)
        const group = await groupsService.getGroup(tenantId, groupId);
        if (!group) {
          return reply.status(404).send({
            error: 'Grupo não encontrado',
          });
        }

        // Obter arquivo do multipart
        const data = await req.file();
        if (!data) {
          return reply.status(400).send({
            error: 'Arquivo não enviado',
          });
        }

        // Validar tipo de arquivo
        if (!data.mimetype.startsWith('image/')) {
          return reply.status(400).send({
            error: 'Arquivo deve ser uma imagem',
          });
        }

        // Obter tipo de imagem (avatar ou cover) do query param ou campo multipart
        let imageType = (req.query as any)?.type || 'avatar';
        
        // Tentar obter do campo multipart se não veio no query
        if (data.fields) {
          const fields = data.fields as any;
          if (fields.type) {
            const typeValue = Array.isArray(fields.type) ? fields.type[0]?.valueCents: fields.type.value;
            if (typeValue) {
              imageType = typeValue;
            }
          }
        }
        
        if (imageType !== 'avatar' && imageType !== 'cover') {
          return reply.status(400).send({
            error: 'Tipo de imagem inválido. Use "avatar" ou "cover" como query param (?type=avatar)',
          });
        }

        // Ler buffer da imagem
        const imageBuffer = await data.toBuffer();

        // Processar imagem
        const processed = await groupImageService.processImage(
          groupId,
          imageType as 'avatar' | 'cover',
          imageBuffer,
          data.mimetype
        );

        // Atualizar URL no grupo
        // ActionContext é obrigatório
        const userContext = {
          globalUserId: req.actionContext!.actorId,
          id: req.actionContext!.actorId,
          userId: req.actionContext!.actorId,
        };
        const updateField = imageType === 'avatar' ? 'avatar_url' : 'cover_url';
        await groupsService.updateGroup(tenantId, groupId, userId, {
          [updateField]: processed.original.url,
        }, userContext);

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId,
          imageType,
          url: processed.original.url,
          action: 'group_image_uploaded',
          source: 'groups',
        }, 'Group image uploaded');

        return reply.status(200).send({
          url: processed.original.url,
          versions: processed.versions,
          type: imageType,
        });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          groupId,
          err: error,
          action: 'group_image_upload',
          source: 'groups',
        }, 'Error uploading group image');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({
          error: err.message || 'Erro ao fazer upload da imagem',
        });
      }
    }
  );

  /**
   * GET /groups/mine
   * Listar grupos do usuário (onde é owner/admin/member)
   * 🔴 DECISÃO DE NEGÓCIO: Qualquer usuário autenticado pode listar seus próprios grupos
   * Não exige permissão RBAC groups:read - apenas autenticação
   */
  fastify.get(
    '/mine',
    {
      // Sem preHandler de permissão RBAC - apenas autenticação via tenant plugin
      // O tenant plugin já garante que req.tenant e req.user estão disponíveis
    },
    async (req) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        throw fastify.httpErrors.badRequest('ActionContext obrigatório');
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;

      if (!tenantId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const groups = await groupsService.getUserGroups(tenantId, userId);
      
      // Adicionar member_count para cada grupo
      const groupsWithCount = await Promise.all(
        groups.map(async (group) => {
          const members = await groupsService.getGroupMembers(tenantId, group.groupId);
          return {
            ...group,
            memberCount: members.length,
          };
        })
      );

      return { groups: groupsWithCount };
    }
  );

  /**
   * GET /groups
   * Listar grupos públicos (para busca/descoberta)
   */
  fastify.get(
    '/',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req) => {
      const tenantId = req.tenant!.id;
      const query = req.query as { isActive?: string; visibility?: string; category_id?: string } | undefined;
      const isActive = query?.isActive !== undefined ? query.isActive === 'true' : true;
      const visibility = query?.visibility || 'public';
      const categoryId = query?.category_id;

      // Listar apenas grupos públicos e ativos
      const allGroups = await groupsService.listGroups(tenantId, { isActive, categoryId });
      const publicGroups = allGroups.filter(g => g.visibility === visibility);

      // Adicionar member_count para cada grupo
      const groupsWithCount = await Promise.all(
        publicGroups.map(async (group) => {
          const members = await groupsService.getGroupMembers(tenantId, group.groupId);
          return {
            ...group,
            memberCount: members.length,
          };
        })
      );

      return { groups: groupsWithCount };
    }
  );

  /**
   * GET /groups/:id
   * Buscar grupo por ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      const group = await groupsService.getGroup(tenantId, id);

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      return group;
    }
  );

  /**
   * PUT /groups/:id
   * Atualizar grupo
   */
  fastify.put<{ Params: { id: string }; Body: any }>(
    '/:id',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        // 🔴 CORREÇÃO UX: Passar contexto do usuário para permitir comparação robusta
        // ActionContext é obrigatório
        const userContext = {
          globalUserId: req.actionContext!.actorId,
          id: req.actionContext!.actorId,
          userId: req.actionContext!.actorId,
        };
        const group = await groupsService.updateGroup(tenantId, id, userId, parsed.data, userContext);

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId: id,
          action: 'group_updated',
          source: 'groups',
        }, 'Group updated');

        return group;
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          groupId: id,
          err: error,
          action: 'group_updated',
          source: 'groups',
        }, 'Error updating group');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * DELETE /groups/:id
   * Deletar grupo (soft-delete)
   */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:delete');
      },
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        const deleted = await groupsService.deleteGroup(tenantId, id, userId);

        if (!deleted) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId: id,
          action: 'group_deleted',
          source: 'groups',
        }, 'Group deleted');

        return reply.status(200).send({ success: true });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          groupId: id,
          err: error,
          action: 'group_deleted',
          source: 'groups',
        }, 'Error deleting group');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * POST /groups/:id/join
   * Entrar em um grupo
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/join',
    {
      preHandler: fastify.requirePermission(['groups:join']),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        const member = await groupsService.joinGroup(tenantId, id, userId);

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId: id,
          action: 'join',
          source: 'groups',
        }, 'User joined group');

        return reply.status(200).send(member);
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          groupId: id,
          err: error,
          action: 'join',
          source: 'groups',
        }, 'Error joining group');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * POST /groups/:id/leave
   * Sair de um grupo
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/leave',
    {
      preHandler: fastify.requirePermission(['groups:leave']),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        const left = await groupsService.leaveGroup(tenantId, id, userId);

        if (!left) {
          return reply.status(404).send({ error: 'Member not found' });
        }

        req.log.info({
          requestId,
          tenantId,
          userId,
          groupId: id,
          action: 'leave',
          source: 'groups',
        }, 'User left group');

        return reply.status(200).send({ success: true });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          groupId: id,
          err: error,
          action: 'leave',
          source: 'groups',
        }, 'Error leaving group');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * GET /groups/:id/members
   * Listar membros do grupo
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/members',
    {
      preHandler: fastify.requirePermission(['groups:members:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      const members = await groupsService.getGroupMembers(tenantId, id);

      return reply.status(200).send({ members });
    }
  );

  /**
   * PATCH /groups/:id/members/:userId
   * Atualizar role de um membro do grupo
   */
  fastify.patch<{ 
    Params: { id: string; userId: string };
    Body: { role: 'member' | 'admin' | 'moderator' | 'collaborator' };
  }>(
    '/:id/members/:userId',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id, userId: memberUserId } = req.params;
      const { role } = req.body;

      if (!role || !['member', 'admin', 'moderator', 'collaborator'].includes(role)) {
        return reply.status(400).send({
          error: 'Invalid role. Must be one of: member, admin, moderator, collaborator',
        });
      }

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const member = await groupsService.updateMemberRole(
          tenantId,
          id,
          memberUserId,
          role,
          userId,
          userContext
        );

        return reply.status(200).send({ member });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error updating member role',
        });
      }
    }
  );

  /**
   * DELETE /groups/:id/members/:userId
   * Remover membro do grupo
   */
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/members/:userId',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id, userId: memberUserId } = req.params;

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const removed = await groupsService.removeMember(
          tenantId,
          id,
          memberUserId,
          userId,
          userContext
        );

        if (!removed) {
          return reply.status(404).send({ error: 'Member not found' });
        }

        return reply.status(200).send({ success: true });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error removing member',
        });
      }
    }
  );

  /**
   * GET /groups/:id/balance
   * Obter saldo do grupo
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/balance',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id: groupId } = req.params;

      try {
        // Verificar se usuário é membro do grupo
        const members = await groupsService.getGroupMembers(tenantId, groupId);
        const isMember = members.some(m => m.userId === userId);
        
        if (!isMember) {
          return reply.status(403).send({ 
            ok: false, 
            message: 'Você não é membro deste grupo' 
          });
        }

        // Buscar conta do grupo
        const { groupsRepository } = await import('./groups.repository');
        const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
        
        if (!groupAccount) {
          return reply.send({ 
            ok: true, 
            data: { 
              balance: 0, 
              currency: 'BRL',
              hasAccount: false,
            } 
          });
        }

        // SPRINT 3: Buscar saldo do Unify Bank (fonte da verdade)
        const { bankIntegrationService } = await import('../bank/bank-integration.service');
        const balance = await bankIntegrationService.getGroupBalance(tenantId, groupId, 'BRL');
        
        return reply.send({
          ok: true,
          data: {
            balance: balance,
            currency: 'BRL',
            accountId: groupAccount.accountId,
            hasAccount: true,
          },
        });
      } catch (error) {
        req.log.error({
          tenantId,
          userId,
          groupId,
          err: error,
          action: 'get_balance',
          source: 'groups',
        }, 'Error getting group balance');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * GET /groups/:id/economy
   * Economia do grupo (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/economy',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id: groupId } = req.params;

      try {
        // Usar projector existente para calcular economia do grupo
        const { economicOverviewProjector } = await import('@modules/economy/economic-overview.projector');
        const overview = await economicOverviewProjector.projectGroupEconomicOverview(tenantId, groupId);

        // Calcular totalOut (grupos não pagam, apenas recebem)
        const totalOut = 0;

        return reply.send({
          totalIn: overview.totalReceived,
          totalOut,
          balance: overview.totalReceived - totalOut,
          currency: overview.currency,
          lastUpdate: overview.lastUpdated.toISOString(),
        });
      } catch (error) {
        req.log.error({ err: error, groupId }, 'Erro ao buscar economia do grupo');
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * GET /groups/:id/dashboard
   * Dashboard do grupo (métricas simples, read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/dashboard',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const { runQueryWithTenant } = await import('@core/database/pool');
        const groupId = req.params.id;

        // Verificar se grupo existe
        const group = await groupsService.getGroup(req.tenant.id, groupId);
        if (!group) {
          return reply.status(404).send({ error: 'Grupo não encontrado' });
        }

        // Contar membros
        const membersCountRow = await runQueryWithTenant<{ count: string }>(
          req.tenant.id,
          `
          SELECT COUNT(*) as count
          FROM group_members
          WHERE group_id = $1 AND tenant_id = $2
          `,
          [groupId, req.tenant.id]
        );
        const membersCount = membersCountRow ? Number(membersCountRow.count) : 0;

        // Contar eventos do grupo (via group_events)
        const eventsCountRow = await runQueryWithTenant<{ count: string }>(
          req.tenant.id,
          `
          SELECT COUNT(*) as count
          FROM group_events
          WHERE group_id = $1 AND tenant_id = $2
          `,
          [groupId, req.tenant.id]
        );
        const eventsCount = eventsCountRow ? Number(eventsCountRow.count) : 0;

        // Contar posts do grupo (via metadata->>'groupId')
        const postsCountRow = await runQueryWithTenant<{ count: string }>(
          req.tenant.id,
          `
          SELECT COUNT(*) as count
          FROM posts
          WHERE tenant_id = $1 AND metadata->>'groupId' = $2
          `,
          [req.tenant.id, groupId]
        );
        const postsCount = postsCountRow ? Number(postsCountRow.count) : null; // null se não houver model claro

        return reply.send({
          membersCount,
          eventsCount,
          postsCount,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar dashboard do grupo');
        return reply.status(500).send({ error: 'Erro ao buscar dashboard' });
      }
    }
  );

  /**
   * GET /groups/:id/impact-history
   * Obter histórico de impacto econômico do grupo
   */
  fastify.get<{ 
    Params: { id: string };
    Querystring: { limit?: number; offset?: number };
  }>(
    '/:id/impact-history',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const tenantId = req.tenant!.id;
      const userId = req.actionContext.actorId;
      const { id: groupId } = req.params;
      const { limit = 20, offset = 0 } = req.query as { limit?: number; offset?: number };

      try {
        // Verificar se usuário é membro do grupo
        const members = await groupsService.getGroupMembers(tenantId, groupId);
        const isMember = members.some(m => m.userId === userId);
        
        if (!isMember) {
          return reply.status(403).send({ 
            ok: false, 
            message: 'Você não é membro deste grupo' 
          });
        }

        // Buscar conta do grupo
        const { groupsRepository } = await import('./groups.repository');
        const groupAccount = await groupsRepository.getGroupAccount(tenantId, groupId);
        
        if (!groupAccount) {
          return reply.send({ ok: true, data: { entries: [], totalCents: 0 } });
        }

        // Buscar histórico do ledger
        const { runQueryWithTenant } = await import('@core/database/pool');
        const entries = await runQueryWithTenant(
          tenantId,
          `
          SELECT 
            l.entry_id,
            l.amount,
            l.entry_type,
            l.createdAt,
            t.metadata
          FROM ledger l
          JOIN transactions t ON t.transaction_id = l.transaction_id
          WHERE l.account_id = $1
            AND l.entry_type = 'credit'
          ORDER BY l.createdAt DESC
          LIMIT $2 OFFSET $3
          `,
          [groupAccount.accountId, limit, offset]
        );

        // Contar total
        const countResult = await runQueryWithTenant<{ count: string }>(
          tenantId,
          `SELECT COUNT(*) as count FROM ledger WHERE account_id = $1 AND entry_type = 'credit'`,
          [groupAccount.accountId]
        );

        return reply.send({
          ok: true,
          data: {
            entries: entries || [],
            totalCents: parseInt(countResult?.count || '0', 10),
          },
        });
      } catch (error) {
        req.log.error({
          tenantId,
          userId,
          groupId,
          err: error,
          action: 'get_impact_history',
          source: 'groups',
        }, 'Error getting group impact history');

        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  /**
   * POST /groups/:id/invites
   * Criar convite para o grupo
   */
  fastify.post<{
    Params: { id: string };
    Body: { invited_user_id: string };
  }>(
    '/:id/invites',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { id } = req.params;
      const { invited_user_id } = req.body;

      if (!invited_user_id) {
        return reply.status(400).send({
          error: 'invited_user_id is required',
        });
      }

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const invite = await groupsService.createInvite(
          tenantId,
          id,
          invited_user_id,
          userId,
          userContext
        );

        return reply.status(201).send({ invite });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error creating invite',
        });
      }
    }
  );

  /**
   * GET /groups/:id/invites
   * Listar convites do grupo
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { status?: 'pending' | 'accepted' | 'declined' | 'expired' };
  }>(
    '/:id/invites',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:read');
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { id } = req.params;
      const { status } = req.query as { status?: 'pending' | 'accepted' | 'declined' | 'expired' };

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const invites = await groupsService.getGroupInvites(
          tenantId,
          id,
          userId,
          userContext,
          status
        );

        return reply.status(200).send({ invites });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error fetching invites',
        });
      }
    }
  );

  /**
   * POST /groups/:id/invites/:inviteId/accept
   * Aceitar convite
   */
  fastify.post<{
    Params: { id: string; inviteId: string };
  }>(
    '/:id/invites/:inviteId/accept',
    {
      // Sem preHandler de permissão RBAC - apenas autenticação via tenant plugin
      // A validação de que o usuário é o convidado é feita no service
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { inviteId } = req.params;

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const member = await groupsService.acceptInvite(
          tenantId,
          inviteId,
          userId,
          userContext
        );

        return reply.status(200).send({ member });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error accepting invite',
        });
      }
    }
  );

  /**
   * POST /groups/:id/invites/:inviteId/decline
   * Recusar convite
   * 🔴 DECISÃO DE NEGÓCIO: Qualquer usuário autenticado pode recusar seus próprios convites
   * Não exige permissão RBAC - apenas autenticação
   */
  fastify.post<{
    Params: { id: string; inviteId: string };
  }>(
    '/:id/invites/:inviteId/decline',
    {
      // Sem preHandler de permissão RBAC - apenas autenticação via tenant plugin
      // A validação de que o usuário é o convidado é feita no service
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { inviteId } = req.params;

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        await groupsService.declineInvite(
          tenantId,
          inviteId,
          userId,
          userContext
        );

        return reply.status(200).send({ success: true });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error declining invite',
        });
      }
    }
  );

  /**
   * GET /groups/invites/mine
   * Listar convites do usuário
   */
  fastify.get<{
    Querystring: { status?: 'pending' | 'accepted' | 'declined' };
  }>(
    '/invites/mine',
    {
      // Sem preHandler de permissão RBAC - apenas autenticação via tenant plugin
      // O tenant plugin já garante que req.tenant e req.user estão disponíveis
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { status } = req.query as { status?: 'pending' | 'accepted' | 'declined' | 'expired' };

      try {
        const invites = await groupsService.getUserInvites(tenantId, userId, status);

        return reply.status(200).send({ invites });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error fetching invites',
        });
      }
    }
  );

  /**
   * POST /groups/:id/request
   * Solicitar entrada em grupo privado
   */
  fastify.post<{
    Params: { id: string };
    Body: { expires_in_days?: number };
  }>(
    '/:id/request',
    {
      preHandler: fastify.requirePermission(['groups:join']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { id } = req.params;
      const { expires_in_days } = req.body || {};

      try {
        const invite = await groupsService.requestJoinGroup(
          tenantId,
          id,
          userId,
          { expires_in_days }
        );

        return reply.status(201).send({ invite });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error creating join request',
        });
      }
    }
  );

  /**
   * POST /groups/:id/requests/:inviteId/approve
   * Aprovar solicitação de entrada
   */
  fastify.post<{
    Params: { id: string; inviteId: string };
  }>(
    '/:id/requests/:inviteId/approve',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { inviteId } = req.params;

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        const member = await groupsService.approveJoinRequest(
          tenantId,
          inviteId,
          userId,
          userContext
        );

        return reply.status(200).send({ member });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error approving join request',
        });
      }
    }
  );

  /**
   * POST /groups/:id/requests/:inviteId/reject
   * Rejeitar solicitação de entrada
   */
  fastify.post<{
    Params: { id: string; inviteId: string };
  }>(
    '/:id/requests/:inviteId/reject',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.globalUserId || req.user!.id;
      const { inviteId } = req.params;

      try {
        const userContext = {
          globalUserId: req.user!.globalUserId,
          id: req.user!.id,
          userId: req.user!.userId,
        };

        await groupsService.rejectJoinRequest(
          tenantId,
          inviteId,
          userId,
          userContext
        );

        return reply.status(200).send({ success: true });
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 400).send({
          error: err.message || 'Error rejecting join request',
        });
      }
    }
  );
};

export default groupsRoutes;




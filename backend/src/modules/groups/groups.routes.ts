// src/modules/groups/groups.routes.ts

import { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { groupsService } from './groups.service';
import { groupImageService } from './services/group-image.service';
import { rbacService } from '@core/rbac/rbac.service';
import { GROUP_PURPOSES, DEFAULT_GROUP_PURPOSE } from './group-purpose.vocabulary';
import type { PermissionString } from '@core/rbac/rbac.types';
import type { GroupVisibility } from './groups.types';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000), // Obrigatória
  audience_description: z.string().max(500).optional(), // Opcional - Descrição do público-alvo
  // DECISION-0163: PROPÓSITO governado — pergunta ANTES da categoria no wizard (D2);
  // default = D3 (comunidade_e_pertencimento) pra back-compat de callers antigos.
  purpose: z.enum(GROUP_PURPOSES).optional().default(DEFAULT_GROUP_PURPOSE),
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
 * 🔒 A ÚNICA REGRA DE "QUEM PODE LER ESTE GRUPO" (2026-08-05).
 *
 * Nasceu do achado 16.2 da instância de `ARQUITETURA/`, e o defeito é da família **IRMÃOS**:
 * rotas da mesma casa com gates diferentes. Medido antes de escrever:
 *   · `GET /groups/:id`          → só `groupsAuthGate('groups:read')` — nada mais
 *   · `GET /groups/:id/members`  → só `groupsAuthGate('groups:members:read')` — nada mais
 *   · a rota de consulta da conta   → gate + **verificação de membership** com 403
 * Um irmão coberto, dois abertos. Com o id em mãos, qualquer autenticado do tenant lia um grupo
 * SECRETO inteiro e a lista de membros dele. Corrigir só a listagem (o outro achado, 16.1) teria
 * sido meia obra: fecharia a vitrine e deixaria a porta.
 *
 * A regra NÃO é invenção minha — sai do próprio módulo: `joinGroup` exige **convite** para secreto
 * e apenas **pedido de entrada** para privado. Logo privado precisa ser encontrável (senão ninguém
 * pede entrada) e secreto **não pode ser legível** por quem não é membro.
 *
 * 🔴 E A RESPOSTA É 404, NÃO 403. Um 403 responde "existe, mas você não pode" — o que confirma a
 * existência do grupo secreto para quem só chutou o id. Indistinguível de inexistente é a única
 * resposta que não vaza.
 *
 * ⚠️ FICA NOMEADO, NÃO DECIDIDO: se a lista de membros de um grupo **privado** deve ser visível a
 * não-membros, a lei não diz — e eu não invento política. Hoje segue como estava (visível).
 */
async function grupoLegivelPor(
  tenantId: string,
  userId: string,
  groupId: string,
  visibility: string | undefined
): Promise<boolean> {
  if (visibility !== 'secret') {
    return true;
  }
  return ehMembroDoGrupo(tenantId, userId, groupId);
}

/**
 * 🔒 Membership do PRINCIPAL AUTENTICADO — a régua estrita, para o que o `CONTRATO_GRUPOS_V2` §2.6
 * fecha por padrão: *"não-membro não vê"*. Mesma forma já usada pela rota de consulta da conta e
 * `/:id/impact-history` (verificadas equivalentes); existe como função para não haver uma quarta
 * cópia — cópia de regra de autorização é como os irmãos divergem em primeiro lugar.
 */
async function ehMembroDoGrupo(tenantId: string, userId: string, groupId: string): Promise<boolean> {
  const members = await groupsService.getGroupMembers(tenantId, groupId);
  return members.some((m) => m.userId !== null && m.userId === userId);
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

  // 🔒 DECISION-0113 / Z2 (F-AUTHORITY-Z2-R1): a AUTORIDADE vem do USUÁRIO AUTENTICADO
  // (req.user.userId, server-side), NUNCA do actorId declarado. `actionContext.actorId` segue
  // como HINT/contexto (logs), mas NÃO prova autoridade. Antes, userIdForCheck derivava do
  // actorId declarado (spoofável) e alimentava ownership/admin/RBAC — bypass corrigido aqui.
  if (!req.user?.userId) {
    throw fastify.httpErrors.unauthorized('Authentication required');
  }
  const userIdForCheck = req.user.userId;

  // 1. Verificar se é owner do grupo OU admin (permissão implícita)
  try {
    const group = await groupsService.getGroup(tenantId, groupId);
    if (group) {
      // 🔒 DECISION-0113 / Z2: ownership = o USUÁRIO AUTENTICADO REPRESENTA o owner actor do
      // grupo (server-side). Declarar actionContext.actorId = ownerActorId NÃO autoriza
      // (actorId do client é hint, nunca authority). canRepresentActor é fail-closed.
      const { authorizationService } = await import('@core/authorization/authorization.service');
      const isOwner = await authorizationService.canRepresentActor(tenantId, userIdForCheck, group.ownerActorId);

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
          ownerActorId: group.ownerActorId,
          permission,
          action: 'group_owner_bypass',
        }, 'Group owner access granted (bypass RBAC)');
        return;
      }

      // 🔒 D9.2-B (DECISION-0188 D11/D16): a via "admin por role" foi RETIRADA no cutover.
      // Gestao do grupo = canRepresentActor(group-actor|owner-actor) — nunca group_members.role.
      const canGovern = await groupsService.userCanGovernGroup(tenantId, groupId, userIdForCheck);
      if (canGovern) {
        req.log.info({
          tenantId,
          userId: userIdForCheck,
          groupId,
          permission,
          action: 'group_representative_bypass',
        }, 'Group representative access granted (canRepresentActor)');
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

/**
 * GATE PRÓPRIO DOCUMENTADO do módulo groups (2026-07-07, achado Clayton no navegador).
 * A função SQL actor_has_permission é STUB FAIL-CLOSED deliberado (RETURN FALSE até FASE 6),
 * e o PRÓPRIO stub prescreve: "callers devem (b) estabelecer gate próprio documentado".
 * Este gate NÃO alivia autoridade — exige a catraca REAL da DECISION-0113:
 *   401 sem principal autenticado · 400 sem actionContext.actorId ·
 *   403 se o principal NÃO representa o actor declarado (canRepresentActor, fail-closed).
 * `permissionHint` preserva o mapeamento pretendido pra quando a FASE 6 religar o RBAC real.
 */
function groupsAuthGate(permissionHint: string) {
  return async (req: any, reply: any) => {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', permissionHint });
    }
    const actorId = req.actionContext?.actorId;
    if (!actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório', permissionHint });
    }
    let ok = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      ok = await authorizationService.canRepresentActor(req.tenant?.id, userId, actorId);
    } catch {
      ok = false;
    }
    if (!ok) {
      return reply.status(403).send({ error: 'Sem autoridade para representar este actor', permissionHint });
    }
  };
}

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /groups
   * Criar novo grupo
   */
  fastify.post(
    '/',
    {
      preHandler: groupsAuthGate('groups:create'),
    },
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2) — presença exigida pelo contrato; NÃO é fonte de autoridade.
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔴 DECISION-0113 fatia 6.4 (self): criação de grupo é ação SELF — o grupo nasce pelo usuário
      // autenticado REAL. Antes, o `userId` derivava do `actionContext.actorId` (spoofável) e alimentava
      // TANTO o gate `identity_status` QUANTO `createGroup` → um caller declarava o actor de outro e criava
      // grupo (e checava identity) em nome da vítima. Agora o sujeito é `req.user.userId` server-side; sem
      // caller autenticado resolvível → fail-closed (401), nunca fallback ao actorId declarado.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const userId = req.user.userId;
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
    async (req, reply) => {
      const userId = req.user?.userId;
      if (!userId) {
        return reply.code(401).send({ error: 'UNAUTHENTICATED' });
      }

      const tenantId = req.tenant!.id;

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
      preHandler: groupsAuthGate('groups:read'),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const query = req.query as { isActive?: string; visibility?: string; category_id?: string } | undefined;
      const isActive = query?.isActive !== undefined ? query.isActive === 'true' : true;
      const categoryId = query?.category_id;

      // 🔴 VAZAMENTO CORRIGIDO 2026-08-05 — `?visibility=secret` LISTAVA GRUPOS SECRETOS.
      // O código era `query?.visibility || 'public'` seguido de `filter(g => g.visibility === ...)`:
      // a visibilidade vinha CRUA do cliente, sem passar por vocabulário nenhum, e o SQL de
      // `findAll` não filtra visibilidade (o `visibilityConditions` de lá é NOME QUE MENTE — são
      // condições de escopo territorial: tenant/estado/país). O comentário que ficava aqui dizia
      // "Listar apenas grupos públicos e ativos" e também mentia.
      // Gravidade pela régua de quem está presente para notar: o prejudicado é o dono do grupo
      // secreto, que NÃO está na requisição e nunca saberia.
      //
      // A regra vem do próprio módulo, não de invenção minha: `joinGroup` exige convite para
      // secreto e apenas pedido de entrada para privado — logo privado é descobrível e secreto
      // NUNCA é. `SECRET` sai do vocabulário de descoberta; valor fora dele é 400, não 500 e não
      // silêncio (fronteira de entrada em rota, `CLAUDE.md` §3.2).
      const VISIBILIDADE_DESCOBRIVEL: readonly GroupVisibility[] = ['public', 'private'];
      const pedida = query?.visibility;
      if (pedida !== undefined && !VISIBILIDADE_DESCOBRIVEL.includes(pedida as GroupVisibility)) {
        return reply.status(400).send({
          ok: false,
          error: 'GROUP_VISIBILITY_NOT_DISCOVERABLE',
          message: `Visibilidade inválida para descoberta: "${pedida}". Aceitas: ${VISIBILIDADE_DESCOBRIVEL.join(', ')}.`,
        });
      }
      // Sem parâmetro, o padrão continua o de antes: só públicos. Ampliar o default seria mudar
      // exposição de carona num conserto de segurança.
      const visibility: GroupVisibility = (pedida as GroupVisibility) ?? 'public';

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
      preHandler: groupsAuthGate('groups:read'),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      const group = await groupsService.getGroup(tenantId, id);

      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      // 🔒 Grupo secreto não é legível por não-membro — e responde 404, não 403 (ver
      // `grupoLegivelPor`: 403 confirmaria a existência para quem chutou o id).
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      if (!(await grupoLegivelPor(tenantId, req.user.userId, id, group.visibility))) {
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
      preHandler: groupsAuthGate('groups:join'),
    },
    async (req, reply) => {
      // presença do actionContext segue exigida pelo contrato V2 (hint/telemetria) — NUNCA identidade
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔒 D9.2-B (DECISION-0188 D13 superficie 1): o sujeito da entrada é o PRINCIPAL
      // AUTENTICADO (req.user.userId, server-side) resolvido a user-actor no service governado.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        const member = await groupsService.joinGroup(tenantId, id, actingUserId);

        req.log.info({
          requestId,
          tenantId,
          userId: actingUserId,
          groupId: id,
          action: 'join',
          source: 'groups',
        }, 'User joined group');

        return reply.status(200).send(member);
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId: actingUserId,
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
      preHandler: groupsAuthGate('groups:leave'),
    },
    async (req, reply) => {
      // presença do actionContext segue exigida pelo contrato V2 (hint/telemetria) — NUNCA identidade
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔒 D9.2-B (DECISION-0188 D13 superficie 2): sujeito = PRINCIPAL AUTENTICADO server-side.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { id } = req.params;
      const requestId = (req as any).requestId || req.id;

      try {
        const left = await groupsService.leaveGroup(tenantId, id, actingUserId);

        if (!left) {
          return reply.status(404).send({ error: 'Member not found' });
        }

        req.log.info({
          requestId,
          tenantId,
          userId: actingUserId,
          groupId: id,
          action: 'leave',
          source: 'groups',
        }, 'User left group');

        return reply.status(200).send({ success: true });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId: actingUserId,
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
      preHandler: groupsAuthGate('groups:members:read'),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      // 🔒 MESMA regra do irmão `GET /groups/:id` — uma função só, não duas leituras da mesma lei.
      // Antes, esta rota tinha APENAS o gate de permissão de tenant: qualquer autenticado listava
      // os membros de qualquer grupo, inclusive secreto.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const group = await groupsService.getGroup(tenantId, id);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }
      if (!(await grupoLegivelPor(tenantId, req.user.userId, id, group.visibility))) {
        return reply.status(404).send({ error: 'Group not found' });
      }

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
      // 🔒 D9.2-B (DECISION-0188 D11): role de membro foi APOSENTADA no cutover Actor-first —
      // a casa canonica group_actor_memberships nao persiste role e role NAO concede autoridade.
      // Endpoint fail-closed explicito (sem escrita na casa legada congelada).
      return reply.status(410).send({
        error: 'GAM_ROLE_RETIRED: role de membro nao existe mais (DECISION-0188 D11) — role nunca e autoridade; roles organizacionais governadas = frente futura (D9.3).',
      });
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
      // 🔒 D9.2-B: remocao administrativa exige o PRINCIPAL AUTENTICADO (server-side);
      // a autoridade real (canRepresentActor do group-actor) e provada no service governado.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      const tenantId = req.tenant!.id;
      const requesterUserId = req.user.userId;
      const { id, userId: memberUserId } = req.params;

      try {
        const removed = await groupsService.removeMember(
          tenantId,
          id,
          memberUserId,
          requesterUserId
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
      preHandler: groupsAuthGate('groups:read'),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔒 D9.2-B (D13): membership do CALLER verificada pelo PRINCIPAL server-side na casa
      // nova (nunca actionContext.actorId comparado com user — comparacao cross-namespace).
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const userId = req.user.userId;
      const { id: groupId } = req.params;

      try {
        // Verificar se usuário é membro do grupo
        const members = await groupsService.getGroupMembers(tenantId, groupId);
        const isMember = members.some(m => m.userId !== null && m.userId === userId);

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
      preHandler: groupsAuthGate('groups:read'),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id: groupId } = req.params;

      // 🔴 ESTA ROTA ERA A PORTA DOS FUNDOS DA IRMÃ QUE CONSULTA A CONTA (corrigido 2026-08-05).
      // Aquela verifica membership e devolve 403; esta aqui tinha APENAS
      // `groupsAuthGate('groups:read')` e devolvia os totais econômicos — a MESMA informação
      // econômica — de qualquer grupo, para qualquer autenticado do tenant. Proteger um irmão e
      // deixar o outro aberto não protege nada: só muda a rota que o curioso usa.
      // `CONTRATO_GRUPOS_V2` §2.6 é explícito: **não-membro não vê por padrão**.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      if (!(await ehMembroDoGrupo(tenantId, req.user.userId, groupId))) {
        return reply.status(403).send({ ok: false, message: 'Você não é membro deste grupo' });
      }

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

        // 🔒 Irmão que estava sem gate NENHUM (só autenticação). Devolve contagens — membros,
        // eventos, posts — logo a régua é a de legibilidade (secreto não é legível por não-membro),
        // não a de membership estrita usada onde há informação econômica.
        if (!(await grupoLegivelPor(req.tenant.id, req.user.userId, groupId, group.visibility))) {
          return reply.status(404).send({ error: 'Grupo não encontrado' });
        }

        // Contar membros ATIVOS (D9.2-B: verdade = group_actor_memberships)
        const membersCountRow = await runQueryWithTenant<{ count: string }>(
          req.tenant.id,
          `
          SELECT COUNT(*) as count
          FROM group_actor_memberships
          WHERE group_id = $1 AND tenant_id = $2 AND status = 'active'
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
      preHandler: groupsAuthGate('groups:read'),
    },
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // 🔒 D9.2-B (D13): membership do CALLER pelo PRINCIPAL server-side, casa nova.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const userId = req.user.userId;
      const { id: groupId } = req.params;
      const { limit = 20, offset = 0 } = req.query as { limit?: number; offset?: number };

      try {
        // Verificar se usuário é membro do grupo
        const members = await groupsService.getGroupMembers(tenantId, groupId);
        const isMember = members.some(m => m.userId !== null && m.userId === userId);

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

        // TODO DECISION-0007 / FASE 6: reimplementar histórico sobre bank_ledger
        // com semântica canônica. Até lá, retorna vazio (tabela "ledger" não
        // existe no schema Gênesis).
        return reply.send({
          ok: true,
          data: {
            entries: [],
            totalCents: 0,
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
    Body: { invited_actor_id?: string; invited_user_id?: string };
  }>(
    '/:id/invites',
    {
      preHandler: async (req, reply) => {
        await requireGroupOwnerOrPermission(fastify, req as any, reply, 'groups:update');
      },
    },
    async (req, reply) => {
      // 🔒 D9.2-B (D13 superficie 6): iniciador = PRINCIPAL AUTENTICADO server-side;
      // candidato = ACTOR canonico (campo legado invited_user_id JA carregava actor id —
      // aceito como alias do campo canonico invited_actor_id, mesmo namespace).
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const requesterUserId = req.user.userId;
      const { id } = req.params;
      const invitedActorId = req.body?.invited_actor_id || req.body?.invited_user_id;

      if (!invitedActorId) {
        return reply.status(400).send({
          error: 'invited_actor_id is required',
        });
      }

      try {
        const invite = await groupsService.createInvite(
          tenantId,
          id,
          invitedActorId,
          requesterUserId
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
      // 🔒 D9.2-B: requester = PRINCIPAL AUTENTICADO server-side (autoridade via canRepresentActor)
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const requesterUserId = req.user.userId;
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
          requesterUserId,
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
      // 🔒 D9.2-B (D13 superficie 5): quem aceita = PRINCIPAL AUTENTICADO server-side,
      // resolvido a user-actor no service governado — SEM fallback userId‖globalUserId‖id.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { inviteId } = req.params;

      try {
        const member = await groupsService.acceptInvite(
          tenantId,
          inviteId,
          actingUserId
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
      // 🔒 D9.2-B: quem recusa = PRINCIPAL AUTENTICADO server-side (self ou representante).
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { inviteId } = req.params;

      try {
        await groupsService.declineInvite(
          tenantId,
          inviteId,
          actingUserId
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
      // 🔒 D9.2-B (D13 superficie 3): "meus convites" = PRINCIPAL AUTENTICADO server-side,
      // resolvido a user-actor no service — NUNCA globalUserId‖id contra coluna de ACTOR.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { status } = req.query as { status?: 'pending' | 'accepted' | 'declined' | 'expired' };

      try {
        const invites = await groupsService.getUserInvites(tenantId, actingUserId, status);

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
      preHandler: groupsAuthGate('groups:join'),
    },
    async (req, reply) => {
      // 🔒 D9.2-B (D13 superficie 4): candidato = user-actor canonico do PRINCIPAL
      // AUTENTICADO (server-side) — NUNCA globalUserId injetado em FK de actors.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const actingUserId = req.user.userId;
      const { id } = req.params;
      const { expires_in_days } = req.body || {};

      try {
        const invite = await groupsService.requestJoinGroup(
          tenantId,
          id,
          actingUserId,
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
      // 🔒 D9.2-B: quem aprova = PRINCIPAL AUTENTICADO server-side; autoridade =
      // canRepresentActor(group-actor), provada no service governado (D10).
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const requesterUserId = req.user.userId;
      const { inviteId } = req.params;

      try {
        const member = await groupsService.approveJoinRequest(
          tenantId,
          inviteId,
          requesterUserId
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
      // 🔒 D9.2-B: quem rejeita = PRINCIPAL AUTENTICADO server-side; autoridade =
      // canRepresentActor (owner civil ou group-actor) — nunca role.
      if (!req.user?.userId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      const tenantId = req.tenant!.id;
      const requesterUserId = req.user.userId;
      const { inviteId } = req.params;

      try {
        await groupsService.rejectJoinRequest(
          tenantId,
          inviteId,
          requesterUserId
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




// src/core/categories/categories.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { CategoryContext } from '@unificard/contracts';
import { categoriesService } from './categories.service';
import {
  createCategorySchema,
  createManyCategoriesSchema,
  assignCategoryToCompanySchema,
  assignSkillToUserSchema,
  classifyTextSchema,
  aiCreateCategorySchema,
  CATEGORY_CONTEXT_VALUES,
} from './categories.schemas';
import type { CategoryAutocompleteResult } from './categories.types';

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /categories/create-root
   * Cria uma categoria raiz
   * GOVERNANÇA: Requer role 'admin' OU cria como 'pending'
   */
  fastify.post<{
    Body: {
      name: string;
      slug?: string;
      description?: string | null;
      allowActive?: boolean;
    };
  }>(
    '/create-root',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            allowActive: { type: 'boolean' },
          },
        },
      },
      preHandler: async (req, reply) => {
        // GOVERNANÇA: Se allowActive=true, exigir admin
        if (req.body.allowActive && req.tenant && req.user) {
          await (fastify as any).requireRole(['admin'])(req, reply);
        }
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }

      try {
        const validated = createCategorySchema.parse(req.body);
        const category = await categoriesService.createCategory(
          {
            ...validated,
            parentId: null,
            allowActive: (validated as any).allowActive || false,
            createdBy: {
              userId: req.user.globalUserId,
              tenantId: req.tenant.id,
              source: 'manual',
            },
          },
          {
            tenantId: req.tenant.id,
            userId: req.user.id,
            validateAdmin: (validated as any).allowActive || false,
            context: 'professional', // Assumir professional para criação manual de raiz
            skipGate: false, // Admin ainda precisa passar pelo gate
          }
        );
        return reply.status(201).send({ ok: true, data: category });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao criar categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/create-child
   * Cria uma subcategoria
   * GOVERNANÇA: Requer role 'admin' OU cria como 'pending'
   */
  fastify.post<{
    Body: {
      name: string;
      slug?: string;
      description?: string | null;
      parentId: string;
      allowActive?: boolean;
    };
  }>(
    '/create-child',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'parentId'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            parentId: { type: 'string' },
            allowActive: { type: 'boolean' },
          },
        },
      },
      preHandler: async (req, reply) => {
        // GOVERNANÇA: Se allowActive=true, exigir admin
        if (req.body.allowActive && req.tenant && req.user) {
          await (fastify as any).requireRole(['admin'])(req, reply);
        }
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }

      try {
        const validated = createCategorySchema.parse(req.body);
        const category = await categoriesService.createCategory(
          {
            ...validated,
            allowActive: (req.body as any).allowActive || false,
            createdBy: {
              userId: req.user.globalUserId,
              tenantId: req.tenant.id,
              source: 'manual',
            },
          },
          {
            tenantId: req.tenant.id,
            userId: req.user.id,
            validateAdmin: (req.body as any).allowActive || false,
            context: 'professional', // Assumir professional para criação manual
            skipGate: false, // Admin ainda precisa passar pelo gate
          }
        );
        return reply.status(201).send({ ok: true, data: category });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao criar subcategoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * GET /categories/tree?countryCode=
   * Retorna árvore completa de categorias (opcionalmente filtrada por país)
   */
  fastify.get<{
    Querystring: {
      countryCode?: string | null;
    };
  }>('/tree', async (req, reply) => {
    try {
      const countryCode = req.query.countryCode || undefined;
      const tree = await categoriesService.getCategoryTree(countryCode);
      return reply.send({ ok: true, data: tree || [] });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar árvore de categorias');
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Se a mensagem já contém "Erro ao buscar árvore de categorias", usar ela diretamente
      const finalMessage = errorMessage.includes('Erro ao buscar árvore de categorias') 
        ? errorMessage 
        : `Erro ao buscar árvore de categorias: ${errorMessage}`;
      return reply.status(500).send({ 
        ok: false, 
        message: finalMessage,
        error: errorMessage
      });
    }
  });

  /**
   * GET /categories/autocomplete?q=&context=&countryCode=
   * Autocomplete inteligente: busca apenas categorias leaf ACTIVE
   * Retorna resultados formatados com path completo para exibição
   */
  fastify.get<{
    Querystring: {
      q: string;
      context?: CategoryContext;
      countryCode?: string | null;
      limit?: number;
    };
  }>(
    '/autocomplete',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1 },
            context: { 
              type: 'string',
              enum: CATEGORY_CONTEXT_VALUES
            },
            countryCode: { type: ['string', 'null'] },
            limit: { type: 'number', minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // DIAGNÓSTICO: Log completo para identificar problema
        const tenantHeader = req.headers['x-tenant-id'];
        const authHeader = req.headers['authorization'];
        fastify.log.info({ 
          route: '/categories/autocomplete', 
          tenant: tenantHeader || 'MISSING',
          tenantPresent: !!tenantHeader,
          hasAuth: !!authHeader,
          query: req.query.q,
          context: req.query.context
        }, 'AUTOCOMPLETE REQUEST RECEIVED');
        
        // VALIDAÇÃO: Se está em protectedScope, tenant é obrigatório
        // (O tenantPlugin já valida isso, mas manter para consistência)
        if (!(req as any).tenant) {
          return reply.status(400).send({ 
            ok: false, 
            code: 'MISSING_TENANT',
            message: 'Tenant ID é obrigatório'
          });
        }

        let countryCode = req.query.countryCode || undefined;
        
        // Se não fornecido e usuário autenticado, buscar da residência (opcional)
        if (!countryCode && req.user?.globalUserId) {
          try {
            const { residenceService } = await import('../residence/residence.service');
            const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
            if (residence?.country?.code) {
              countryCode = residence.country.code;
            }
          } catch (error) {
            // Falha ao buscar residência não pode quebrar autocomplete
            fastify.log.debug(
              { err: error },
              'Não foi possível buscar residência para countryCode; usando categorias globais'
            );
          }
        }

        const results = await categoriesService.autocompleteCategories(
          req.query.q,
          req.query.context,
          countryCode,
          req.query.limit || 20
        );

        // DIAGNÓSTICO: Log resultado
        fastify.log.info({ 
          query: req.query.q,
          resultsCount: results.length,
          firstResult: results[0]?.name
        }, 'AUTOCOMPLETE SUCCESS');

        return reply.send({ ok: true, data: results });
      } catch (error) {
        // DIAGNÓSTICO: Log erro completo
        fastify.log.error({ 
          err: error,
          query: req.query.q,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }, 'AUTOCOMPLETE ERROR');
        
        return reply.status(500).send({ 
          ok: false,
          code: 'INTERNAL_ERROR',
          message: 'Erro ao buscar autocomplete de categorias',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * GET /categories/search?term=&countryCode=
   * Busca categorias por termo (opcionalmente filtrada por país)
   * Se countryCode não for fornecido e o usuário estiver autenticado, usa o país da residência
   */
  fastify.get<{
    Querystring: {
      term: string;
      limit?: number;
      countryCode?: string | null;
    };
  }>(
    '/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['term'],
          properties: {
            term: { type: 'string' },
            limit: { type: 'number' },
            countryCode: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        let countryCode = req.query.countryCode || undefined;
        
        // Se não fornecido e usuário autenticado, buscar da residência (opcional)
        if (!countryCode && req.user?.globalUserId) {
          try {
            const { residenceService } = await import('../residence/residence.service');
            const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
            if (residence?.country?.code) {
              countryCode = residence.country.code;
            }
          } catch (error) {
            // Falha ao buscar residência não pode quebrar a busca
            fastify.log.debug(
              { err: error },
              'Não foi possível buscar residência para countryCode; usando categorias globais'
            );
          }
        }
        
        const categories = await categoriesService.searchCategories(
          req.query.term,
          req.query.limit,
          countryCode
        );
        return reply.send({ ok: true, data: { categories, total: categories.length } });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar categorias');
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao buscar categorias',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * GET /categories/:categoryId
   * Busca categoria por ID
   */
  fastify.get<{
    Params: { categoryId: string };
  }>(
    '/:categoryId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const category = await categoriesService.getCategoryById(req.params.categoryId);
        if (!category) {
          return reply.status(404).send({ ok: false, message: 'Categoria não encontrada' });
        }
        return reply.send({ ok: true, data: category });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar categoria');
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao buscar categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * GET /categories/:categoryId/children
   * Busca filhos de uma categoria
   */
  fastify.get<{
    Params: { categoryId: string };
  }>(
    '/:categoryId/children',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const children = await categoriesService.getChildren(req.params.categoryId);
        return reply.send({ ok: true, data: { children, total: children.length } });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar filhos da categoria');
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao buscar filhos da categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/assign-company
   * Associa categoria a uma empresa
   */
  fastify.post<{
    Body: {
      companyId: string;
      categoryId: string;
    };
  }>(
    '/assign-company',
    {
      schema: {
        body: {
          type: 'object',
          required: ['companyId', 'categoryId'],
          properties: {
            companyId: { type: 'string' },
            categoryId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = assignCategoryToCompanySchema.parse(req.body);
        await categoriesService.assignCategoryToCompany(req.tenant.id, validated);
        return reply.status(200).send({ success: true, message: 'Categoria associada à empresa' });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao associar categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/assign-skill
   * Associa skill/categoria a um usuário
   */
  fastify.post<{
    Body: {
      categoryId: string;
      skillLevel?: number;
    };
  }>(
    '/assign-skill',
    {
      schema: {
        body: {
          type: 'object',
          required: ['categoryId'],
          properties: {
            categoryId: { type: 'string' },
            skillLevel: { type: 'number' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      try {
        const validated = assignSkillToUserSchema.parse(req.body);
        await categoriesService.assignSkillToUser(req.user.globalUserId, validated);
        return reply.status(200).send({ success: true, message: 'Skill associada ao usuário' });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao associar skill',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/classify-text
   * Classifica texto em categorias (preparado para AI Kernel)
   */
  fastify.post<{
    Body: {
      text: string;
      maxCategories?: number;
    };
  }>(
    '/classify-text',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            maxCategories: { type: 'number' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const validated = classifyTextSchema.parse(req.body);
        const classifications = await categoriesService.classifyTextIntoCategories(validated);
        return { classifications };
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao classificar texto' });
      }
    }
  );

  /**
   * POST /categories/suggest-path
   * IA COMO CLASSIFICADORA: Sugere caminho hierárquico sem criar nada
   * Retorna: root, parent, leafName, confidence
   * SECURITY: reasoning removido do response (apenas mensagem fixa)
   */
  fastify.post<{
    Body: {
      text: string;
      context?: CategoryContext;
      countryCode?: string | null;
    };
  }>(
    '/suggest-path',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            context: { type: 'string', enum: CATEGORY_CONTEXT_VALUES },
            countryCode: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const suggestion = await categoriesService.suggestCategoryPath(
          req.body.text,
          req.body.context || 'professional',
          req.body.countryCode
        );
        
        // SECURITY: Remover reasoning detalhado do response público
        const { reasoning, ...publicSuggestion } = suggestion;
        
        return reply.send({ 
          ok: true, 
          data: {
            ...publicSuggestion,
            reasoning: 'Análise automática concluída', // Mensagem fixa curta
          }
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao sugerir caminho de categoria');
        if (error instanceof Error) {
          // Validação de input retorna 400
          if (error.message.includes('inválido') || error.message.includes('não permitido')) {
            return reply.status(400).send({ ok: false, message: error.message });
          }
          return reply.status(500).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao sugerir caminho de categoria'
        });
      }
    }
  );

  /**
   * POST /categories/ai-create
   * Cria categoria automaticamente usando IA quando não existe
   * Aceita texto ou transcrição de voz
   * Para categorias de educação, usa countryCode do usuário se não fornecido
   * REGRAS DE BLINDAGEM: Categoria criada como 'pending' e requires_review = true
   */
  fastify.post<{
    Body: {
      text: string;
      context?: CategoryContext;
      parentId?: string | null;
      countryCode?: string | null;
      inputType?: 'text' | 'voice' | 'transcription';
      audioUrl?: string;
      audioHash?: string;
    };
  }>(
    '/ai-create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            context: { type: 'string', enum: CATEGORY_CONTEXT_VALUES },
            parentId: { type: ['string', 'null'] },
            countryCode: { type: ['string', 'null'] },
            inputType: { type: 'string', enum: ['text', 'voice', 'transcription'] },
            audioUrl: { type: 'string' },
            audioHash: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }

      try {
        const validated = aiCreateCategorySchema.parse(req.body);
        
        // Se for educação e não tiver countryCode, buscar da residência do usuário (opcional)
        if (validated.context === 'education' && !validated.countryCode && req.user.globalUserId) {
          try {
            const { residenceService } = await import('../residence/residence.service');
            const residence = await residenceService.getResidenceWithDetails(req.user.globalUserId);
            if (residence?.country?.code) {
              validated.countryCode = residence.country.code;
            }
          } catch (error) {
            // Falha ao buscar residência não pode quebrar a sugestão
            fastify.log.debug(
              { err: error },
              'Não foi possível buscar residência para countryCode; usando categorias globais'
            );
          }
        }
        
        // Buscar actor_id do usuário se disponível
        let actorId: string | undefined = undefined;
        try {
          const { social2Service } = await import('../../modules/social/social-2.0.service');
          const userActor = await social2Service.getUserActor(req.tenant.id, req.user.globalUserId || '');
          actorId = userActor?.actor_id;
        } catch (err) {
          // Não crítico se não encontrar actor
        }
        
        const result = await categoriesService.createCategoryWithAI({
          ...validated,
          tenantId: req.tenant.id,
          actorId,
          globalUserId: req.user.globalUserId,
          inputType: validated.inputType || 'text',
          audioUrl: validated.audioUrl,
          audioHash: validated.audioHash,
        });
        
        return reply.status(result.created ? 201 : 200).send({ 
          ok: true, 
          data: result 
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar categoria via IA');
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao criar categoria via IA',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/:categoryId/approve
   * Aprova uma categoria pendente criada por IA
   * REGRAS: Apenas categorias com status 'pending' e requires_review = true podem ser aprovadas
   */
  fastify.post<{
    Params: { categoryId: string };
  }>(
    '/:categoryId/approve',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      try {
        const result = await categoriesService.approveCategory(
          req.params.categoryId,
          req.user.id
        );
        return reply.status(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao aprovar categoria');
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao aprovar categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * POST /categories/:categoryId/reject
   * Rejeita uma categoria pendente criada por IA
   */
  fastify.post<{
    Params: { categoryId: string };
    Body: {
      reason?: string;
    };
  }>(
    '/:categoryId/reject',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      try {
        const result = await categoriesService.rejectCategory(
          req.params.categoryId,
          req.body.reason || 'Rejeitada por moderador'
        );
        return reply.status(200).send({ ok: true, data: result });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao rejeitar categoria');
        if (error instanceof Error) {
          return reply.status(400).send({ ok: false, message: error.message });
        }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao rejeitar categoria',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  /**
   * GET /categories/pending
   * Lista categorias pendentes de aprovação
   */
  fastify.get('/pending', async (req, reply) => {
    try {
      const categories = await categoriesService.getPendingCategories();
      return reply.send({ ok: true, data: categories });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar categorias pendentes');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar categorias pendentes',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
};

export default categoriesRoutes;








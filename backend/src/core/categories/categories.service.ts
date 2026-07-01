// src/core/categories/categories.service.ts
import { runQueryWithTenant } from '@core/database/pool';
import { pool } from '@core/database/pool';
import { createHash } from 'crypto';
import { CategoryContext } from '@unificard/contracts';
import { CategoryRepository } from './categories.repository';
import { CategoryModel } from './categories.model';
import { categoryAdmissionPolicyService } from './policies/category-admission-policy.service';
import { categoryLexicalGateService } from './category-lexical-gate.service';
import { occupationFormCheckerService } from './occupation-form-checker.service';
import { cboMatcherService } from './cbo-matcher.service';
import { categoryInputAuditService } from './category-input-audit.service';
import { categoryInputGateService } from './category-input-gate.service';
import { tenantService } from '@core/tenants/tenant.service';
import { ssotObservabilityUtil } from '@core/observability/ssot-observability.util';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import type {
  Category,
  CategoryRow,
  CategoryTree,
  CreateCategoryInput,
  CreateManyCategoriesInput,
  AssignCategoryToCompanyInput,
  AssignSkillToUserInput,
  ClassifyTextInput,
  CategoryClassification,
  CategoryAutocompleteResult,
} from './categories.types';
import { HttpError } from '@core/errors/http-error';
import { assertCategoryWritableForUserSkillsStrict } from '@core/profile/category-navigation-bridge';

/**
 * Surfacing de `conceptId` em LEITURAS de categoria — DECISION-0068.
 * Exposto APENAS em contextos DECLARATIVOS de perfil (actor-first/concept-first): `professional`,
 * `learning`, `interest`. NÃO exposto em contextos transacionais/marketplace/checkout/offer/intent,
 * nem `event`/`campaign`/`company`/`health`/`group`/etc. `category_id` segue navegação/breadcrumb;
 * `concept_id` segue identidade semântica (Lei 7). Contexto OMITIDO (undefined) ⇒ NÃO surfaçar
 * (default seguro). Não usa o fallback interno `effectiveContext` — decide pelo `context` explícito.
 */
const DECLARATIVE_CONCEPT_CONTEXTS = new Set<CategoryContext>(['professional', 'learning', 'interest']);
function canExposeCategoryConceptId(context?: CategoryContext): boolean {
  return context !== undefined && DECLARATIVE_CONCEPT_CONTEXTS.has(context);
}

class CategoriesService {
  private repository = new CategoryRepository();
  
  // CACHE: Árvore de categorias ACTIVE (performance)
  // 🔴 REGRA: Cache chaveado por (countryCode + context) para evitar vazamento entre contexts
  private categoryTreeCache: {
    data: CategoryTree[] | null;
    timestamp: number;
    countryCode?: string | null;
    context?: CategoryContext;
  } = {
    data: null,
    timestamp: 0,
  };

  // CACHE CANÔNICO: Cache chaveado por tenantId:context (nunca compartilha entre tenants)
  private canonicalCache: Map<string, {
    data: CategoryTree[];
    timestamp: number;
  }> = new Map();

  // CONFIG: Valores configuráveis via env
  private readonly CONFIDENCE_THRESHOLD_AUTO_APPROVE = parseFloat(process.env.CONFIDENCE_THRESHOLD_AUTO_APPROVE || '0.85');
  private readonly CONFIDENCE_THRESHOLD = parseFloat(process.env.CATEGORY_CONFIDENCE_THRESHOLD || '0.6');
  private readonly CACHE_TTL_SECONDS = parseInt(process.env.CATEGORY_CACHE_TTL_SECONDS || '60', 10);
  private readonly MAX_INPUT_LENGTH = parseInt(process.env.CATEGORY_MAX_INPUT_LENGTH || '60', 10);

  /**
   * Sanitiza texto removendo scripts, SQL, URLs e limitando tamanho
   * REGRAS DE SEGURANÇA: Remove conteúdo perigoso antes de processar com IA
   */
  private sanitizeText(text: string, maxLength: number = 500): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let sanitized = text.trim();

    // Remover scripts (JavaScript, VBScript, etc.)
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers (onclick, onload, etc.)

    // Remover SQL injection patterns básicos
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '');
    sanitized = sanitized.replace(/['";\\]/g, ''); // Remove caracteres perigosos de SQL

    // Remover URLs (http, https, ftp, etc.)
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '');
    sanitized = sanitized.replace(/ftp:\/\/[^\s]+/gi, '');
    sanitized = sanitized.replace(/www\.[^\s]+/gi, '');

    // Remover tags HTML restantes
    sanitized = sanitized.replace(/<[^>]+>/g, '');

    // Normalizar espaços em branco
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Limitar tamanho
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Gera hash SHA-256 de um texto
   */
  private generateHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Gera slug a partir do nome
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '-') // Substitui não-alfanuméricos por hífen
      .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
  }

  /**
   * Calcula path recursivo de uma categoria
   */
  private async calculatePath(categoryId: string): Promise<string[]> {
    const category = await this.repository.findById(categoryId);
    if (!category) {
      return [];
    }

    if (!category.parent_id) {
      return [category.slug];
    }

    const parentPath = await this.calculatePath(category.parent_id);
    return [...parentPath, category.slug];
  }

  /**
   * Calcula level de uma categoria
   */
  private async calculateLevel(parentId: string | null): Promise<number> {
    if (!parentId) {
      return 0;
    }

    const parent = await this.repository.findById(parentId);
    if (!parent) {
      return 0;
    }

    return parent.level + 1;
  }

  /**
   * Cria uma nova categoria
   * GOVERNANÇA: Por padrão cria como 'pending'. Para criar como 'active', requer allowActive=true e validação de admin
   */
  async createCategory(
    input: CreateCategoryInput,
    options?: {
      tenantId?: string;
      userId?: string;
      validateAdmin?: boolean;
      context?: CategoryContext;
      skipGate?: boolean; // Para criação interna (grupos/subgrupos), pular gate
      source?: string; // Origem (ex: 'script') para auditoria
      allowActive?: boolean; // Criar categoria já como active (scripts)
    }
  ): Promise<Category> {
    // VALIDAÇÃO OBRIGATÓRIA: name deve ser string não vazia
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new Error('Nome da categoria é obrigatório e deve ser uma string não vazia');
    }
    
    // Normalizar name (trim e validar)
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error('Nome da categoria não pode ser vazio após normalização');
    }
    
    // GOVERNANÇA: Se allowActive=true, validar permissão de admin
    if (input.allowActive && options?.validateAdmin) {
      if (!options.tenantId || !options.userId) {
        throw new Error('TenantId e UserId são obrigatórios para criar categoria como active');
      }

      const { rbacService } = await import('../rbac/rbac.service');
      const hasAdminRole = await rbacService.userHasAnyRole(
        options.tenantId,
        options.userId,
        ['admin']
      );

      if (!hasAdminRole) {
        throw new Error('Apenas administradores podem criar categorias como active');
      }
    }

    // CATEGORY INPUT GATE — VALIDAÇÃO FINAL CANÔNICA
    // FASE 3.7.1: Hardening - Nenhum bypass por nível
    if (!options?.skipGate && options?.context) {
      const sanitized = this.sanitizeText(name, 500);

      if (input.parentId) {
        // Buscar parent para validar existência
        const parent = await this.repository.findById(input.parentId);
        if (!parent) {
          throw new Error('Categoria pai não encontrada');
        }

        // Se NÃO é raiz (tem parentId), aplicar gate completo
        // Aplica para qualquer categoria com parent (level >= 1)
        const gateResult = await categoryInputGateService.validate(sanitized, {
          context: options.context,
          skipFormCheck: false,
          skipCBO: false,
          tenantId: options.tenantId,
          actorId: undefined,
          globalUserId: options.userId,
        });

        if (gateResult.decision === 'DENY') {
          const suggestion = gateResult.suggestion
            ? ` Use "${gateResult.suggestion}" em vez de "${name}".`
            : '';
          throw new Error(
            `❌ ${gateResult.reasonCode || 'Termo bloqueado'}.${suggestion}`
          );
        }
      } else {
        // Categoria raiz → apenas lexical gate
        const lexicalCheck = categoryLexicalGateService.validate(sanitized);
        if (lexicalCheck.decision === 'DENY') {
          await categoryInputAuditService.log({
            inputOriginal: name,
            normalized: lexicalCheck.normalized || sanitized,
            context: options.context,
            decision: 'DENY',
            reasonCode: lexicalCheck.reasonCode,
            lexicalDecision: 'DENY',
            tenantId: options.tenantId,
            globalUserId: options.userId,
          });
          throw new Error(
            `❌ ${lexicalCheck.reasonCode || 'Termo bloqueado por validação léxica'}`
          );
        }
      }
    }

    // Gerar slug se não fornecido
    const slug = input.slug || this.generateSlug(name);

    // FASE 3.7.1: ADVISORY LOCK para evitar race conditions
    const lockKey = this.generateLockKey(name, input.parentId ?? null);
    const { pool } = await import('@core/database/pool');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // FASE 3.6: Verificar se categoria já existe (por slug e parent, ou por nome e parent)
      const parentId = input.parentId ?? null;
      const existing = await this.checkCategoryExists(name, slug, parentId, options?.context, client);
      if (existing) {
        // Se encontrou categoria existente no mesmo nível, retornar ela ao invés de criar
        await client.query('COMMIT');
        return CategoryModel.fromRow(existing);
      }

      // Calcular level e path
      const level = await this.calculateLevel(parentId);
      const path = parentId
        ? await this.calculatePath(parentId)
        : [];

      // GOVERNANÇA: Determinar status baseado em allowActive
      // FASE 3.6: Se allowActive=true e criado por IA, usar 'auto_active' ao invés de 'active'
      const isAICreated = input.createdBy?.source === 'ai';
      const status = input.allowActive ? (isAICreated ? 'auto_active' : 'active') : 'pending';
      const requiresReview = !input.allowActive;
      const createdByAI = input.createdBy?.source === 'ai';

      // Criar categoria (dentro da transação com lock)
      const row = await this.repository.create({
        name: name,
        slug,
        description: input.description ?? null,
        parentId,
        level,
        path,
        keywords: input.keywords || [],
        countryCode: input.countryCode || null,
        status,
        requiresReview,
        createdByAI,
      }, client);

      // Atualizar path da categoria criada
      const finalPath = [...path, slug];
      await this.repository.update(row.category_id, { path: finalPath }, client);

      // AUDITORIA: Registrar criação
      if (input.createdBy) {
        await this.repository.logCategoryCreation({
          categoryId: row.category_id,
          tenantId: input.createdBy.tenantId,
          actorId: input.createdBy.actorId,
          globalUserId: input.createdBy.userId,
          source: input.createdBy.source,
          originalText: name,
          sanitizedText: name,
          context: undefined,
        });
      }

      await client.query('COMMIT');

      // CACHE: Invalidar cache ao criar categoria
      this.invalidateCategoryCache();

      return CategoryModel.fromRow({ ...row, path: finalPath });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Gera chave de advisory lock baseada em nome e parentId
   * FASE 3.7.1: Hardening - Evitar race conditions
   */
  private generateLockKey(name: string, parentId: string | null): number {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('md5')
      .update(name.toLowerCase() + (parentId ?? 'null'))
      .digest();
    return Math.abs(hash.readInt32BE(0));
  }

  /**
   * Cria múltiplas categorias
   * GOVERNANÇA: Cria todas como 'pending' por padrão
   */
  async createManyCategories(
    input: CreateManyCategoriesInput,
    options?: {
      tenantId?: string;
      userId?: string;
      validateAdmin?: boolean;
      source?: 'manual' | 'script' | 'ai' | 'migration';
    }
  ): Promise<Category[]> {
    const created: Category[] = [];

    for (const catInput of input.categories) {
      let parentId: string | null = null;

      // Resolver parentSlug para parentId
      if (catInput.parentSlug) {
        const parent = await this.repository.findBySlug(catInput.parentSlug);
        if (!parent) {
          throw new Error(`Categoria pai com slug "${catInput.parentSlug}" não encontrada`);
        }
        parentId = parent.category_id;
      }

      const category = await this.createCategory(
        {
          name: catInput.name,
          slug: catInput.slug,
          description: catInput.description,
          parentId,
          allowActive: false, // GOVERNANÇA: Sempre pending para múltiplas
          createdBy: {
            userId: options?.userId,
            tenantId: options?.tenantId,
            source: options?.source || 'manual',
          },
        },
        options
      );

      created.push(category);
    }

    return created;
  }

  /**
   * Busca categoria por ID
   * 🔴 BLINDAGEM: NUNCA lança exceção - sempre retorna null em caso de erro
   * Service é SAFE por definição - não quebra quem chama
   */
  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      // Validar que categoryId existe
      if (!categoryId) {
        return null;
      }

      const row = await this.repository.findById(categoryId);
      return row ? CategoryModel.fromRow(row) : null;
    } catch (error) {
      // 🔴 CRÍTICO: Nunca lançar erro - service é SAFE
      // Log apenas em dev/warn, retornar null
      console.warn('[CategoriesService] Erro ao buscar categoria (retornando null):', {
        category_id: categoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * MÉTODO CANÔNICO: Leitura de categorias para tenant
   * SSOT: Único caminho canônico para leitura de categorias
   * 
   * @param tenantId - ID do tenant (obrigatório)
   * @param context - Contexto semântico (obrigatório)
   * @returns Árvore de categorias filtrada por tenant e contexto
   */
  async getCategoriesForTenant(
    tenantId: string,
    context: CategoryContext
  ): Promise<CategoryTree[]> {
    // GUARD: tenantId obrigatório
    if (!tenantId) {
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: context || null,
        details: {
          method: 'getCategoriesForTenant',
          reason: 'tenantId ausente',
        },
      });
      throw new Error('SSOT_VIOLATION: tenantId is mandatory for category reads');
    }

    // GUARD: context obrigatório
    if (!context) {
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId,
        context: null,
        details: {
          method: 'getCategoriesForTenant',
          reason: 'context ausente',
        },
      });
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }

// Ontologia (N0→N1→N2): leitura canônica não filtra por cidade/tenant geográfico.
// `country_code` em `categories` é metadado da taxonomia quando existir, não âncora via `tenants.city_id`.
// Não consultar `cities`/world aqui — evita query ilegal (ex.: coluna city_id inexistente) e SSOT paralelo.
const countryCode: string | null = null;

const tenant = await tenantService.getTenantById(tenantId);

if (!tenant) {
  const err: any = new Error(`TENANT_NOT_FOUND: ${tenantId}`);
  err.statusCode = 401;
  err.status = 401;
  throw err;
}

// 🔴 ADR: Validação de permissão de contexto
// Se tenant_contexts não existir, erro será claro (não entrar em loop)
let hasReadAccess: boolean;
try {
  hasReadAccess = await tenantContextPermissionService.hasReadAccess(tenantId, context);
} catch (err: any) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  // 🔴 ADR: Erro específico para tabela não existe
  if (errorMessage.includes('tenant_contexts') && (errorMessage.includes('não existe') || errorMessage.includes('does not exist'))) {
    throw new Error(
      `SCHEMA_ERROR: Tabela tenant_contexts não encontrada. Execute a migration 312: 312_tenant_default_context_permissions.sql`
    );
  }
  // Re-lançar outros erros
  throw err;
}

if (!hasReadAccess) {
  throw new Error(
    `CONTEXT_ACCESS_DENIED: Tenant ${tenantId} não tem permissão de leitura no context ${context}`
  );
}


    // Cache: chave única por tenantId:context
    const cacheKey = `${tenantId}:${context}`;
    const cached = this.canonicalCache.get(cacheKey);
    
    if (cached) {
      const cacheAge = (Date.now() - cached.timestamp) / 1000;
      if (cacheAge < this.CACHE_TTL_SECONDS) {
        return cached.data;
      }
    }

    // Chamar repository APENAS após validações
    const allRows = await this.repository.findAll(countryCode, context);

    const allCategories = CategoryModel.fromRows(allRows);

    // DECISION-0068 (estende OPÇÃO B / 07 §4262/4278): conceptId é exposto em contextos DECLARATIVOS
    // (professional/learning/interest) — declaração de perfil concept-first, NÃO concept_ref transacional.
    // Em qualquer outro contexto (marketplace/produto/transacional/event/company/…) NÃO é surfaçado.
    if (!canExposeCategoryConceptId(context)) {
      for (const cat of allCategories) {
        delete (cat as { conceptId?: string | null }).conceptId;
      }
    }

    // Criar mapa de categorias por ID
    const categoryMap = new Map<string, CategoryTree>();
    allCategories.forEach((cat) => {
      categoryMap.set(cat.categoryId, { ...cat, children: [] });
    });

    // Construir árvore
    const roots: CategoryTree[] = [];
    allCategories.forEach((cat) => {
      const treeNode = categoryMap.get(cat.categoryId)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(treeNode);
        } else {
          // Parent não encontrado - pode ser categoria órfã, adicionar como root
          roots.push(treeNode);
        }
      } else {
        roots.push(treeNode);
      }
    });

    // Atualizar cache canônico
    this.canonicalCache.set(cacheKey, {
      data: roots,
      timestamp: Date.now(),
    });

    return roots;
  }

  /**
   * F-PROFESSIONAL-BROWSE-EMPTY-SCAFFOLD-CONTAINMENT-SLICE-A (D1 · READ-FIRST BROWSE_COM_WARNING).
   * FILTRO DE LEITURA (navegação, NÃO identidade): no browse do PRODUTOR (context='professional'),
   * buckets L1 professional VAZIOS — `scope='professional' ∧ level=1 ∧ concept_id NULL ∧ 0 filhos
   * navegáveis` — são "armários vazios" (scaffolds N1 pré-semeados sem grão). Deixam de aparecer
   * como nó navegável enquanto não tiverem filhos.
   *
   * Isto NÃO apaga / funde / reparenta / altera nada: o bucket permanece no DB (scaffold intacto)
   * e volta a aparecer assim que ganhar uma folha L2 concept-bound. NÃO toca
   * concept/canonical/alias/label/authority/path/parent_id.
   *
   * GUARDA-TRILHO: nunca remove bucket com ≥1 filho (ex.: beleza-estetica/limpeza-conservacao/
   * medicina), nunca remove folha L2 (a regra mira level=1), nunca remove nó concept-bound. Só age
   * em context='professional'; qualquer outro context retorna a árvore INTACTA (validadores como
   * human-mvp continuam usando `getCategoriesForTenant` cru, sem este filtro).
   */
  pruneEmptyProfessionalScaffolds(
    nodes: CategoryTree[],
    context: CategoryContext
  ): CategoryTree[] {
    if (context !== 'professional' || !Array.isArray(nodes)) {
      return nodes;
    }
    const isEmptyProfessionalScaffold = (node: CategoryTree): boolean =>
      node.scope === 'professional' &&
      node.level === 1 &&
      (node.conceptId === null || node.conceptId === undefined) &&
      (!node.children || node.children.length === 0);

    const prune = (list: CategoryTree[]): CategoryTree[] =>
      list
        .filter((node) => !isEmptyProfessionalScaffold(node))
        .map((node) =>
          node.children && node.children.length > 0
            ? { ...node, children: prune(node.children) }
            : node
        );

    return prune(nodes);
  }

  /**
   * @deprecated Use getCategoriesForTenant(tenantId, context) instead.
   * Este método será removido quando ENFORCE_CANONICAL_ONLY=true.
   * 
   * Método legado: permite leitura sem tenantId explícito.
   * Violação de SSOT: countryCode pode vir de parâmetros externos.
   */
  async getCategoryTree(countryCode?: string | null, context?: CategoryContext, useCache: boolean = true): Promise<CategoryTree[]> {
    // KILL SWITCH: Se ENFORCE_CANONICAL_ONLY estiver ativo, bloquear método legado
    if (process.env.ENFORCE_CANONICAL_ONLY === 'true') {
      // Registrar SSOT_VIOLATION (kill switch ativo)
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: context || null,
        details: {
          method: 'getCategoryTree',
          reason: 'método legado chamado com ENFORCE_CANONICAL_ONLY=true',
          countryCode: countryCode || null,
        },
      });
      
      const error = new Error(
        'SSOT_VIOLATION: getCategoryTree is deprecated. Use getCategoriesForTenant(tenantId, context) instead.'
      );
      console.error('[DEPRECATED] getCategoryTree chamado com ENFORCE_CANONICAL_ONLY=true:', {
        countryCode,
        context,
        stack: error.stack,
      });
      throw error;
    }

    // WARNING: Método legado em uso
    // Registrar LEGACY_CALL (tentativa de uso de método legado)
    await ssotObservabilityUtil.recordViolation('LEGACY_CALL', {
      tenantId: null,
      context: context || null,
      details: {
        method: 'getCategoryTree',
        reason: 'método legado chamado (deve usar getCategoriesForTenant)',
        countryCode: countryCode || null,
      },
    });
    
    console.warn('[DEPRECATED] getCategoryTree chamado. Use getCategoriesForTenant(tenantId, context) instead.', {
      countryCode,
      context,
      stack: new Error().stack,
    });
    // 🔴 LOG DE DIAGNÓSTICO
    console.log('[CategoriesService.getCategoryTree] Chamado com:', {
      countryCode: countryCode || 'null',
      context: context || 'undefined',
      useCache,
      cacheExists: !!this.categoryTreeCache.data,
      cacheAge: this.categoryTreeCache.data ? (Date.now() - this.categoryTreeCache.timestamp) / 1000 : null,
    });
    
    // CACHE: Verificar se cache é válido (chaveado por countryCode + context)
    if (useCache && this.categoryTreeCache.data) {
      const cacheAge = (Date.now() - this.categoryTreeCache.timestamp) / 1000;
      const sameCountry = this.categoryTreeCache.countryCode === countryCode;
      const sameContext = this.categoryTreeCache.context === context;
      
      if (cacheAge < this.CACHE_TTL_SECONDS && sameCountry && sameContext) {
        console.log('[CategoriesService.getCategoryTree] Retornando do cache:', {
          totalRoots: this.categoryTreeCache.data.length,
          context,
        });
        return this.categoryTreeCache.data;
      } else {
        console.log('[CategoriesService.getCategoryTree] Cache inválido, buscando do banco:', {
          reason: !sameCountry ? 'countryCode diferente' : !sameContext ? 'context diferente' : 'cache expirado',
        });
      }
    }

    try {
      const allRows = await this.repository.findAll(countryCode, context);
      
      // 🔴 LOG DE DIAGNÓSTICO
      console.log('[CategoriesService.getCategoryTree] Diagnóstico:', {
        countryCode: countryCode || 'null',
        context: context || 'undefined',
        totalFound: allRows.length,
        sampleCategories: allRows.slice(0, 3).map(r => ({
          id: r.category_id,
          name: r.name,
          scope: r.scope || 'NULL',
          status: (r as any).status || 'NULL',
          country_code: r.country_code,
        })),
      });
      
      // 🔴 INSPEÇÃO TEMPORÁRIA: Rastrear "Pedreiro" após repository
      const foundPedreiroService = allRows.some((r: any) => 
        r.name?.toLowerCase().includes('pedr') || r.slug?.toLowerCase().includes('pedr')
      );
      const pedreiroRowService = allRows.find((r: any) => 
        r.name?.toLowerCase().includes('pedr') || r.slug?.toLowerCase().includes('pedr')
      );
      console.log('[INSPEÇÃO] Service após repository:', {
        foundPedreiroService,
        pedreiroInfo: pedreiroRowService ? {
          id: pedreiroRowService.category_id,
          name: pedreiroRowService.name,
          parent_id: pedreiroRowService.parent_id,
          level: pedreiroRowService.level,
        } : null,
      });
      
      const allCategories = CategoryModel.fromRows(allRows);
      console.log(`[getCategoryTree] Convertidas ${allCategories.length} categorias`);

      // Criar mapa de categorias por ID
      const categoryMap = new Map<string, CategoryTree>();
      allCategories.forEach((cat) => {
        categoryMap.set(cat.categoryId, { ...cat, children: [] });
      });

      // Construir árvore
      const roots: CategoryTree[] = [];
      allCategories.forEach((cat) => {
        const treeNode = categoryMap.get(cat.categoryId)!;
        if (cat.parentId) {
          const parent = categoryMap.get(cat.parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(treeNode);
          } else {
            // Parent não encontrado - pode ser categoria órfã, adicionar como root
            console.warn(`[getCategoryTree] Categoria ${cat.categoryId} tem parent ${cat.parentId} que não existe - adicionando como root`);
            roots.push(treeNode);
          }
        } else {
          roots.push(treeNode);
        }
      });

      console.log(`[getCategoryTree] Árvore construída com ${roots.length} raízes`);
      
      // 🔴 INSPEÇÃO TEMPORÁRIA: Rastrear "Pedreiro" após tree builder
      const findPedreiroInTree = (nodes: CategoryTree[]): CategoryTree | null => {
        for (const node of nodes) {
          if (node.name?.toLowerCase().includes('pedr') || node.slug?.toLowerCase().includes('pedr')) {
            return node;
          }
          if (node.children) {
            const found = findPedreiroInTree(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const pedreiroAfterTree = findPedreiroInTree(roots);
      const foundPedreiroAfterTree = pedreiroAfterTree !== null;
      console.log('[INSPEÇÃO] Service após tree builder:', {
        foundPedreiroAfterTree,
        pedreiroInfo: pedreiroAfterTree ? {
          id: pedreiroAfterTree.categoryId,
          name: pedreiroAfterTree.name,
          parentId: pedreiroAfterTree.parentId,
          level: pedreiroAfterTree.level,
          isRoot: !pedreiroAfterTree.parentId,
          childrenCount: pedreiroAfterTree.children?.length || 0,
        } : null,
      });
      
      // 🔴 LOG FINAL (DIAGNÓSTICO)
      console.log('[CategoriesService.getCategoryTree] Resultado final:', {
        countryCode: countryCode || 'null',
        context: context || 'undefined',
        totalRoots: roots.length,
        totalCategories: allCategories.length,
        rootsSample: roots.slice(0, 3).map(r => ({
          id: r.categoryId,
          name: r.name,
          scope: r.scope || 'NULL',
          childrenCount: r.children?.length || 0,
        })),
      });

      // 🔴 CACHE: Atualizar cache apenas se houver dados (chaveado por countryCode + context)
      // Se roots estiver vazio, limpar cache para forçar nova busca
      if (roots.length > 0) {
        this.categoryTreeCache = {
          data: roots,
          timestamp: Date.now(),
          countryCode,
          context,
        };
      } else {
        // Limpar cache se estiver vazio (pode ser cache de estado vazio inválido)
        this.categoryTreeCache = {
          data: null,
          timestamp: 0,
          countryCode: null,
          context: undefined,
        };
        console.warn('[CategoriesService.getCategoryTree] Árvore vazia - cache limpo');
      }

      return roots;
    } catch (error) {
      // Log detalhado do erro para debug
      console.error('[getCategoryTree] Erro ao buscar árvore de categorias:', error);
      if (error instanceof Error) {
        console.error('[getCategoryTree] Stack trace:', error.stack);
        throw new Error(`Erro ao buscar árvore de categorias: ${error.message}`);
      }
      throw new Error('Erro ao buscar árvore de categorias: Erro desconhecido');
    }
  }

  /**
   * CACHE: Invalida cache de categorias
   * Chamado quando categoria é criada, aprovada ou rejeitada
   */
  invalidateCategoryCache(): void {
    this.categoryTreeCache = {
      data: null,
      timestamp: 0,
    };
  }

  /**
   * Busca filhos de uma categoria
   */
  /**
   * Busca filhos de uma categoria
   * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
   */
  async getChildren(categoryId: string, countryCode?: string | null, context?: CategoryContext): Promise<Category[]> {
    // Filtro mantém 'professional' como default histórico (não muda QUAIS filhos retornam);
    // mas conceptId só é exposto quando o contexto DECLARATIVO veio EXPLÍCITO do caller.
    const effectiveContext: CategoryContext = context ?? 'professional';
    const rows = await this.repository.findChildren(categoryId, effectiveContext, countryCode);
    const cats = CategoryModel.fromRows(rows);
    // DECISION-0068: surfaçar conceptId em contextos declarativos (professional/learning/interest).
    // Decide pelo `context` EXPLÍCITO (não pelo fallback effectiveContext): contexto omitido ⇒ NÃO surfaçar.
    if (!canExposeCategoryConceptId(context)) {
      for (const cat of cats) {
        delete (cat as { conceptId?: string | null }).conceptId;
      }
    }
    return cats;
  }

  /**
   * Busca categorias por termo
   * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
   */
  /**
   * MÉTODO CANÔNICO: Busca de categorias para tenant
   * SSOT: Usa o mesmo método canônico de leitura (getCategoriesForTenant) e aplica filtro de busca em memória
   * 
   * @param term - Termo de busca
   * @param tenantId - ID do tenant (obrigatório)
   * @param context - Contexto semântico (obrigatório)
   * @param limit - Limite de resultados
   * @returns Lista de categorias que correspondem ao termo de busca
   */
  async searchCategoriesForTenant(
    term: string,
    tenantId: string,
    context: CategoryContext,
    limit: number = 50
  ): Promise<Category[]> {
    // GUARD: tenantId obrigatório
    if (!tenantId) {
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: context || null,
        details: {
          method: 'searchCategoriesForTenant',
          reason: 'tenantId ausente',
        },
      });
      throw new Error('SSOT_VIOLATION: tenantId is mandatory for category reads');
    }

    // GUARD: context obrigatório
    if (!context) {
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId,
        context: null,
        details: {
          method: 'searchCategoriesForTenant',
          reason: 'context ausente',
        },
      });
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }

    // SSOT: Obter a MESMA árvore canônica usada pela navegação
    // D1 (SLICE-A): esconder do browse do produtor buckets L1 professional vazios (filtro de leitura).
    const tree = this.pruneEmptyProfessionalScaffolds(
      await this.getCategoriesForTenant(tenantId, context),
      context
    );

    // Aplicar filtro de busca em memória sobre a árvore completa
    const searchTerm = term.toLowerCase().trim();
    const normalizedTerm = searchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Função recursiva para coletar todas as categorias da árvore
    const collectAllCategories = (nodes: CategoryTree[]): CategoryTree[] => {
      const all: CategoryTree[] = [];
      for (const node of nodes) {
        all.push(node);
        if (node.children && node.children.length > 0) {
          all.push(...collectAllCategories(node.children));
        }
      }
      return all;
    };

    // Função para verificar se uma categoria corresponde ao termo de busca
    const matchesSearch = (category: CategoryTree): boolean => {
      const nameLower = category.name.toLowerCase();
      const normalizedName = nameLower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Verificar match exato
      if (nameLower === searchTerm || normalizedName === normalizedTerm) {
        return true;
      }
      
      // Verificar prefixo
      if (nameLower.startsWith(searchTerm) || normalizedName.startsWith(normalizedTerm)) {
        return true;
      }
      
      // Verificar contém
      if (nameLower.includes(searchTerm) || normalizedName.includes(normalizedTerm)) {
        return true;
      }
      
      // Verificar slug
      const slugLower = category.slug.toLowerCase();
      if (slugLower === searchTerm || slugLower.startsWith(searchTerm) || slugLower.includes(searchTerm)) {
        return true;
      }
      
      // Verificar keywords
      if (category.keywords && category.keywords.length > 0) {
        for (const keyword of category.keywords) {
          const keywordLower = keyword.toLowerCase();
          if (keywordLower === searchTerm || keywordLower.startsWith(searchTerm) || keywordLower.includes(searchTerm)) {
            return true;
          }
        }
      }
      
      // Verificar path
      if (category.path && category.path.length > 0) {
        for (const pathItem of category.path) {
          const pathLower = pathItem.toLowerCase();
          if (pathLower.includes(searchTerm)) {
            return true;
          }
        }
      }
      
      return false;
    };

    // Coletar todas as categorias da árvore
    const allCategories = collectAllCategories(tree);
    
    // Filtrar apenas as que correspondem ao termo de busca
    const matchingCategories = allCategories.filter(matchesSearch);
    
    // Limitar resultados
    const limitedResults = matchingCategories.slice(0, limit);
    
    // Converter para formato Category
    return limitedResults.map(cat => ({
      categoryId: cat.categoryId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
      parentId: cat.parentId ?? null,
      level: cat.level,
      path: cat.path || [],
      keywords: cat.keywords || [],
      countryCode: cat.countryCode ?? null,
      scope: cat.scope ?? undefined,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }

  /**
   * @deprecated Use searchCategoriesForTenant instead. Este método mantido apenas para compatibilidade interna.
   * TRAVA: context com default 'professional' - não criar novos usos deste método
   */
  async searchCategories(term: string, limit: number = 50, countryCode?: string | null, context: CategoryContext = 'professional'): Promise<Category[]> {
    const rows = await this.repository.search(term, context, countryCode, limit);
    return CategoryModel.fromRows(rows);
  }

  /**
   * Autocomplete: busca categorias leaf ACTIVE para sugestão rápida
   * SSOT: Usa a MESMA árvore canônica da navegação (getCategoriesForTenant)
   * Aplica apenas filtragem em memória sobre a árvore completa
   */
  async autocompleteCategories(
    query: string,
    tenantId: string,
    context: CategoryContext,
    limit: number = 20
  ): Promise<CategoryAutocompleteResult[]> {
    if (!query || query.trim().length < 1) {
      return [];
    }

    // SSOT: Obter a MESMA árvore canônica usada pela navegação
    // D1 (SLICE-A): esconder do autocomplete do produtor buckets L1 professional vazios (filtro de leitura).
    const tree = this.pruneEmptyProfessionalScaffolds(
      await this.getCategoriesForTenant(tenantId, context),
      context
    );

    // Aplicar filtragem em memória sobre a árvore completa
    const searchTerm = query.toLowerCase().trim();
    const normalizedTerm = searchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Função auxiliar para verificar se uma categoria corresponde ao termo de busca
    const matchesSearch = (category: CategoryTree): boolean => {
      const nameLower = category.name.toLowerCase();
      const normalizedName = nameLower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Verificar match exato
      if (nameLower === searchTerm || normalizedName === normalizedTerm) {
        return true;
      }
      
      // Verificar prefixo
      if (nameLower.startsWith(searchTerm) || normalizedName.startsWith(normalizedTerm)) {
        return true;
      }
      
      // Verificar contém
      if (nameLower.includes(searchTerm) || normalizedName.includes(normalizedTerm)) {
        return true;
      }
      
      // Verificar slug
      const slugLower = category.slug.toLowerCase();
      if (slugLower === searchTerm || slugLower.startsWith(searchTerm) || slugLower.includes(searchTerm)) {
        return true;
      }
      
      // Verificar keywords
      if (category.keywords && category.keywords.length > 0) {
        for (const keyword of category.keywords) {
          const keywordLower = keyword.toLowerCase();
          if (keywordLower === searchTerm || keywordLower.startsWith(searchTerm) || keywordLower.includes(searchTerm)) {
            return true;
          }
        }
      }
      
      // Verificar path
      if (category.path && category.path.length > 0) {
        for (const pathItem of category.path) {
          const pathLower = pathItem.toLowerCase();
          if (pathLower.includes(searchTerm)) {
            return true;
          }
        }
      }
      
      return false;
    };

    // Função auxiliar para calcular relevância (maior = mais relevante)
    const calculateRelevance = (category: CategoryTree): number => {
      const nameLower = category.name.toLowerCase();
      const normalizedName = nameLower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Match exato no nome (maior prioridade)
      if (nameLower === searchTerm || normalizedName === normalizedTerm) {
        return 100;
      }
      
      // Match exato no slug
      const slugLower = category.slug.toLowerCase();
      if (slugLower === searchTerm) {
        return 90;
      }
      
      // Nome começa com o termo (prefixo) - ALTA PRIORIDADE
      if (nameLower.startsWith(searchTerm) || normalizedName.startsWith(normalizedTerm)) {
        return 85;
      }
      
      // Slug começa com o termo (prefixo) - ALTA PRIORIDADE
      if (slugLower.startsWith(searchTerm)) {
        return 75;
      }
      
      // Nome contém o termo (fallback)
      if (nameLower.includes(searchTerm) || normalizedName.includes(normalizedTerm)) {
        return 60;
      }
      
      // Slug contém o termo (fallback)
      if (slugLower.includes(searchTerm)) {
        return 55;
      }
      
      // Keywords contém o termo
      if (category.keywords && category.keywords.length > 0) {
        for (const keyword of category.keywords) {
          const keywordLower = keyword.toLowerCase();
          if (keywordLower.startsWith(searchTerm)) {
            return 45;
          }
          if (keywordLower.includes(searchTerm)) {
            return 40;
          }
        }
      }
      
      // Path contém o termo
      if (category.path && category.path.length > 0) {
        for (const pathItem of category.path) {
          const pathLower = pathItem.toLowerCase();
          if (pathLower.includes(searchTerm)) {
            return 30;
          }
        }
      }
      
      return 10;
    };

    // Função recursiva para coletar todas as categorias leaf da árvore
    const collectLeafCategories = (nodes: CategoryTree[]): CategoryTree[] => {
      const leaves: CategoryTree[] = [];
      
      for (const node of nodes) {
        // Se não tem filhos, é uma categoria leaf
        if (!node.children || node.children.length === 0) {
          leaves.push(node);
        } else {
          // Recursivamente coletar leaves dos filhos
          leaves.push(...collectLeafCategories(node.children));
        }
      }
      
      return leaves;
    };

    // Coletar todas as categorias leaf da árvore
    const allLeaves = collectLeafCategories(tree);
    
    // Filtrar apenas as que correspondem ao termo de busca
    const matchingLeaves = allLeaves.filter(matchesSearch);
    
    // Ordenar por relevância (maior primeiro) e depois por nome
    matchingLeaves.sort((a, b) => {
      const relevanceA = calculateRelevance(a);
      const relevanceB = calculateRelevance(b);
      
      if (relevanceA !== relevanceB) {
        return relevanceB - relevanceA; // Maior relevância primeiro
      }
      
      // Se mesma relevância, ordenar por nome
      return a.name.localeCompare(b.name);
    });
    
    // Limitar resultados
    const limitedResults = matchingLeaves.slice(0, limit);
    
    // Converter para formato de autocomplete com path completo formatado
    const results: CategoryAutocompleteResult[] = [];
    
    for (const category of limitedResults) {
      // Construir fullPathLabel usando o path da categoria
      let fullPathLabel = category.name;
      
      if (category.path && category.path.length > 1) {
        // Buscar nomes das categorias no path
        const pathNames: string[] = [];
        
        // Para cada slug no path (exceto o último que é a própria categoria)
        for (let i = 0; i < category.path.length - 1; i++) {
          const slug = category.path[i];
          // Buscar o nome da categoria pelo slug na árvore
          const findCategoryBySlug = (nodes: CategoryTree[], targetSlug: string): CategoryTree | null => {
            for (const node of nodes) {
              if (node.slug === targetSlug) {
                return node;
              }
              if (node.children && node.children.length > 0) {
                const found = findCategoryBySlug(node.children, targetSlug);
                if (found) {
                  return found;
                }
              }
            }
            return null;
          };
          
          const pathCategory = findCategoryBySlug(tree, slug);
          const name = pathCategory?.name || slug; // Fallback para slug se não encontrar
          pathNames.push(name);
        }
        
        // Adicionar o nome da categoria atual (último item do path)
        pathNames.push(category.name);
        
        fullPathLabel = pathNames.join(' > ');
      } else if (category.path && category.path.length === 1) {
        // Se path tem apenas 1 item, é a própria categoria
        fullPathLabel = category.name;
      }

      results.push({
        id: category.categoryId,
        name: category.name,
        slug: category.slug,
        level: category.level,
        path: category.path || [],
        fullPathLabel,
        // DECISION-0068: conceptId no autocomplete de contextos declarativos (professional/learning/interest);
        // proibido como concept_ref transacional (não-declarativos não recebem).
        ...(canExposeCategoryConceptId(context) ? { conceptId: category.conceptId ?? null } : {}),
      });
    }
    
    return results;
  }

  /**
   * Associa categoria a uma empresa
   */
  async assignCategoryToCompany(
    tenantId: string,
    input: AssignCategoryToCompanyInput
  ): Promise<void> {
    // VALIDAÇÃO: categoryId é obrigatório
    if (!input.categoryId) {
      throw new Error('categoryId é obrigatório');
    }
    
    // Verificar se categoria existe
    const category = await this.getCategoryById(input.categoryId);
    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    // Verificar se já está associada
    const existing = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id
      FROM company_categories
      WHERE tenant_id = $1 AND company_id = $2 AND category_id = $3
      LIMIT 1
      `,
      [tenantId, input.companyId, input.categoryId]
    );

    if (existing) {
      throw new Error('Categoria já está associada a esta empresa');
    }

    // Associar
    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO company_categories (tenant_id, company_id, category_id)
      VALUES ($1, $2, $3)
      `,
      [tenantId, input.companyId, input.categoryId]
    );
  }

  /**
   * Associa skill/categoria a um usuário
   */
  async assignSkillToUser(
    globalUserId: string,
    input: AssignSkillToUserInput
  ): Promise<void> {
    if (!input.categoryId) {
      throw HttpError.badRequest('categoryId é obrigatório');
    }

    await assertCategoryWritableForUserSkillsStrict(pool, input.categoryId);

    await pool.query(
      `
      INSERT INTO user_skills_categories (global_user_id, category_id, skill_level, years_experience, hourly_rate, pricing_type)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'hourly'))
      ON CONFLICT (global_user_id, category_id)
      DO UPDATE SET 
        skill_level = EXCLUDED.skill_level, 
        years_experience = EXCLUDED.years_experience,
        hourly_rate = EXCLUDED.hourly_rate,
        pricing_type = COALESCE(EXCLUDED.pricing_type, user_skills_categories.pricing_type),
        updated_at = now()
      `,
      [globalUserId, input.categoryId, input.skillLevel ?? 0, input.yearsExperience ?? 0, input.hourlyRate ?? null, (input as any).pricingType || 'hourly']
    );
  }

  /**
   * Classifica texto em categorias (preparado para integração com AI Kernel)
   */
  async classifyTextIntoCategories(input: ClassifyTextInput): Promise<CategoryClassification[]> {
    // VALIDAÇÃO: text é obrigatório
    if (!input.text || typeof input.text !== 'string' || input.text.trim().length === 0) {
      throw new Error('text é obrigatório e deve ser uma string não vazia');
    }
    
    // TODO: Implementar integração com AI Kernel
    // Por enquanto, retorna array vazio
    // O AI Kernel pode chamar este método e implementar a lógica de classificação
    
    const maxCategories = input.maxCategories || 5;
    const text = input.text.trim();
    
    // Placeholder: busca simples por palavras-chave
    // Em produção, isso será substituído por chamada ao AI Kernel
    const searchResults = await this.searchCategories(text, maxCategories, undefined, 'professional');
    
    return searchResults.slice(0, maxCategories).map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.name,
      confidence: 0.5, // Placeholder - será calculado pelo AI
      path: cat.path,
    }));
  }

  /**
   * Valida input por contexto (security)
   */
  private validateInputByContext(
    text: string,
    context: CategoryContext
  ): { valid: boolean; message?: string } {
    // Tamanho máximo
    if (text.length > this.MAX_INPUT_LENGTH) {
      return { valid: false, message: `Texto muito longo (máximo ${this.MAX_INPUT_LENGTH} caracteres)` };
    }

    if (text.length < 2) {
      return { valid: false, message: 'Texto muito curto (mínimo 2 caracteres)' };
    }

    // Remover unicode invisível e caracteres de controle
    const cleaned = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').trim();
    if (cleaned.length < 2) {
      return { valid: false, message: 'Texto inválido após limpeza' };
    }

    // Validação por contexto
    if (context === 'professional') {
      // Allowlist: letras, espaços, hífen, acentos, números (limitados)
      // Bloquear: URLs, scripts, caracteres especiais perigosos
      if (/https?:\/\//i.test(cleaned)) {
        return { valid: false, message: 'URLs não são permitidas' };
      }
      if (/<[^>]+>/i.test(cleaned)) {
        return { valid: false, message: 'Tags HTML não são permitidas' };
      }
      if (/[{}[\]\\|`~!@#$%^&*()_+=]/g.test(cleaned)) {
        return { valid: false, message: 'Caracteres especiais não permitidos' };
      }
      // Permitir apenas letras, espaços, hífen, números (limitados)
      if (!/^[a-záàâãéèêíìîóòôõúùûçñ\s\-0-9]+$/i.test(cleaned)) {
        return { valid: false, message: 'Apenas letras, espaços, hífen e números são permitidos' };
      }
    } else if (context === 'interest') {
      // Mais permissivo, mas ainda bloquear URLs e scripts
      if (/https?:\/\//i.test(cleaned)) {
        return { valid: false, message: 'URLs não são permitidas' };
      }
      if (/<[^>]+>/i.test(cleaned)) {
        return { valid: false, message: 'Tags HTML não são permitidas' };
      }
      if (/javascript:/i.test(cleaned)) {
        return { valid: false, message: 'Scripts não são permitidos' };
      }
    } else if (context === 'education' || context === 'learning') {
      // Similar a professional, mas permitir termos acadêmicos
      if (/https?:\/\//i.test(cleaned)) {
        return { valid: false, message: 'URLs não são permitidas' };
      }
      if (/<[^>]+>/i.test(cleaned)) {
        return { valid: false, message: 'Tags HTML não são permitidas' };
      }
      // Permitir mais caracteres acadêmicos (parênteses, dois pontos, etc)
      if (!/^[a-záàâãéèêíìîóòôõúùûçñ\s\-0-9():.,;]+$/i.test(cleaned)) {
        return { valid: false, message: 'Caracteres inválidos para categoria de aprendizado' };
      }
    }

    return { valid: true };
  }

  /**
   * IA COMO CLASSIFICADORA: Sugere caminho hierárquico sem criar nada
   * 
   * Este método analisa o texto e sugere:
   * - Categoria raiz existente (level 0)
   * - Categoria pai existente (level 1 ou 2)
   * - Nome da folha (nova profissão/categoria)
   * 
   * REGRAS:
   * - Nunca sugere criar raiz nova
   * - Usa apenas categorias ACTIVE existentes
   * - Retorna confidence score
   * - Valida nível máximo (root > parent > leaf)
   * - FALLBACK: Se não houver categorias ACTIVE, retorna sugestão vazia (não lança erro)
   */
  async suggestCategoryPath(
    input: string,
    context: CategoryContext, // OBRIGATÓRIO: sem default
    countryCode?: string | null
  ): Promise<import('./categories.types').CategoryPathSuggestion> {
    // 1. VALIDAÇÃO POR CONTEXTO (security)
    const validation = this.validateInputByContext(input, context);
    if (!validation.valid) {
      throw new Error(validation.message || 'Texto inválido');
    }

    // 2. Sanitizar input
    const sanitizedText = this.sanitizeText(input, this.MAX_INPUT_LENGTH);
    if (!sanitizedText || sanitizedText.length < 2) {
      throw new Error('Texto inválido ou muito curto após sanitização');
    }

    // 3. Buscar árvore completa de categorias ACTIVE (com cache)
    const searchCountryCode = (context === 'education' || context === 'learning') ? countryCode : undefined;
    // 🔴 FIX: getCategoryTree agora requer context como segundo parâmetro
    // Para autocomplete, usar context do parâmetro da função (já validado)
    const categoryTree = await this.getCategoryTree(searchCountryCode, context, true);

    // Filtrar apenas categorias ACTIVE ou AUTO_ACTIVE (getCategoryTree já filtra por status)
    // FASE 3.6: Incluir auto_active como visível e usável
    const activeCategories = categoryTree.filter(cat => 
      !cat.status || cat.status === 'active' || cat.status === 'auto_active'
    );

    // FALLBACK: Se não houver categorias ACTIVE, retornar sugestão vazia (não lançar erro)
    if (activeCategories.length === 0) {
      const normalizedName = sanitizedText
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return {
        normalizedInput: sanitizedText,
        suggestedRoot: null,
        suggestedParent: null,
        leafName: normalizedName,
        leafDescription: null,
        confidence: 0.0,
        reasoning: 'Sistema sem categorias base - requer configuração inicial',
        requiresReview: true,
        keywords: [sanitizedText.toLowerCase()],
      };
    }

    // 3. Buscar match exato ou similar nas categorias existentes
    const searchResults = await this.searchCategories(sanitizedText, 10, searchCountryCode, context);
    const exactMatch = searchResults.find(cat => {
      const nameLower = cat.name.toLowerCase();
      const textLower = sanitizedText.toLowerCase();
      return nameLower === textLower;
    });

    if (exactMatch) {
      // Categoria já existe - retornar sugestão baseada nela
      const parent = exactMatch.parentId 
        ? await this.getCategoryById(exactMatch.parentId)
        : null;
      
      const root = parent 
        ? (parent.parentId ? await this.getCategoryById(parent.parentId) : parent)
        : exactMatch;

      return {
        normalizedInput: sanitizedText,
        suggestedRoot: root ? {
          id: root.categoryId,
          name: root.name,
          slug: root.slug,
          path: root.path,
        } : null,
        suggestedParent: parent ? {
          id: parent.categoryId,
          name: parent.name,
          slug: parent.slug,
          path: parent.path,
          level: parent.level,
        } : null,
        leafName: exactMatch.name,
        leafDescription: exactMatch.description,
        confidence: 1.0,
        reasoning: 'Categoria já existe no sistema',
        requiresReview: false,
        keywords: exactMatch.keywords,
      };
    }

    // 4. Usar IA para classificar e sugerir hierarquia
    const { AIKernel } = await import('../ai/ai-kernel');
    const aiKernel = AIKernel.getInstance();

    // Preparar estrutura simplificada para IA (apenas raízes e primeiros níveis)
    const treeForAI = activeCategories.slice(0, 50).map(cat => ({
      id: cat.categoryId,
      name: cat.name,
      slug: cat.slug,
      level: cat.level,
      path: cat.path,
      children: cat.children?.slice(0, 10).map(child => ({
        id: child.categoryId,
        name: child.name,
        slug: child.slug,
        level: child.level,
        path: child.path,
        children: child.children?.slice(0, 5).map(grandchild => ({
          id: grandchild.categoryId,
          name: grandchild.name,
          slug: grandchild.slug,
          level: grandchild.level,
        })),
      })),
    }));

    const aiPrompt = `
Analise o seguinte termo e sugira a hierarquia completa (Grupo → Subgrupo → Profissão).

REGRAS OBRIGATÓRIAS:
1. SEMPRE sugerir hierarquia completa: Grupo (level 0) → Subgrupo (level 1) → Profissão (level 2)
2. NUNCA sugerir criar profissão como categoria raiz (level 0)
3. Se encontrar categoria existente na lista, use-a. Se não encontrar, sugira criar nova.
4. Para o Grupo (raiz): Se não existir na lista, sugira um nome apropriado baseado no contexto:
   - Profissões de saúde → "Saúde"
   - Profissões de tecnologia → "Tecnologia"
   - Profissões de construção → "Construção e Reformas"
   - Profissões de educação → "Educação e Ensino"
   - Outros → contexto apropriado
5. Para o Subgrupo: Se não existir na lista, sugira um nome apropriado baseado no termo:
   - "Dentista" → "Odontologia" (dentro de "Saúde")
   - "Pedreiro" → "Construção Civil" (dentro de "Construção e Reformas")
   - "Programador" → "Desenvolvimento de Software" (dentro de "Tecnologia")
6. O termo fornecido é SEMPRE a Profissão (folha final, level 2)
7. Valide que a hierarquia faz sentido semântico
8. Confidence deve refletir a certeza da hierarquia sugerida (mínimo 0.7 se hierarquia completa)

Termo: "${sanitizedText}"
Contexto: ${context}

Estrutura de categorias existente (apenas ACTIVE):
${JSON.stringify(treeForAI, null, 2)}

Responda em JSON com:
{
  "suggestedRoot": {
    "id": "uuid-da-raiz-existente-ou-null",
    "slug": "slug-da-raiz-ou-null",
    "name": "Nome do grupo (ex: Saúde, Tecnologia, Construção e Reformas)"
  },
  "suggestedParent": {
    "id": "uuid-do-subgrupo-existente-ou-null",
    "slug": "slug-do-subgrupo-ou-null",
    "name": "Nome do subgrupo (ex: Odontologia, Desenvolvimento de Software, Construção Civil)"
  },
  "leafName": "Nome normalizado da profissão",
  "leafDescription": "Descrição clara e concisa da profissão",
  "keywords": ["palavra1", "palavra2"],
  "confidence": 0.7-1.0,
  "reasoning": "Explicação da hierarquia completa sugerida"
}
`;

    let aiSuggestion: any;
    let aiConfidence: number = 0.5;

    try {
      const aiResult = await aiKernel.run(aiPrompt, { 
        text: sanitizedText, 
        context, 
        categoryTree: treeForAI 
      });

      if (aiResult.result) {
        const jsonMatch = aiResult.result.toString().match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiSuggestion = JSON.parse(jsonMatch[0]);
          aiConfidence = Math.max(0, Math.min(1, aiSuggestion.confidence || 0.5));
        } else {
          // Fallback para análise simples
          aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
        }
      } else {
        aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
      }
    } catch (error) {
      console.warn('Erro ao processar com IA, usando análise simples:', error);
      aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
    }

    // 5. Validar e buscar categorias sugeridas
    // FASE 3.6: A IA agora pode sugerir criar grupo e subgrupo mesmo que não existam
    let suggestedRoot: { id: string; name: string; slug: string; path: string[] } | null = null;
    let suggestedParent: { id: string; name: string; slug: string; path: string[]; level: number } | null = null;

    // Buscar raiz se sugerida (pode ser existente ou nova)
    // FASE 3.7: Usar findBySlugAndParent com parentId=null para raízes
    if (aiSuggestion.suggestedRoot) {
      // Se tem ID ou slug, tentar buscar existente
      if (aiSuggestion.suggestedRoot.id || aiSuggestion.suggestedRoot.slug) {
        const root = aiSuggestion.suggestedRoot.id
          ? await this.getCategoryById(aiSuggestion.suggestedRoot.id)
          : await this.repository.findBySlugAndParent(aiSuggestion.suggestedRoot.slug, null);
        
        if (root && (!root.status || root.status === 'active' || root.status === 'auto_active') && root.level === 0) {
          const rootId = 'categoryId' in root ? root.categoryId : root.category_id;
          suggestedRoot = {
            id: rootId,
            name: root.name,
            slug: root.slug,
            path: root.path,
          };
        }
      }
      
      // Se não encontrou existente, sugerir criar nova (FASE 3.6)
      if (!suggestedRoot && aiSuggestion.suggestedRoot.name) {
        suggestedRoot = {
          id: '', // Será criado
          name: aiSuggestion.suggestedRoot.name,
          slug: aiSuggestion.suggestedRoot.slug || this.generateSlug(aiSuggestion.suggestedRoot.name),
          path: [],
        };
      }
    } else if (aiSuggestion.rootId || aiSuggestion.rootSlug) {
      // Compatibilidade com formato antigo
      const root = aiSuggestion.rootId
        ? await this.getCategoryById(aiSuggestion.rootId)
        : await this.repository.findBySlugAndParent(aiSuggestion.rootSlug, null);
      
      if (root && (!root.status || root.status === 'active' || root.status === 'auto_active') && root.level === 0) {
        const rootId = 'categoryId' in root ? root.categoryId : root.category_id;
        suggestedRoot = {
          id: rootId,
          name: root.name,
          slug: root.slug,
          path: root.path,
        };
      }
    }

    // Buscar parent se sugerido (pode ser existente ou novo)
    // FASE 3.7: Usar findBySlugAndParent com parentId=rootId quando rootId existir
    if (aiSuggestion.suggestedParent) {
      // Se tem ID ou slug, tentar buscar existente
      if (aiSuggestion.suggestedParent.id || aiSuggestion.suggestedParent.slug) {
        const parent = aiSuggestion.suggestedParent.id
          ? await this.getCategoryById(aiSuggestion.suggestedParent.id)
          : suggestedRoot?.id 
            ? await this.repository.findBySlugAndParent(aiSuggestion.suggestedParent.slug, suggestedRoot.id)
            : null; // Se não tem rootId, não pode buscar por parent_id
        
        if (parent && (!parent.status || parent.status === 'active' || parent.status === 'auto_active')) {
          // Validar que parent não é raiz (deve ser level 1 ou 2)
          if (parent.level > 0 && parent.level <= 2) {
            const parentId = 'categoryId' in parent ? parent.categoryId : parent.category_id;
            suggestedParent = {
              id: parentId,
              name: parent.name,
              slug: parent.slug,
              path: parent.path,
              level: parent.level,
            };
          }
        }
      }
      
      // Se não encontrou existente, sugerir criar novo (FASE 3.6)
      if (!suggestedParent && aiSuggestion.suggestedParent.name) {
        suggestedParent = {
          id: '', // Será criado
          name: aiSuggestion.suggestedParent.name,
          slug: aiSuggestion.suggestedParent.slug || this.generateSlug(aiSuggestion.suggestedParent.name),
          path: [],
          level: 1, // Subgrupo é sempre level 1
        };
      }
    } else if (aiSuggestion.parentId || aiSuggestion.parentSlug) {
      // Compatibilidade com formato antigo
      const parent = aiSuggestion.parentId
        ? await this.getCategoryById(aiSuggestion.parentId)
        : suggestedRoot?.id
          ? await this.repository.findBySlugAndParent(aiSuggestion.parentSlug, suggestedRoot.id)
          : null;
      
      if (parent && (!parent.status || parent.status === 'active' || parent.status === 'auto_active')) {
        // Validar que parent não é raiz (deve ser level 1 ou 2)
        if (parent.level > 0 && parent.level <= 2) {
          const parentId = 'categoryId' in parent ? parent.categoryId : parent.category_id;
          suggestedParent = {
            id: parentId,
            name: parent.name,
            slug: parent.slug,
            path: parent.path,
            level: parent.level,
          };
        }
      }
    }

    // 6. FASE 3.7: VALIDAÇÃO OBRIGATÓRIA - Garantir hierarquia completa
    // Se IA não sugeriu root ou parent, inferir programaticamente
    if (!suggestedRoot) {
      const inferredGroup = this.inferGroupName(sanitizedText, context);
      const groupSlug = this.generateSlug(inferredGroup);
      suggestedRoot = {
        id: '',
        name: inferredGroup,
        slug: groupSlug,
        path: [],
      };
    }
    
    if (!suggestedParent) {
      const inferredSubgroup = this.inferSubgroupName(sanitizedText, context);
      const subgroupName = inferredSubgroup || this.generateDefaultSubgroupName(sanitizedText, context);
      const subgroupSlug = this.generateSlug(subgroupName);
      suggestedParent = {
        id: '',
        name: subgroupName,
        slug: subgroupSlug,
        path: [],
        level: 1,
      };
    }

    // FASE 3.7: requiresReview SEMPRE false para categorias criadas por IA
    // O sistema deve criar com auto_active e não bloquear fluxo
    const requiresReview = false;

    // Normalizar nome da folha
    const leafName = aiSuggestion.leafName || sanitizedText
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // SECURITY: Remover reasoning detalhado do response (manter apenas no log)
    return {
      normalizedInput: sanitizedText,
      suggestedRoot,
      suggestedParent,
      leafName,
      leafDescription: aiSuggestion.leafDescription || null,
      confidence: Math.max(aiConfidence, 0.7), // Mínimo 0.7 se hierarquia completa garantida
      reasoning: 'Análise automática concluída', // Mensagem fixa curta (reasoning detalhado apenas em logs)
      requiresReview,
      keywords: aiSuggestion.keywords || [sanitizedText.toLowerCase()],
    };
  }

  /**
   * FASE 3.6: Garante hierarquia completa (Grupo → Subgrupo → Profissão)
   * Esta função é chamada ANTES de criar a profissão para garantir que grupo e subgrupo existam
   * Retorna: { rootId, subgroupId } garantidos
   */
  private async ensureCompleteHierarchy(
    profession: string,
    context: string,
    pathSuggestion: {
      suggestedRoot: { id: string; name: string; slug: string; path: string[] } | null;
      suggestedParent: { id: string; name: string; slug: string; path: string[]; level: number } | null;
      leafName: string;
      confidence: number;
    },
    countryCode: string | null | undefined,
    tenantId: string | undefined,
    actorId: string | undefined,
    globalUserId: string | undefined
  ): Promise<{ rootId: string; subgroupId: string; minConfidence: number }> {
    let rootId: string | null = null;
    let subgroupId: string | null = null;
    let minConfidence = pathSuggestion.confidence;

    // PASSO 1: Garantir que há um GRUPO (raiz)
    if (pathSuggestion.suggestedRoot) {
      // TAREFA A: Buscar existente por (slug, parent_id=null) - IDEMPOTÊNCIA
      const existingRoot = await this.repository.findBySlugAndParent(pathSuggestion.suggestedRoot.slug, null);
      if (existingRoot) {
        rootId = existingRoot.category_id;
      } else {
        // Criar grupo
        const rootCategory = await this.createCategory(
          {
            name: pathSuggestion.suggestedRoot.name,
            slug: pathSuggestion.suggestedRoot.slug,
            description: `Grupo criado automaticamente pela IA: ${pathSuggestion.suggestedRoot.name}`,
            parentId: null,
            keywords: [pathSuggestion.suggestedRoot.name.toLowerCase()],
            countryCode: context === 'education' ? countryCode || null : null,
            allowActive: true,
            createdBy: {
              userId: globalUserId,
              actorId: actorId,
              tenantId: tenantId,
              source: 'ai',
            },
          },
          {
            tenantId,
            userId: globalUserId,
            validateAdmin: false,
            context: context as CategoryContext,
            skipGate: true, // Grupos são criados internamente, não precisam do gate completo
          }
        );
        rootId = rootCategory.categoryId;
        minConfidence = Math.min(minConfidence, pathSuggestion.confidence);
      }
    } else {
      // IA não sugeriu grupo - criar baseado no contexto
      const inferredGroup = this.inferGroupName(profession, context);
      const groupSlug = this.generateSlug(inferredGroup);
      // TAREFA A: Verificar se grupo já existe por (slug, parent_id=null) - IDEMPOTÊNCIA
      const existingRoot = await this.repository.findBySlugAndParent(groupSlug, null);
      
      if (existingRoot) {
        rootId = existingRoot.category_id;
      } else {
        const rootCategory = await this.createCategory(
          {
            name: inferredGroup,
            slug: groupSlug,
            description: `Grupo criado automaticamente: ${inferredGroup}`,
            parentId: null,
            keywords: [inferredGroup.toLowerCase()],
            countryCode: context === 'education' ? countryCode || null : null,
            allowActive: true,
            createdBy: {
              userId: globalUserId,
              actorId: actorId,
              tenantId: tenantId,
              source: 'ai',
            },
          },
          {
            tenantId,
            userId: globalUserId,
            validateAdmin: false,
          }
        );
        rootId = rootCategory.categoryId;
        minConfidence = Math.min(minConfidence, 0.7); // Confidence padrão para inferência
      }
    }

    if (!rootId) {
      throw new Error('Não foi possível criar ou encontrar grupo. A hierarquia deve ser: Grupo → Subgrupo → Profissão');
    }

    // PASSO 2: Garantir que há um SUBGRUPO
    if (pathSuggestion.suggestedParent && pathSuggestion.suggestedParent.id) {
      // IA sugeriu subgrupo com ID - usar existente
      subgroupId = pathSuggestion.suggestedParent.id;
    } else if (pathSuggestion.suggestedParent && pathSuggestion.suggestedParent.slug) {
      // TAREFA A: Verificar se subgrupo já existe por (slug, parent_id=rootId) - IDEMPOTÊNCIA
      const existingSubgroup = await this.repository.findBySlugAndParent(
        pathSuggestion.suggestedParent.slug,
        rootId // parentId = rootId para subgrupo
      );
      if (existingSubgroup) {
        subgroupId = existingSubgroup.category_id;
      } else {
        const subgroupCategory = await this.createCategory(
          {
            name: pathSuggestion.suggestedParent.name,
            slug: pathSuggestion.suggestedParent.slug,
            description: `Subgrupo criado automaticamente pela IA: ${pathSuggestion.suggestedParent.name}`,
            parentId: rootId,
            keywords: [pathSuggestion.suggestedParent.name.toLowerCase()],
            countryCode: context === 'education' ? countryCode || null : null,
            allowActive: true,
            createdBy: {
              userId: globalUserId,
              actorId: actorId,
              tenantId: tenantId,
              source: 'ai',
            },
          },
          {
            tenantId,
            userId: globalUserId,
            validateAdmin: false,
            context: context as CategoryContext,
            skipGate: true, // Subgrupos são criados internamente
          }
        );
        subgroupId = subgroupCategory.categoryId;
        minConfidence = Math.min(minConfidence, pathSuggestion.confidence);
      }
    } else {
      // IA não sugeriu subgrupo - inferir e criar
      const inferredSubgroup = this.inferSubgroupName(profession, context);
      const subgroupName = inferredSubgroup || this.generateDefaultSubgroupName(profession, context);
      const subgroupSlug = this.generateSlug(subgroupName);
      
      // TAREFA A: Verificar se subgrupo já existe por (slug, parent_id=rootId) - IDEMPOTÊNCIA
      const existingSubgroup = await this.repository.findBySlugAndParent(subgroupSlug, rootId);
      if (existingSubgroup) {
        subgroupId = existingSubgroup.category_id;
      } else {
        const subgroupCategory = await this.createCategory(
          {
            name: subgroupName,
            slug: subgroupSlug,
            description: `Subgrupo criado automaticamente: ${subgroupName}`,
            parentId: rootId,
            keywords: [subgroupName.toLowerCase()],
            countryCode: context === 'education' ? countryCode || null : null,
            allowActive: true,
            createdBy: {
              userId: globalUserId,
              actorId: actorId,
              tenantId: tenantId,
              source: 'ai',
            },
          },
          {
            tenantId,
            userId: globalUserId,
            validateAdmin: false,
            context: context as CategoryContext,
            skipGate: true, // Subgrupos são criados internamente
          }
        );
        subgroupId = subgroupCategory.categoryId;
        minConfidence = Math.min(minConfidence, 0.7); // Confidence padrão para inferência
      }
    }

    if (!subgroupId) {
      throw new Error('Não foi possível criar ou encontrar subgrupo. A hierarquia deve ser: Grupo → Subgrupo → Profissão');
    }

    return { rootId, subgroupId, minConfidence };
  }

  /**
   * Infere o nome do grupo baseado na profissão e contexto
   * FASE 3.6: Garantir que sempre haja grupo na hierarquia
   */
  private inferGroupName(profession: string, context: string): string {
    const lowerProfession = profession.toLowerCase().trim();
    
    // Mapeamento de profissões para grupos
    const professionToGroup: Record<string, string> = {
      // Saúde
      'dentista': 'Saúde',
      'dentist': 'Saúde',
      'médico': 'Saúde',
      'medico': 'Saúde',
      'enfermeiro': 'Saúde',
      'fisioterapeuta': 'Saúde',
      'psicólogo': 'Saúde',
      'psicologo': 'Saúde',
      'nutricionista': 'Saúde',
      'farmacêutico': 'Saúde',
      'farmaceutico': 'Saúde',
      
      // Construção
      'pedreiro': 'Construção e Reformas',
      'carpinteiro': 'Construção e Reformas',
      'eletricista': 'Construção e Reformas',
      'encanador': 'Construção e Reformas',
      'pintor': 'Construção e Reformas',
      'arquiteto': 'Construção e Reformas',
      'engenheiro': 'Construção e Reformas',
      
      // Tecnologia
      'programador': 'Tecnologia',
      'desenvolvedor': 'Tecnologia',
      'designer': 'Tecnologia',
      'analista': 'Tecnologia',
      
      // Educação
      'professor': 'Educação e Ensino',
      'educador': 'Educação e Ensino',
      'instrutor': 'Educação e Ensino',
    };
    
    // Buscar mapeamento direto
    if (professionToGroup[lowerProfession]) {
      return professionToGroup[lowerProfession];
    }
    
    // Buscar por contém
    for (const [key, value] of Object.entries(professionToGroup)) {
      if (lowerProfession.includes(key) || key.includes(lowerProfession)) {
        return value;
      }
    }
    
    // Padrão baseado no contexto
    if (context === 'professional') {
      return 'Profissões Gerais';
    } else if (context === 'education' || context === 'learning') {
      return 'Educação e Conhecimento Geral';
    } else {
      return 'Outros';
    }
  }

  /**
   * Gera nome padrão de subgrupo quando não consegue inferir
   */
  private generateDefaultSubgroupName(profession: string, context: string): string {
    const normalized = profession
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Se profissão tem mais de uma palavra, usar a última como subgrupo
    const words = normalized.split(' ');
    if (words.length > 1) {
      return words[words.length - 1];
    }
    
    // Caso contrário, usar o nome da profissão + "Profissional"
    return `${normalized} Profissional`;
  }

  /**
   * Infere o nome do subgrupo baseado na profissão
   * FASE 3.6: Garantir que sempre haja subgrupo na hierarquia
   */
  private inferSubgroupName(profession: string, context: string): string | null {
    const lowerProfession = profession.toLowerCase().trim();
    
    // Mapeamento de profissões para subgrupos
    const professionToSubgroup: Record<string, string> = {
      // Saúde
      'dentista': 'Odontologia',
      'dentist': 'Odontologia',
      'médico': 'Medicina',
      'medico': 'Medicina',
      'enfermeiro': 'Enfermagem',
      'fisioterapeuta': 'Fisioterapia',
      'psicólogo': 'Psicologia',
      'psicologo': 'Psicologia',
      'nutricionista': 'Nutrição',
      'farmacêutico': 'Farmácia',
      'farmaceutico': 'Farmácia',
      
      // Construção
      'pedreiro': 'Construção Civil',
      'carpinteiro': 'Carpintaria',
      'eletricista': 'Instalações Elétricas',
      'encanador': 'Instalações Hidráulicas',
      'pintor': 'Acabamentos',
      'arquiteto': 'Arquitetura',
      'engenheiro': 'Engenharia',
      
      // Tecnologia
      'programador': 'Desenvolvimento de Software',
      'desenvolvedor': 'Desenvolvimento de Software',
      'designer': 'Design',
      'analista': 'Análise de Sistemas',
      
      // Educação
      'professor': 'Ensino',
      'educador': 'Ensino',
      'instrutor': 'Ensino',
    };
    
    // Buscar mapeamento direto
    if (professionToSubgroup[lowerProfession]) {
      return professionToSubgroup[lowerProfession];
    }
    
    // Buscar por contém
    for (const [key, value] of Object.entries(professionToSubgroup)) {
      if (lowerProfession.includes(key) || key.includes(lowerProfession)) {
        return value;
      }
    }
    
    // Se não encontrou, retornar null (será criado baseado na sugestão da IA)
    return null;
  }

  /**
   * DECISÃO SEMÂNTICA: Verifica se a IA pode criar e aprovar automaticamente uma subcategoria
   * 
   * REGRAS DE GOVERNANÇA:
   * - Apenas subcategorias (não raízes) podem ser criadas automaticamente
   * - Raiz deve existir (rootCategoryExists = true)
   * - Confidence deve ser alta (>= 0.85)
   * - Termo deve existir no mundo real (lista de termos conhecidos)
   * 
   * @returns true se pode criar automaticamente como ACTIVE, false caso contrário
   */
  private canAutoCreateSubcategoryWithAI(params: {
    suggestedName: string;
    confidence: number;
    rootCategoryExists: boolean;
  }): boolean {
    // 1. Raiz deve existir (governança: IA não cria raiz)
    if (!params.rootCategoryExists) {
      return false;
    }

    // 2. Confidence deve ser alta (>= 0.85)
    if (params.confidence < 0.85) {
      return false;
    }

    // 3. Termo deve existir no mundo real (lista de termos conhecidos)
    const GLOBAL_KNOWN_TERMS = [
      'dentista',
      'médico',
      'engenheiro',
      'advogado',
      'pedreiro',
      'eletricista',
      'encanador',
      'programador',
      'designer',
      'fisioterapeuta',
      'psicólogo',
      'nutricionista',
      'professor',
      'arquiteto',
      'contador',
      'administrador',
      'esteticista',
      'cabeleireiro'
    ];

    const normalizedName = params.suggestedName.toLowerCase().trim();
    return GLOBAL_KNOWN_TERMS.includes(normalizedName);
  }

  /**
   * IA COMO VALIDADORA: Decide se deve auto-aprovar categoria baseado em:
   * 1. Se já existe no autocomplete (match exato) → NÃO cria
   * 2. Se pode criar automaticamente (canAutoCreateSubcategoryWithAI) → auto-approve
   * 3. Se confidence >= threshold → auto-approve como ACTIVE
   * 4. Se confidence < threshold → PENDING (revisão humana)
   * 
   * REGRAS:
   * - Termos que "existem no mundo real" (pedreiro, médico, futebol) → auto-approve
   * - Termos ambíguos ou novos → revisão humana
   */
  private async shouldAutoApproveSuggestion(
    input: string,
    tenantId: string,
    context: CategoryContext,
    confidence: number,
    suggestedParent: { id: string; name: string; slug: string; path: string[]; level: number } | null
  ): Promise<{ autoApprove: boolean; reason: string }> {
    // 1. Verificar se já existe no autocomplete (match exato)
    const autocompleteResults = await this.autocompleteCategories(input, tenantId, context, 5);
    const exactMatch = autocompleteResults.find(
      r => r.name.toLowerCase() === input.toLowerCase().trim() || r.slug === this.generateSlug(input)
    );
    
    if (exactMatch) {
      return {
        autoApprove: false,
        reason: `Categoria já existe: ${exactMatch.name} (${exactMatch.id})`
      };
    }

    // 2. Se confidence >= threshold de auto-approve E tem parent válido → auto-approve
    if (confidence >= this.CONFIDENCE_THRESHOLD_AUTO_APPROVE && suggestedParent) {
      // Validar se o termo é comum no mundo real
      const commonTerms = [
        // Profissões comuns
        'pedreiro', 'médico', 'enfermeiro', 'professor', 'engenheiro', 'advogado', 'contador',
        'dentista', 'veterinário', 'arquiteto', 'designer', 'programador', 'chef', 'padeiro',
        'cabeleireiro', 'eletricista', 'encanador', 'pintor', 'carpinteiro', 'mecânico',
        'pizzaiolo', 'barbeiro', 'massagista', 'fisioterapeuta', 'psicólogo', 'nutricionista',
        // Interesses comuns
        'futebol', 'basquete', 'vôlei', 'natação', 'corrida', 'ciclismo', 'musculação',
        'leitura', 'cinema', 'música', 'dança', 'teatro', 'fotografia', 'pintura',
        // Educação - Instituições comuns
        'universidade', 'faculdade', 'escola', 'curso', 'graduação', 'pós-graduação',
        'mestrado', 'doutorado', 'técnico', 'ensino médio', 'ensino fundamental',
        'usp', 'unifesp', 'unicamp', 'ufrj', 'ufmg', 'puc', 'mackenzie', 'fiap',
        // Educação - Cursos comuns
        'engenharia', 'medicina', 'direito', 'administração', 'contabilidade', 'pedagogia',
        'psicologia', 'enfermagem', 'fisioterapia', 'nutrição', 'arquitetura', 'design'
      ];
      
      const inputLower = input.toLowerCase().trim();
      const isCommonTerm = commonTerms.some(term => 
        inputLower === term || inputLower.includes(term) || term.includes(inputLower)
      );

      if (isCommonTerm || confidence >= 0.9) {
        return {
          autoApprove: true,
          reason: `Termo comum no mundo real ou confidence alta (${confidence.toFixed(2)})`
        };
      }
    }

    // 3. Caso contrário → revisão humana
    return {
      autoApprove: false,
      reason: `Confidence ${confidence.toFixed(2)} abaixo do threshold ${this.CONFIDENCE_THRESHOLD_AUTO_APPROVE} ou termo não comum`
    };
  }

  /**
   * Normaliza nome para Title Case (ex: "Pedreiro", "Engenharia Civil")
   * CORRIGIDO: Normaliza também para educação (ex: "USP", "Universidade de São Paulo")
   */
  private normalizeNameToTitleCase(name: string): string {
    const trimmed = name.trim();
    
    // Casos especiais: siglas conhecidas
    const knownAcronyms = ['USP', 'UNIFESP', 'UNICAMP', 'UFRJ', 'UFMG', 'PUC', 'FIAP', 'MACKENZIE', 'TI', 'RH', 'CEO', 'CTO'];
    const upperTrimmed = trimmed.toUpperCase();
    if (knownAcronyms.includes(upperTrimmed)) {
      return upperTrimmed;
    }
    
    // Normalizar para Title Case
    return trimmed
      .split(/\s+/)
      .map(word => {
        // Manter palavras em maiúscula se forem siglas (ex: "TI", "RH", "USP")
        if (word.length <= 5 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
          return word;
        }
        // Preposições e artigos em minúscula (ex: "de", "da", "do")
        const lowerWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos'];
        if (lowerWords.includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  /**
   * Verifica se categoria já existe (por slug normalizado ou nome exato)
   * TAREFA A: IDEMPOTÊNCIA - Busca por (slug, parent_id) para evitar duplicação
   */
  private async checkCategoryExists(
    name: string, 
    slug: string, 
    parentId: string | null = null,
    context?: CategoryContext,
    client?: any
  ): Promise<CategoryRow | null> {
    const normalizedSlug = this.generateSlug(slug || name);
    
    // FASE 3.7 — PROPERTY CANÔNICO: Busca por (slug + parent_id) idempotente
    const existing = await this.repository.findBySlugAndParent(
      normalizedSlug,
      parentId ?? null,
      client
    );

    if (existing) {
      return existing;
    }
    
    // Fallback: Buscar por nome exato (case-insensitive) no mesmo nível
    const byName = await this.repository.findByNameAndParent(name, parentId, client);
    if (byName) {
      return byName;
    }
    
    return null;
  }

  /**
   * Análise simples de caminho quando IA não está disponível
   */
  private simpleCategoryPathAnalysis(
    text: string,
    context: CategoryContext,
    categoryTree: CategoryTree[]
  ): {
    rootId?: string;
    rootSlug?: string;
    parentId?: string;
    parentSlug?: string;
    leafName: string;
    leafDescription: string;
    keywords: string[];
    confidence: number;
    reasoning: string;
    level: number;
  } {
    const normalizedName = text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Tentar encontrar categoria relacionada por palavras-chave simples
    let parentSlug: string | null = null;
    let rootSlug: string | null = null;
    let confidence = 0.4; // Baixa confiança para análise simples

    if (context === 'professional') {
      // Procurar em categorias profissionais (nível 1)
      for (const root of categoryTree) {
        if (root.level === 0) {
          for (const child of root.children || []) {
            if (child.level === 1) {
              // Verificar similaridade simples
              const childNameLower = child.name.toLowerCase();
              const textLower = text.toLowerCase();
              if (childNameLower.includes(textLower) || textLower.includes(childNameLower)) {
                parentSlug = child.slug;
                rootSlug = root.slug;
                confidence = 0.5;
                break;
              }
            }
          }
        }
        if (parentSlug) break;
      }
    }

    return {
      parentSlug: parentSlug || undefined,
      rootSlug: rootSlug || undefined,
      leafName: normalizedName,
      leafDescription: `Categoria de ${context}: ${normalizedName}`,
      keywords: [text.toLowerCase(), normalizedName.toLowerCase()],
      confidence,
      reasoning: 'Análise simples por palavras-chave (IA não disponível)',
      level: 2,
    };
  }

  /**
   * IA COMO VALIDADORA: Primeiro verifica autocomplete, depois sugere, depois cria com auto-approve quando apropriado
   * 
   * FLUXO:
   * 1. Verifica autocomplete (se existe → retorna existente)
   * 2. Chama suggestCategoryPath (IA classifica)
   * 3. Verifica shouldAutoApproveSuggestion (decide status)
   * 4. Cria categoria com status apropriado (ACTIVE se auto-approve, PENDING caso contrário)
   * 
   * REGRAS DE BLINDAGEM:
   * - Texto é sanitizado antes de processar
   * - Categoria criada com status baseado em auto-approve
   * - Log completo de origem (actor_id, audio_hash, text_hash)
   * - IA pode criar como ACTIVE se confidence >= threshold e termo comum
   * - IA nunca cria raiz nova
   * - Usa suggestCategoryPath primeiro para classificar
   */
  async createCategoryWithAI(input: {
    text: string;
    context: CategoryContext; // OBRIGATÓRIO: sem default
    parentId?: string | null;
    countryCode?: string | null;
    tenantId?: string;
    actorId?: string;
    globalUserId?: string;
    inputType?: 'text' | 'voice' | 'transcription';
    audioUrl?: string;
    audioHash?: string;
  }): Promise<{
    created: boolean;
    category?: Category;
    existingCategory?: Category;
    message: string;
    suggestedParent?: {
      categoryId: string;
      name: string;
      path: string[];
    } | null;
    requiresApproval: boolean;
  }> {
    const { 
      text, 
      context, // OBRIGATÓRIO: sem default
      parentId, 
      countryCode,
      tenantId,
      actorId,
      globalUserId,
      inputType = 'text',
      audioUrl,
      audioHash,
    } = input;

    // 1. SANITIZAÇÃO: Remover scripts, SQL, URLs e limitar tamanho
    const originalText = text;
    const sanitizedText = this.sanitizeText(text, 500);
    
    if (!sanitizedText || sanitizedText.length < 2) {
      throw new Error('Texto inválido ou muito curto após sanitização');
    }

    // 2. Gerar hashes para rastreamento
    const textHash = this.generateHash(sanitizedText);
    const finalAudioHash = audioHash || (audioUrl ? this.generateHash(audioUrl) : null);

    // 3. VERIFICAR AUTCOMPLETE PRIMEIRO (verdade interna)
    // SSOT: Autocomplete DEVE usar a mesma árvore canônica da navegação
    if (!tenantId) {
      throw new Error('SSOT_VIOLATION: tenantId is mandatory for category reads');
    }
    const autocompleteCheck = await this.autocompleteCategories(sanitizedText, tenantId, context, 5);
    const exactMatch = autocompleteCheck.find(
      r => r.name.toLowerCase() === sanitizedText.toLowerCase().trim() || 
           r.slug === this.generateSlug(sanitizedText)
    );
    
    if (exactMatch) {
      const existingCategory = await this.repository.findById(exactMatch.id);
      if (existingCategory) {
        return {
          created: false,
          existingCategory: CategoryModel.fromRow(existingCategory),
          message: `Categoria "${exactMatch.name}" já existe`,
          suggestedParent: null,
          requiresApproval: false,
        };
      }
    }

    // 3.5. CATEGORY INPUT GATE - ETAPA 1: Bloqueio Léxico Seguro (0-2ms)
    const lexicalCheck = categoryLexicalGateService.validate(sanitizedText);
    if (lexicalCheck.decision === 'DENY') {
      // Auditoria
      await categoryInputAuditService.log({
        inputOriginal: originalText,
        normalized: lexicalCheck.normalized || sanitizedText,
        context,
        decision: 'DENY',
        reasonCode: lexicalCheck.reasonCode,
        lexicalDecision: 'DENY',
        tenantId,
        actorId,
        globalUserId,
      });
      throw new Error(`❌ ${lexicalCheck.reasonCode || 'Termo bloqueado por validação léxica'}`);
    }

    // 3.5.1. HOBBY GATE: Validação específica para hobbies
    if (context === 'hobby') {
      // Usar CategoryInputGateService que já integra HobbyVerbHeuristic + HobbyMatcher
      const { categoryInputGateService } = await import('./category-input-gate.service');
      const { hobbyRateLimitService } = await import('./hobby-rate-limit.service');
      
      // Verificar rate limit (10 tentativas/minuto)
      if (actorId && tenantId) {
        const rateLimitCheck = await hobbyRateLimitService.checkRateLimit(actorId, tenantId);
        if (!rateLimitCheck.allowed) {
          throw new Error(`❌ Limite de tentativas excedido. Aguarde ${Math.ceil((rateLimitCheck.resetAt!.getTime() - Date.now()) / 1000)} segundos.`);
        }
      }

      // Verificar limite de hobbies (máx 30)
      if (globalUserId) {
        const hobbyLimitCheck = await hobbyRateLimitService.checkHobbyLimit(globalUserId);
        if (!hobbyLimitCheck.allowed) {
          throw new Error(`❌ Limite de hobbies atingido (${hobbyLimitCheck.currentCount}/${hobbyLimitCheck.maxCount}). Remova alguns hobbies antes de adicionar novos.`);
        }
      }

      // Validar via CategoryInputGate (inclui HobbyVerbHeuristic + HobbyMatcher)
      // TRAVA: context hardcoded 'hobby' - não criar novos usos hardcoded, context deve ser explícito
      const gateResult = await categoryInputGateService.validate(sanitizedText, {
        context: 'hobby',
        tenantId,
        actorId,
        globalUserId,
      });

      if (gateResult.decision === 'DENY') {
        throw new Error(`❌ ${gateResult.reasonCode || 'Hobby inválido'}. ${gateResult.suggestion || ''}`);
      }

      // Se passou no gate, usar hobby canônico se disponível
      if (gateResult.canonicalHobby) {
        // Usar o hobby canônico do dataset ao invés do input original
        // Isso garante consistência (ex: "violao" → "tocar violão")
        // Mas por enquanto, vamos manter o input original para não quebrar o fluxo
        // O canonicalHobby pode ser usado para sugestão ou normalização futura
      }
    }

    // 3.6. CATEGORY INPUT GATE - ETAPA 2: Occupation Form Check (Sintático)
    let formCheckDecision: 'ALLOW' | 'DENY' = 'ALLOW';
    let formCheckSuggestion: string | undefined;
    if (context === 'professional' || context === 'education' || context === 'company' || context === 'learning') {
      const formCheck = occupationFormCheckerService.validate(sanitizedText, context);
      formCheckDecision = formCheck.decision;
      formCheckSuggestion = formCheck.suggestion;
      if (formCheck.decision === 'DENY') {
        // Auditoria
        await categoryInputAuditService.log({
          inputOriginal: originalText,
          normalized: sanitizedText,
          context,
          decision: 'DENY',
          reasonCode: formCheck.reasonCode,
          lexicalDecision: 'ALLOW',
          formCheckDecision: 'DENY',
          tenantId,
          actorId,
          globalUserId,
        });
        const suggestion = formCheck.suggestion 
          ? ` Use "${formCheck.suggestion}" em vez de "${sanitizedText}".`
          : '';
        throw new Error(`❌ ${formCheck.reasonCode || 'Forma ocupacional inválida'}.${suggestion}`);
      }
    }

    // 3.7. CATEGORY INPUT GATE - ETAPA 3: Busca no CBO (Fuzzy Match)
    // Aplicar apenas para professional e education (não para company)
    let cboMatch: { matched: boolean; canonicalId?: string; cboCode?: string; similarity?: number } | null = null;
    if (context === 'professional' || context === 'education') {
      try {
        cboMatch = await cboMatcherService.findMatch(sanitizedText);
        // Se encontrou match forte no CBO, usar canonical_id (não bloqueia se não encontrar)
      } catch (error) {
        // Erro no CBO não bloqueia - continuar sem match
        console.warn('[CategoryInputGate] Erro ao buscar no CBO:', error);
      }
    }

    // 4. IA COMO CLASSIFICADORA: Usar suggestCategoryPath
    const pathSuggestion = await this.suggestCategoryPath(sanitizedText, context, countryCode);

    // 4.5. FASE 3.8: POLÍTICA DE ADMISSÃO SEMÂNTICA - Validar ANTES de criar hierarquia
    const aiContextForPolicy = {
      suggestedRoot: pathSuggestion.suggestedRoot,
      suggestedParent: pathSuggestion.suggestedParent,
      leafName: pathSuggestion.leafName,
      confidence: pathSuggestion.confidence,
      reasoning: pathSuggestion.reasoning,
    };

    let admissionDecision;
    if (context === 'professional' || context === 'education') {
      admissionDecision = await categoryAdmissionPolicyService.validateProfessionalCategory(
        sanitizedText,
        aiContextForPolicy
      );
    } else if (context === 'company') {
      // Para 'company', usar validação de interesse (mais permissiva, similar a interest)
      admissionDecision = await categoryAdmissionPolicyService.validateInterestCategory(
        sanitizedText,
        aiContextForPolicy
      );
    } else {
      // Para 'interest' ou 'lifestyle', usar validação de interesse (mais permissiva)
      admissionDecision = await categoryAdmissionPolicyService.validateInterestCategory(
        sanitizedText,
        aiContextForPolicy
      );
    }

    // FASE 3.8: Aplicar decisão da política
    if (admissionDecision.decision === 'BLOCK') {
      throw new Error(`❌ ${admissionDecision.reason}`);
    }

    // Se for REVIEW, criar com status 'pending_review' e NÃO criar hierarquia automaticamente
    if (admissionDecision.decision === 'REVIEW') {
      // Para REVIEW, criar apenas a categoria final com status 'pending_review'
      // NÃO chamar ensureCompleteHierarchy
      const normalizedName = this.normalizeNameToTitleCase(pathSuggestion.leafName);
      const normalizedSlug = this.generateSlug(normalizedName);
      
      // Verificar se já existe
      const existingBySlug = await this.checkCategoryExists(normalizedName, normalizedSlug, parentId || null, context);
      if (existingBySlug) {
        return {
          created: false,
          existingCategory: CategoryModel.fromRow(existingBySlug),
          message: `Categoria com slug "${normalizedSlug}" já existe`,
          suggestedParent: pathSuggestion.suggestedParent ? {
            categoryId: pathSuggestion.suggestedParent.id,
            name: pathSuggestion.suggestedParent.name,
            path: pathSuggestion.suggestedParent.path,
          } : null,
          requiresApproval: true,
        };
      }

      // Criar categoria com status 'pending_review'
      const pendingCategory = await this.createCategory(
        {
          name: normalizedName,
          slug: normalizedSlug,
          description: pathSuggestion.leafDescription || `Categoria sugerida: ${sanitizedText} (aguardando revisão)`,
          parentId: parentId || pathSuggestion.suggestedParent?.id || null,
          keywords: pathSuggestion.keywords || [sanitizedText.toLowerCase()],
          countryCode: context === 'education' ? countryCode || null : null,
          allowActive: false, // Não permitir active para REVIEW
        },
        {
          tenantId,
          userId: globalUserId,
          validateAdmin: false,
        }
      );

      // Atualizar status para 'pending_review' explicitamente
      // Usar update direto no banco
      await pool.query(
        `UPDATE categories 
         SET status = $1, requires_review = $2, updated_at = NOW()
         WHERE category_id = $3`,
        ['pending_review', true, pendingCategory.categoryId]
      );

      // Auditoria
      await this.repository.logCategoryCreation({
        categoryId: pendingCategory.categoryId,
        tenantId: tenantId || null,
        actorId: actorId || null,
        globalUserId: globalUserId || null,
        source: 'ai',
        originalText,
        sanitizedText,
        textHash,
        audioHash: finalAudioHash || undefined,
        audioUrl: audioUrl || undefined,
        context,
        aiSuggestion: {
          root: pathSuggestion.suggestedRoot,
          parent: pathSuggestion.suggestedParent,
          leafName: pathSuggestion.leafName,
          reasoning: pathSuggestion.reasoning + ` [POLICY: ${admissionDecision.reason}]`,
        },
        aiConfidence: pathSuggestion.confidence,
      });

      return {
        created: true,
        category: pendingCategory,
        message: `📋 ${admissionDecision.reason}`,
        suggestedParent: pathSuggestion.suggestedParent ? {
          categoryId: pathSuggestion.suggestedParent.id,
          name: pathSuggestion.suggestedParent.name,
          path: pathSuggestion.suggestedParent.path,
        } : null,
        requiresApproval: true,
      };
    }

    // 5. FASE 3.6: GARANTIR hierarquia completa ANTES de criar profissão (apenas se ALLOW)
    // Esta função garante que grupo e subgrupo existam, criando-os se necessário
    // FASE 3.8: Só criar hierarquia se decision === 'ALLOW'
    const { rootId, subgroupId, minConfidence } = await this.ensureCompleteHierarchy(
      sanitizedText,
      context,
      pathSuggestion,
      countryCode,
      tenantId,
      actorId,
      globalUserId
    );

    // 6. Determinar parent final (sempre será o subgrupo garantido)
    const finalParentId = parentId || subgroupId;
    
    // FASE 3.6: VALIDAÇÃO CRÍTICA - NUNCA criar profissão como raiz
    if (!finalParentId) {
      throw new Error('Não é possível criar profissão sem grupo ou subgrupo. A hierarquia deve ser: Grupo → Subgrupo → Profissão');
    }

    // 7. DECISÃO SEMÂNTICA: Verificar se pode criar automaticamente como subcategoria
    // FASE 3.6: rootCategoryExists agora é baseado em rootId garantido
    const rootCategoryExists = !!rootId;
    const canAutoCreate = this.canAutoCreateSubcategoryWithAI({
      suggestedName: pathSuggestion.leafName,
      confidence: minConfidence, // Usar confidence agregado
      rootCategoryExists,
    });

    // 9. IA COMO VALIDADORA: Decidir se auto-aprova (usa decisão semântica se aplicável)
    let autoApproveDecision: { autoApprove: boolean; reason: string };
    if (canAutoCreate && finalParentId) {
      // Se pode criar automaticamente, auto-aprovar
      autoApproveDecision = {
        autoApprove: true,
        reason: `Subcategoria válida criada automaticamente: ${pathSuggestion.leafName} (confidence: ${pathSuggestion.confidence.toFixed(2)})`
      };
    } else {
      // Caso contrário, usar lógica padrão
      autoApproveDecision = await this.shouldAutoApproveSuggestion(
        sanitizedText,
        tenantId!,
        context,
        pathSuggestion.confidence,
        pathSuggestion.suggestedParent
      );
    }

    // 10. Normalizar nome para Title Case
    const normalizedName = this.normalizeNameToTitleCase(pathSuggestion.leafName);
    const normalizedSlug = this.generateSlug(normalizedName);

    // 11. Verificar duplicata (por slug, nome exato ou similar)
    const existingBySlug = await this.checkCategoryExists(normalizedName, normalizedSlug, finalParentId, context);
    if (existingBySlug) {
      return {
        created: false,
        existingCategory: CategoryModel.fromRow(existingBySlug),
        message: `Categoria com slug "${normalizedSlug}" já existe`,
        suggestedParent: pathSuggestion.suggestedParent ? {
          categoryId: pathSuggestion.suggestedParent.id,
          name: pathSuggestion.suggestedParent.name,
          path: pathSuggestion.suggestedParent.path,
        } : null,
        requiresApproval: false,
      };
    }

    // 12. FASE 3.6: Criar categoria final (Profissão) com status baseado em auto-approve
    // REGRA FASE 3.6: TODAS as categorias criadas pela IA devem ter status 'auto_active'
    // 'auto_active' = criado pela IA, utilizável imediatamente, revisável depois
    // NÃO bloquear uso do sistema quando status = auto_active
    // FASE 3.6: Confidence agregado = mínimo entre todos os níveis criados
    // SEMPRE usar 'auto_active' para categorias criadas por IA (independente da confidence)
    const requiresReview = false; // FASE 3.6: Categorias criadas por IA não bloqueiam fluxo
    const status = 'auto_active'; // FASE 3.6: SEMPRE auto_active para categorias criadas por IA
    
    const newCategory = await this.createCategory(
      {
        name: normalizedName,
        slug: normalizedSlug,
        description: pathSuggestion.leafDescription || `Categoria criada automaticamente para: ${sanitizedText}`,
        parentId: finalParentId,
        keywords: pathSuggestion.keywords || [sanitizedText.toLowerCase()],
        countryCode: context === 'education' ? countryCode || null : null,
        allowActive: true, // FASE 3.6: Sempre permitir auto_active para categorias criadas por IA
      },
      {
        tenantId,
        userId: globalUserId,
        validateAdmin: false, // Auto-approve não precisa validação admin
        context,
        skipGate: true, // Já passou pelo gate antes, não precisa validar novamente
      }
    );

    // 12. AUDITORIA: Registrar origem completa
    // FASE 3.6: Confidence agregado = mínimo entre todos os níveis criados (raiz, subgrupo, profissão)
    const aggregatedConfidence = Math.min(minConfidence, pathSuggestion.confidence);
    
    // Auditoria completa do Category Input Gate
    await categoryInputAuditService.log({
      inputOriginal: originalText,
      normalized: sanitizedText,
      context,
      decision: 'ALLOW',
      confidence: aggregatedConfidence,
      canonicalId: cboMatch?.canonicalId,
      lexicalDecision: 'ALLOW',
      formCheckDecision,
      cboMatchCode: cboMatch?.cboCode,
      tenantId,
      actorId,
      globalUserId,
    });
    
    await this.repository.logCategoryCreation({
      categoryId: newCategory.categoryId,
      tenantId: tenantId || null,
      actorId: actorId || null,
      globalUserId: globalUserId || null,
      source: 'ai',
      originalText,
      sanitizedText,
      textHash,
      audioHash: finalAudioHash || undefined,
      audioUrl: audioUrl || undefined,
      context,
      aiSuggestion: {
        root: pathSuggestion.suggestedRoot,
        parent: pathSuggestion.suggestedParent,
        leafName: pathSuggestion.leafName,
        reasoning: pathSuggestion.reasoning + ' [Hierarquia completa garantida: Grupo + Subgrupo + Profissão]',
      },
      aiConfidence: aggregatedConfidence, // Confidence agregado
    });

    // 13. Preparar resposta
    const suggestedParent = pathSuggestion.suggestedParent ? {
      categoryId: pathSuggestion.suggestedParent.id,
      name: pathSuggestion.suggestedParent.name,
      path: pathSuggestion.suggestedParent.path,
    } : null;

    return {
      created: true,
      category: newCategory,
      message: `Categoria "${normalizedName}" criada automaticamente pela IA e disponível imediatamente (confidence: ${(aggregatedConfidence * 100).toFixed(0)}%)`,
      suggestedParent,
      requiresApproval: false, // FASE 3.6: Categorias criadas por IA não requerem aprovação prévia
    };
  }

  /**
   * Cria categoria com status 'pending' e requires_review configurável
   * Usado exclusivamente para categorias criadas por IA
   */
  private async createCategoryPending(
    input: CreateCategoryInput,
    requiresReview: boolean = true
  ): Promise<Category> {
    // VALIDAÇÃO OBRIGATÓRIA: name deve ser string não vazia
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new Error('Nome da categoria é obrigatório e deve ser uma string não vazia');
    }
    
    // Normalizar name
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error('Nome da categoria não pode ser vazio após normalização');
    }
    
    const slug = input.slug || this.generateSlug(name);
    // PROPERTY: Verificação contextual por (slug, parent_id) - não busca global
    const parentId = input.parentId ?? null;
    const existing = await this.repository.findBySlugAndParent(slug, parentId);
    if (existing) {
      // PROPERTY: Idempotência - retornar existente ao invés de erro
      return CategoryModel.fromRow(existing);
    }

    if (input.parentId) {
      const parent = await this.repository.findById(input.parentId);
      if (!parent) {
        throw new Error('Categoria pai não encontrada');
      }
    }
    const level = await this.calculateLevel(parentId);
    const path = parentId ? await this.calculatePath(parentId) : [];

    // Usar método create com status pending
    const row = await this.repository.create({
      name: name,
      slug,
      description: input.description ?? null,
      parentId,
      level,
      path,
      keywords: input.keywords || [],
      countryCode: input.countryCode || null,
      status: 'pending',
      requiresReview,
      createdByAI: true,
    });

    const finalPath = [...path, slug];
    await this.repository.update(row.category_id, { path: finalPath });

    // CACHE: Invalidar cache ao criar categoria (mesmo que seja pending)
    this.invalidateCategoryCache();

    return CategoryModel.fromRow({ ...row, path: finalPath });
  }

  /**
   * Análise simples de categoria quando IA não está disponível
   */
  private simpleCategoryAnalysis(
    text: string,
    context: CategoryContext,
    categoryTree: CategoryTree[]
  ): {
    name: string;
    description: string;
    parentSlug: string | null;
    keywords: string[];
    level: number;
  } {
    // Normalizar nome (primeira letra maiúscula)
    const normalizedName = text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Tentar encontrar categoria pai apropriada baseado no contexto
    let parentSlug: string | null = null;
    let level = 2; // Assumir nível 2 (profissão específica) por padrão

    if (context === 'professional') {
      // Procurar categorias de nível 1 (áreas profissionais)
      const professionalAreas = categoryTree.filter(cat => cat.level === 1);
      // Tentar encontrar área relacionada (análise simples)
      // Por enquanto, deixar null e deixar IA decidir
    }

    return {
      name: normalizedName,
      description: `Categoria de ${context}: ${normalizedName}`,
      parentSlug,
      keywords: [text.toLowerCase(), normalizedName.toLowerCase()],
      level,
    };
  }

  /**
   * Aprova uma categoria pendente criada por IA
   * REGRAS: Apenas categorias com status 'pending' e requires_review = true podem ser aprovadas
   */
  async approveCategory(categoryId: string, approvedByUserId: string): Promise<Category> {
    // CACHE: Invalidar cache ao aprovar categoria
    this.invalidateCategoryCache();
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    // Verificar se está pendente
    const categoryRow = await this.repository.findById(categoryId);
    if (!categoryRow) {
      throw new Error('Categoria não encontrada');
    }

    // Verificar status via query direta (campos novos podem não estar no tipo ainda)
    const statusCheck = await pool.query(
      `
      SELECT status, requires_review, created_by_ai
      FROM categories
      WHERE category_id = $1
      `,
      [categoryId]
    );

    if (!statusCheck || statusCheck.rows.length === 0) {
      throw new Error('Categoria não encontrada');
    }

    const statusData = statusCheck.rows[0] as any;
    if (statusData.status !== 'pending' || !statusData.requires_review) {
      throw new Error('Apenas categorias pendentes podem ser aprovadas');
    }

    // Atualizar status para 'active'
    await pool.query(
      `
      UPDATE categories
      SET status = 'active',
          requires_review = false,
          approved_by = $1,
          approved_at = now(),
          updated_at = now()
      WHERE category_id = $2
      `,
      [approvedByUserId, categoryId]
    );

    const updated = await this.getCategoryById(categoryId);
    if (!updated) {
      throw new Error('Erro ao atualizar categoria');
    }

    return updated;
  }

  /**
   * Rejeita uma categoria pendente criada por IA
   */
  async rejectCategory(categoryId: string, reason: string): Promise<Category> {
    // CACHE: Invalidar cache ao rejeitar categoria (pode ter sido aprovada antes)
    this.invalidateCategoryCache();
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    // Verificar status
    const statusCheck = await pool.query(
      `
      SELECT status, requires_review
      FROM categories
      WHERE category_id = $1
      `,
      [categoryId]
    );

    if (!statusCheck || statusCheck.rows.length === 0) {
      throw new Error('Categoria não encontrada');
    }

    const statusData = statusCheck.rows[0] as any;
    if (statusData.status !== 'pending') {
      throw new Error('Apenas categorias pendentes podem ser rejeitadas');
    }

    // Atualizar status para 'rejected'
    await pool.query(
      `
      UPDATE categories
      SET status = 'rejected',
          requires_review = false,
          rejection_reason = $1,
          updated_at = now()
      WHERE category_id = $2
      `,
      [reason, categoryId]
    );

    const updated = await this.getCategoryById(categoryId);
    if (!updated) {
      throw new Error('Erro ao atualizar categoria');
    }

    return updated;
  }

  /**
   * Lista categorias pendentes de aprovação
   */
  async getPendingCategories(): Promise<Category[]> {
    const result = await pool.query<CategoryRow>(
      `
      SELECT 
        category_id, parent_id, name, slug, description, level, path,
        COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code,
        status, requires_review, created_by_ai, approved_by, approved_at, rejection_reason,
        created_at, updated_at
      FROM categories
      WHERE status = 'pending' AND requires_review = true
      ORDER BY created_at DESC
      `
    );

    return result.rows.map((row) => CategoryModel.fromRow(row));
  }

  /**
   * Verifica quantas categorias existem no banco
   * Usado para detectar se seeds foram aplicados
   */
  async getCategoryCount(): Promise<number> {
    try {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM categories`
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      console.error('[CategoriesService] Erro ao contar categorias:', error);
      return 0;
    }
  }

  /**
   * Cria categorias básicas automaticamente se a tabela estiver vazia
   * FALLBACK: Usado quando seeds não foram aplicados
   */
  async ensureBasicCategories(): Promise<void> {
    const count = await this.getCategoryCount();
    if (count > 0) {
      // Já existem categorias, não precisa criar
      return;
    }

    console.log('[CategoriesService] Tabela categories vazia - criando categorias básicas...');

    try {
      // Criar categorias raiz básicas
      const roots = [
        { name: 'Profissional', slug: 'profissional', description: 'Categorias relacionadas à vida profissional' },
        { name: 'Pessoal', slug: 'pessoal', description: 'Categorias relacionadas à vida pessoal' },
        { name: 'Físico', slug: 'fisico', description: 'Categorias relacionadas ao bem-estar físico' },
        { name: 'Aprendizado', slug: 'aprendizado', description: 'Categorias relacionadas ao aprendizado e educação' },
      ];

      for (const root of roots) {
        try {
          await this.createCategory(
            {
              name: root.name,
              slug: root.slug,
              description: root.description,
              parentId: null,
              allowActive: true, // Criar como ativa automaticamente
            },
            {
              validateAdmin: false, // Skip admin validation para criação automática
              context: 'professional', // Context padrão
              skipGate: true, // Pular gate para criação automática
            }
          );
        } catch (error) {
          // Se já existe, ignorar
          if (error instanceof Error && error.message.includes('already exists')) {
            continue;
          }
          console.error(`[CategoriesService] Erro ao criar categoria ${root.name}:`, error);
        }
      }

      console.log('[CategoriesService] ✅ Categorias básicas criadas com sucesso');
    } catch (error) {
      console.error('[CategoriesService] ❌ Erro ao criar categorias básicas:', error);
      throw error;
    }
  }
}

export const categoriesService = new CategoriesService();



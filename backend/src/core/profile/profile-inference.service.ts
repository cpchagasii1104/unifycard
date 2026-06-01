// src/core/profile/profile-inference.service.ts
// Motor de inferência entre trilhas - observa padrões sem forçar ações
//
// 🔴 BLINDAGEM CANÔNICA: Educação NÃO participa de inferências
// - Inferências usam apenas: physical, learning, professional
// - Educação não influencia estado do usuário, não gera sugestões
// - Por que isso NÃO pode virar decisão: educação é temporal/declarativa, não estado atual
//
// 🔴 BLINDAGEM CANÔNICA: Aprendizado representa direção e interesse declarado
// - Progresso (beginner/intermediate/advanced) representa fase de exploração, não capacidade
// - beginner = explorando (interesse inicial)
// - intermediate = praticando (direção ativa)
// - advanced = aprofundando (direção consolidada)
// - NÃO mede capacidade, NÃO valida competência, apenas indica fase de interesse
// - Sugestões são baseadas em direção, não em validação de nível

import { CategoryContext } from '@unificard/contracts';
import {
  createSemanticResolutionCache,
  resolveConceptFromCategoryCached,
  resolveConceptFromSlugCached,
  type SemanticResolutionCache,
} from '@core/semantic/semantic.adapter';
import {
  getRelatedConcepts,
  getCategoryRow,
  type ConceptRelation,
  type GraphRelationType,
} from '@core/semantic/graph.adapter';
import { SemanticResolutionError } from '@core/semantic/semantic.errors';
import { upsertTenantMetrics } from '@core/semantic/semantic-metrics.repository';
import { resolveSemanticPolicy, type SemanticPolicy } from '@core/semantic/semantic.policy';
// F2 (DECISION-0069): Learning/Interest do snapshot vêm do C1 actor-first/concept-first via helper de
// leitura (não mais de getLearningProfile/getPhysicalProfile, que liam o blob hoje vazio). Professional
// permanece separado. `resolveConceptFromCategoryCached` segue importado (usado só em findCategoryBySlug
// para resolver a categoria-ALVO da sugestão — não a declaração C1).
import { profileC1DeclarationsReadService } from './profile-c1-declarations-read.service';
import { profileProfessionalService } from './profile-professional.service';
import type {
  UserState,
  UserProfileSnapshot,
  InferenceSuggestion,
  InferenceResult,
} from './profile-inference.types';

type SemanticFallbackReason =
  | 'missing_concept'
  | 'no_graph_or_slug'
  | 'hierarchy_gap'
  | 'mismatch';

type SemanticInferenceContext = {
  resolutionCache: SemanticResolutionCache;
  graphCache: Map<string, ConceptRelation[]>;
  /** Política efetiva (env + opcional override por tenant) para esta geração. */
  policy: SemanticPolicy;
  decisionStats: {
    graphSuccess: number;
    slugFallback: number;
    graphMissing: number;
  };
  fallbackCounts: {
    affinityPhysical: number;
    affinityLearning: number;
    findCategoryBySlug: number;
  };
  fallbackByReason: Partial<Record<SemanticFallbackReason, number>>;
};

class ProfileInferenceService {
  private createSemanticInferenceContext(policy: SemanticPolicy): SemanticInferenceContext {
    return {
      resolutionCache: createSemanticResolutionCache(),
      graphCache: new Map(),
      policy,
      decisionStats: {
        graphSuccess: 0,
        slugFallback: 0,
        graphMissing: 0,
      },
      fallbackCounts: {
        affinityPhysical: 0,
        affinityLearning: 0,
        findCategoryBySlug: 0,
      },
      fallbackByReason: {},
    };
  }

  private async getRelatedConceptsCached(
    ctx: SemanticInferenceContext,
    conceptId: string,
    relationTypes: GraphRelationType[],
  ): Promise<ConceptRelation[]> {
    const key = `${conceptId}::${[...relationTypes].sort().join(',')}`;
    const hit = ctx.graphCache.get(key);
    if (hit) {
      return hit;
    }
    const rows = await getRelatedConcepts(conceptId, { relationTypes });
    ctx.graphCache.set(key, rows);
    return rows;
  }

  private bumpFallback(
    ctx: SemanticInferenceContext,
    bucket: keyof SemanticInferenceContext['fallbackCounts'],
    reason: SemanticFallbackReason,
    detail: string,
  ): void {
    ctx.fallbackCounts[bucket] += 1;
    ctx.fallbackByReason[reason] = (ctx.fallbackByReason[reason] ?? 0) + 1;
    console.log(`[semantic] DECISION=fallback reason=${reason} bucket=${bucket} ${detail}`);
  }

  private logSemanticFallbackSummary(
    ctx: SemanticInferenceContext,
    tenantId: string,
  ): void {
    const { affinityPhysical, affinityLearning, findCategoryBySlug } = ctx.fallbackCounts;
    const total = affinityPhysical + affinityLearning + findCategoryBySlug;
    console.log(
      `[semantic] FALLBACK_STATS tenant=${tenantId} total=${total} affinity.physical=${affinityPhysical} affinity.learning=${affinityLearning} findCategoryBySlug=${findCategoryBySlug} byReason=${JSON.stringify(ctx.fallbackByReason)}`,
    );
  }

  private logSemanticDecisionStats(ctx: SemanticInferenceContext, tenantId: string): void {
    const g = ctx.decisionStats.graphSuccess;
    const s = ctx.decisionStats.slugFallback;
    const m = ctx.decisionStats.graphMissing;
    const t = g + s;
    const pg = t > 0 ? ((g / t) * 100).toFixed(1) : '0.0';
    const ps = t > 0 ? ((s / t) * 100).toFixed(1) : '0.0';
    console.log(
      `[semantic] DECISION_STATS tenant=${tenantId} graph_success=${g} (${pg}%) slug_fallback=${s} (${ps}%) graph_missing_events=${m} total_resolved=${t}`,
    );
  }

  /**
   * Se slug fallback está proibido pela política, falha explícita (Lei 7 / operações).
   * Quando há concept_id mas o grafo não resolveu, incrementa graphMissing.
   */
  private assertSlugFallbackAllowed(
    policy: SemanticPolicy,
    ctx: SemanticInferenceContext,
    tenantId: string,
    traceLabel: string,
    fromConceptId: string | null,
    categoryContext: CategoryContext,
    candidates: string[],
    relationTypesExpected: GraphRelationType[] | undefined,
  ): void {
    if (fromConceptId) {
      ctx.decisionStats.graphMissing += 1;
    }
    if (!policy.allowSlugFallback) {
      console.error(
        `[semantic][ERROR] missing graph relation trace=${traceLabel} tenant=${tenantId} fromConceptId=${fromConceptId ?? 'null'} candidates=${candidates.slice(0, 5).join(',')}`,
      );
      throw new SemanticResolutionError({
        type: 'MISSING_GRAPH_RELATION',
        context: {
          fromConceptId,
          attemptedTarget: {
            trace: traceLabel,
            tenantId,
            categoryContext,
            slugCandidates: candidates,
            relationTypesExpected,
          },
        },
      });
    }
  }

  /**
   * Candidatos de slug para fallback (path do mais específico ao raiz + extras + nome normalizado).
   */
  private buildSlugCandidates(path: string[], name: string, extraSlugs: string[] = []): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const t = raw?.trim();
      if (!t || seen.has(t)) {
        return;
      }
      seen.add(t);
      out.push(t);
    };
    for (const s of [...path].reverse()) {
      push(s);
    }
    for (const s of extraSlugs) {
      push(s);
    }
    const fromName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    if (fromName) {
      push(fromName);
    }
    return out;
  }

  private async resolveTargetBySlugCandidates(
    ctx: SemanticInferenceContext,
    tenantId: string,
    context: CategoryContext,
    candidates: string[],
    traceLabel: string,
    policy: SemanticPolicy,
  ): Promise<{ categoryId: string; name: string; path: string[] } | null> {
    if (!policy.allowSlugFallback) {
      return null;
    }
    for (const slug of candidates) {
      const row = await this.findCategoryBySlug(ctx, tenantId, slug, context);
      if (row) {
        const msg = `slug_fallback trace=${traceLabel} matched_slug=${slug} tenant=${tenantId}`;
        if (policy.logFallbackAsError) {
          console.error(`[semantic][ERROR] fallback used ${msg}`);
        } else {
          console.warn(`[semantic][WARN] fallback used ${msg}`);
        }
        console.log(`[semantic] DECISION=slug_fallback ${traceLabel} matched_slug=${slug}`);
        ctx.decisionStats.slugFallback += 1;
        return row;
      }
    }
    return null;
  }

  /**
   * Busca snapshot completo do perfil do usuário
   */
  async getUserProfileSnapshot(
    tenantId: string,
    userId: string
  ): Promise<UserProfileSnapshot> {
    const [decls, professional] = await Promise.all([
      // C1 actor-first/concept-first (DECISION-0069): Learning + Interest do actor 'user'. Sem actor /
      // sem declaração ⇒ vazio controlado (não 500). conceptId é a identidade; sourceCategoryId breadcrumb.
      profileC1DeclarationsReadService.getUserActorConceptDeclarationsForProfile(tenantId, userId),
      // Bloco profissional depende de serviço legado morto; degrada SÓ ele.
      profileProfessionalService.getProfessionalProfile(tenantId, userId).catch(() => ({ skills: [], count: 0 })),
    ]);

    // Mapeia C1 → snapshot. conceptId = identidade; categoryId/categoryName = breadcrumb (null → '' p/
    // backcompat do contrato, NUNCA identidade). categoryPath sempre array.
    const interests = decls.interests.map((i) => ({
      conceptId: i.conceptId,
      categoryId: i.sourceCategoryId ?? '',
      categoryName: i.categoryName ?? '',
      categoryPath: i.categoryPath,
    }));
    const learnings = decls.learning.map((l) => ({
      conceptId: l.conceptId,
      categoryId: l.sourceCategoryId ?? '',
      categoryName: l.categoryName ?? '',
      categoryPath: l.categoryPath,
      progress: l.progress,
    }));

    return {
      physical: {
        interests,
        count: interests.length,
      },
      learning: {
        learnings,
        count: learnings.length,
        hasIntermediateOrAdvanced: learnings.some(
          (l) => l.progress === 'intermediate' || l.progress === 'advanced'
        ),
      },
      professional: {
        skills: professional?.skills || [],
        count: professional?.skills?.length || 0,
      },
      lastUpdated: {
        physical: decls.actorId ? new Date().toISOString() : undefined,
        learning: decls.actorId ? new Date().toISOString() : undefined,
        professional: professional ? new Date().toISOString() : undefined,
      },
    };
  }

  /**
   * Detecta o estado atual do usuário
   * Método público para uso externo
   */
  detectUserState(snapshot: UserProfileSnapshot): UserState {
    const { physical, learning, professional } = snapshot;

    // Em Risco: Profissional intenso sem Físico
    if (professional.count > 0 && physical.count === 0) {
      return 'at_risk';
    }

    // Profissional Estável: Apenas Profissional
    if (professional.count > 0 && learning.count === 0 && physical.count === 0) {
      return 'professional_stable';
    }

    // Profissional em Formação: Aprendizado + Profissional
    if (learning.count > 0 && professional.count > 0) {
      return 'professional_training';
    }

    // Em Transição: Aprendizado ativo, sem Profissional
    if (learning.count > 0 && professional.count === 0) {
      return 'in_transition';
    }

    // Curioso: Físico + Aprendizado
    if (physical.count > 0 && learning.count > 0) {
      return 'curious';
    }

    // Explorador: Apenas Físico
    if (physical.count > 0 && learning.count === 0 && professional.count === 0) {
      return 'explorer';
    }

    // Default: Explorador
    return 'explorer';
  }

  /**
   * Gera sugestões baseadas no estado e padrões do usuário
   */
  async generateSuggestions(
    tenantId: string,
    userId: string
  ): Promise<InferenceSuggestion[]> {
    const policy = await resolveSemanticPolicy({ tenantId });
    const ctx = this.createSemanticInferenceContext(policy);
    const snapshot = await this.getUserProfileSnapshot(tenantId, userId);
    const suggestions: InferenceSuggestion[] = [];

    // REGRA A: Físico → Aprendizado
    if (snapshot.physical.count > 0 && snapshot.learning.count === 0) {
      const physicalInterests = snapshot.physical.interests;
      
      for (const interest of physicalInterests) {
        // concept-first (DECISION-0069): conceptId vem direto do C1 (identidade); categoryPath/Name e o
        // breadcrumb categoryId só alimentam o fallback de slug. NÃO resolver concept a partir de categoryId.
        const { target: learningCategory } = await this.resolvePhysicalToLearningTarget(
          ctx,
          tenantId,
          interest.conceptId,
          interest.categoryPath,
          interest.categoryName,
          interest.categoryId,
        );

        if (learningCategory) {
          suggestions.push({
            id: `physical_to_learning_${interest.conceptId}`,
            type: 'physical_to_learning',
            title: 'Quer aprender mais sobre isso?',
            message: `Você gosta de "${interest.categoryName || 'isso'}". Que tal explorar isso como aprendizado?`,
            actionLabel: 'Ver temas de aprendizado',
            categoryId: learningCategory.categoryId,
            categoryName: learningCategory.name,
            categoryPath: learningCategory.path,
            priority: 7,
            dismissible: true,
          });
          break; // Uma sugestão por vez
        }
      }
    }

    // REGRA B: Aprendizado (em fase de aprofundamento) → Sugestão Profissional
    // 🔴 BLINDAGEM CANÔNICA: Progresso representa direção/fase de exploração, não capacidade
    // - beginner = explorando (interesse inicial)
    // - intermediate = praticando (direção ativa)
    // - advanced = aprofundando (direção consolidada)
    // NÃO mede capacidade, NÃO valida competência, apenas indica fase de interesse
    if (snapshot.learning.hasIntermediateOrAdvanced && snapshot.professional.count === 0) {
      const advancedLearnings = snapshot.learning.learnings.filter(
        (l) => l.progress === 'intermediate' || l.progress === 'advanced'
      );
      
      if (advancedLearnings.length > 0) {
        const learning = advancedLearnings[0];

        // concept-first (DECISION-0069): conceptId direto do C1; breadcrumb só para fallback de slug.
        const { target: professionalCategory } = await this.resolveLearningToProfessionalTarget(
          ctx,
          tenantId,
          learning.conceptId,
          learning.categoryPath,
          learning.categoryName,
          learning.categoryId,
        );

        if (professionalCategory) {
          // 🔴 BLINDAGEM: Mensagem não menciona "nível" como capacidade
          const phaseLabel = learning.progress === 'intermediate' ? 'praticando' : 'aprofundando';
          suggestions.push({
            id: `learning_to_professional_${learning.conceptId}`,
            type: 'learning_to_professional',
            title: 'Você já pensou em usar isso profissionalmente?',
            message: `Você está ${phaseLabel} "${learning.categoryName || 'isso'}". Que tal considerar isso como profissão?`,
            actionLabel: 'Ver profissões relacionadas',
            categoryId: professionalCategory.categoryId,
            categoryName: professionalCategory.name,
            categoryPath: professionalCategory.path,
            priority: 8,
            dismissible: true,
          });
        }
      }
    }

    // REGRA C: Profissional sem Físico
    if (snapshot.professional.count > 0 && snapshot.physical.count === 0) {
      suggestions.push({
        id: 'professional_needs_physical',
        type: 'professional_needs_physical',
        title: 'O que você gosta de fazer fora do trabalho?',
        message: 'Conte-nos sobre suas atividades de prazer. Isso nos ajuda a conhecer você melhor.',
        actionLabel: 'Adicionar atividades de prazer',
        priority: 6,
        dismissible: true,
      });
    }

    // REGRA D: Aprendizado Estagnado (verificar se não foi atualizado há muito tempo)
    // Por enquanto, não implementamos detecção de tempo, mas a estrutura está pronta

    this.logSemanticFallbackSummary(ctx, tenantId);
    this.logSemanticDecisionStats(ctx, tenantId);

    void upsertTenantMetrics(tenantId, {
      graphSuccess: ctx.decisionStats.graphSuccess,
      slugFallback: ctx.decisionStats.slugFallback,
      graphMissing: ctx.decisionStats.graphMissing,
    }).catch((err) => {
      console.error('[semantic] tenant_semantic_metrics upsert failed', err);
    });

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Busca inferências completas para o usuário
   * Filtra sugestões já dispensadas
   */
  async getInferences(
    tenantId: string,
    userId: string
  ): Promise<InferenceResult> {
    const snapshot = await this.getUserProfileSnapshot(tenantId, userId);
    const userState = this.detectUserState(snapshot);
    const allSuggestions = await this.generateSuggestions(tenantId, userId);
    
    // Filtrar sugestões já dispensadas
    const suggestions = await this.filterDismissedSuggestions(tenantId, userId, allSuggestions);

    return {
      userState,
      suggestions,
      insights: {
        hasPhysicalWithoutLearning: snapshot.physical.count > 0 && snapshot.learning.count === 0,
        hasLearningWithoutProfessional: snapshot.learning.count > 0 && snapshot.professional.count === 0,
        hasProfessionalWithoutPhysical: snapshot.professional.count > 0 && snapshot.physical.count === 0,
        learningStagnant: false, // TODO: Implementar detecção de tempo
      },
    };
  }

  /**
   * Físico → aprendizado: graph (enables) → fallback por candidatos de slug (path / categoria / nome).
   */
  private async resolvePhysicalToLearningTarget(
    ctx: SemanticInferenceContext,
    tenantId: string,
    conceptId: string,
    path: string[],
    name: string,
    sourceCategoryId: string,
  ): Promise<{
    target: { categoryId: string; name: string; path: string[] } | null;
  }> {
    // concept-first (DECISION-0069): conceptId vem direto do C1; NÃO resolver concept a partir de categoryId.
    // O breadcrumb (sourceCategoryId) só serve para extrair o slug da categoria de origem para o fallback.
    const interestRow = sourceCategoryId ? await getCategoryRow(sourceCategoryId) : null;
    const extraSlugs = interestRow?.slug ? [interestRow.slug] : [];
    const candidates = this.buildSlugCandidates(path, name, extraSlugs);

    if (conceptId) {
      const edges = await this.getRelatedConceptsCached(ctx, conceptId, [
        'enables',
      ]);
      for (const e of edges) {
        const row = await getCategoryRow(e.toCategoryId);
        if (row && row.conceptId === e.relatedConceptId) {
          console.log(
            `[semantic][INFO] graph decision physical→learning from_concept=${conceptId} to_category=${e.toCategoryId} relation=${e.relationType}`,
          );
          ctx.decisionStats.graphSuccess += 1;
          return {
            target: {
              categoryId: row.categoryId,
              name: row.name,
              path: row.path,
            },
          };
        }
      }

      this.assertSlugFallbackAllowed(
        ctx.policy,
        ctx,
        tenantId,
        'physical→learning',
        conceptId,
        'learning',
        candidates,
        ['enables'],
      );
      const lc = await this.resolveTargetBySlugCandidates(
        ctx,
        tenantId,
        'learning',
        candidates,
        'physical→learning',
        ctx.policy,
      );
      if (lc) {
        return { target: lc };
      }

      this.bumpFallback(
        ctx,
        'affinityPhysical',
        'no_graph_or_slug',
        `sourceCategoryId=${sourceCategoryId || 'null'} concept_id=${conceptId}`,
      );
      return { target: null };
    }

    this.bumpFallback(
      ctx,
      'affinityPhysical',
      'missing_concept',
      `sourceCategoryId=${sourceCategoryId || 'null'} slug fallback (no conceptId)`,
    );
    this.assertSlugFallbackAllowed(
      ctx.policy,
      ctx,
      tenantId,
      'physical→learning (no concept)',
      null,
      'learning',
      candidates,
      undefined,
    );
    const lc = await this.resolveTargetBySlugCandidates(
      ctx,
      tenantId,
      'learning',
      candidates,
      'physical→learning (no concept)',
      ctx.policy,
    );
    return { target: lc };
  }

  /**
   * Aprendizado → profissional: graph (evolves_to) → fallback por candidatos de slug.
   */
  private async resolveLearningToProfessionalTarget(
    ctx: SemanticInferenceContext,
    tenantId: string,
    conceptId: string,
    path: string[],
    name: string,
    sourceCategoryId: string,
  ): Promise<{
    target: { categoryId: string; name: string; path: string[] } | null;
  }> {
    // concept-first (DECISION-0069): conceptId direto do C1; breadcrumb (sourceCategoryId) só p/ slug.
    const learnRow = sourceCategoryId ? await getCategoryRow(sourceCategoryId) : null;
    const extraSlugs = learnRow?.slug ? [learnRow.slug] : [];
    const candidates = this.buildSlugCandidates(path, name, extraSlugs);

    if (conceptId) {
      const edges = await this.getRelatedConceptsCached(ctx, conceptId, [
        'evolves_to',
      ]);
      for (const e of edges) {
        const row = await getCategoryRow(e.toCategoryId);
        if (row && row.conceptId === e.relatedConceptId) {
          console.log(
            `[semantic][INFO] graph decision learning→professional from_concept=${conceptId} to_category=${e.toCategoryId} relation=${e.relationType}`,
          );
          ctx.decisionStats.graphSuccess += 1;
          return {
            target: {
              categoryId: row.categoryId,
              name: row.name,
              path: row.path,
            },
          };
        }
      }

      this.assertSlugFallbackAllowed(
        ctx.policy,
        ctx,
        tenantId,
        'learning→professional',
        conceptId,
        'professional',
        candidates,
        ['evolves_to'],
      );
      const pc = await this.resolveTargetBySlugCandidates(
        ctx,
        tenantId,
        'professional',
        candidates,
        'learning→professional',
        ctx.policy,
      );
      if (pc) {
        return { target: pc };
      }

      this.bumpFallback(
        ctx,
        'affinityLearning',
        'no_graph_or_slug',
        `sourceCategoryId=${sourceCategoryId || 'null'} concept_id=${conceptId}`,
      );
      return { target: null };
    }

    this.bumpFallback(
      ctx,
      'affinityLearning',
      'missing_concept',
      `sourceCategoryId=${sourceCategoryId || 'null'} slug fallback (no conceptId)`,
    );
    this.assertSlugFallbackAllowed(
      ctx.policy,
      ctx,
      tenantId,
      'learning→professional (no concept)',
      null,
      'professional',
      candidates,
      undefined,
    );
    const pc = await this.resolveTargetBySlugCandidates(
      ctx,
      tenantId,
      'professional',
      candidates,
      'learning→professional (no concept)',
      ctx.policy,
    );
    return { target: pc };
  }

  /**
   * Resolve categoria alvo por slug global (UNIQUE em categories); fallback findBySlug legado alinhado ao repositório.
   */
  private async findCategoryBySlug(
    ctx: SemanticInferenceContext,
    _tenantId: string,
    slug: string,
    context: CategoryContext,
  ): Promise<{ categoryId: string; name: string; path: string[] } | null> {
    try {
      const { CategoryRepository } = await import('../categories/categories.repository');
      const repository = new CategoryRepository();

      const slugResolution = await resolveConceptFromSlugCached(slug, ctx.resolutionCache);

      if (slugResolution.conceptId && slugResolution.categoryId) {
        const row = await repository.findById(slugResolution.categoryId);
        if (row) {
          console.log(
            `[semantic] DECISION=concept_id findCategoryBySlug context=${context} concept_id=${slugResolution.conceptId} category_id=${row.category_id} slug=${slug} source=global_slug`,
          );
          return {
            categoryId: row.category_id,
            name: row.name,
            path: row.path || [],
          };
        }
        this.bumpFallback(
          ctx,
          'findCategoryBySlug',
          'hierarchy_gap',
          `slug=${slug} slugResolution has concept_id but findById empty category_id=${slugResolution.categoryId}`,
        );
        return null;
      }

      if (slugResolution.categoryId) {
        let row = await repository.findById(slugResolution.categoryId);
        if (!row) {
          row = await repository.findBySlug(slug, undefined);
        }
        if (row) {
          const sem = await resolveConceptFromCategoryCached(row.category_id, ctx.resolutionCache);
          if (sem.conceptId) {
            console.log(
              `[semantic] DECISION=concept_id findCategoryBySlug context=${context} concept_id=${sem.conceptId} category_id=${row.category_id} slug=${slug} source=global_slug`,
            );
          } else {
            this.bumpFallback(
              ctx,
              'findCategoryBySlug',
              'missing_concept',
              `slug=${slug} source=global_slug category_id=${row.category_id} (concept_id null)`,
            );
          }
          return {
            categoryId: row.category_id,
            name: row.name,
            path: row.path || [],
          };
        }
      }

      const category = await repository.findBySlug(slug, undefined);
      if (!category) {
        this.bumpFallback(
          ctx,
          'findCategoryBySlug',
          'missing_concept',
          `slug=${slug} no row (global or legacy)`,
        );
        return null;
      }

      if (slugResolution.categoryId && slugResolution.categoryId !== category.category_id) {
        console.warn(
          `[semantic] findCategoryBySlug MISMATCH resolution_row=${slugResolution.categoryId} legacy_row=${category.category_id} slug=${slug}`,
        );
        this.bumpFallback(
          ctx,
          'findCategoryBySlug',
          'mismatch',
          `slug=${slug} resolution_row=${slugResolution.categoryId} legacy_row=${category.category_id}`,
        );
      }

      const semantic = await resolveConceptFromCategoryCached(category.category_id, ctx.resolutionCache);
      if (semantic.conceptId) {
        console.log(
          `[semantic] DECISION=concept_id findCategoryBySlug context=${context} concept_id=${semantic.conceptId} category_id=${category.category_id} slug=${slug} source=legacy_findBySlug`,
        );
      } else {
        this.bumpFallback(
          ctx,
          'findCategoryBySlug',
          'missing_concept',
          `slug=${slug} source=legacy_findBySlug category_id=${category.category_id} (concept_id null)`,
        );
      }

      return {
        categoryId: category.category_id,
        name: category.name,
        path: category.path || [],
      };
    } catch (error) {
      console.error('Erro ao buscar categoria por slug:', error);
      return null;
    }
  }

  /**
   * Registra ação do usuário sobre uma sugestão
   */
  async recordSuggestionAction(
    tenantId: string,
    userId: string,
    suggestionId: string,
    action: 'accept' | 'dismiss'
  ): Promise<void> {
    // Buscar globalUserId
    const identity = await import('../identity/identity.service');
    const identityProfile = await identity.identityService.getIdentityProfile(userId, tenantId);
    if (!identityProfile || !identityProfile.global.globalUserId) {
      throw new Error('Identidade do usuário não encontrada');
    }

    const globalUserId = identityProfile.global.globalUserId;

    // Buscar metadata atual
    const { pool } = await import('@core/database/pool');
    const currentRow = await pool.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );

    const currentMetadata = currentRow.rows[0]?.metadata || {};
    const suggestionHistory = currentMetadata.suggestionHistory || [];

    // Adicionar nova ação ao histórico
    suggestionHistory.push({
      suggestionId,
      action,
      timestamp: new Date().toISOString(),
    });

    // Atualizar metadata
    const updatedMetadata = {
      ...currentMetadata,
      suggestionHistory,
    };

    // Salvar no banco
    await pool.query(
      `
      UPDATE global_users
      SET metadata = $1::jsonb, updated_at = now()
      WHERE global_user_id = $2
      `,
      [JSON.stringify(updatedMetadata), globalUserId]
    );
  }

  /**
   * Verifica se uma sugestão já foi dispensada
   */
  async isSuggestionDismissed(
    tenantId: string,
    userId: string,
    suggestionId: string
  ): Promise<boolean> {
    const identity = await import('../identity/identity.service');
    const identityProfile = await identity.identityService.getIdentityProfile(userId, tenantId);
    if (!identityProfile || !identityProfile.global.globalUserId) {
      return false;
    }

    const globalUserId = identityProfile.global.globalUserId;

    const { pool } = await import('@core/database/pool');
    const userRow = await pool.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM global_users
      WHERE global_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [globalUserId]
    );

    const metadata = userRow.rows[0]?.metadata || {};
    const suggestionHistory = metadata.suggestionHistory || [];

    // Verificar se há dismiss para esta sugestão
    return suggestionHistory.some(
      (entry: any) => entry.suggestionId === suggestionId && entry.action === 'dismiss'
    );
  }

  /**
   * Filtra sugestões já dispensadas
   */
  async filterDismissedSuggestions(
    tenantId: string,
    userId: string,
    suggestions: InferenceSuggestion[]
  ): Promise<InferenceSuggestion[]> {
    const filtered: InferenceSuggestion[] = [];

    for (const suggestion of suggestions) {
      const isDismissed = await this.isSuggestionDismissed(tenantId, userId, suggestion.id);
      if (!isDismissed) {
        filtered.push(suggestion);
      }
    }

    return filtered;
  }

  /**
   * Busca categoria na árvore recursivamente
   */
  private findCategoryInTree(
    tree: any[],
    categoryId: string
  ): any | null {
    for (const node of tree) {
      if (node.categoryId === categoryId) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = this.findCategoryInTree(node.children, categoryId);
        if (found) return found;
      }
    }
    return null;
  }
}

export const profileInferenceService = new ProfileInferenceService();




























// src/core/profile/profile-inference.service.ts
// Motor de inferência entre trilhas - observa padrões sem forçar ações

import { CategoryContext } from '@unificard/contracts';
import { profilePhysicalService } from './profile-physical.service';
import { profileLearningService } from './profile-learning.service';
import { profileProfessionalService } from './profile-professional.service';
import type {
  UserState,
  UserProfileSnapshot,
  InferenceSuggestion,
  InferenceResult,
  CategoryAffinity,
} from './profile-inference.types';

class ProfileInferenceService {
  /**
   * Mapeamento de afinidade entre categorias de diferentes contextos
   * Baseado em semântica, não IDs diretos
   */
  private categoryAffinities: CategoryAffinity[] = [
    // Criatividade & Expressão
    {
      physicalCategory: 'criar-expressar',
      learningCategories: ['fotografia-aprendizado', 'desenho-ilustracao', 'escrita-criativa', 'video-aprendizado', 'design-aprendizado'],
      professionalCategories: ['fotografo', 'designer', 'escritor', 'editor-video'],
    },
    {
      physicalCategory: 'fotografia',
      learningCategories: ['fotografia-aprendizado'],
      professionalCategories: ['fotografo'],
    },
    {
      physicalCategory: 'desenho',
      learningCategories: ['desenho-ilustracao'],
      professionalCategories: ['designer', 'ilustrador'],
    },
    {
      physicalCategory: 'video',
      learningCategories: ['video-aprendizado', 'edicao-video-aprendizado'],
      professionalCategories: ['editor-video', 'produtor-audiovisual'],
    },
    {
      physicalCategory: 'escrita',
      learningCategories: ['escrita-criativa', 'escrita-profissional'],
      professionalCategories: ['escritor', 'redator'],
    },
    {
      physicalCategory: 'musica',
      learningCategories: ['musica-aprendizado', 'teoria-musical'],
      professionalCategories: ['musico', 'produtor-musical'],
    },
    
    // Tecnologia
    {
      physicalCategory: 'tecnologia',
      learningCategories: ['programacao', 'desenvolvimento-web-aprendizado', 'inteligencia-artificial'],
      professionalCategories: ['desenvolvedor-backend', 'desenvolvedor-frontend', 'desenvolvedor-fullstack'],
    },
    {
      physicalCategory: 'jogos',
      learningCategories: ['games-aprendizado', 'desenvolvimento-jogos'],
      professionalCategories: ['desenvolvedor-jogos', 'game-designer'],
    },
    
    // Gastronomia
    {
      physicalCategory: 'cozinhar-comer-bem',
      learningCategories: ['culinaria-aprendizado', 'confeitaria-aprendizado'],
      professionalCategories: ['chef', 'confeiteiro', 'cozinheiro'],
    },
    
    // Bem-Estar
    {
      physicalCategory: 'se-movimentar',
      learningCategories: ['atividade-fisica-aprendizado', 'treinamento-fisico'],
      professionalCategories: ['personal-trainer', 'educador-fisico'],
    },
    {
      physicalCategory: 'cuidar-de-si',
      learningCategories: ['saude-mental-aprendizado', 'nutricao-aprendizado'],
      professionalCategories: ['nutricionista', 'psicologo'],
    },
  ];

  /**
   * Busca snapshot completo do perfil do usuário
   */
  async getUserProfileSnapshot(
    tenantId: string,
    userId: string
  ): Promise<UserProfileSnapshot> {
    const [physical, learning, professional] = await Promise.all([
      profilePhysicalService.getPhysicalProfile(tenantId, userId).catch(() => null),
      profileLearningService.getLearningProfile(tenantId, userId).catch(() => null),
      profileProfessionalService.getProfessionalProfile(tenantId, userId).catch(() => null),
    ]);

    return {
      physical: {
        interests: physical?.interests || [],
        count: physical?.interests?.length || 0,
      },
      learning: {
        learnings: learning?.learnings || [],
        count: learning?.learnings?.length || 0,
        hasIntermediateOrAdvanced: (learning?.learnings || []).some(
          (l) => l.progress === 'intermediate' || l.progress === 'advanced'
        ),
      },
      professional: {
        skills: professional?.skills || [],
        count: professional?.skills?.length || 0,
      },
      lastUpdated: {
        physical: physical ? new Date().toISOString() : undefined,
        learning: learning ? new Date().toISOString() : undefined,
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
    const snapshot = await this.getUserProfileSnapshot(tenantId, userId);
    const suggestions: InferenceSuggestion[] = [];

    // REGRA A: Físico → Aprendizado
    if (snapshot.physical.count > 0 && snapshot.learning.count === 0) {
      const physicalInterests = snapshot.physical.interests;
      
      for (const interest of physicalInterests) {
        // Buscar afinidade
        const affinity = this.findAffinityByPhysical(interest.categoryPath, interest.categoryName);
        
        if (affinity && affinity.learningCategories.length > 0) {
          // Buscar categoria de aprendizado relacionada
          const { categoriesService } = await import('../categories/categories.service');
          const learningCategory = await this.findCategoryBySlug(
            affinity.learningCategories[0],
            'learning'
          );
          
          if (learningCategory) {
            suggestions.push({
              id: `physical_to_learning_${interest.categoryId}`,
              type: 'physical_to_learning',
              title: 'Quer aprender mais sobre isso?',
              message: `Você gosta de "${interest.categoryName}". Que tal explorar isso como aprendizado?`,
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
    }

    // REGRA B: Aprendizado (Intermediário/Avançado) → Profissional
    if (snapshot.learning.hasIntermediateOrAdvanced && snapshot.professional.count === 0) {
      const advancedLearnings = snapshot.learning.learnings.filter(
        (l) => l.progress === 'intermediate' || l.progress === 'advanced'
      );
      
      if (advancedLearnings.length > 0) {
        const learning = advancedLearnings[0];
        const affinity = this.findAffinityByLearning(learning.categoryPath, learning.categoryName);
        
        if (affinity && affinity.professionalCategories.length > 0) {
          const { categoriesService } = await import('../categories/categories.service');
          const professionalCategory = await this.findCategoryBySlug(
            affinity.professionalCategories[0],
            'professional'
          );
          
          if (professionalCategory) {
            suggestions.push({
              id: `learning_to_professional_${learning.categoryId}`,
              type: 'learning_to_professional',
              title: 'Você já pensou em usar isso profissionalmente?',
              message: `Você está em nível ${learning.progress === 'intermediate' ? 'intermediário' : 'avançado'} em "${learning.categoryName}". Que tal considerar isso como profissão?`,
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
   * Busca afinidade por categoria física
   */
  private findAffinityByPhysical(path: string[], name: string): CategoryAffinity | null {
    // Buscar por slug no path ou nome
    const searchTerms = [
      ...path.map(p => p.toLowerCase()),
      name.toLowerCase(),
    ];

    for (const term of searchTerms) {
      const affinity = this.categoryAffinities.find(
        (a) => a.physicalCategory.toLowerCase().includes(term) || 
               term.includes(a.physicalCategory.toLowerCase())
      );
      if (affinity) return affinity;
    }

    return null;
  }

  /**
   * Busca afinidade por categoria de aprendizado
   */
  private findAffinityByLearning(path: string[], name: string): CategoryAffinity | null {
    const searchTerms = [
      ...path.map(p => p.toLowerCase()),
      name.toLowerCase(),
    ];

    for (const term of searchTerms) {
      const affinity = this.categoryAffinities.find(
        (a) => a.learningCategories.some(
          (lc) => lc.toLowerCase().includes(term) || term.includes(lc.toLowerCase())
        )
      );
      if (affinity) return affinity;
    }

    return null;
  }

  /**
   * Busca categoria por slug e contexto
   */
  private async findCategoryBySlug(
    slug: string,
    context: CategoryContext
  ): Promise<{ categoryId: string; name: string; path: string[] } | null> {
    try {
      const { CategoryRepository } = await import('../categories/categories.repository');
      const repository = new CategoryRepository();
      
      // Buscar por slug no repository (sem countryCode para buscar global)
      const category = await repository.findBySlug(slug, undefined);
      
      if (!category) {
        return null;
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














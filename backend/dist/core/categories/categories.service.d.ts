import { CategoryContext } from '@unificard/contracts';
import type { Category, CategoryTree, CreateCategoryInput, CreateManyCategoriesInput, AssignCategoryToCompanyInput, AssignSkillToUserInput, ClassifyTextInput, CategoryClassification, CategoryAutocompleteResult } from './categories.types';
declare class CategoriesService {
    private repository;
    private categoryTreeCache;
    private readonly CONFIDENCE_THRESHOLD_AUTO_APPROVE;
    private readonly CONFIDENCE_THRESHOLD;
    private readonly CACHE_TTL_SECONDS;
    private readonly MAX_INPUT_LENGTH;
    /**
     * Sanitiza texto removendo scripts, SQL, URLs e limitando tamanho
     * REGRAS DE SEGURANÇA: Remove conteúdo perigoso antes de processar com IA
     */
    private sanitizeText;
    /**
     * Gera hash SHA-256 de um texto
     */
    private generateHash;
    /**
     * Gera slug a partir do nome
     */
    private generateSlug;
    /**
     * Calcula path recursivo de uma categoria
     */
    private calculatePath;
    /**
     * Calcula level de uma categoria
     */
    private calculateLevel;
    /**
     * Cria uma nova categoria
     * GOVERNANÇA: Por padrão cria como 'pending'. Para criar como 'active', requer allowActive=true e validação de admin
     */
    createCategory(input: CreateCategoryInput, options?: {
        tenantId?: string;
        userId?: string;
        validateAdmin?: boolean;
        context?: CategoryContext;
        skipGate?: boolean;
    }): Promise<Category>;
    /**
     * Gera chave de advisory lock baseada em nome e parentId
     * FASE 3.7.1: Hardening - Evitar race conditions
     */
    private generateLockKey;
    /**
     * Cria múltiplas categorias
     * GOVERNANÇA: Cria todas como 'pending' por padrão
     */
    createManyCategories(input: CreateManyCategoriesInput, options?: {
        tenantId?: string;
        userId?: string;
        validateAdmin?: boolean;
        source?: 'manual' | 'script' | 'ai' | 'migration';
    }): Promise<Category[]>;
    /**
     * Busca categoria por ID
     */
    getCategoryById(categoryId: string): Promise<Category | null>;
    /**
     * Busca árvore completa de categorias
     * @param countryCode - Se fornecido, filtra categorias por país (incluindo globais)
     * @param useCache - Se true, usa cache quando disponível (default: true)
     */
    getCategoryTree(countryCode?: string | null, useCache?: boolean): Promise<CategoryTree[]>;
    /**
     * CACHE: Invalida cache de categorias
     * Chamado quando categoria é criada, aprovada ou rejeitada
     */
    invalidateCategoryCache(): void;
    /**
     * Busca filhos de uma categoria
     */
    /**
     * Busca filhos de uma categoria
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    getChildren(categoryId: string, countryCode?: string | null): Promise<Category[]>;
    /**
     * Busca categorias por termo
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    searchCategories(term: string, limit?: number, countryCode?: string | null): Promise<Category[]>;
    /**
     * Autocomplete: busca categorias leaf ACTIVE para sugestão rápida
     * Retorna apenas categorias finais que podem ser selecionadas diretamente
     */
    autocompleteCategories(query: string, context?: CategoryContext, countryCode?: string | null, limit?: number): Promise<CategoryAutocompleteResult[]>;
    /**
     * Associa categoria a uma empresa
     */
    assignCategoryToCompany(tenantId: string, input: AssignCategoryToCompanyInput): Promise<void>;
    /**
     * Associa skill/categoria a um usuário
     */
    assignSkillToUser(globalUserId: string, input: AssignSkillToUserInput): Promise<void>;
    /**
     * Classifica texto em categorias (preparado para integração com AI Kernel)
     */
    classifyTextIntoCategories(input: ClassifyTextInput): Promise<CategoryClassification[]>;
    /**
     * Valida input por contexto (security)
     */
    private validateInputByContext;
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
    suggestCategoryPath(input: string, context?: CategoryContext, countryCode?: string | null): Promise<import('./categories.types').CategoryPathSuggestion>;
    /**
     * FASE 3.6: Garante hierarquia completa (Grupo → Subgrupo → Profissão)
     * Esta função é chamada ANTES de criar a profissão para garantir que grupo e subgrupo existam
     * Retorna: { rootId, subgroupId } garantidos
     */
    private ensureCompleteHierarchy;
    /**
     * Infere o nome do grupo baseado na profissão e contexto
     * FASE 3.6: Garantir que sempre haja grupo na hierarquia
     */
    private inferGroupName;
    /**
     * Gera nome padrão de subgrupo quando não consegue inferir
     */
    private generateDefaultSubgroupName;
    /**
     * Infere o nome do subgrupo baseado na profissão
     * FASE 3.6: Garantir que sempre haja subgrupo na hierarquia
     */
    private inferSubgroupName;
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
    private canAutoCreateSubcategoryWithAI;
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
    private shouldAutoApproveSuggestion;
    /**
     * Normaliza nome para Title Case (ex: "Pedreiro", "Engenharia Civil")
     * CORRIGIDO: Normaliza também para educação (ex: "USP", "Universidade de São Paulo")
     */
    private normalizeNameToTitleCase;
    /**
     * Verifica se categoria já existe (por slug normalizado ou nome exato)
     * TAREFA A: IDEMPOTÊNCIA - Busca por (slug, parent_id) para evitar duplicação
     */
    private checkCategoryExists;
    /**
     * Análise simples de caminho quando IA não está disponível
     */
    private simpleCategoryPathAnalysis;
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
    createCategoryWithAI(input: {
        text: string;
        context?: CategoryContext;
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
    }>;
    /**
     * Cria categoria com status 'pending' e requires_review configurável
     * Usado exclusivamente para categorias criadas por IA
     */
    private createCategoryPending;
    /**
     * Análise simples de categoria quando IA não está disponível
     */
    private simpleCategoryAnalysis;
    /**
     * Aprova uma categoria pendente criada por IA
     * REGRAS: Apenas categorias com status 'pending' e requires_review = true podem ser aprovadas
     */
    approveCategory(categoryId: string, approvedByUserId: string): Promise<Category>;
    /**
     * Rejeita uma categoria pendente criada por IA
     */
    rejectCategory(categoryId: string, reason: string): Promise<Category>;
    /**
     * Lista categorias pendentes de aprovação
     */
    getPendingCategories(): Promise<Category[]>;
}
export declare const categoriesService: CategoriesService;
export {};
//# sourceMappingURL=categories.service.d.ts.map
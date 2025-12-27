import { CategoryContext } from '@unificard/contracts';
import type { CategoryRow } from './categories.types';
export declare class CategoryRepository {
    private _hasStatusColumn;
    /**
     * Verifica se a coluna status existe na tabela categories
     * Cacheia o resultado para evitar múltiplas consultas
     */
    private hasStatusColumn;
    /**
     * Retorna a condição WHERE para filtrar por status (se a coluna existir)
     */
    private getStatusCondition;
    /**
     * Busca categoria por ID
     */
    findById(categoryId: string, client?: any): Promise<CategoryRow | null>;
    /**
     * Busca categoria por slug
     */
    findBySlug(slug: string, countryCode?: string | null, client?: any): Promise<CategoryRow | null>;
    /**
     * FASE 3.7 — PROPERTY CANÔNICO
     * Busca categoria por (slug + parent_id) de forma 100% idempotente
     * Resolve definitivamente o erro: "could not determine data type of parameter $2"
     */
    findBySlugAndParent(slug: string, parentId: string | null, client?: any): Promise<CategoryRow | null>;
    /**
     * Busca todas as categorias raiz (sem parent)
     * @param countryCode - Se fornecido, retorna apenas categorias globais (NULL) ou do país especificado
     */
    findRootCategories(countryCode?: string | null, client?: any): Promise<CategoryRow[]>;
    /**
     * Busca filhos de uma categoria
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    findChildren(parentId: string, countryCode?: string | null, client?: any): Promise<CategoryRow[]>;
    /**
     * Busca categoria por nome exato e parent (FASE 3.7: Previne duplicação com tipagem correta)
     */
    findByNameAndParent(name: string, parentId: string | null, client?: any): Promise<CategoryRow | null>;
    /**
     * Busca categoria por nome similar e parent (FASE 3.7: Previne duplicação com tipagem correta)
     */
    findSimilarNameAndParent(name: string, parentId: string | null, client?: any): Promise<CategoryRow | null>;
    /**
     * Busca categorias por termo (busca inteligente com fuzzy matching)
     * Busca em: name, description, slug, keywords (se existir) e path
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    search(term: string, limit?: number, countryCode?: string | null, client?: any): Promise<CategoryRow[]>;
    /**
     * Autocomplete: busca categorias leaf (level >= 1) ACTIVE para sugestão rápida
     * Retorna apenas categorias finais (não raízes) que podem ser selecionadas diretamente
     * CORREÇÃO: Prioriza busca por prefixo (começa com) antes de busca por contém
     */
    autocomplete(query: string, context?: CategoryContext, countryCode?: string | null, limit?: number, client?: any): Promise<CategoryRow[]>;
    /**
     * Cria uma nova categoria
     * GOVERNANÇA: Por padrão cria como 'pending' a menos que allowActive=true seja explicitamente passado
     * IDEMPOTÊNCIA: Retorna existente se (slug, parent_id) já existir (via constraint)
     */
    create(data: {
        name: string;
        slug: string;
        description: string | null;
        parentId: string | null;
        level: number;
        path: string[];
        keywords?: string[];
        countryCode?: string | null;
        status?: 'active' | 'auto_active' | 'pending';
        requiresReview?: boolean;
        createdByAI?: boolean;
    }, client?: any): Promise<CategoryRow>;
    /**
     * Cria uma nova categoria com status 'pending' e requires_review = true
     * Usado exclusivamente para categorias criadas por IA
     */
    createPending(data: {
        name: string;
        slug: string;
        description: string | null;
        parentId: string | null;
        level: number;
        path: string[];
        keywords?: string[];
        countryCode?: string | null;
    }, client?: any): Promise<CategoryRow>;
    /**
     * Atualiza uma categoria
     */
    update(categoryId: string, data: {
        name?: string;
        slug?: string;
        description?: string | null;
        parentId?: string | null;
        level?: number;
        path?: string[];
        keywords?: string[];
        countryCode?: string | null;
    }, client?: any): Promise<CategoryRow | null>;
    /**
     * Busca todas as categorias
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    findAll(countryCode?: string | null, client?: any): Promise<CategoryRow[]>;
    /**
     * Registra auditoria de criação de categoria
     */
    logCategoryCreation(data: {
        categoryId: string;
        tenantId?: string | null;
        actorId?: string | null;
        globalUserId?: string | null;
        source: 'manual' | 'script' | 'ai' | 'migration';
        originalText?: string;
        sanitizedText?: string;
        textHash?: string;
        audioHash?: string;
        audioUrl?: string;
        context?: string;
        aiSuggestion?: any;
        aiConfidence?: number;
    }): Promise<void>;
}
//# sourceMappingURL=categories.repository.d.ts.map
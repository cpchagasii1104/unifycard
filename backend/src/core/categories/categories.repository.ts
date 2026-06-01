// src/core/categories/categories.repository.ts
import { pool } from '@core/database/pool';
import { CategoryContext } from '@unificard/contracts';
import type { CategoryRow } from './categories.types';
import { ssotObservabilityUtil } from '@core/observability/ssot-observability.util';

export class CategoryRepository {
  private _hasStatusColumn: boolean | null = null;

  /**
   * Verifica se a coluna status existe na tabela categories
   * Cacheia o resultado para evitar múltiplas consultas
   */
  private async hasStatusColumn(): Promise<boolean> {
    if (this._hasStatusColumn !== null) {
      return this._hasStatusColumn;
    }
    
    const statusCheck = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as exists
      `
    );
    this._hasStatusColumn = statusCheck.rows[0]?.exists || false;
    return this._hasStatusColumn;
  }

  /**
   * Retorna a condição WHERE para filtrar por status (se a coluna existir)
   * 🔴 CORREÇÃO DEFINITIVA: status = 'active' e 'auto_active' são visíveis
   * Permite NULL para compatibilidade com categorias antigas
   * auto_active também é visível (categorias criadas por IA e aprovadas automaticamente)
   */
  private async getStatusCondition(): Promise<string> {
    const hasStatus = await this.hasStatusColumn();
    if (!hasStatus) {
      // Se coluna não existe, não filtrar - retornar todas
      return '1=1';
    }
    // 🔴 CORREÇÃO: status = 'active' e 'auto_active' são visíveis, permite NULL (compatibilidade)
    // auto_active também é visível - categorias criadas por IA e aprovadas automaticamente
    // Se status for NULL, assume-se que é categoria antiga (compatibilidade)
    return '(status IN (\'active\', \'auto_active\') OR status IS NULL)';
  }

  /**
   * Núcleo canônico de filtros de leitura.
   * REGRA: context filtra VISÃO (scope), nunca hierarquia (level/parent/leaf).
   * REGRA: countryCode (quando fornecido) inclui globais (NULL) + país.
   */
  private async buildCanonicalReadFilter(args: {
    context?: CategoryContext;
    countryCode?: string | null;
    includeNullScope?: boolean; // compatibilidade histórica
  }): Promise<{ whereSql: string; params: any[] }> {
    const { context, countryCode, includeNullScope = true } = args;

    if (!context) {
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: null,
        details: {
          method: 'buildCanonicalReadFilter',
          reason: 'context ausente no repository',
        },
      });
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }

    const statusCondition = await this.getStatusCondition();

    const params: any[] = [];
    let idx = 1;

    let whereSql = `${statusCondition}`;

    // Contexto como filtro de visão, nunca como estrutura.
    if (includeNullScope) {
      whereSql += ` AND (scope = $${idx} OR scope IS NULL)`;
    } else {
      whereSql += ` AND scope = $${idx}`;
    }
    params.push(context);
    idx++;

    // País canônico: país OU global (NULL)
    if (countryCode !== undefined && countryCode !== null) {
      whereSql += ` AND (country_code = $${idx} OR country_code IS NULL)`;
      params.push(countryCode);
      idx++;
    }

    return { whereSql, params };
  }

  /**
   * Busca categoria por ID
   * REGRA CANÔNICA: Normaliza allowed_scopes para categorias raiz de grupo
   */
  async findById(categoryId: string, client?: any): Promise<CategoryRow | null> {
    const statusCondition = await this.getStatusCondition();
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) AS keywords,
             country_code, scope, metadata, created_at, updated_at
      FROM categories
      WHERE category_id = $1 AND ${statusCondition}
      LIMIT 1
      `,
      [categoryId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0] as any;
    
    // REGRA CANÔNICA: Normalizar allowed_scopes para categorias raiz de grupo
    if (row.level === 0 && row.scope === 'group') {
      const metadata = row.metadata || {};
      if (!metadata.allowed_scopes || !Array.isArray(metadata.allowed_scopes) || metadata.allowed_scopes.length === 0) {
        // Default canônico para categorias raiz de grupo
        metadata.allowed_scopes = ['national', 'state', 'city', 'neighborhood'];
        row.metadata = metadata;
      }
    }

    return row as CategoryRow;
  }

  /**
   * Busca categoria por slug
   * REGRA CANÔNICA: Normaliza allowed_scopes para categorias raiz de grupo
   */
  async findBySlug(slug: string, countryCode?: string | null, client?: any): Promise<CategoryRow | null> {
    const statusCondition = await this.getStatusCondition();
    let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, scope, metadata, created_at, updated_at
      FROM categories
      WHERE slug = $1 AND ${statusCondition}
    `;
    const params: any[] = [slug];
    
    if (countryCode !== undefined) {
      // Se countryCode é fornecido, buscar categoria específica do país OU global (NULL)
      query += ` AND (country_code = $2 OR country_code IS NULL)`;
      params.push(countryCode);
      query += ` ORDER BY country_code DESC NULLS LAST LIMIT 1`;
    } else {
      query += ` LIMIT 1`;
    }
    
    const queryClient = client || pool;
    const result = await queryClient.query(query, params);
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0] as any;
    
    // REGRA CANÔNICA: Normalizar allowed_scopes para categorias raiz de grupo
    if (row.level === 0 && row.scope === 'group') {
      const metadata = row.metadata || {};
      if (!metadata.allowed_scopes || !Array.isArray(metadata.allowed_scopes) || metadata.allowed_scopes.length === 0) {
        metadata.allowed_scopes = ['national', 'state', 'city', 'neighborhood'];
        row.metadata = metadata;
      }
    }
    
    return row as CategoryRow;
  }

  /**
   * FASE 3.7 — PROPERTY CANÔNICO
   * Busca categoria por (slug + parent_id) de forma 100% idempotente
   * Resolve definitivamente o erro: "could not determine data type of parameter $2"
   *
   * 🔴 CORREÇÃO: NÃO filtra por status - método interno de lookup
   * Idempotência e busca de existentes devem encontrar categorias em QUALQUER status
   */
  async findBySlugAndParent(
    slug: string,
    parentId: string | null,
    client?: any
  ): Promise<CategoryRow | null> {
    // 🔴 REMOVIDO: statusCondition - este método deve encontrar categorias em qualquer status
    // Razão: usado para idempotência em create() e lookups internos

    // 🔒 CASO 1 — ROOT (parent_id IS NULL)
    if (parentId === null) {
      const queryClient = client || pool;
      const result = await queryClient.query(
        `
        SELECT category_id, parent_id, name, slug, description, level, path,
               COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords,
               country_code, status, created_at, updated_at
        FROM categories
        WHERE slug = $1
          AND parent_id IS NULL
        LIMIT 1
        `,
        [slug]
      );
      return result.rows[0] ?? null;
    }

    // 🔒 CASO 2 — COM PARENT DEFINIDO
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      SELECT category_id, parent_id, name, slug, description, level, path,
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords,
             country_code, status, created_at, updated_at
      FROM categories
      WHERE slug = $1
        AND parent_id = $2::uuid
      LIMIT 1
      `,
      [slug, parentId]
    );

    return (result.rows[0] as CategoryRow) ?? null;
  }

  /**
   * Busca todas as categorias raiz (sem parent)
   * REGRA CANÔNICA: Normaliza allowed_scopes para categorias raiz de grupo
   * @param countryCode - Se fornecido, retorna apenas categorias globais (NULL) ou do país especificado
   */
  async findRootCategories(countryCode?: string | null, client?: any): Promise<CategoryRow[]> {
    const statusCondition = await this.getStatusCondition();
    let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, scope, metadata, created_at, updated_at
      FROM categories
      WHERE parent_id IS NULL AND ${statusCondition}
    `;
    const params: any[] = [];
    
    if (countryCode !== undefined) {
      // Se countryCode é fornecido, buscar categorias globais (NULL) ou do país
      query += ` AND (country_code = $1 OR country_code IS NULL)`;
      params.push(countryCode);
    }
    
    query += ` ORDER BY level ASC, name ASC`;
    
    const queryClient = client || pool;
    const result = await queryClient.query(query, params);
    
    // REGRA CANÔNICA: Normalizar allowed_scopes para categorias raiz de grupo
    return result.rows.map((row: any) => {
      if (row.level === 0 && row.scope === 'group') {
        const metadata = row.metadata || {};
        if (!metadata.allowed_scopes || !Array.isArray(metadata.allowed_scopes) || metadata.allowed_scopes.length === 0) {
          metadata.allowed_scopes = ['national', 'state', 'city', 'neighborhood'];
          row.metadata = metadata;
        }
      }
      return row as CategoryRow;
    });
  }

  /**
   * Busca filhos de uma categoria
   * @param parentId - ID da categoria pai
   * @param context - Contexto obrigatório para leitura de categorias (SSOT)
   * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
   */
  async findChildren(parentId: string, context: CategoryContext, countryCode?: string | null, client?: any): Promise<CategoryRow[]> {
    if (!context) {
      // Registrar SSOT_VIOLATION antes de lançar erro
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: null,
        details: {
          method: 'findChildren',
          reason: 'context ausente no repository',
        },
      });
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }

    // 🔴 FILTRO CANÔNICO: Usar buildCanonicalReadFilter para garantir consistência
    const { whereSql, params } = await this.buildCanonicalReadFilter({
      context,
      countryCode,
      includeNullScope: true,
    });

    // Calcular índice do parent_id (após os parâmetros canônicos)
    const parentIdParamIndex = params.length + 1;
    const finalParams = [...params, parentId];

    let query = `
      SELECT category_id, parent_id, name, slug, description, level, path,
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, scope, concept_id, created_at, updated_at
      FROM categories
      WHERE ${whereSql} AND parent_id = $${parentIdParamIndex}
      ORDER BY level ASC, name ASC
    `;

    // 🔴 DIAGNÓSTICO: Log para investigar problema de children vazios
    console.log('[CategoryRepository.findChildren] DIAGNÓSTICO:', {
      parentId,
      context,
      countryCode,
      query: query.replace(/\s+/g, ' ').trim(),
    });

    const queryClient = client || pool;
    const result = await queryClient.query(query, finalParams);

    // 🔴 DIAGNÓSTICO: Log do resultado
    console.log('[CategoryRepository.findChildren] RESULTADO:', {
      parentId,
      rowCount: result.rows.length,
      rows: result.rows.map((r: any) => ({
        id: r.category_id,
        name: r.name,
        level: r.level,
        status: r.status,
      })),
    });

    // 🔴 DIAGNÓSTICO: Buscar SEM filtro de status para comparação
    if (result.rows.length === 0) {
      const debugQuery = `
        SELECT category_id, name, level, status, scope
        FROM categories
        WHERE parent_id = $1
        ORDER BY name ASC
        LIMIT 10
      `;
      const debugResult = await queryClient.query(debugQuery, [parentId]);
      console.log('[CategoryRepository.findChildren] DEBUG (sem filtro status):', {
        parentId,
        rowCount: debugResult.rows.length,
        rows: debugResult.rows,
      });
    }

    return result.rows as CategoryRow[];
  }

  /**
   * Busca categoria por nome exato e parent (FASE 3.7: Previne duplicação com tipagem correta)
   */
  async findByNameAndParent(name: string, parentId: string | null, client?: any): Promise<CategoryRow | null> {
    const statusCondition = await this.getStatusCondition();
    
    // 🔒 CASO 1 — ROOT (parent_id IS NULL)
    if (parentId === null) {
      const queryClient = client || pool;
    const result = await queryClient.query(
        `
        SELECT category_id, parent_id, name, slug, description, level, path, 
               COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, created_at, updated_at
        FROM categories
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) 
          AND parent_id IS NULL
          AND ${statusCondition}
        LIMIT 1
        `,
        [name]
      );
      return (result.rows[0] as CategoryRow) ?? null;
    }

    // 🔒 CASO 2 — COM PARENT DEFINIDO
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) 
        AND parent_id = $2::uuid
        AND ${statusCondition}
      LIMIT 1
      `,
      [name, parentId]
    );
    return (result.rows[0] as CategoryRow) ?? null;
  }

  /**
   * Busca categoria por nome similar e parent (FASE 3.7: Previne duplicação com tipagem correta)
   */
  async findSimilarNameAndParent(name: string, parentId: string | null, client?: any): Promise<CategoryRow | null> {
    const statusCondition = await this.getStatusCondition();
    const normalizedName = name.toLowerCase().trim();
    
    // 🔒 CASO 1 — ROOT (parent_id IS NULL)
    if (parentId === null) {
      const queryClient = client || pool;
    const result = await queryClient.query(
        `
        SELECT category_id, parent_id, name, slug, description, level, path, 
               COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, created_at, updated_at
        FROM categories
        WHERE LOWER(TRIM(name)) = $1
          AND parent_id IS NULL
          AND ${statusCondition}
        LIMIT 1
        `,
        [normalizedName]
      );
      return (result.rows[0] as CategoryRow) ?? null;
    }

    // 🔒 CASO 2 — COM PARENT DEFINIDO
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(to_jsonb(keywords), '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE LOWER(TRIM(name)) = $1
        AND parent_id = $2::uuid
        AND ${statusCondition}
      LIMIT 1
      `,
      [normalizedName, parentId]
    );
    return (result.rows[0] as CategoryRow) ?? null;
  }

  /**
   * Busca categorias por termo (busca inteligente com fuzzy matching)
   * Busca em: name, description, slug, keywords (se existir) e path
   * @param context - Contexto obrigatório para filtro canônico
   * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
   */
  async search(term: string, context: CategoryContext, countryCode?: string | null, limit: number = 50, client?: any): Promise<CategoryRow[]> {
    const searchTerm = term.toLowerCase().trim();
    const searchPattern = `%${searchTerm}%`;
    
    // Normalizar termo para busca (remover acentos, espaços extras)
    const normalizedTerm = searchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Verificar se a coluna keywords existe
    const hasKeywords = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'keywords'
      ) as exists
      `
    );
    const keywordsExists = hasKeywords.rows[0]?.exists || false;

    // Verificar se pg_trgm está disponível
    const hasPgTrgm = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
      ) as exists
      `
    );
    const pgTrgmExists = hasPgTrgm.rows[0]?.exists || false;

    // Construir query dinamicamente baseado no que está disponível
    let keywordsCondition = '';
    let keywordsRelevance = '';
    let fuzzyCondition = '';
    let fuzzyRelevance = '';

    if (keywordsExists) {
      keywordsCondition = `
        -- Busca em keywords (coluna JSONB: array de strings)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(keywords) = 'array' THEN keywords ELSE '[]'::jsonb END
          ) AS kw
          WHERE LOWER(kw) LIKE $3
        )`;
      keywordsRelevance = `
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(keywords) = 'array' THEN keywords ELSE '[]'::jsonb END
            ) AS kw
            WHERE LOWER(kw) LIKE $3
          ) THEN 40`;
    }

    if (pgTrgmExists) {
      fuzzyCondition = `
        -- Busca fuzzy (similaridade)
        OR similarity(LOWER(name), $1) > 0.3`;
      fuzzyRelevance = `
          -- Similaridade fuzzy (usando pg_trgm)
          WHEN similarity(LOWER(name), $1) > 0.3 THEN 20`;
    }

    // 🔴 FILTRO CANÔNICO: Usar buildCanonicalReadFilter para garantir consistência
    const { whereSql: canonicalWhereSql, params: canonicalParams } =
      await this.buildCanonicalReadFilter({ context, countryCode, includeNullScope: true });

    const queryClient = client || pool;
    
    // Calcular offset baseado no número de parâmetros canônicos
    const canonicalParamCount = canonicalParams.length;
    const searchParam1 = canonicalParamCount + 1;
    const searchParam2 = canonicalParamCount + 2;
    const searchParam3 = canonicalParamCount + 3;
    const limitParam = canonicalParamCount + 4;
    
    const finalParams = [...canonicalParams, searchTerm, `${normalizedTerm}%`, searchPattern, limit];
    
    // Ajustar referências nos snippets dinâmicos
    const adjustedKeywordsRelevance = keywordsRelevance.replace(/\$3/g, `$${searchParam3}`);
    const adjustedFuzzyRelevance = fuzzyRelevance.replace(/\$1/g, `$${searchParam1}`);
    const adjustedKeywordsCondition = keywordsCondition.replace(/\$3/g, `$${searchParam3}`);
    const adjustedFuzzyCondition = fuzzyCondition.replace(/\$1/g, `$${searchParam1}`);
    
    const result = await queryClient.query(
      `
      SELECT 
        category_id, parent_id, name, slug, description, level, path, 
        COALESCE(keywords, '[]'::jsonb) AS keywords, country_code, scope, metadata, created_at, updated_at,
        -- Calcular relevância para ordenação
        CASE
          -- Match exato no nome (maior prioridade)
          WHEN LOWER(name) = $${searchParam1} THEN 100
          -- Match exato no slug
          WHEN LOWER(slug) = $${searchParam1} THEN 90
          -- Nome começa com o termo
          WHEN LOWER(name) LIKE $${searchParam2} THEN 80
          -- Slug começa com o termo
          WHEN LOWER(slug) LIKE $${searchParam2} THEN 70
          -- Nome contém o termo
          WHEN LOWER(name) LIKE $${searchParam3} THEN 60
          -- Descrição contém o termo
          WHEN LOWER(description) LIKE $${searchParam3} THEN 50${adjustedKeywordsRelevance}
          -- Path contém o termo
          WHEN EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $${searchParam3}
          ) THEN 30${adjustedFuzzyRelevance}
          ELSE 10
        END AS relevance
      FROM categories
      WHERE 
        ${canonicalWhereSql}
        AND (
          -- Busca em name
          LOWER(name) LIKE $${searchParam3}
          -- Busca em slug
          OR LOWER(slug) LIKE $${searchParam3}
          -- Busca em description
          OR LOWER(description) LIKE $${searchParam3}${adjustedKeywordsCondition}
          -- Busca em path (array de strings)
          OR EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $${searchParam3}
          )${adjustedFuzzyCondition}
        )
      ORDER BY relevance DESC, country_code DESC NULLS LAST, name ASC
      LIMIT $${limitParam}
      `,
      finalParams
    );

    return result.rows as CategoryRow[];
  }

  /**
   * Autocomplete: busca categorias leaf (level >= 1) ACTIVE para sugestão rápida
   * Retorna apenas categorias finais (não raízes) que podem ser selecionadas diretamente
   * CORREÇÃO: Prioriza busca por prefixo (começa com) antes de busca por contém
   */
  async autocomplete(
    query: string,
    context?: CategoryContext,
    countryCode?: string | null,
    limit: number = 20,
    client?: any
  ): Promise<CategoryRow[]> {
    if (!context) {
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }
    
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    // Padrões de busca: prefixo (prioridade) e contém (fallback)
    const prefixPattern = `${searchTerm}%`; // 'ped%' - busca por prefixo
    const containsPattern = `%${searchTerm}%`; // '%ped%' - busca por contém
    const normalizedTerm = searchTerm
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizedPrefix = `${normalizedTerm}%`;

    // Verificar se pg_trgm está disponível para busca fuzzy
    const hasPgTrgm = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') as exists`
    );
    const pgTrgmExists = hasPgTrgm.rows[0]?.exists || false;

    // Verificar se keywords existe
    const hasKeywords = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'keywords') as exists`
    );
    const keywordsExists = hasKeywords.rows[0]?.exists || false;

    // 🔴 FILTRO CANÔNICO: Usar buildCanonicalReadFilter para garantir consistência
    const { whereSql: canonicalWhereSql, params: canonicalParams } =
      await this.buildCanonicalReadFilter({ context, countryCode, includeNullScope: true });

    // Calcular offset baseado no número de parâmetros canônicos
    const canonicalParamCount = canonicalParams.length;
    
    // Parâmetros de busca (searchTerm, prefixPattern, normalizedPrefix, containsPattern)
    // Índices começam após os parâmetros canônicos
    const searchParam1 = canonicalParamCount + 1;
    const searchParam2 = canonicalParamCount + 2;
    const searchParam3 = canonicalParamCount + 3;
    const searchParam4 = canonicalParamCount + 4;
    const queryParams: any[] = [searchTerm, prefixPattern, normalizedPrefix, containsPattern];
    
    const limitParam = canonicalParamCount + 5; // 4 parâmetros de busca + 1 limit
    queryParams.push(limit);

    // Construir condições dinâmicas (ajustar índices para começar após parâmetros canônicos)
    let keywordsCondition = '';
    let keywordsRelevance = '';
    let fuzzyCondition = '';
    let fuzzyRelevance = '';

    if (keywordsExists) {
      keywordsCondition = `
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(keywords) = 'array' THEN keywords ELSE '[]'::jsonb END
          ) AS kw
          WHERE LOWER(kw) LIKE $${searchParam3} OR LOWER(kw) LIKE $${searchParam4}
        )`;
      keywordsRelevance = `
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(keywords) = 'array' THEN keywords ELSE '[]'::jsonb END
          ) AS kw
          WHERE LOWER(kw) LIKE $${searchParam3}
        ) THEN 45
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(keywords) = 'array' THEN keywords ELSE '[]'::jsonb END
          ) AS kw
          WHERE LOWER(kw) LIKE $${searchParam4}
        ) THEN 40`;
    }

    if (pgTrgmExists) {
      fuzzyCondition = `OR similarity(LOWER(name), $${searchParam1}) > 0.3`;
      fuzzyRelevance = `WHEN similarity(LOWER(name), $${searchParam1}) > 0.3 THEN 20`;
    }

    // 🔴 REGRA CANÔNICA: context filtra VISÃO, não estrutura.
    // Autocomplete sugere categorias selecionáveis; por padrão evitamos ROOT.
    const selectableCondition = `parent_id IS NOT NULL`;

    // CORREÇÃO CRÍTICA: Garantir que busca funcione mesmo sem status column
    // Se status não existe, buscar todas as categorias (assumindo que são active)
    const queryClient = client || pool;
    const finalParams = [...canonicalParams, ...queryParams];
    const result = await queryClient.query(
      `
      SELECT 
        category_id, parent_id, name, slug, description, level, path, 
        COALESCE(keywords, '[]'::jsonb) AS keywords, country_code, scope, metadata, created_at, updated_at,
        -- Calcular relevância para ordenação (prioriza prefixo)
        CASE
          -- Match exato no nome (maior prioridade)
          WHEN LOWER(name) = $${searchParam1} THEN 100
          -- Match exato no slug
          WHEN LOWER(slug) = $${searchParam1} THEN 90
          -- Nome começa com o termo (prefixo) - ALTA PRIORIDADE
          WHEN LOWER(name) LIKE $${searchParam2} THEN 85
          -- Slug começa com o termo (prefixo) - ALTA PRIORIDADE
          WHEN LOWER(slug) LIKE $${searchParam2} THEN 75
          -- Nome normalizado começa com o termo (prefixo sem acentos)
          WHEN LOWER(name) LIKE $${searchParam3} THEN 70
          -- Slug normalizado começa com o termo
          WHEN LOWER(slug) LIKE $${searchParam3} THEN 65
          -- Nome contém o termo (fallback)
          WHEN LOWER(name) LIKE $${searchParam4} THEN 60
          -- Slug contém o termo (fallback)
          WHEN LOWER(slug) LIKE $${searchParam4} THEN 55
          -- Keywords contém o termo (prefixo primeiro)
          ${keywordsRelevance}
          -- Path contém o termo (verifica último elemento do path)
          WHEN EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $${searchParam2} OR LOWER(path_item) LIKE $${searchParam4}
          ) THEN 30
          -- Similaridade fuzzy (última opção)
          ${fuzzyRelevance}
          ELSE 10
        END AS relevance
      FROM categories
      WHERE 
        ${canonicalWhereSql}
        AND ${selectableCondition}
        AND (
          -- Busca em name (prefixo primeiro, depois contém) - CORRIGIDO: busca mais agressiva
          LOWER(name) LIKE $${searchParam2}
          OR LOWER(name) LIKE $${searchParam4}
          OR LOWER(name) LIKE $${searchParam3}
          -- Busca em slug (prefixo primeiro, depois contém)
          OR LOWER(slug) LIKE $${searchParam2}
          OR LOWER(slug) LIKE $${searchParam4}
          OR LOWER(slug) LIKE $${searchParam3}
          -- Busca em keywords
          ${keywordsCondition}
          -- Busca em path (último elemento do path)
          OR EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $${searchParam2} OR LOWER(path_item) LIKE $${searchParam4} OR LOWER(path_item) LIKE $${searchParam3}
          )${fuzzyCondition}
        )
      ORDER BY relevance DESC, country_code DESC NULLS LAST, name ASC
      LIMIT $${limitParam}
      `,
      finalParams
    );

    return result.rows as CategoryRow[];
  }

  /**
   * Cria uma nova categoria
   * GOVERNANÇA: Por padrão cria como 'pending' a menos que allowActive=true seja explicitamente passado
   * IDEMPOTÊNCIA: Retorna existente se (slug, parent_id) já existir (via constraint)
   */
  async create(data: {
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
  }, client?: any): Promise<CategoryRow> {
    // GOVERNANÇA: Por padrão, criar como 'pending' com requires_review=true
    const status = data.status || 'pending';
    const requiresReview = data.requiresReview !== undefined ? data.requiresReview : (status === 'pending');
    const createdByAI = data.createdByAI || false;
    
    // IDEMPOTÊNCIA: Tentar inserir, se der erro de constraint, buscar existente
    const queryClient = client || pool;
    try {
      const result = await queryClient.query(
        `
        INSERT INTO categories (
          name, slug, description, parent_id, level, path, keywords, country_code,
          status, requires_review, created_by_ai
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
        RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
        `,
        [data.name, data.slug, data.description, data.parentId, data.level, data.path, JSON.stringify(data.keywords || []), data.countryCode || null, status, requiresReview, createdByAI]
      );
      return result.rows[0] as CategoryRow;
    } catch (error: any) {
      // Se erro for de constraint única (slug duplicado), buscar existente
      if (error.code === '23505' && (
        error.constraint === 'categories_slug_parent_unique_null' ||
        error.constraint === 'categories_slug_parent_unique_not_null' ||
        error.message?.includes('categories_slug') ||
        error.message?.includes('duplicate key')
      )) {
        // Buscar categoria existente por (slug, parent_id) usando o mesmo client
        const existing = await this.findBySlugAndParent(data.slug, data.parentId, client);
        if (existing) {
          // 🔴 CORREÇÃO: Se status solicitado é 'active' e existente não é, atualizar
          // Isso garante que re-execução do seed ativa categorias pendentes
          if (status === 'active' && existing.status !== 'active') {
            console.log(`[CategoryRepository.create] Atualizando status de '${existing.status}' para 'active': ${existing.name}`);
            await queryClient.query(
              `UPDATE categories SET status = 'active', is_active = true WHERE category_id = $1`,
              [existing.category_id]
            );
            existing.status = 'active';
          }
          return existing;
        }
      }
      // Se não for erro de constraint ou não encontrou existente, relançar erro
      throw error;
    }
  }

  /**
   * Cria uma nova categoria com status 'pending' e requires_review = true
   * Usado exclusivamente para categorias criadas por IA
   */
  async createPending(data: {
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    level: number;
    path: string[];
    keywords?: string[];
    countryCode?: string | null;
  }, client?: any): Promise<CategoryRow> {
    const keywordsJson = data.keywords ? JSON.stringify(data.keywords) : '[]';
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      INSERT INTO categories (
        name, slug, description, parent_id, level, path, keywords, country_code,
        status, requires_review, created_by_ai
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending', true, true)
      RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
      `,
      [data.name, data.slug, data.description, data.parentId, data.level, data.path, keywordsJson, data.countryCode || null]
    );

    return result.rows[0] as CategoryRow;
  }

  /**
   * Atualiza uma categoria
   */
  async update(categoryId: string, data: {
    name?: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
    level?: number;
    path?: string[];
    keywords?: string[];
    countryCode?: string | null;
  }, client?: any): Promise<CategoryRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.parentId !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`);
      values.push(data.parentId);
    }
    if (data.level !== undefined) {
      updates.push(`level = $${paramIndex++}`);
      values.push(data.level);
    }
    if (data.path !== undefined) {
      updates.push(`path = $${paramIndex++}`);
      values.push(data.path);
    }
    if (data.keywords !== undefined) {
      updates.push(`keywords = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(data.keywords));
    }
    if (data.countryCode !== undefined) {
      updates.push(`country_code = $${paramIndex++}`);
      values.push(data.countryCode);
    }

    if (updates.length === 0) {
      return this.findById(categoryId);
    }

    values.push(categoryId);
    const queryClient = client || pool;
    const result = await queryClient.query(
      `
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE category_id = $${paramIndex}
      RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
      `,
      values
    );

    return (result.rows[0] as CategoryRow) || null;
  }

  /**
   * Busca todas as categorias
   * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
   */
  async findAll(countryCode?: string | null, context?: CategoryContext, client?: any): Promise<CategoryRow[]> {
    if (!context) {
      // Registrar SSOT_VIOLATION antes de lançar erro
      await ssotObservabilityUtil.recordViolation('SSOT_VIOLATION', {
        tenantId: null,
        context: null,
        details: {
          method: 'findAll',
          reason: 'context ausente no repository',
        },
      });
      throw new Error('SSOT_VIOLATION: context is mandatory for category reads');
    }
    
    // 🔴 FILTRO CANÔNICO: Usar buildCanonicalReadFilter para garantir consistência
    const { whereSql, params } = await this.buildCanonicalReadFilter({
      context,
      countryCode,
      includeNullScope: true,
    });
    
    // keywords: JSONB (migration 0061) — alinhado ao schema; path permanece TEXT[]
    let query = `
      SELECT category_id, parent_id, name, slug, description, level, path,
             COALESCE(keywords, '[]'::jsonb) AS keywords,
             country_code, scope, concept_id, metadata, created_at, updated_at
      FROM categories
      WHERE ${whereSql}
      ORDER BY level ASC, name ASC
    `;
    
    // 🔴 LOG DE DIAGNÓSTICO
    console.log('[CategoryRepository.findAll] Query final:', query);
    console.log('[CategoryRepository.findAll] Params:', params);
    
    const queryClient = client || pool;
    try {
      const result = await queryClient.query(query, params);
      
      // 🔴 LOG DE DIAGNÓSTICO
      const rootCount = result.rows.filter((r: CategoryRow) => !r.parent_id).length;
      console.log('[CategoryRepository.findAll] Resultado:', {
        totalRows: result.rows.length,
        rootCategories: rootCount,
        sampleRows: result.rows.slice(0, 5).map((r: CategoryRow) => ({
          id: r.category_id,
          name: r.name,
          parent_id: r.parent_id,
          country_code: r.country_code,
          level: r.level,
        })),
      });
      
      // 🔴 INSPEÇÃO TEMPORÁRIA: Rastrear "Pedreiro"
      const foundPedreiroRepo = result.rows.some((r: CategoryRow) => 
        r.name?.toLowerCase().includes('pedr') || r.slug?.toLowerCase().includes('pedr')
      );
      const pedreiroRow = result.rows.find((r: CategoryRow) => 
        r.name?.toLowerCase().includes('pedr') || r.slug?.toLowerCase().includes('pedr')
      );
      console.log('[INSPEÇÃO] Repository findAll:', {
        countTotal: result.rows.length,
        foundPedreiroRepo,
        pedreiroInfo: pedreiroRow ? {
          id: pedreiroRow.category_id,
          name: pedreiroRow.name,
          slug: pedreiroRow.slug,
          parent_id: pedreiroRow.parent_id,
          level: pedreiroRow.level,
          scope: pedreiroRow.scope,
        } : null,
      });
      
      return result.rows as CategoryRow[];
    } catch (error) {
      console.error('[CategoryRepository.findAll] Erro na query:', error);
      console.error('[CategoryRepository.findAll] Query:', query);
      console.error('[CategoryRepository.findAll] Params:', params);
      throw error;
    }
  }

  /**
   * Registra auditoria de criação de categoria
   */
  async logCategoryCreation(data: {
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
  }): Promise<void> {
    try {
      // Verificar se tabela category_ai_logs existe
      const tableExists = await pool.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'category_ai_logs'
        ) as exists
        `
      );

      if (!tableExists.rows[0]?.exists) {
        // Tabela não existe ainda, pular log (não crítico)
        return;
      }

      await pool.query(
        `
        INSERT INTO category_ai_logs (
          category_id, tenant_id, actor_id, global_user_id,
          input_type, original_text, sanitized_text,
          text_hash, audio_hash, audio_url,
          context, ai_suggestion, ai_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (category_id) DO UPDATE SET
          original_text = EXCLUDED.original_text,
          sanitized_text = EXCLUDED.sanitized_text,
          text_hash = EXCLUDED.text_hash,
          audio_hash = EXCLUDED.audio_hash,
          audio_url = EXCLUDED.audio_url,
          context = EXCLUDED.context,
          ai_suggestion = EXCLUDED.ai_suggestion,
          ai_confidence = EXCLUDED.ai_confidence
        `,
        [
          data.categoryId,
          data.tenantId || null,
          data.actorId || null,
          data.globalUserId || null,
          data.source === 'ai' ? 'text' : 'text', // input_type
          data.originalText || null,
          data.sanitizedText || null,
          data.textHash || null,
          data.audioHash || null,
          data.audioUrl || null,
          data.context || null,
          data.aiSuggestion ? JSON.stringify(data.aiSuggestion) : null,
          data.aiConfidence || null,
        ]
      );
    } catch (error) {
      // Log não crítico - não falhar criação se log falhar
      console.error('Erro ao registrar auditoria de categoria (não crítico):', error);
    }
  }
}









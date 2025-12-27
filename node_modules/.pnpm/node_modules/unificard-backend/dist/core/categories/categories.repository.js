"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryRepository = void 0;
// src/core/categories/categories.repository.ts
const pool_1 = require("@core/database/pool");
class CategoryRepository {
    _hasStatusColumn = null;
    /**
     * Verifica se a coluna status existe na tabela categories
     * Cacheia o resultado para evitar múltiplas consultas
     */
    async hasStatusColumn() {
        if (this._hasStatusColumn !== null) {
            return this._hasStatusColumn;
        }
        const statusCheck = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as exists
      `);
        this._hasStatusColumn = statusCheck.rows[0]?.exists || false;
        return this._hasStatusColumn;
    }
    /**
     * Retorna a condição WHERE para filtrar por status (se a coluna existir)
     */
    async getStatusCondition() {
        const hasStatus = await this.hasStatusColumn();
        // FASE 3.6: Incluir auto_active como visível e usável
        return hasStatus ? '(status IS NULL OR status = \'active\' OR status = \'auto_active\')' : '1=1';
    }
    /**
     * Busca categoria por ID
     */
    async findById(categoryId, client) {
        const statusCondition = await this.getStatusCondition();
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE category_id = $1 AND ${statusCondition}
      LIMIT 1
      `, [categoryId]);
        return result.rows[0] || null;
    }
    /**
     * Busca categoria por slug
     */
    async findBySlug(slug, countryCode, client) {
        const statusCondition = await this.getStatusCondition();
        let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE slug = $1 AND ${statusCondition}
    `;
        const params = [slug];
        if (countryCode !== undefined) {
            // Se countryCode é fornecido, buscar categoria específica do país OU global (NULL)
            query += ` AND (country_code = $2 OR country_code IS NULL)`;
            params.push(countryCode);
            query += ` ORDER BY country_code DESC NULLS LAST LIMIT 1`;
        }
        else {
            query += ` LIMIT 1`;
        }
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(query, params);
        return result.rows[0] || null;
    }
    /**
     * FASE 3.7 — PROPERTY CANÔNICO
     * Busca categoria por (slug + parent_id) de forma 100% idempotente
     * Resolve definitivamente o erro: "could not determine data type of parameter $2"
     */
    async findBySlugAndParent(slug, parentId, client) {
        const statusCondition = await this.getStatusCondition();
        // 🔒 CASO 1 — ROOT (parent_id IS NULL)
        if (parentId === null) {
            const queryClient = client || pool_1.pool;
            const result = await queryClient.query(`
        SELECT category_id, parent_id, name, slug, description, level, path,
               COALESCE(keywords, '[]'::jsonb) as keywords,
               country_code, created_at, updated_at
        FROM categories
        WHERE slug = $1
          AND parent_id IS NULL
          AND ${statusCondition}
        LIMIT 1
        `, [slug]);
            return result.rows[0] ?? null;
        }
        // 🔒 CASO 2 — COM PARENT DEFINIDO
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT category_id, parent_id, name, slug, description, level, path,
             COALESCE(keywords, '[]'::jsonb) as keywords,
             country_code, created_at, updated_at
      FROM categories
      WHERE slug = $1
        AND parent_id = $2::uuid
        AND ${statusCondition}
      LIMIT 1
      `, [slug, parentId]);
        return result.rows[0] ?? null;
    }
    /**
     * Busca todas as categorias raiz (sem parent)
     * @param countryCode - Se fornecido, retorna apenas categorias globais (NULL) ou do país especificado
     */
    async findRootCategories(countryCode, client) {
        const statusCondition = await this.getStatusCondition();
        let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE parent_id IS NULL AND ${statusCondition}
    `;
        const params = [];
        if (countryCode !== undefined) {
            // Se countryCode é fornecido, buscar categorias globais (NULL) ou do país
            query += ` AND (country_code = $1 OR country_code IS NULL)`;
            params.push(countryCode);
        }
        query += ` ORDER BY country_code DESC NULLS LAST, name ASC`;
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(query, params);
        return result.rows;
    }
    /**
     * Busca filhos de uma categoria
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    async findChildren(parentId, countryCode, client) {
        const statusCondition = await this.getStatusCondition();
        let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE parent_id = $1 AND ${statusCondition}
    `;
        const params = [parentId];
        if (countryCode !== undefined) {
            // Se countryCode é fornecido, buscar categorias globais (NULL) ou do país
            query += ` AND (country_code = $2 OR country_code IS NULL)`;
            params.push(countryCode);
        }
        query += ` ORDER BY country_code DESC NULLS LAST, name ASC`;
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(query, params);
        return result.rows;
    }
    /**
     * Busca categoria por nome exato e parent (FASE 3.7: Previne duplicação com tipagem correta)
     */
    async findByNameAndParent(name, parentId, client) {
        const statusCondition = await this.getStatusCondition();
        // 🔒 CASO 1 — ROOT (parent_id IS NULL)
        if (parentId === null) {
            const queryClient = client || pool_1.pool;
            const result = await queryClient.query(`
        SELECT category_id, parent_id, name, slug, description, level, path, 
               COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
        FROM categories
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) 
          AND parent_id IS NULL
          AND ${statusCondition}
        LIMIT 1
        `, [name]);
            return result.rows[0] ?? null;
        }
        // 🔒 CASO 2 — COM PARENT DEFINIDO
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) 
        AND parent_id = $2::uuid
        AND ${statusCondition}
      LIMIT 1
      `, [name, parentId]);
        return result.rows[0] ?? null;
    }
    /**
     * Busca categoria por nome similar e parent (FASE 3.7: Previne duplicação com tipagem correta)
     */
    async findSimilarNameAndParent(name, parentId, client) {
        const statusCondition = await this.getStatusCondition();
        const normalizedName = name.toLowerCase().trim();
        // 🔒 CASO 1 — ROOT (parent_id IS NULL)
        if (parentId === null) {
            const queryClient = client || pool_1.pool;
            const result = await queryClient.query(`
        SELECT category_id, parent_id, name, slug, description, level, path, 
               COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
        FROM categories
        WHERE LOWER(TRIM(name)) = $1
          AND parent_id IS NULL
          AND ${statusCondition}
        LIMIT 1
        `, [normalizedName]);
            return result.rows[0] ?? null;
        }
        // 🔒 CASO 2 — COM PARENT DEFINIDO
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE LOWER(TRIM(name)) = $1
        AND parent_id = $2::uuid
        AND ${statusCondition}
      LIMIT 1
      `, [normalizedName, parentId]);
        return result.rows[0] ?? null;
    }
    /**
     * Busca categorias por termo (busca inteligente com fuzzy matching)
     * Busca em: name, description, slug, keywords (se existir) e path
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    async search(term, limit = 50, countryCode, client) {
        const searchTerm = term.toLowerCase().trim();
        const searchPattern = `%${searchTerm}%`;
        // Normalizar termo para busca (remover acentos, espaços extras)
        const normalizedTerm = searchTerm
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        // Verificar se a coluna keywords existe
        const hasKeywords = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'keywords'
      ) as exists
      `);
        const keywordsExists = hasKeywords.rows[0]?.exists || false;
        // Verificar se pg_trgm está disponível
        const hasPgTrgm = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
      ) as exists
      `);
        const pgTrgmExists = hasPgTrgm.rows[0]?.exists || false;
        // Construir query dinamicamente baseado no que está disponível
        let keywordsCondition = '';
        let keywordsRelevance = '';
        let fuzzyCondition = '';
        let fuzzyRelevance = '';
        if (keywordsExists) {
            keywordsCondition = `
        -- Busca em keywords (array JSONB)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
          WHERE LOWER(keyword) LIKE $3
        )`;
            keywordsRelevance = `
          -- Keywords contém o termo (busca em array JSONB)
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
            WHERE LOWER(keyword) LIKE $3
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
        // Construir condição de país
        let countryCondition = '';
        const queryParams = [searchTerm, `${normalizedTerm}%`, searchPattern];
        let paramOffset = 3;
        if (countryCode !== undefined) {
            countryCondition = ` AND (country_code = $${paramOffset + 1} OR country_code IS NULL)`;
            queryParams.push(countryCode);
            paramOffset++;
        }
        const limitParam = paramOffset + 1;
        queryParams.push(limit);
        const statusCondition = await this.getStatusCondition();
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT 
        category_id, parent_id, name, slug, description, level, path, 
        COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at,
        -- Calcular relevância para ordenação
        CASE
          -- Match exato no nome (maior prioridade)
          WHEN LOWER(name) = $1 THEN 100
          -- Match exato no slug
          WHEN LOWER(slug) = $1 THEN 90
          -- Nome começa com o termo
          WHEN LOWER(name) LIKE $2 THEN 80
          -- Slug começa com o termo
          WHEN LOWER(slug) LIKE $2 THEN 70
          -- Nome contém o termo
          WHEN LOWER(name) LIKE $3 THEN 60
          -- Descrição contém o termo
          WHEN LOWER(description) LIKE $3 THEN 50${keywordsRelevance}
          -- Path contém o termo
          WHEN EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $3
          ) THEN 30${fuzzyRelevance}
          ELSE 10
        END AS relevance
      FROM categories
      WHERE 
        ${statusCondition}
        AND (
          -- Busca em name
          LOWER(name) LIKE $3
          -- Busca em slug
          OR LOWER(slug) LIKE $3
          -- Busca em description
          OR LOWER(description) LIKE $3${keywordsCondition}
          -- Busca em path (array de strings)
          OR EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $3
          )${fuzzyCondition}
        )
        ${countryCondition}
      ORDER BY relevance DESC, country_code DESC NULLS LAST, name ASC
      LIMIT $${limitParam}
      `, queryParams);
        return result.rows;
    }
    /**
     * Autocomplete: busca categorias leaf (level >= 1) ACTIVE para sugestão rápida
     * Retorna apenas categorias finais (não raízes) que podem ser selecionadas diretamente
     * CORREÇÃO: Prioriza busca por prefixo (começa com) antes de busca por contém
     */
    async autocomplete(query, context, countryCode, limit = 20, client) {
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
        const hasPgTrgm = await pool_1.pool.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') as exists`);
        const pgTrgmExists = hasPgTrgm.rows[0]?.exists || false;
        // Verificar se keywords existe
        const hasKeywords = await pool_1.pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'keywords') as exists`);
        const keywordsExists = hasKeywords.rows[0]?.exists || false;
        // Construir condições dinâmicas
        let keywordsCondition = '';
        let keywordsRelevance = '';
        let fuzzyCondition = '';
        let fuzzyRelevance = '';
        if (keywordsExists) {
            keywordsCondition = `
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
          WHERE LOWER(keyword) LIKE $3 OR LOWER(keyword) LIKE $4
        )`;
            keywordsRelevance = `
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
          WHERE LOWER(keyword) LIKE $3
        ) THEN 45
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(keywords) AS keyword
          WHERE LOWER(keyword) LIKE $4
        ) THEN 40`;
        }
        if (pgTrgmExists) {
            fuzzyCondition = `OR similarity(LOWER(name), $1) > 0.3`;
            fuzzyRelevance = `WHEN similarity(LOWER(name), $1) > 0.3 THEN 20`;
        }
        // Filtrar por contexto: professional retorna apenas LEAF (sem filhos)
        // CORREÇÃO CRÍTICA: Usar verificação de LEAF ao invés de level fixo
        // Isso garante que profissões apareçam mesmo se estiverem em level 1
        let leafCondition = '1=1'; // Padrão: qualquer categoria
        if (context === 'professional') {
            // Para professional: retornar SOMENTE categorias LEAF (sem filhos)
            // CORREÇÃO: Verificar apenas se existe filho, sem filtro de status (mais performático)
            // O statusCondition já filtra a categoria pai, então não precisamos filtrar filhos aqui
            leafCondition = `NOT EXISTS (
        SELECT 1 
        FROM categories c2
        WHERE c2.parent_id = categories.category_id
      )`;
        }
        else {
            // Para outros contexts: pode incluir subcategorias (level >= 1)
            leafCondition = 'level >= 1';
        }
        // Construir condição de país - sempre incluir categorias globais (country_code IS NULL)
        let countryCondition = '';
        const queryParams = [searchTerm, prefixPattern, normalizedPrefix, containsPattern];
        let paramOffset = 4;
        if (countryCode !== undefined) {
            countryCondition = ` AND (country_code = $${paramOffset + 1} OR country_code IS NULL)`;
            queryParams.push(countryCode);
            paramOffset++;
        }
        const limitParam = paramOffset + 1;
        queryParams.push(limit);
        const statusCondition = await this.getStatusCondition();
        // CORREÇÃO CRÍTICA: Garantir que busca funcione mesmo sem status column
        // Se status não existe, buscar todas as categorias (assumindo que são active)
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      SELECT 
        category_id, parent_id, name, slug, description, level, path, 
        COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at,
        -- Calcular relevância para ordenação (prioriza prefixo)
        CASE
          -- Match exato no nome (maior prioridade)
          WHEN LOWER(name) = $1 THEN 100
          -- Match exato no slug
          WHEN LOWER(slug) = $1 THEN 90
          -- Nome começa com o termo (prefixo) - ALTA PRIORIDADE
          WHEN LOWER(name) LIKE $2 THEN 85
          -- Slug começa com o termo (prefixo) - ALTA PRIORIDADE
          WHEN LOWER(slug) LIKE $2 THEN 75
          -- Nome normalizado começa com o termo (prefixo sem acentos)
          WHEN LOWER(name) LIKE $3 THEN 70
          -- Slug normalizado começa com o termo
          WHEN LOWER(slug) LIKE $3 THEN 65
          -- Nome contém o termo (fallback)
          WHEN LOWER(name) LIKE $4 THEN 60
          -- Slug contém o termo (fallback)
          WHEN LOWER(slug) LIKE $4 THEN 55
          -- Keywords contém o termo (prefixo primeiro)
          ${keywordsRelevance}
          -- Path contém o termo (verifica último elemento do path)
          WHEN EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $2 OR LOWER(path_item) LIKE $4
          ) THEN 30
          -- Similaridade fuzzy (última opção)
          ${fuzzyRelevance}
          ELSE 10
        END AS relevance
      FROM categories
      WHERE 
        ${statusCondition}
        AND ${leafCondition}
        AND (
          -- Busca em name (prefixo primeiro, depois contém) - CORRIGIDO: busca mais agressiva
          LOWER(name) LIKE $2
          OR LOWER(name) LIKE $4
          OR LOWER(name) LIKE $3
          -- Busca em slug (prefixo primeiro, depois contém)
          OR LOWER(slug) LIKE $2
          OR LOWER(slug) LIKE $4
          OR LOWER(slug) LIKE $3
          -- Busca em keywords
          ${keywordsCondition}
          -- Busca em path (último elemento do path)
          OR EXISTS (
            SELECT 1 FROM unnest(path) AS path_item
            WHERE LOWER(path_item) LIKE $2 OR LOWER(path_item) LIKE $4 OR LOWER(path_item) LIKE $3
          )${fuzzyCondition}
        )
        ${countryCondition}
      ORDER BY relevance DESC, country_code DESC NULLS LAST, name ASC
      LIMIT $${limitParam}
      `, queryParams);
        return result.rows;
    }
    /**
     * Cria uma nova categoria
     * GOVERNANÇA: Por padrão cria como 'pending' a menos que allowActive=true seja explicitamente passado
     * IDEMPOTÊNCIA: Retorna existente se (slug, parent_id) já existir (via constraint)
     */
    async create(data, client) {
        const keywordsJson = data.keywords ? JSON.stringify(data.keywords) : '[]';
        // GOVERNANÇA: Por padrão, criar como 'pending' com requires_review=true
        const status = data.status || 'pending';
        const requiresReview = data.requiresReview !== undefined ? data.requiresReview : (status === 'pending');
        const createdByAI = data.createdByAI || false;
        // IDEMPOTÊNCIA: Tentar inserir, se der erro de constraint, buscar existente
        const queryClient = client || pool_1.pool;
        try {
            const result = await queryClient.query(`
        INSERT INTO categories (
          name, slug, description, parent_id, level, path, keywords, country_code,
          status, requires_review, created_by_ai
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
        RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
        `, [data.name, data.slug, data.description, data.parentId, data.level, data.path, keywordsJson, data.countryCode || null, status, requiresReview, createdByAI]);
            return result.rows[0];
        }
        catch (error) {
            // Se erro for de constraint única (slug duplicado), buscar existente
            if (error.code === '23505' && (error.constraint === 'categories_slug_parent_unique_null' ||
                error.constraint === 'categories_slug_parent_unique_not_null' ||
                error.message?.includes('categories_slug') ||
                error.message?.includes('duplicate key'))) {
                // Buscar categoria existente por (slug, parent_id) usando o mesmo client
                const existing = await this.findBySlugAndParent(data.slug, data.parentId, client);
                if (existing) {
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
    async createPending(data, client) {
        const keywordsJson = data.keywords ? JSON.stringify(data.keywords) : '[]';
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      INSERT INTO categories (
        name, slug, description, parent_id, level, path, keywords, country_code,
        status, requires_review, created_by_ai
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending', true, true)
      RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
      `, [data.name, data.slug, data.description, data.parentId, data.level, data.path, keywordsJson, data.countryCode || null]);
        return result.rows[0];
    }
    /**
     * Atualiza uma categoria
     */
    async update(categoryId, data, client) {
        const updates = [];
        const values = [];
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
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(`
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE category_id = $${paramIndex}
      RETURNING category_id, parent_id, name, slug, description, level, path, keywords, country_code, created_at, updated_at
      `, values);
        return result.rows[0] || null;
    }
    /**
     * Busca todas as categorias
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    async findAll(countryCode, client) {
        const statusCondition = await this.getStatusCondition();
        let query = `
      SELECT category_id, parent_id, name, slug, description, level, path, 
             COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
      FROM categories
      WHERE ${statusCondition}
    `;
        const params = [];
        let paramIndex = 1;
        if (countryCode !== undefined) {
            query += ` AND (country_code = $${paramIndex} OR country_code IS NULL)`;
            params.push(countryCode);
            paramIndex++;
        }
        query += ` ORDER BY level ASC, country_code DESC NULLS LAST, name ASC`;
        const queryClient = client || pool_1.pool;
        const result = await queryClient.query(query, params);
        return result.rows;
    }
    /**
     * Registra auditoria de criação de categoria
     */
    async logCategoryCreation(data) {
        try {
            // Verificar se tabela category_ai_logs existe
            const tableExists = await pool_1.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'category_ai_logs'
        ) as exists
        `);
            if (!tableExists.rows[0]?.exists) {
                // Tabela não existe ainda, pular log (não crítico)
                return;
            }
            await pool_1.pool.query(`
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
        `, [
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
            ]);
        }
        catch (error) {
            // Log não crítico - não falhar criação se log falhar
            console.error('Erro ao registrar auditoria de categoria (não crítico):', error);
        }
    }
}
exports.CategoryRepository = CategoryRepository;
//# sourceMappingURL=categories.repository.js.map
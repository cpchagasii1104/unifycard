"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesService = void 0;
// src/core/categories/categories.service.ts
const pool_1 = require("@core/database/pool");
const pool_2 = require("@core/database/pool");
const crypto_1 = require("crypto");
const categories_repository_1 = require("./categories.repository");
const categories_model_1 = require("./categories.model");
const category_admission_policy_service_1 = require("./policies/category-admission-policy.service");
const category_lexical_gate_service_1 = require("./category-lexical-gate.service");
const occupation_form_checker_service_1 = require("./occupation-form-checker.service");
const cbo_matcher_service_1 = require("./cbo-matcher.service");
const category_input_audit_service_1 = require("./category-input-audit.service");
const category_input_gate_service_1 = require("./category-input-gate.service");
class CategoriesService {
    repository = new categories_repository_1.CategoryRepository();
    // CACHE: Árvore de categorias ACTIVE (performance)
    categoryTreeCache = {
        data: null,
        timestamp: 0,
    };
    // CONFIG: Valores configuráveis via env
    CONFIDENCE_THRESHOLD_AUTO_APPROVE = parseFloat(process.env.CONFIDENCE_THRESHOLD_AUTO_APPROVE || '0.85');
    CONFIDENCE_THRESHOLD = parseFloat(process.env.CATEGORY_CONFIDENCE_THRESHOLD || '0.6');
    CACHE_TTL_SECONDS = parseInt(process.env.CATEGORY_CACHE_TTL_SECONDS || '60', 10);
    MAX_INPUT_LENGTH = parseInt(process.env.CATEGORY_MAX_INPUT_LENGTH || '60', 10);
    /**
     * Sanitiza texto removendo scripts, SQL, URLs e limitando tamanho
     * REGRAS DE SEGURANÇA: Remove conteúdo perigoso antes de processar com IA
     */
    sanitizeText(text, maxLength = 500) {
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
    generateHash(text) {
        return (0, crypto_1.createHash)('sha256').update(text).digest('hex');
    }
    /**
     * Gera slug a partir do nome
     */
    generateSlug(name) {
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
    async calculatePath(categoryId) {
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
    async calculateLevel(parentId) {
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
    async createCategory(input, options) {
        // GOVERNANÇA: Se allowActive=true, validar permissão de admin
        if (input.allowActive && options?.validateAdmin) {
            if (!options.tenantId || !options.userId) {
                throw new Error('TenantId e UserId são obrigatórios para criar categoria como active');
            }
            const { rbacService } = await Promise.resolve().then(() => __importStar(require('../rbac/rbac.service')));
            const hasAdminRole = await rbacService.userHasAnyRole(options.tenantId, options.userId, ['admin']);
            if (!hasAdminRole) {
                throw new Error('Apenas administradores podem criar categorias como active');
            }
        }
        // CATEGORY INPUT GATE — VALIDAÇÃO FINAL CANÔNICA
        // FASE 3.7.1: Hardening - Nenhum bypass por nível
        if (!options?.skipGate && options?.context) {
            const sanitized = this.sanitizeText(input.name, 500);
            if (input.parentId) {
                // Buscar parent para validar existência
                const parent = await this.repository.findById(input.parentId);
                if (!parent) {
                    throw new Error('Categoria pai não encontrada');
                }
                // Se NÃO é raiz (tem parentId), aplicar gate completo
                // Aplica para qualquer categoria com parent (level >= 1)
                const gateResult = await category_input_gate_service_1.categoryInputGateService.validate(sanitized, {
                    context: options.context,
                    skipFormCheck: false,
                    skipCBO: false,
                    tenantId: options.tenantId,
                    actorId: undefined,
                    globalUserId: options.userId,
                });
                if (gateResult.decision === 'DENY') {
                    const suggestion = gateResult.suggestion
                        ? ` Use "${gateResult.suggestion}" em vez de "${input.name}".`
                        : '';
                    throw new Error(`❌ ${gateResult.reasonCode || 'Termo bloqueado'}.${suggestion}`);
                }
            }
            else {
                // Categoria raiz → apenas lexical gate
                const lexicalCheck = category_lexical_gate_service_1.categoryLexicalGateService.validate(sanitized);
                if (lexicalCheck.decision === 'DENY') {
                    await category_input_audit_service_1.categoryInputAuditService.log({
                        inputOriginal: input.name,
                        normalized: lexicalCheck.normalized || sanitized,
                        context: options.context,
                        decision: 'DENY',
                        reasonCode: lexicalCheck.reasonCode,
                        lexicalDecision: 'DENY',
                        tenantId: options.tenantId,
                        globalUserId: options.userId,
                    });
                    throw new Error(`❌ ${lexicalCheck.reasonCode || 'Termo bloqueado por validação léxica'}`);
                }
            }
        }
        // Gerar slug se não fornecido
        const slug = input.slug || this.generateSlug(input.name);
        // FASE 3.7.1: ADVISORY LOCK para evitar race conditions
        const lockKey = this.generateLockKey(input.name, input.parentId ?? null);
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
            // FASE 3.6: Verificar se categoria já existe (por slug e parent, ou por nome e parent)
            const parentId = input.parentId ?? null;
            const existing = await this.checkCategoryExists(input.name, slug, parentId, options?.context, client);
            if (existing) {
                // Se encontrou categoria existente no mesmo nível, retornar ela ao invés de criar
                await client.query('COMMIT');
                return categories_model_1.CategoryModel.fromRow(existing);
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
                name: input.name,
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
                    originalText: input.name,
                    sanitizedText: input.name,
                    context: undefined,
                });
            }
            await client.query('COMMIT');
            // CACHE: Invalidar cache ao criar categoria
            this.invalidateCategoryCache();
            return categories_model_1.CategoryModel.fromRow({ ...row, path: finalPath });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    /**
     * Gera chave de advisory lock baseada em nome e parentId
     * FASE 3.7.1: Hardening - Evitar race conditions
     */
    generateLockKey(name, parentId) {
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
    async createManyCategories(input, options) {
        const created = [];
        for (const catInput of input.categories) {
            let parentId = null;
            // Resolver parentSlug para parentId
            if (catInput.parentSlug) {
                const parent = await this.repository.findBySlug(catInput.parentSlug);
                if (!parent) {
                    throw new Error(`Categoria pai com slug "${catInput.parentSlug}" não encontrada`);
                }
                parentId = parent.category_id;
            }
            const category = await this.createCategory({
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
            }, options);
            created.push(category);
        }
        return created;
    }
    /**
     * Busca categoria por ID
     */
    async getCategoryById(categoryId) {
        const row = await this.repository.findById(categoryId);
        return row ? categories_model_1.CategoryModel.fromRow(row) : null;
    }
    /**
     * Busca árvore completa de categorias
     * @param countryCode - Se fornecido, filtra categorias por país (incluindo globais)
     * @param useCache - Se true, usa cache quando disponível (default: true)
     */
    async getCategoryTree(countryCode, useCache = true) {
        // CACHE: Verificar se cache é válido
        if (useCache && this.categoryTreeCache.data) {
            const cacheAge = (Date.now() - this.categoryTreeCache.timestamp) / 1000;
            const sameCountry = this.categoryTreeCache.countryCode === countryCode;
            if (cacheAge < this.CACHE_TTL_SECONDS && sameCountry) {
                return this.categoryTreeCache.data;
            }
        }
        try {
            const allRows = await this.repository.findAll(countryCode);
            const allCategories = categories_model_1.CategoryModel.fromRows(allRows);
            // Criar mapa de categorias por ID
            const categoryMap = new Map();
            allCategories.forEach((cat) => {
                categoryMap.set(cat.categoryId, { ...cat, children: [] });
            });
            // Construir árvore
            const roots = [];
            allCategories.forEach((cat) => {
                const treeNode = categoryMap.get(cat.categoryId);
                if (cat.parentId) {
                    const parent = categoryMap.get(cat.parentId);
                    if (parent) {
                        parent.children = parent.children || [];
                        parent.children.push(treeNode);
                    }
                }
                else {
                    roots.push(treeNode);
                }
            });
            // CACHE: Atualizar cache
            this.categoryTreeCache = {
                data: roots,
                timestamp: Date.now(),
                countryCode,
            };
            return roots;
        }
        catch (error) {
            // Log detalhado do erro para debug
            console.error('Erro ao buscar árvore de categorias:', error);
            if (error instanceof Error) {
                throw new Error(`Erro ao buscar árvore de categorias: ${error.message}`);
            }
            throw new Error('Erro ao buscar árvore de categorias: Erro desconhecido');
        }
    }
    /**
     * CACHE: Invalida cache de categorias
     * Chamado quando categoria é criada, aprovada ou rejeitada
     */
    invalidateCategoryCache() {
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
    async getChildren(categoryId, countryCode) {
        const rows = await this.repository.findChildren(categoryId, countryCode);
        return categories_model_1.CategoryModel.fromRows(rows);
    }
    /**
     * Busca categorias por termo
     * @param countryCode - Se fornecido, filtra por país (incluindo categorias globais)
     */
    async searchCategories(term, limit = 50, countryCode) {
        const rows = await this.repository.search(term, limit, countryCode);
        return categories_model_1.CategoryModel.fromRows(rows);
    }
    /**
     * Autocomplete: busca categorias leaf ACTIVE para sugestão rápida
     * Retorna apenas categorias finais que podem ser selecionadas diretamente
     */
    async autocompleteCategories(query, context, countryCode, limit = 20) {
        if (!query || query.trim().length < 1) {
            return [];
        }
        const rows = await this.repository.autocomplete(query, context, countryCode, limit);
        if (rows.length === 0) {
            return [];
        }
        // Coletar todos os slugs únicos do path para buscar nomes em uma única query
        const allSlugs = new Set();
        rows.forEach(row => {
            if (row.path) {
                row.path.forEach(slug => allSlugs.add(slug));
            }
        });
        // Buscar nomes de todas as categorias no path de uma vez
        const slugToName = new Map();
        if (allSlugs.size > 0) {
            const slugsArray = Array.from(allSlugs);
            const pathCategories = await pool_2.pool.query(`SELECT slug, name FROM categories WHERE slug = ANY($1::text[])`, [slugsArray]);
            pathCategories.rows.forEach(cat => {
                slugToName.set(cat.slug, cat.name);
            });
        }
        // Converter para formato de autocomplete com path completo formatado
        const results = [];
        for (const row of rows) {
            // Construir fullPathLabel usando os nomes buscados
            let fullPathLabel = row.name;
            if (row.path && row.path.length > 1) {
                const pathNames = [];
                // Para cada slug no path, buscar o nome (exceto o último que é a própria categoria)
                for (let i = 0; i < row.path.length - 1; i++) {
                    const slug = row.path[i];
                    const name = slugToName.get(slug) || slug; // Fallback para slug se não encontrar
                    pathNames.push(name);
                }
                // Adicionar o nome da categoria atual (último item do path)
                pathNames.push(row.name);
                fullPathLabel = pathNames.join(' > ');
            }
            else if (row.path && row.path.length === 1) {
                // Se path tem apenas 1 item, é a própria categoria
                fullPathLabel = row.name;
            }
            results.push({
                id: row.category_id,
                name: row.name,
                slug: row.slug,
                level: row.level,
                path: row.path || [],
                fullPathLabel,
            });
        }
        return results;
    }
    /**
     * Associa categoria a uma empresa
     */
    async assignCategoryToCompany(tenantId, input) {
        // Verificar se categoria existe
        const category = await this.getCategoryById(input.categoryId);
        if (!category) {
            throw new Error('Categoria não encontrada');
        }
        // Verificar se já está associada
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id
      FROM company_categories
      WHERE tenant_id = $1 AND company_id = $2 AND category_id = $3
      LIMIT 1
      `, [tenantId, input.companyId, input.categoryId]);
        if (existing) {
            throw new Error('Categoria já está associada a esta empresa');
        }
        // Associar
        await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO company_categories (tenant_id, company_id, category_id)
      VALUES ($1, $2, $3)
      `, [tenantId, input.companyId, input.categoryId]);
    }
    /**
     * Associa skill/categoria a um usuário
     */
    async assignSkillToUser(globalUserId, input) {
        // Verificar se categoria existe
        const category = await this.getCategoryById(input.categoryId);
        if (!category) {
            throw new Error('Categoria não encontrada');
        }
        // Upsert skill
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        await pool.query(`
      INSERT INTO user_skills_categories (global_user_id, category_id, skill_level, years_experience, hourly_rate, pricing_type)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'hourly'))
      ON CONFLICT (global_user_id, category_id)
      DO UPDATE SET 
        skill_level = EXCLUDED.skill_level, 
        years_experience = EXCLUDED.years_experience,
        hourly_rate = EXCLUDED.hourly_rate,
        pricing_type = COALESCE(EXCLUDED.pricing_type, user_skills_categories.pricing_type),
        updated_at = now()
      `, [globalUserId, input.categoryId, input.skillLevel ?? 0, input.yearsExperience ?? 0, input.hourlyRate ?? null, input.pricingType || 'hourly']);
    }
    /**
     * Classifica texto em categorias (preparado para integração com AI Kernel)
     */
    async classifyTextIntoCategories(input) {
        // TODO: Implementar integração com AI Kernel
        // Por enquanto, retorna array vazio
        // O AI Kernel pode chamar este método e implementar a lógica de classificação
        const maxCategories = input.maxCategories || 5;
        // Placeholder: busca simples por palavras-chave
        // Em produção, isso será substituído por chamada ao AI Kernel
        const searchResults = await this.searchCategories(input.text, maxCategories);
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
    validateInputByContext(text, context) {
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
        }
        else if (context === 'interest') {
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
        }
        else if (context === 'education' || context === 'learning') {
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
    async suggestCategoryPath(input, context = 'professional', countryCode) {
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
        const categoryTree = await this.getCategoryTree(searchCountryCode, true);
        // Filtrar apenas categorias ACTIVE ou AUTO_ACTIVE (getCategoryTree já filtra por status)
        // FASE 3.6: Incluir auto_active como visível e usável
        const activeCategories = categoryTree.filter(cat => !cat.status || cat.status === 'active' || cat.status === 'auto_active');
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
        const searchResults = await this.searchCategories(sanitizedText, 10, searchCountryCode);
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
        const { AIKernel } = await Promise.resolve().then(() => __importStar(require('../ai/ai-kernel')));
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
        let aiSuggestion;
        let aiConfidence = 0.5;
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
                }
                else {
                    // Fallback para análise simples
                    aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
                }
            }
            else {
                aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
            }
        }
        catch (error) {
            console.warn('Erro ao processar com IA, usando análise simples:', error);
            aiSuggestion = this.simpleCategoryPathAnalysis(sanitizedText, context, activeCategories);
        }
        // 5. Validar e buscar categorias sugeridas
        // FASE 3.6: A IA agora pode sugerir criar grupo e subgrupo mesmo que não existam
        let suggestedRoot = null;
        let suggestedParent = null;
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
        }
        else if (aiSuggestion.rootId || aiSuggestion.rootSlug) {
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
        }
        else if (aiSuggestion.parentId || aiSuggestion.parentSlug) {
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
    async ensureCompleteHierarchy(profession, context, pathSuggestion, countryCode, tenantId, actorId, globalUserId) {
        let rootId = null;
        let subgroupId = null;
        let minConfidence = pathSuggestion.confidence;
        // PASSO 1: Garantir que há um GRUPO (raiz)
        if (pathSuggestion.suggestedRoot) {
            // TAREFA A: Buscar existente por (slug, parent_id=null) - IDEMPOTÊNCIA
            const existingRoot = await this.repository.findBySlugAndParent(pathSuggestion.suggestedRoot.slug, null);
            if (existingRoot) {
                rootId = existingRoot.category_id;
            }
            else {
                // Criar grupo
                const rootCategory = await this.createCategory({
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
                }, {
                    tenantId,
                    userId: globalUserId,
                    validateAdmin: false,
                    context: context,
                    skipGate: true, // Grupos são criados internamente, não precisam do gate completo
                });
                rootId = rootCategory.categoryId;
                minConfidence = Math.min(minConfidence, pathSuggestion.confidence);
            }
        }
        else {
            // IA não sugeriu grupo - criar baseado no contexto
            const inferredGroup = this.inferGroupName(profession, context);
            const groupSlug = this.generateSlug(inferredGroup);
            // TAREFA A: Verificar se grupo já existe por (slug, parent_id=null) - IDEMPOTÊNCIA
            const existingRoot = await this.repository.findBySlugAndParent(groupSlug, null);
            if (existingRoot) {
                rootId = existingRoot.category_id;
            }
            else {
                const rootCategory = await this.createCategory({
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
                }, {
                    tenantId,
                    userId: globalUserId,
                    validateAdmin: false,
                });
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
        }
        else if (pathSuggestion.suggestedParent && pathSuggestion.suggestedParent.slug) {
            // TAREFA A: Verificar se subgrupo já existe por (slug, parent_id=rootId) - IDEMPOTÊNCIA
            const existingSubgroup = await this.repository.findBySlugAndParent(pathSuggestion.suggestedParent.slug, rootId // parentId = rootId para subgrupo
            );
            if (existingSubgroup) {
                subgroupId = existingSubgroup.category_id;
            }
            else {
                const subgroupCategory = await this.createCategory({
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
                }, {
                    tenantId,
                    userId: globalUserId,
                    validateAdmin: false,
                    context: context,
                    skipGate: true, // Subgrupos são criados internamente
                });
                subgroupId = subgroupCategory.categoryId;
                minConfidence = Math.min(minConfidence, pathSuggestion.confidence);
            }
        }
        else {
            // IA não sugeriu subgrupo - inferir e criar
            const inferredSubgroup = this.inferSubgroupName(profession, context);
            const subgroupName = inferredSubgroup || this.generateDefaultSubgroupName(profession, context);
            const subgroupSlug = this.generateSlug(subgroupName);
            // TAREFA A: Verificar se subgrupo já existe por (slug, parent_id=rootId) - IDEMPOTÊNCIA
            const existingSubgroup = await this.repository.findBySlugAndParent(subgroupSlug, rootId);
            if (existingSubgroup) {
                subgroupId = existingSubgroup.category_id;
            }
            else {
                const subgroupCategory = await this.createCategory({
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
                }, {
                    tenantId,
                    userId: globalUserId,
                    validateAdmin: false,
                    context: context,
                    skipGate: true, // Subgrupos são criados internamente
                });
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
    inferGroupName(profession, context) {
        const lowerProfession = profession.toLowerCase().trim();
        // Mapeamento de profissões para grupos
        const professionToGroup = {
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
        }
        else if (context === 'education' || context === 'learning') {
            return 'Educação e Conhecimento Geral';
        }
        else {
            return 'Outros';
        }
    }
    /**
     * Gera nome padrão de subgrupo quando não consegue inferir
     */
    generateDefaultSubgroupName(profession, context) {
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
    inferSubgroupName(profession, context) {
        const lowerProfession = profession.toLowerCase().trim();
        // Mapeamento de profissões para subgrupos
        const professionToSubgroup = {
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
    canAutoCreateSubcategoryWithAI(params) {
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
    async shouldAutoApproveSuggestion(input, context, confidence, suggestedParent) {
        // 1. Verificar se já existe no autocomplete (match exato)
        const autocompleteResults = await this.autocompleteCategories(input, context, undefined, 5);
        const exactMatch = autocompleteResults.find(r => r.name.toLowerCase() === input.toLowerCase().trim() || r.slug === this.generateSlug(input));
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
            const isCommonTerm = commonTerms.some(term => inputLower === term || inputLower.includes(term) || term.includes(inputLower));
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
    normalizeNameToTitleCase(name) {
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
    async checkCategoryExists(name, slug, parentId = null, context, client) {
        const normalizedSlug = this.generateSlug(slug || name);
        // FASE 3.7 — PROPERTY CANÔNICO: Busca por (slug + parent_id) idempotente
        const existing = await this.repository.findBySlugAndParent(normalizedSlug, parentId ?? null, client);
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
    simpleCategoryPathAnalysis(text, context, categoryTree) {
        const normalizedName = text.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        // Tentar encontrar categoria relacionada por palavras-chave simples
        let parentSlug = null;
        let rootSlug = null;
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
                if (parentSlug)
                    break;
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
    async createCategoryWithAI(input) {
        const { text, context = 'professional', parentId, countryCode, tenantId, actorId, globalUserId, inputType = 'text', audioUrl, audioHash, } = input;
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
        const autocompleteCheck = await this.autocompleteCategories(sanitizedText, context, countryCode, 5);
        const exactMatch = autocompleteCheck.find(r => r.name.toLowerCase() === sanitizedText.toLowerCase().trim() ||
            r.slug === this.generateSlug(sanitizedText));
        if (exactMatch) {
            const existingCategory = await this.repository.findById(exactMatch.id);
            if (existingCategory) {
                return {
                    created: false,
                    existingCategory: categories_model_1.CategoryModel.fromRow(existingCategory),
                    message: `Categoria "${exactMatch.name}" já existe`,
                    suggestedParent: null,
                    requiresApproval: false,
                };
            }
        }
        // 3.5. CATEGORY INPUT GATE - ETAPA 1: Bloqueio Léxico Seguro (0-2ms)
        const lexicalCheck = category_lexical_gate_service_1.categoryLexicalGateService.validate(sanitizedText);
        if (lexicalCheck.decision === 'DENY') {
            // Auditoria
            await category_input_audit_service_1.categoryInputAuditService.log({
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
            const { categoryInputGateService } = await Promise.resolve().then(() => __importStar(require('./category-input-gate.service')));
            const { hobbyRateLimitService } = await Promise.resolve().then(() => __importStar(require('./hobby-rate-limit.service')));
            // Verificar rate limit (10 tentativas/minuto)
            if (actorId && tenantId) {
                const rateLimitCheck = await hobbyRateLimitService.checkRateLimit(actorId, tenantId);
                if (!rateLimitCheck.allowed) {
                    throw new Error(`❌ Limite de tentativas excedido. Aguarde ${Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000)} segundos.`);
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
        let formCheckDecision = 'ALLOW';
        let formCheckSuggestion;
        if (context === 'professional' || context === 'education' || context === 'company' || context === 'learning') {
            const formCheck = occupation_form_checker_service_1.occupationFormCheckerService.validate(sanitizedText, context);
            formCheckDecision = formCheck.decision;
            formCheckSuggestion = formCheck.suggestion;
            if (formCheck.decision === 'DENY') {
                // Auditoria
                await category_input_audit_service_1.categoryInputAuditService.log({
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
        let cboMatch = null;
        if (context === 'professional' || context === 'education') {
            try {
                cboMatch = await cbo_matcher_service_1.cboMatcherService.findMatch(sanitizedText);
                // Se encontrou match forte no CBO, usar canonical_id (não bloqueia se não encontrar)
            }
            catch (error) {
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
            admissionDecision = await category_admission_policy_service_1.categoryAdmissionPolicyService.validateProfessionalCategory(sanitizedText, aiContextForPolicy);
        }
        else if (context === 'company') {
            // Para 'company', usar validação de interesse (mais permissiva, similar a interest)
            admissionDecision = await category_admission_policy_service_1.categoryAdmissionPolicyService.validateInterestCategory(sanitizedText, aiContextForPolicy);
        }
        else {
            // Para 'interest' ou 'lifestyle', usar validação de interesse (mais permissiva)
            admissionDecision = await category_admission_policy_service_1.categoryAdmissionPolicyService.validateInterestCategory(sanitizedText, aiContextForPolicy);
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
                    existingCategory: categories_model_1.CategoryModel.fromRow(existingBySlug),
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
            const pendingCategory = await this.createCategory({
                name: normalizedName,
                slug: normalizedSlug,
                description: pathSuggestion.leafDescription || `Categoria sugerida: ${sanitizedText} (aguardando revisão)`,
                parentId: parentId || pathSuggestion.suggestedParent?.id || null,
                keywords: pathSuggestion.keywords || [sanitizedText.toLowerCase()],
                countryCode: context === 'education' ? countryCode || null : null,
                allowActive: false, // Não permitir active para REVIEW
            }, {
                tenantId,
                userId: globalUserId,
                validateAdmin: false,
            });
            // Atualizar status para 'pending_review' explicitamente
            // Usar update direto no banco
            await pool_2.pool.query(`UPDATE categories 
         SET status = $1, requires_review = $2, updated_at = NOW()
         WHERE category_id = $3`, ['pending_review', true, pendingCategory.categoryId]);
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
        const { rootId, subgroupId, minConfidence } = await this.ensureCompleteHierarchy(sanitizedText, context, pathSuggestion, countryCode, tenantId, actorId, globalUserId);
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
        let autoApproveDecision;
        if (canAutoCreate && finalParentId) {
            // Se pode criar automaticamente, auto-aprovar
            autoApproveDecision = {
                autoApprove: true,
                reason: `Subcategoria válida criada automaticamente: ${pathSuggestion.leafName} (confidence: ${pathSuggestion.confidence.toFixed(2)})`
            };
        }
        else {
            // Caso contrário, usar lógica padrão
            autoApproveDecision = await this.shouldAutoApproveSuggestion(sanitizedText, context, pathSuggestion.confidence, pathSuggestion.suggestedParent);
        }
        // 10. Normalizar nome para Title Case
        const normalizedName = this.normalizeNameToTitleCase(pathSuggestion.leafName);
        const normalizedSlug = this.generateSlug(normalizedName);
        // 11. Verificar duplicata (por slug, nome exato ou similar)
        const existingBySlug = await this.checkCategoryExists(normalizedName, normalizedSlug, finalParentId, context);
        if (existingBySlug) {
            return {
                created: false,
                existingCategory: categories_model_1.CategoryModel.fromRow(existingBySlug),
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
        const newCategory = await this.createCategory({
            name: normalizedName,
            slug: normalizedSlug,
            description: pathSuggestion.leafDescription || `Categoria criada automaticamente para: ${sanitizedText}`,
            parentId: finalParentId,
            keywords: pathSuggestion.keywords || [sanitizedText.toLowerCase()],
            countryCode: context === 'education' ? countryCode || null : null,
            allowActive: true, // FASE 3.6: Sempre permitir auto_active para categorias criadas por IA
        }, {
            tenantId,
            userId: globalUserId,
            validateAdmin: false, // Auto-approve não precisa validação admin
            context,
            skipGate: true, // Já passou pelo gate antes, não precisa validar novamente
        });
        // 12. AUDITORIA: Registrar origem completa
        // FASE 3.6: Confidence agregado = mínimo entre todos os níveis criados (raiz, subgrupo, profissão)
        const aggregatedConfidence = Math.min(minConfidence, pathSuggestion.confidence);
        // Auditoria completa do Category Input Gate
        await category_input_audit_service_1.categoryInputAuditService.log({
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
    async createCategoryPending(input, requiresReview = true) {
        const slug = input.slug || this.generateSlug(input.name);
        // PROPERTY: Verificação contextual por (slug, parent_id) - não busca global
        const parentId = input.parentId ?? null;
        const existing = await this.repository.findBySlugAndParent(slug, parentId);
        if (existing) {
            // PROPERTY: Idempotência - retornar existente ao invés de erro
            return categories_model_1.CategoryModel.fromRow(existing);
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
            name: input.name,
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
        return categories_model_1.CategoryModel.fromRow({ ...row, path: finalPath });
    }
    /**
     * Análise simples de categoria quando IA não está disponível
     */
    simpleCategoryAnalysis(text, context, categoryTree) {
        // Normalizar nome (primeira letra maiúscula)
        const normalizedName = text.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        // Tentar encontrar categoria pai apropriada baseado no contexto
        let parentSlug = null;
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
    async approveCategory(categoryId, approvedByUserId) {
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
        const statusCheck = await pool_2.pool.query(`
      SELECT status, requires_review, created_by_ai
      FROM categories
      WHERE category_id = $1
      `, [categoryId]);
        if (!statusCheck || statusCheck.rows.length === 0) {
            throw new Error('Categoria não encontrada');
        }
        const statusData = statusCheck.rows[0];
        if (statusData.status !== 'pending' || !statusData.requires_review) {
            throw new Error('Apenas categorias pendentes podem ser aprovadas');
        }
        // Atualizar status para 'active'
        await pool_2.pool.query(`
      UPDATE categories
      SET status = 'active',
          requires_review = false,
          approved_by = $1,
          approved_at = now()
      WHERE category_id = $2
      `, [approvedByUserId, categoryId]);
        const updated = await this.getCategoryById(categoryId);
        if (!updated) {
            throw new Error('Erro ao atualizar categoria');
        }
        return updated;
    }
    /**
     * Rejeita uma categoria pendente criada por IA
     */
    async rejectCategory(categoryId, reason) {
        // CACHE: Invalidar cache ao rejeitar categoria (pode ter sido aprovada antes)
        this.invalidateCategoryCache();
        const category = await this.getCategoryById(categoryId);
        if (!category) {
            throw new Error('Categoria não encontrada');
        }
        // Verificar status
        const statusCheck = await pool_2.pool.query(`
      SELECT status, requires_review
      FROM categories
      WHERE category_id = $1
      `, [categoryId]);
        if (!statusCheck || statusCheck.rows.length === 0) {
            throw new Error('Categoria não encontrada');
        }
        const statusData = statusCheck.rows[0];
        if (statusData.status !== 'pending') {
            throw new Error('Apenas categorias pendentes podem ser rejeitadas');
        }
        // Atualizar status para 'rejected'
        await pool_2.pool.query(`
      UPDATE categories
      SET status = 'rejected',
          requires_review = false,
          rejection_reason = $1
      WHERE category_id = $2
      `, [reason, categoryId]);
        const updated = await this.getCategoryById(categoryId);
        if (!updated) {
            throw new Error('Erro ao atualizar categoria');
        }
        return updated;
    }
    /**
     * Lista categorias pendentes de aprovação
     */
    async getPendingCategories() {
        const result = await pool_2.pool.query(`
      SELECT 
        category_id, parent_id, name, slug, description, level, path,
        COALESCE(keywords, '[]'::jsonb) as keywords, country_code,
        status, requires_review, created_by_ai, approved_by, approved_at, rejection_reason,
        created_at, updated_at
      FROM categories
      WHERE status = 'pending' AND requires_review = true
      ORDER BY created_at DESC
      `);
        return result.rows.map((row) => categories_model_1.CategoryModel.fromRow(row));
    }
}
exports.categoriesService = new CategoriesService();
//# sourceMappingURL=categories.service.js.map
"use strict";
// src/core/categories/cbo-matcher.service.ts
// ETAPA 3: Busca no dataset CBO com fuzzy match
// FASE 3.8: Category Input Gate
Object.defineProperty(exports, "__esModule", { value: true });
exports.cboMatcherService = void 0;
const pool_1 = require("@core/database/pool");
class CBOMatcherService {
    /**
     * Normaliza input para busca
     */
    normalizeInput(input) {
        return input
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
    /**
     * Busca no CBO usando fuzzy match (pg_trgm)
     * Performance: <50ms com índices adequados
     */
    async findMatch(input) {
        const normalized = this.normalizeInput(input);
        try {
            // Busca por similaridade usando pg_trgm
            const result = await pool_1.pool.query(`SELECT 
          occupation_id,
          cbo_code,
          title,
          similarity(normalized_title, $1) AS similarity
        FROM occupations_reference
        WHERE normalized_title % $1
           OR $1 = ANY(synonyms)
           OR EXISTS (
             SELECT 1 FROM unnest(synonyms) AS syn
             WHERE similarity(syn, $1) > 0.3
           )
        ORDER BY similarity DESC
        LIMIT 5`, [normalized]);
            if (result.rows.length === 0) {
                return {
                    matched: false,
                    reasonCode: 'NO_CBO_MATCH',
                };
            }
            const bestMatch = result.rows[0];
            // Threshold de similaridade: >= 0.5 para considerar match
            if (bestMatch.similarity >= 0.5) {
                return {
                    matched: true,
                    canonicalId: bestMatch.occupation_id,
                    cboCode: bestMatch.cbo_code,
                    title: bestMatch.title,
                    similarity: bestMatch.similarity,
                    reasonCode: 'CBO_FUZZY_MATCH',
                };
            }
            // Similaridade baixa - não é match confiável
            return {
                matched: false,
                reasonCode: 'LOW_SIMILARITY',
                similarity: bestMatch.similarity,
            };
        }
        catch (error) {
            console.error('[CBOMatcher] Erro ao buscar no CBO:', error);
            // Se erro, não bloquear - continuar sem match
            return {
                matched: false,
                reasonCode: 'CBO_SEARCH_ERROR',
            };
        }
    }
    /**
     * Busca exata por sinônimo
     */
    async findExactMatch(input) {
        const normalized = this.normalizeInput(input);
        try {
            const result = await pool_1.pool.query(`SELECT occupation_id, cbo_code, title
         FROM occupations_reference
         WHERE normalized_title = $1
            OR $1 = ANY(synonyms)
         LIMIT 1`, [normalized]);
            if (result.rows.length > 0) {
                return {
                    matched: true,
                    canonicalId: result.rows[0].occupation_id,
                    cboCode: result.rows[0].cbo_code,
                    title: result.rows[0].title,
                    similarity: 1.0,
                    reasonCode: 'CBO_EXACT_MATCH',
                };
            }
            return {
                matched: false,
                reasonCode: 'NO_EXACT_MATCH',
            };
        }
        catch (error) {
            console.error('[CBOMatcher] Erro ao buscar match exato:', error);
            return {
                matched: false,
                reasonCode: 'CBO_SEARCH_ERROR',
            };
        }
    }
}
exports.cboMatcherService = new CBOMatcherService();
//# sourceMappingURL=cbo-matcher.service.js.map
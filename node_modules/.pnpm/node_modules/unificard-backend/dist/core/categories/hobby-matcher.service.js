"use strict";
// backend/src/core/categories/hobby-matcher.service.ts
// ETAPA 4: Matching de Hobbies (Exato + Fuzzy)
// FASE 3: Hobby Gate
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
exports.hobbyMatcherService = void 0;
const pool_1 = require("@core/database/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class HobbyMatcherService {
    hobbies = [];
    initialized = false;
    /**
     * Carrega dataset de hobbies do arquivo JSON
     */
    async loadHobbiesDataset() {
        if (this.initialized)
            return;
        try {
            // Tentar múltiplos caminhos possíveis (desenvolvimento e produção)
            const possiblePaths = [
                path.join(process.cwd(), 'docs/seed/hobbies.json'),
                path.join(__dirname, '../../../docs/seed/hobbies.json'),
                path.join(__dirname, '../../../../docs/seed/hobbies.json'),
            ];
            let fileContent = null;
            for (const hobbiesPath of possiblePaths) {
                try {
                    if (fs.existsSync(hobbiesPath)) {
                        fileContent = fs.readFileSync(hobbiesPath, 'utf-8');
                        break;
                    }
                }
                catch (err) {
                    // Continuar tentando próximo caminho
                }
            }
            if (!fileContent) {
                console.error('[HobbyMatcher] Arquivo hobbies.json não encontrado em nenhum caminho');
                this.hobbies = [];
                this.initialized = true;
                return;
            }
            const data = JSON.parse(fileContent);
            if (Array.isArray(data.hobbies)) {
                this.hobbies = data.hobbies.map((h) => this.normalizeInput(h));
                this.initialized = true;
            }
            else {
                console.error('[HobbyMatcher] Formato inválido no arquivo hobbies.json');
                this.hobbies = [];
                this.initialized = true;
            }
        }
        catch (error) {
            console.error('[HobbyMatcher] Erro ao carregar dataset de hobbies:', error);
            this.hobbies = [];
            this.initialized = true;
        }
    }
    /**
     * Normaliza input para comparação
     */
    normalizeInput(input) {
        return input
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
    /**
     * Match exato no dataset
     */
    findExactMatch(normalized) {
        for (const hobby of this.hobbies) {
            if (hobby === normalized) {
                return hobby;
            }
        }
        return null;
    }
    /**
     * Match fuzzy usando pg_trgm
     * Threshold: >= 0.85
     * Limite: 3 resultados
     */
    async findFuzzyMatch(normalized) {
        try {
            // Verificar se pg_trgm está disponível
            const extensionCheck = await pool_1.pool.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') as exists`);
            if (!extensionCheck.rows[0]?.exists) {
                // pg_trgm não disponível, usar matching simples (Levenshtein-like)
                return this.findSimpleFuzzyMatch(normalized);
            }
            // Buscar no dataset usando similaridade em batch
            // Criar array temporário no banco e usar similarity em lote
            const hobbiesArray = this.hobbies.slice(0, 250); // Limitar para performance
            // Usar unnest para comparar todos de uma vez
            const result = await pool_1.pool.query(`
        SELECT 
          hobby,
          similarity($1, hobby) as similarity
        FROM unnest($2::text[]) AS hobby
        WHERE similarity($1, hobby) >= 0.85
        ORDER BY similarity DESC
        LIMIT 3
        `, [normalized, hobbiesArray]);
            if (result.rows.length > 0) {
                return result.rows[0];
            }
            return null;
        }
        catch (error) {
            console.error('[HobbyMatcher] Erro ao buscar fuzzy match:', error);
            // Fallback para matching simples
            return this.findSimpleFuzzyMatch(normalized);
        }
    }
    /**
     * Matching simples sem pg_trgm (fallback)
     * Usa similaridade de strings básica
     */
    findSimpleFuzzyMatch(normalized) {
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const hobby of this.hobbies) {
            const similarity = this.calculateSimpleSimilarity(normalized, hobby);
            if (similarity >= 0.85 && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = { hobby, similarity };
            }
        }
        return bestMatch;
    }
    /**
     * Calcula similaridade simples entre duas strings
     * Usa Jaro-Winkler-like ou Levenshtein normalizado
     */
    calculateSimpleSimilarity(str1, str2) {
        // Se são iguais, similaridade 1.0
        if (str1 === str2)
            return 1.0;
        // Se uma contém a outra, alta similaridade
        if (str1.includes(str2) || str2.includes(str1)) {
            const minLen = Math.min(str1.length, str2.length);
            const maxLen = Math.max(str1.length, str2.length);
            return minLen / maxLen;
        }
        // Similaridade básica baseada em palavras comuns
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w));
        const totalWords = new Set([...words1, ...words2]).size;
        if (totalWords === 0)
            return 0;
        return (commonWords.length * 2) / totalWords;
    }
    /**
     * Busca match de hobby
     *
     * Fluxo:
     * 1. Match exato → ALLOW
     * 2. Fuzzy >= 0.85 → ALLOW (canonical_id)
     * 3. Senão → DENY
     */
    async findMatch(input) {
        // Garantir que dataset está carregado
        await this.loadHobbiesDataset();
        const normalized = this.normalizeInput(input);
        // 1. Match exato
        const exactMatch = this.findExactMatch(normalized);
        if (exactMatch) {
            return {
                matched: true,
                canonicalHobby: exactMatch,
                similarity: 1.0,
                reasonCode: 'EXACT_MATCH',
            };
        }
        // 2. Fuzzy match
        const fuzzyMatch = await this.findFuzzyMatch(normalized);
        if (fuzzyMatch && fuzzyMatch.similarity >= 0.85) {
            return {
                matched: true,
                canonicalHobby: fuzzyMatch.hobby,
                similarity: fuzzyMatch.similarity,
                reasonCode: 'FUZZY_MATCH_ACCEPTED',
            };
        }
        // 3. Não encontrado
        return {
            matched: false,
            reasonCode: 'NOT_IN_HOBBY_DATASET',
        };
    }
    /**
     * Verifica se hobby está no dataset (sem fuzzy)
     * Útil para validação rápida
     */
    async isInDataset(input) {
        await this.loadHobbiesDataset();
        const normalized = this.normalizeInput(input);
        return this.findExactMatch(normalized) !== null;
    }
}
exports.hobbyMatcherService = new HobbyMatcherService();

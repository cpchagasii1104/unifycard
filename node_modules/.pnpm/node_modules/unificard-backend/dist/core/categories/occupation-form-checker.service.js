"use strict";
// src/core/categories/occupation-form-checker.service.ts
// ETAPA 2: Occupation Form Check (Sintático)
// Valida estrutura sintática de profissões
Object.defineProperty(exports, "__esModule", { value: true });
exports.occupationFormCheckerService = void 0;
class OccupationFormCheckerService {
    // Sufixos ocupacionais reconhecidos
    OCCUPATIONAL_SUFFIXES = [
        'ista', 'ista', // artista, dentista, jornalista
        'or', 'ora', // professor, professora, diretor, diretora
        'eiro', 'eira', // pedreiro, pedreira, cozinheiro, cozinheira
        'ólogo', 'ologo', 'óloga', 'ologa', // psicólogo, psicóloga, biólogo, bióloga
        'nte', // estudante, assistente, gerente
        'ário', 'ario', 'ária', 'aria', // secretário, secretária, bibliotecário
        'dor', 'dora', // motorista, motorista, vendedor, vendedora
        'ista', // especialista, terapeuta
    ];
    // Prefixos de função
    FUNCTION_PREFIXES = [
        'analista de',
        'analista em',
        'gerente de',
        'gerente em',
        'técnico de',
        'técnico em',
        'especialista em',
        'especialista de',
        'auxiliar de',
        'auxiliar em',
        'assistente de',
        'assistente em',
        'coordenador de',
        'coordenador em',
        'coordenadora de',
        'coordenadora em',
        'supervisor de',
        'supervisor em',
        'diretor de',
        'diretor em',
        'diretora de',
        'diretora em',
    ];
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
     * Verifica se termo termina com sufixo ocupacional
     */
    hasOccupationalSuffix(term) {
        const normalized = this.normalizeInput(term);
        for (const suffix of this.OCCUPATIONAL_SUFFIXES) {
            if (normalized.endsWith(suffix)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Verifica se termo começa com prefixo de função
     */
    hasFunctionPrefix(term) {
        const normalized = this.normalizeInput(term);
        for (const prefix of this.FUNCTION_PREFIXES) {
            if (normalized.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Verifica estrutura "cargo + de/em + área" (mínimo 3 palavras)
     */
    hasValidStructure(term) {
        const words = term.trim().split(/\s+/);
        // Mínimo 3 palavras
        if (words.length < 3) {
            return false;
        }
        // Deve conter "de" ou "em" como preposição
        const hasPreposition = words.some(word => word.toLowerCase() === 'de' || word.toLowerCase() === 'em');
        return hasPreposition;
    }
    /**
     * Gera sugestão de forma correta
     */
    generateSuggestion(term) {
        const normalized = this.normalizeInput(term);
        // Mapeamento de sugestões conhecidas
        const suggestions = {
            'futebol': 'Jogador de Futebol',
            'cinema': 'Cineasta',
            'marketing': 'Analista de Marketing',
            'música': 'Músico',
            'musica': 'Músico',
            'arte': 'Artista',
            'comida': 'Chef de Cozinha',
            'academia': 'Personal Trainer',
            'beleza': 'Esteticista',
            'saúde': 'Profissional de Saúde',
            'saude': 'Profissional de Saúde',
            'educação': 'Educador',
            'educacao': 'Educador',
            'tecnologia': 'Profissional de Tecnologia',
        };
        if (suggestions[normalized]) {
            return suggestions[normalized];
        }
        // Sugestão genérica baseada em padrão
        if (normalized.length > 0) {
            const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
            return `Profissional de ${capitalized}`;
        }
        return term;
    }
    /**
     * Valida forma ocupacional
     */
    validate(input, context = 'professional') {
        // Para interesses/hobbies, validação mais permissiva
        if (context === 'interest' || context === 'hobby') {
            return {
                decision: 'ALLOW',
            };
        }
        // Para empresas, validação mais permissiva (apenas bloquear genéricos)
        if (context === 'company') {
            const normalized = this.normalizeInput(input);
            const genericTerms = ['empresa', 'trabalhar', 'trabalho', 'negocio', 'negócio', 'trabalho', 'emprego', 'cargo', 'funcao', 'função'];
            if (genericTerms.includes(normalized)) {
                return {
                    decision: 'DENY',
                    reasonCode: 'GENERIC_COMPANY_TERM',
                    suggestion: 'Use o nome específico da empresa (ex: "Google", "Microsoft", "Hospital São Lucas")',
                };
            }
            // Para empresas, permitir qualquer nome específico (não precisa de sufixo ocupacional)
            return {
                decision: 'ALLOW',
            };
        }
        // Para educação, usar mesma validação de profissão
        // (context === 'professional' || context === 'education')
        const normalized = this.normalizeInput(input);
        const words = normalized.split(/\s+/).filter(w => w.length > 0);
        // Aceitar se cumprir pelo menos 1 critério:
        // 1. Sufixo ocupacional
        if (this.hasOccupationalSuffix(normalized)) {
            return {
                decision: 'ALLOW',
            };
        }
        // 2. Prefixo de função
        if (this.hasFunctionPrefix(normalized)) {
            return {
                decision: 'ALLOW',
            };
        }
        // 3. Estrutura válida (cargo + de/em + área)
        if (this.hasValidStructure(normalized)) {
            return {
                decision: 'ALLOW',
            };
        }
        // Rejeitar palavra única sem sufixo ocupacional
        if (words.length === 1 && !this.hasOccupationalSuffix(normalized)) {
            return {
                decision: 'DENY',
                reasonCode: 'SINGLE_WORD_NO_SUFFIX',
                suggestion: this.generateSuggestion(input),
            };
        }
        // Rejeitar termos genéricos sem estrutura
        if (words.length === 1) {
            return {
                decision: 'DENY',
                reasonCode: 'GENERIC_TERM',
                suggestion: this.generateSuggestion(input),
            };
        }
        // Se chegou aqui, permitir (pode ser caso especial)
        return {
            decision: 'ALLOW',
        };
    }
}
exports.occupationFormCheckerService = new OccupationFormCheckerService();
//# sourceMappingURL=occupation-form-checker.service.js.map
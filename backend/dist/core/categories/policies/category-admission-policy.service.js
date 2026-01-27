"use strict";
// src/core/categories/policies/category-admission-policy.service.ts
// Serviço de política de admissão semântica para categorias
// FASE 3.8: Validação obrigatória antes da criação de categorias
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
exports.categoryAdmissionPolicyService = void 0;
const occupational_classification_prompt_1 = require("./occupational-classification.prompt");
class CategoryAdmissionPolicyService {
    // Listas de bloqueio explícito (BLOCK)
    BLOCKED_TERMS = new Set([
        // Sexual explícito
        'punheteiro', 'punheta', 'masturbação', 'masturbacao', 'sexo', 'pornografia',
        'prostituta', 'prostituto', 'garota de programa', 'garoto de programa',
        'escort', 'acompanhante', 'puta', 'puto', 'vadia', 'viado', 'bicha',
        // Crimes
        'ladrão', 'ladrao', 'roubo', 'assalto', 'traficante', 'traficar', 'drogas',
        'homicídio', 'homicidio', 'assassinato', 'estelionato', 'fraude', 'corrupção',
        'corrupcao', 'contrabando', 'pirataria', 'pirata', 'hacker criminoso',
        // Violência e ódio
        'nazista', 'fascista', 'racista', 'xenófobo', 'xenofobo', 'homofóbico',
        'homofobico', 'misógino', 'misogino', 'terrorista', 'terrorismo',
        // Profissões ilegais
        'assassino de aluguel', 'matador', 'sicário', 'sicario',
    ]);
    // Termos que requerem revisão (REVIEW)
    REVIEW_TERMS = new Set([
        'coach', 'influencer', 'influenciador', 'youtuber', 'streamer',
        'blogger', 'vlogger', 'podcaster', 'criador de conteúdo',
        'empreendedor', 'empresário', 'empresario', 'consultor',
        'freelancer', 'autônomo', 'autonomo', 'prestador de serviço',
    ]);
    // Profissões reconhecidas (ALLOW)
    ALLOWED_PROFESSIONS = new Set([
        // Saúde
        'dentista', 'médico', 'medico', 'enfermeiro', 'fisioterapeuta',
        'psicólogo', 'psicologo', 'nutricionista', 'farmacêutico', 'farmaceutico',
        'veterinário', 'veterinario', 'odontólogo', 'odontologo',
        // Educação
        'professor', 'educador', 'instrutor', 'tutor', 'coordenador pedagógico',
        // Tecnologia
        'programador', 'desenvolvedor', 'analista de sistemas', 'designer',
        'engenheiro de software', 'arquiteto de software',
        // Construção
        'pedreiro', 'carpinteiro', 'eletricista', 'encanador', 'pintor',
        'arquiteto', 'engenheiro civil', 'engenheiro',
        // Serviços
        'motorista', 'taxista', 'caminhoneiro', 'entregador',
        'garçom', 'garcom', 'cozinheiro', 'chef', 'barbeiro', 'cabeleireiro',
        'esteticista', 'massagista', 'personal trainer',
        // Comércio
        'vendedor', 'atendente', 'caixa', 'gerente', 'supervisor',
        // Outros
        'advogado', 'contador', 'jornalista', 'fotógrafo', 'fotografo',
        'jornalista', 'publicitário', 'publicitario', 'marketeiro',
    ]);
    // Padrões de bloqueio (regex)
    BLOCK_PATTERNS = [
        /(sexo|sexual|porn|xxx|adulto|erótico|erotico)/i,
        /(ladr|roub|assalt|furt)/i,
        /(trafic|drog|maconh|coca|hero)/i,
        /(mat|assassin|homicíd|homicid)/i,
        /(nazi|fasc|racist|homofób|homofob|xenófob|xenofob)/i,
        /(put|vadi|prostitut|escort|acompanhant)/i,
    ];
    /**
     * Valida categoria profissional usando regras explícitas + IA
     */
    async validateProfessionalCategory(input, aiContext) {
        const normalizedInput = this.normalizeInput(input);
        // 0. FASE 3.8: Validação prévia com IA especializada (se disponível)
        let aiClassification = null;
        try {
            const { AIKernel } = await Promise.resolve().then(() => __importStar(require('../../ai/ai-kernel')));
            const aiKernel = AIKernel.getInstance();
            const prompt = (0, occupational_classification_prompt_1.buildOccupationalClassificationPrompt)(input, 'professional');
            const aiResult = await aiKernel.run(prompt);
            if (aiResult.success && aiResult.result) {
                const jsonMatch = aiResult.result.toString().match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    aiClassification = parsed;
                    // Se IA rejeitou, retornar imediatamente
                    if (parsed && parsed.decision === 'rejected') {
                        return {
                            decision: 'BLOCK',
                            reason: parsed.reason || 'Termo rejeitado pela classificação ocupacional',
                            confidence: Math.min(parsed.confidence || 0.2, 0.2),
                            flags: ['AI_REJECTED', 'OCCUPATIONAL_CLASSIFICATION'],
                            domainType: 'UNKNOWN',
                        };
                    }
                }
            }
        }
        catch (error) {
            // Se IA falhar, continuar com validação por regras
            console.warn('[CategoryAdmissionPolicy] Erro ao usar IA especializada, usando regras:', error);
        }
        // 1. Verificar bloqueio explícito
        const blockCheck = this.checkBlockedTerms(normalizedInput);
        if (blockCheck) {
            return blockCheck;
        }
        // 2. Verificar padrões de bloqueio
        const patternCheck = this.checkBlockPatterns(normalizedInput);
        if (patternCheck) {
            return patternCheck;
        }
        // 3. Classificar domínio usando IA (se disponível) ou heurísticas
        const domainType = await this.classifyDomain(normalizedInput, aiContext);
        // 4. Aplicar regras baseadas no domínio
        if (domainType === 'CRIME' || domainType === 'SEXUAL' || domainType === 'VIOLENCE' || domainType === 'HATE') {
            return {
                decision: 'BLOCK',
                reason: `Termo classificado como ${domainType}: não pode ser cadastrado como profissão`,
                confidence: 0.95,
                flags: [domainType],
                domainType,
            };
        }
        // 5. Verificar se é hobby/esporte (bloquear como profissão)
        if (domainType === 'HOBBY' || domainType === 'SPORT') {
            // Exceção: "Jogador de Futebol" é profissão, mas "Futebol" é esporte
            if (this.isSportAsProfession(normalizedInput)) {
                // Permitir se for claramente uma profissão relacionada ao esporte
                return {
                    decision: 'ALLOW',
                    reason: `Profissão relacionada a esporte reconhecida: ${input}`,
                    confidence: 0.8,
                    flags: ['SPORT_PROFESSION'],
                    domainType: 'PROFESSION',
                };
            }
            return {
                decision: 'BLOCK',
                reason: `"${input}" é um ${domainType === 'HOBBY' ? 'hobby' : 'esporte'}, não uma profissão. Use "Jogador de ${input}" ou similar.`,
                confidence: 0.9,
                flags: [domainType],
                domainType,
            };
        }
        // 6. Verificar termos que requerem revisão
        const reviewCheck = this.checkReviewTerms(normalizedInput);
        if (reviewCheck) {
            return reviewCheck;
        }
        // 7. Verificar profissões reconhecidas
        const allowedCheck = this.checkAllowedProfessions(normalizedInput);
        if (allowedCheck) {
            return allowedCheck;
        }
        // 8. Se confiança da IA é alta e domínio é PROFESSION, permitir
        if (aiContext && aiContext.confidence >= 0.8 && domainType === 'PROFESSION') {
            return {
                decision: 'ALLOW',
                reason: `Profissão reconhecida pela IA com alta confiança (${(aiContext.confidence * 100).toFixed(0)}%)`,
                confidence: aiContext.confidence,
                flags: ['AI_HIGH_CONFIDENCE'],
                domainType: 'PROFESSION',
                aiContext: {
                    reasoning: aiContext.reasoning || 'Classificação automática',
                    classification: aiContext.leafName,
                },
            };
        }
        // 9. Se confiança é média, enviar para revisão
        if (aiContext && aiContext.confidence >= 0.6 && aiContext.confidence < 0.8) {
            return {
                decision: 'REVIEW',
                reason: `Termo ambíguo ou profissão pouco conhecida. Será analisado pela equipe.`,
                confidence: aiContext.confidence,
                flags: ['AMBIGUOUS', 'NEEDS_REVIEW'],
                domainType: domainType === 'UNKNOWN' ? 'PROFESSION' : domainType,
                aiContext: {
                    reasoning: aiContext.reasoning || 'Confiança média requer revisão',
                    classification: aiContext.leafName,
                },
            };
        }
        // 10. Padrão: revisão para termos desconhecidos
        return {
            decision: 'REVIEW',
            reason: `Termo não reconhecido automaticamente. Será analisado pela equipe antes de ser aprovado.`,
            confidence: 0.5,
            flags: ['UNKNOWN', 'NEEDS_REVIEW'],
            domainType: 'UNKNOWN',
        };
    }
    /**
     * Valida categoria de interesse/hobby (regras mais permissivas)
     */
    async validateInterestCategory(input, aiContext) {
        const normalizedInput = this.normalizeInput(input);
        // 0. FASE 3.8: Validação prévia com IA especializada (se disponível)
        let aiClassification = null;
        try {
            const { AIKernel } = await Promise.resolve().then(() => __importStar(require('../../ai/ai-kernel')));
            const aiKernel = AIKernel.getInstance();
            const prompt = (0, occupational_classification_prompt_1.buildOccupationalClassificationPrompt)(input, 'interest');
            const aiResult = await aiKernel.run(prompt);
            if (aiResult.success && aiResult.result) {
                const jsonMatch = aiResult.result.toString().match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    aiClassification = parsed;
                    // Se IA rejeitou, retornar imediatamente
                    if (parsed && parsed.decision === 'rejected') {
                        return {
                            decision: 'BLOCK',
                            reason: parsed.reason || 'Termo rejeitado pela classificação ocupacional',
                            confidence: Math.min(parsed.confidence || 0.2, 0.2),
                            flags: ['AI_REJECTED', 'OCCUPATIONAL_CLASSIFICATION'],
                            domainType: 'UNKNOWN',
                        };
                    }
                }
            }
        }
        catch (error) {
            // Se IA falhar, continuar com validação por regras
            console.warn('[CategoryAdmissionPolicy] Erro ao usar IA especializada, usando regras:', error);
        }
        // 1. Verificar bloqueio explícito (mesmo para interesses)
        const blockCheck = this.checkBlockedTerms(normalizedInput);
        if (blockCheck) {
            return blockCheck;
        }
        // 2. Verificar padrões de bloqueio
        const patternCheck = this.checkBlockPatterns(normalizedInput);
        if (patternCheck) {
            return patternCheck;
        }
        // 3. Para interesses, hobbies e esportes são permitidos
        const domainType = await this.classifyDomain(normalizedInput, aiContext);
        if (domainType === 'CRIME' || domainType === 'SEXUAL' || domainType === 'VIOLENCE' || domainType === 'HATE') {
            return {
                decision: 'BLOCK',
                reason: `Termo classificado como ${domainType}: não pode ser cadastrado`,
                confidence: 0.95,
                flags: [domainType],
                domainType,
            };
        }
        // 3.5. Se IA especializada aprovou, usar sua classificação
        if (aiClassification && aiClassification.decision === 'approved') {
            return {
                decision: 'ALLOW',
                reason: aiClassification.reason || `Interesse/hobby aprovado pela classificação ocupacional`,
                confidence: Math.max(aiClassification.confidence, 0.7),
                flags: ['AI_APPROVED', 'OCCUPATIONAL_CLASSIFICATION', 'INTEREST'],
                domainType: domainType,
                aiContext: {
                    reasoning: `Classificação ocupacional: ${aiClassification.reason}`,
                    classification: aiClassification.classification.item || input,
                },
            };
        }
        // 4. Hobbies, esportes e interesses são permitidos
        if (domainType === 'HOBBY' || domainType === 'SPORT' || domainType === 'PROFESSION') {
            return {
                decision: 'ALLOW',
                reason: `Interesse/hobby válido: ${input}`,
                confidence: 0.85,
                flags: [domainType],
                domainType,
                aiContext: aiContext ? {
                    reasoning: aiContext.reasoning || 'Classificação automática',
                    classification: aiContext.leafName,
                } : undefined,
            };
        }
        // 5. Padrão: permitir com revisão se necessário
        return {
            decision: aiContext && aiContext.confidence >= 0.7 ? 'ALLOW' : 'REVIEW',
            reason: aiContext && aiContext.confidence >= 0.7
                ? `Interesse reconhecido com confiança ${(aiContext.confidence * 100).toFixed(0)}%`
                : `Interesse será analisado pela equipe`,
            confidence: aiContext?.confidence || 0.6,
            flags: ['INTEREST'],
            domainType: 'UNKNOWN',
        };
    }
    /**
     * Normaliza input para comparação
     */
    normalizeInput(input) {
        return input
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .trim();
    }
    /**
     * Verifica termos bloqueados explicitamente
     */
    checkBlockedTerms(normalizedInput) {
        // Verificar match exato
        if (this.BLOCKED_TERMS.has(normalizedInput)) {
            return {
                decision: 'BLOCK',
                reason: `Termo bloqueado: "${normalizedInput}" não pode ser cadastrado`,
                confidence: 1.0,
                flags: ['EXPLICIT_BLOCK'],
                domainType: this.inferDomainType(normalizedInput),
            };
        }
        // Verificar se contém termo bloqueado
        for (const blocked of this.BLOCKED_TERMS) {
            if (normalizedInput.includes(blocked) || blocked.includes(normalizedInput)) {
                return {
                    decision: 'BLOCK',
                    reason: `Termo contém palavra bloqueada: não pode ser cadastrado`,
                    confidence: 0.95,
                    flags: ['CONTAINS_BLOCKED'],
                    domainType: this.inferDomainType(blocked),
                };
            }
        }
        return null;
    }
    /**
     * Verifica padrões de bloqueio (regex)
     */
    checkBlockPatterns(normalizedInput) {
        for (const pattern of this.BLOCK_PATTERNS) {
            if (pattern.test(normalizedInput)) {
                return {
                    decision: 'BLOCK',
                    reason: `Termo contém padrão bloqueado: não pode ser cadastrado`,
                    confidence: 0.9,
                    flags: ['PATTERN_BLOCK'],
                    domainType: this.inferDomainTypeFromPattern(pattern),
                };
            }
        }
        return null;
    }
    /**
     * Verifica termos que requerem revisão
     */
    checkReviewTerms(normalizedInput) {
        for (const reviewTerm of this.REVIEW_TERMS) {
            if (normalizedInput === reviewTerm || normalizedInput.includes(reviewTerm)) {
                return {
                    decision: 'REVIEW',
                    reason: `Termo ambíguo ou profissão moderna: "${reviewTerm}" será analisado pela equipe`,
                    confidence: 0.7,
                    flags: ['AMBIGUOUS', 'MODERN_PROFESSION'],
                    domainType: 'PROFESSION',
                };
            }
        }
        return null;
    }
    /**
     * Verifica profissões reconhecidas
     */
    checkAllowedProfessions(normalizedInput) {
        for (const allowed of this.ALLOWED_PROFESSIONS) {
            if (normalizedInput === allowed || normalizedInput.includes(allowed) || allowed.includes(normalizedInput)) {
                return {
                    decision: 'ALLOW',
                    reason: `Profissão reconhecida: ${allowed}`,
                    confidence: 0.9,
                    flags: ['RECOGNIZED_PROFESSION'],
                    domainType: 'PROFESSION',
                };
            }
        }
        return null;
    }
    /**
     * Classifica domínio usando IA (se disponível) ou heurísticas
     */
    async classifyDomain(normalizedInput, aiContext) {
        // Se IA forneceu contexto, usar classificação da IA
        if (aiContext?.reasoning) {
            const aiReasoning = aiContext.reasoning.toLowerCase();
            if (aiReasoning.includes('crime') || aiReasoning.includes('ilegal') || aiReasoning.includes('criminoso')) {
                return 'CRIME';
            }
            if (aiReasoning.includes('sexual') || aiReasoning.includes('sexo') || aiReasoning.includes('porn')) {
                return 'SEXUAL';
            }
            if (aiReasoning.includes('violência') || aiReasoning.includes('violencia') || aiReasoning.includes('ódio') || aiReasoning.includes('odio')) {
                return 'VIOLENCE';
            }
            if (aiReasoning.includes('hobby') || aiReasoning.includes('interesse') || aiReasoning.includes('passatempo')) {
                return 'HOBBY';
            }
            if (aiReasoning.includes('esporte') || aiReasoning.includes('sport') || aiReasoning.includes('atleta')) {
                return 'SPORT';
            }
            if (aiReasoning.includes('profissão') || aiReasoning.includes('profissao') || aiReasoning.includes('trabalho')) {
                return 'PROFESSION';
            }
        }
        // Heurísticas baseadas em palavras-chave
        const sportKeywords = ['futebol', 'basquete', 'vôlei', 'volei', 'tênis', 'tenis', 'natação', 'natacao', 'corrida', 'ciclismo'];
        const hobbyKeywords = ['leitura', 'cinema', 'música', 'musica', 'dança', 'danca', 'pintura', 'fotografia', 'coleção', 'colecao'];
        if (sportKeywords.some(kw => normalizedInput.includes(kw))) {
            return 'SPORT';
        }
        if (hobbyKeywords.some(kw => normalizedInput.includes(kw))) {
            return 'HOBBY';
        }
        // Padrão: assumir profissão se não for claramente outra coisa
        return 'PROFESSION';
    }
    /**
     * Verifica se esporte pode ser considerado profissão (ex: "Jogador de Futebol")
     */
    isSportAsProfession(normalizedInput) {
        const professionPrefixes = ['jogador', 'atleta', 'técnico', 'tecnico', 'treinador', 'árbitro', 'arbitro'];
        return professionPrefixes.some(prefix => normalizedInput.startsWith(prefix));
    }
    /**
     * Infere tipo de domínio a partir de termo bloqueado
     */
    inferDomainType(term) {
        if (term.includes('sex') || term.includes('porn') || term.includes('prostitut')) {
            return 'SEXUAL';
        }
        if (term.includes('ladr') || term.includes('roub') || term.includes('trafic') || term.includes('drog')) {
            return 'CRIME';
        }
        if (term.includes('nazi') || term.includes('racist') || term.includes('homofób') || term.includes('xenófob')) {
            return 'HATE';
        }
        return 'UNKNOWN';
    }
    /**
     * Infere tipo de domínio a partir de padrão regex
     */
    inferDomainTypeFromPattern(pattern) {
        const patternStr = pattern.toString();
        if (patternStr.includes('sex') || patternStr.includes('porn')) {
            return 'SEXUAL';
        }
        if (patternStr.includes('ladr') || patternStr.includes('roub') || patternStr.includes('trafic')) {
            return 'CRIME';
        }
        if (patternStr.includes('nazi') || patternStr.includes('racist')) {
            return 'HATE';
        }
        return 'UNKNOWN';
    }
}
exports.categoryAdmissionPolicyService = new CategoryAdmissionPolicyService();

"use strict";
// src/core/categories/category-input-gate.service.ts
// Serviço unificado do Category Input Gate
// FASE 3.8: Pipeline completo de validação
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryInputGateService = void 0;
const category_lexical_gate_service_1 = require("./category-lexical-gate.service");
const occupation_form_checker_service_1 = require("./occupation-form-checker.service");
const cbo_matcher_service_1 = require("./cbo-matcher.service");
const category_input_audit_service_1 = require("./category-input-audit.service");
const hobby_verb_heuristic_service_1 = require("./hobby-verb-heuristic.service");
const hobby_matcher_service_1 = require("./hobby-matcher.service");
class CategoryInputGateService {
    /**
     * Pipeline completo de validação
     * Performance: <60ms (sem IA)
     */
    async validate(input, options) {
        const { context, skipFormCheck = false, skipCBO = false, tenantId, actorId, globalUserId } = options;
        // ETAPA 1: Bloqueio Léxico Seguro (0-2ms)
        const lexicalCheck = category_lexical_gate_service_1.categoryLexicalGateService.validate(input);
        if (lexicalCheck.decision === 'DENY') {
            // Auditoria
            await category_input_audit_service_1.categoryInputAuditService.log({
                inputOriginal: input,
                normalized: lexicalCheck.normalized || input,
                context,
                decision: 'DENY',
                reasonCode: lexicalCheck.reasonCode,
                lexicalDecision: 'DENY',
                tenantId,
                actorId,
                globalUserId,
            });
            return {
                decision: 'DENY',
                reasonCode: lexicalCheck.reasonCode,
            };
        }
        // ETAPA 2: Occupation Form Check (0-1ms)
        // Aplicar para professional, education e company (NÃO para hobby)
        let formCheckDecision = 'ALLOW';
        let formCheckSuggestion;
        if (!skipFormCheck && (context === 'professional' || context === 'education' || context === 'company')) {
            const formCheck = occupation_form_checker_service_1.occupationFormCheckerService.validate(input, context);
            formCheckDecision = formCheck.decision;
            formCheckSuggestion = formCheck.suggestion;
            if (formCheck.decision === 'DENY') {
                // Auditoria
                await category_input_audit_service_1.categoryInputAuditService.log({
                    inputOriginal: input,
                    normalized: input,
                    context,
                    decision: 'DENY',
                    reasonCode: formCheck.reasonCode,
                    lexicalDecision: 'ALLOW',
                    formCheckDecision: 'DENY',
                    tenantId,
                    actorId,
                    globalUserId,
                });
                return {
                    decision: 'DENY',
                    reasonCode: formCheck.reasonCode,
                    suggestion: formCheck.suggestion,
                };
            }
        }
        // ETAPA 3: Hobby Gate (para contexto hobby)
        // Pipeline: HobbyVerbHeuristic → HobbyMatcher
        if (context === 'hobby') {
            // 3.1. Heurística Verbal
            const verbCheck = hobby_verb_heuristic_service_1.hobbyVerbHeuristicService.validate(input);
            if (verbCheck.decision === 'DENY') {
                // Auditoria
                await category_input_audit_service_1.categoryInputAuditService.log({
                    inputOriginal: input,
                    normalized: input,
                    context,
                    decision: 'DENY',
                    reasonCode: verbCheck.reasonCode,
                    lexicalDecision: 'ALLOW',
                    tenantId,
                    actorId,
                    globalUserId,
                });
                return {
                    decision: 'DENY',
                    reasonCode: verbCheck.reasonCode,
                    suggestion: verbCheck.suggestion,
                };
            }
            // 3.2. Hobby Matcher (exato + fuzzy)
            try {
                const hobbyMatch = await hobby_matcher_service_1.hobbyMatcherService.findMatch(input);
                if (!hobbyMatch.matched) {
                    // Auditoria
                    await category_input_audit_service_1.categoryInputAuditService.log({
                        inputOriginal: input,
                        normalized: input,
                        context,
                        decision: 'DENY',
                        reasonCode: hobbyMatch.reasonCode || 'NOT_IN_HOBBY_DATASET',
                        lexicalDecision: 'ALLOW',
                        tenantId,
                        actorId,
                        globalUserId,
                    });
                    return {
                        decision: 'DENY',
                        reasonCode: hobbyMatch.reasonCode || 'NOT_IN_HOBBY_DATASET',
                        suggestion: 'Hobby não encontrado no dataset. Use hobbies válidos como "xadrez", "fotografia", "tocar violão", etc.',
                    };
                }
                // Match encontrado - ALLOW
                await category_input_audit_service_1.categoryInputAuditService.log({
                    inputOriginal: input,
                    normalized: input,
                    context,
                    decision: 'ALLOW',
                    reasonCode: hobbyMatch.reasonCode,
                    confidence: hobbyMatch.similarity,
                    lexicalDecision: 'ALLOW',
                    tenantId,
                    actorId,
                    globalUserId,
                });
                return {
                    decision: 'ALLOW',
                    canonicalHobby: hobbyMatch.canonicalHobby,
                    confidence: hobbyMatch.similarity,
                };
            }
            catch (error) {
                console.error('[CategoryInputGate] Erro ao buscar hobby:', error);
                // Em caso de erro, bloquear por segurança
                await category_input_audit_service_1.categoryInputAuditService.log({
                    inputOriginal: input,
                    normalized: input,
                    context,
                    decision: 'DENY',
                    reasonCode: 'HOBBY_MATCH_ERROR',
                    lexicalDecision: 'ALLOW',
                    tenantId,
                    actorId,
                    globalUserId,
                });
                return {
                    decision: 'DENY',
                    reasonCode: 'HOBBY_MATCH_ERROR',
                };
            }
        }
        // ETAPA 4: CBO Match (<50ms)
        // Aplicar para professional e education (não para company, não para hobby)
        let cboMatch = null;
        if (!skipCBO && (context === 'professional' || context === 'education')) {
            try {
                cboMatch = await cbo_matcher_service_1.cboMatcherService.findMatch(input);
            }
            catch (error) {
                console.warn('[CategoryInputGate] Erro ao buscar no CBO:', error);
            }
        }
        // Resultado final
        return {
            decision: 'ALLOW',
            canonicalId: cboMatch?.canonicalId,
            cboCode: cboMatch?.cboCode,
            confidence: cboMatch?.similarity,
        };
    }
}
exports.categoryInputGateService = new CategoryInputGateService();
//# sourceMappingURL=category-input-gate.service.js.map
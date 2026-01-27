"use strict";
/**
 * AI Development Kernel - Tasks
 *
 * Responsável por expor tarefas de engenharia para uso futuro
 * no sistema de automação e raciocínio interno.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AITasks = void 0;
const ai_engine_1 = require("./ai-engine");
const engine = new ai_engine_1.AIEngine();
/**
 * Tarefas disponíveis do AI Development Kernel
 */
exports.AITasks = {
    /**
     * Analisa um módulo específico do sistema
     */
    async analyzeModule(name) {
        const thought = await engine.think(`Analyze module: ${name}`);
        const context = engine.getContext();
        const isCore = context.architecture.core.includes(name);
        const isModule = context.architecture.modules.includes(name);
        return {
            name,
            path: isCore ? `src/core/${name}` : `src/modules/${name}`,
            type: isCore ? "core" : "module",
            status: (isCore || isModule) ? "exists" : "missing",
            dependencies: [],
            recommendations: thought.suggestions
        };
    },
    /**
     * Propõe melhorias arquiteturais baseadas no contexto
     */
    async proposeArchitecture() {
        const thought = await engine.think("Propose system architecture based on context");
        const context = engine.getContext();
        return {
            current: {
                core: context.architecture.core,
                modules: context.architecture.modules
            },
            proposed: {
                additions: [
                    "core/identity (UnifyCard ID específico)",
                    "core/crm",
                    "core/erp-lite",
                    "modules/events (completo)"
                ],
                improvements: [
                    "Integração mais forte entre Work e Events",
                    "Sistema de eventos para comunicação entre módulos",
                    "Padronização de schemas e validações"
                ]
            },
            alignment: {
                withContext: true,
                issues: []
            }
        };
    },
    /**
     * Revisa código em um caminho específico
     */
    async reviewCode(path) {
        const thought = await engine.think(`Review code at: ${path}`);
        const validation = engine.validateProposal(`Review code at: ${path}`);
        return {
            path,
            issues: validation.reasons,
            suggestions: thought.suggestions,
            multiTenantCompliant: validation.valid,
            followsPatterns: true
        };
    },
    /**
     * Valida se uma proposta está alinhada com o contexto
     */
    async validateProposal(proposal) {
        return engine.validateProposal(proposal);
    },
    /**
     * Gera raciocínio sobre um prompt específico
     */
    async think(prompt) {
        return engine.think(prompt);
    }
};

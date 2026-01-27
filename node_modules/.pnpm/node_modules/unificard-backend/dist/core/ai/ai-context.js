"use strict";
/**
 * AI Development Kernel - Context Loader
 *
 * Responsável por carregar e fornecer o contexto do projeto Unificard
 * para uso interno do sistema de raciocínio e automação.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAIContext = void 0;
const loadAIContext = () => {
    return {
        projectName: "Unificard",
        version: "0.1",
        description: "AI Development Kernel for internal reasoning and automation",
        domain: [
            "identity",
            "economy",
            "work",
            "events",
            "crm",
            "erp-lite",
            "reputation",
            "reviews",
            "notifications"
        ],
        contextFile: "docs/unificard-context.md",
        architecture: {
            core: [
                "auth",
                "economy",
                "reputation",
                "reviews",
                "notify",
                "rbac",
                "tenants",
                "config",
                "database",
                "db",
                "errors",
                "events",
                "health",
                "plugins"
            ],
            modules: [
                "work",
                "rides"
            ],
            plugins: [
                "error-handler",
                "rbac",
                "tenant"
            ]
        },
        priorities: {
            mvp: [
                "Consolidar backend existente",
                "Work + Events em Cidade Nova"
            ],
            focus: [
                "Multi-tenant com RLS",
                "Work: vagas, candidaturas, assignments, check-in/out",
                "Events: eventos, escalas de staff",
                "Economy: pagamentos e transações",
                "Reputation: atualização automática"
            ]
        },
        rules: {
            language: "TypeScript (Node.js)",
            database: "PostgreSQL multi-tenant com RLS",
            multiTenant: true,
            structure: {
                core: "coisas genéricas e reutilizáveis",
                modules: "funcionalidades de negócio específicas"
            }
        }
    };
};
exports.loadAIContext = loadAIContext;

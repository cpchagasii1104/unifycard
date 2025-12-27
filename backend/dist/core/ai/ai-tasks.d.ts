/**
 * AI Development Kernel - Tasks
 *
 * Responsável por expor tarefas de engenharia para uso futuro
 * no sistema de automação e raciocínio interno.
 */
import { AIThought } from "./ai-engine";
export interface ModuleAnalysis {
    name: string;
    path: string;
    type: "core" | "module";
    status: "exists" | "missing" | "partial";
    dependencies: string[];
    recommendations: string[];
}
export interface ArchitectureProposal {
    current: {
        core: string[];
        modules: string[];
    };
    proposed: {
        additions: string[];
        improvements: string[];
    };
    alignment: {
        withContext: boolean;
        issues: string[];
    };
}
export interface CodeReview {
    path: string;
    issues: string[];
    suggestions: string[];
    multiTenantCompliant: boolean;
    followsPatterns: boolean;
}
/**
 * Tarefas disponíveis do AI Development Kernel
 */
export declare const AITasks: {
    /**
     * Analisa um módulo específico do sistema
     */
    analyzeModule(name: string): Promise<ModuleAnalysis>;
    /**
     * Propõe melhorias arquiteturais baseadas no contexto
     */
    proposeArchitecture(): Promise<ArchitectureProposal>;
    /**
     * Revisa código em um caminho específico
     */
    reviewCode(path: string): Promise<CodeReview>;
    /**
     * Valida se uma proposta está alinhada com o contexto
     */
    validateProposal(proposal: string): Promise<{
        valid: boolean;
        reasons: string[];
    }>;
    /**
     * Gera raciocínio sobre um prompt específico
     */
    think(prompt: string): Promise<AIThought>;
};
//# sourceMappingURL=ai-tasks.d.ts.map
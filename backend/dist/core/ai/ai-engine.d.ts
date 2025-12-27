/**
 * AI Development Kernel - Engine
 *
 * Responsável por processar prompts internos e gerar raciocínios/ações
 * baseados no contexto do projeto Unificard.
 */
import { AIContext } from "./ai-context";
export interface AIThought {
    prompt: string;
    context: AIContext;
    reasoning: string[];
    suggestions: string[];
    result: any;
}
export declare class AIEngine {
    private context;
    constructor();
    /**
     * Processa um prompt interno e gera raciocínio baseado no contexto
     */
    think(prompt: string, tenantId?: string): Promise<AIThought>;
    /**
     * Retorna o contexto atual do projeto
     */
    getContext(): AIContext;
    /**
     * Valida se uma proposta está alinhada com o contexto do projeto
     */
    validateProposal(proposal: string): {
        valid: boolean;
        reasons: string[];
    };
}
//# sourceMappingURL=ai-engine.d.ts.map
/**
 * AI Development Kernel - Context Loader
 *
 * Responsável por carregar e fornecer o contexto do projeto Unificard
 * para uso interno do sistema de raciocínio e automação.
 */
export interface AIContext {
    projectName: string;
    version: string;
    description: string;
    domain: string[];
    contextFile: string;
    architecture: {
        core: string[];
        modules: string[];
        plugins: string[];
    };
    priorities: {
        mvp: string[];
        focus: string[];
    };
    rules: {
        language: string;
        database: string;
        multiTenant: boolean;
        structure: {
            core: string;
            modules: string;
        };
    };
    region?: {
        country?: {
            countryId: string;
            name: string;
            code: string;
        };
        state?: {
            stateId: string;
            name: string;
            code: string;
        };
        city?: {
            cityId: string;
            name: string;
        };
    };
    globalUser?: {
        globalUserId: string;
        fullName: string | null;
        avatarUrl: string | null;
    };
    reputation?: {
        globalScore: number;
        workScore?: number;
        ridesScore?: number;
        eventsScore?: number;
        commerceScore?: number;
    };
    wallet?: {
        balance: number;
        currency: string;
        lastTransactions: Array<{
            transactionId: string;
            type: 'credit' | 'debit';
            amount: number;
        }>;
    };
}
export declare const loadAIContext: () => AIContext;
//# sourceMappingURL=ai-context.d.ts.map
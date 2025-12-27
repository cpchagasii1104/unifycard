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

export const loadAIContext = (): AIContext => {
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


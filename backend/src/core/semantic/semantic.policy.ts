/**
 * Política operacional de fallback semântico (graph-first, slug contingente).
 *
 * Norma institucional: **slug não é identidade operacional** em fluxos financeiros, ledger,
 * catálogo canónico (`concept_id` / UUID) ou matching soberano — apenas heurística de navegação
 * / inferência semântica quando `allowSlugFallback` estiver permitido.
 *
 * Base (sem I/O): env + NODE_ENV — ver `getSemanticPolicy` / `resolveEnvSemanticPolicy`.
 * Por tenant: linha em `tenant_semantic_policy` sobrescreve a base quando existe.
 *
 * Env:
 * - SEMANTIC_ALLOW_SLUG_FALLBACK=true|false
 * - SEMANTIC_LOG_FALLBACK_AS_ERROR=true|false
 */
import { getTenantSemanticPolicy } from './semantic-policy.repository';

export type SemanticPolicy = {
  allowSlugFallback: boolean;
  logFallbackAsError: boolean;
};

export type SemanticPolicyContext = {
  /** default: process.env.NODE_ENV */
  nodeEnv?: string;
  /** Quando definido, `resolveSemanticPolicy` pode aplicar override por tenant (I/O). */
  tenantId?: string;
};

/** Política só a partir de ambiente (sem tenant, sem I/O). */
export function resolveEnvSemanticPolicy(context: SemanticPolicyContext = {}): SemanticPolicy {
  const envRaw = context.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const env = envRaw.toLowerCase();

  if (process.env.SEMANTIC_ALLOW_SLUG_FALLBACK === 'true') {
    return {
      allowSlugFallback: true,
      logFallbackAsError: process.env.SEMANTIC_LOG_FALLBACK_AS_ERROR === 'true',
    };
  }
  if (process.env.SEMANTIC_ALLOW_SLUG_FALLBACK === 'false') {
    return {
      allowSlugFallback: false,
      logFallbackAsError: process.env.SEMANTIC_LOG_FALLBACK_AS_ERROR !== 'false',
    };
  }

  switch (env) {
    case 'production':
      return { allowSlugFallback: false, logFallbackAsError: true };
    case 'staging':
      return { allowSlugFallback: true, logFallbackAsError: true };
    case 'test':
    case 'development':
    default:
      return { allowSlugFallback: true, logFallbackAsError: false };
  }
}

/**
 * Alias síncrono: apenas ambiente (compatível com chamadas sem tenant).
 * Para política efetiva com tenant, usar `resolveSemanticPolicy`.
 */
export function getSemanticPolicy(context: SemanticPolicyContext = {}): SemanticPolicy {
  return resolveEnvSemanticPolicy(context);
}

/** Linha em BD define os três flags; `enforce_graph` impõe slug fallback desligado. */
function policyFromTenantRow(row: {
  allow_slug_fallback: boolean;
  log_fallback_as_error: boolean;
  enforce_graph: boolean;
}): SemanticPolicy {
  let allowSlugFallback = row.allow_slug_fallback;
  if (row.enforce_graph) {
    allowSlugFallback = false;
  }
  return {
    allowSlugFallback,
    logFallbackAsError: row.log_fallback_as_error,
  };
}

/**
 * Política efetiva: se existir linha para `tenantId`, ela substitui env para estes campos;
 * `enforce_graph = true` força `allowSlugFallback = false`.
 * Sem `tenantId` ou sem linha → igual a `resolveEnvSemanticPolicy`.
 */
export async function resolveSemanticPolicy(
  context: SemanticPolicyContext = {}
): Promise<SemanticPolicy> {
  const envPolicy = resolveEnvSemanticPolicy(context);
  const tenantId = context.tenantId;
  if (!tenantId) {
    return envPolicy;
  }

  const row = await getTenantSemanticPolicy(tenantId);
  if (!row) {
    return envPolicy;
  }

  return policyFromTenantRow(row);
}
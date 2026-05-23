import type { CategoryContext } from '@unificard/contracts';
import type { GraphRelationType } from './graph.adapter';

export type SemanticResolutionErrorType = 'MISSING_GRAPH_RELATION';

export type SemanticResolutionErrorContext = {
  fromConceptId: string | null;
  attemptedTarget: {
    trace: string;
    tenantId: string;
    categoryContext?: CategoryContext;
    slugCandidates?: string[];
    relationTypesExpected?: GraphRelationType[];
  };
};

/**
 * Falha explícita quando a política proíbe inferência fora do grafo (Lei 7 / operações).
 */
export class SemanticResolutionError extends Error {
  readonly type: SemanticResolutionErrorType;

  readonly resolutionContext: SemanticResolutionErrorContext;

  constructor(payload: { type: SemanticResolutionErrorType; context: SemanticResolutionErrorContext }) {
    super(
      `[semantic] ${payload.type} trace=${payload.context.attemptedTarget.trace} tenant=${payload.context.attemptedTarget.tenantId}`,
    );
    this.name = 'SemanticResolutionError';
    this.type = payload.type;
    this.resolutionContext = payload.context;
  }
}
/**
 * Concept Resolution — interpretação de texto + lookup read-only em `concepts`.
 *
 * Não define SSOT; `concept_id` só reflete linha existente em `concepts`.
 */

/**
 * Contexto de resolução: escolhe o `concepts.domain` (N0) esperado.
 * Mesmo slug em domínios diferentes = significados diferentes — resolver com domínio, não só slug.
 */
export type ConceptResolutionContext = 'vehicle' | 'product' | 'service';

/** Entrada do resolver estrito: sempre exige domínio explícito OU contexto (que mapeia para N0). */
export type ResolveConceptSlugInput =
  | { slug: string; context: ConceptResolutionContext }
  | { slug: string; domain: string };

export type ConceptSlugUnresolvedReason = 'not_found' | 'invalid_slug' | 'missing_domain';

export type ConceptSlugResolveResult =
  | {
      status: 'resolved';
      conceptId: string;
      domain: string;
      slug: string;
    }
  | {
      status: 'unresolved';
      slug: string;
      domain: string;
      reason: ConceptSlugUnresolvedReason;
    };

export type ResolvedEntityType = 'vehicle' | 'product' | 'service' | 'person';

export interface ResolvedQueryTimeYear {
  type: 'year';
  value: number;
}

export interface ResolvedQueryTimeDateRange {
  type: 'date_range';
  value: { start: Date; end: Date };
}

export type ResolvedQueryTime = ResolvedQueryTimeYear | ResolvedQueryTimeDateRange;

export interface ResolvedQueryLocation {
  city?: string;
  state?: string;
  country?: string;
}

export interface ResolveQueryOptions {
  /**
   * `concepts.domain` explícito (sobrepõe `conceptResolutionContext` se ambos existirem).
   * Sem domain nem context, não há lookup em PG.
   */
  conceptDomain?: string;
  /**
   * Mapeia para N0 via `getDefaultConceptDomain` quando `conceptDomain` não é informado.
   */
  conceptResolutionContext?: ConceptResolutionContext;
}

export interface ResolvedQuery {
  conceptText?: string;
  conceptSlug?: string;
  conceptId?: string;
  /** `true` apenas se existir linha em `concepts` para (domain, slug). */
  conceptResolved: boolean;
  /**
   * `true` quando há texto candidato a conceito mas não houve match no SSOT.
   * A camada superior deve encaminhar para fila/governança — não inserir aqui.
   */
  conceptNeedsResolution: boolean;
  entityType?: ResolvedEntityType;
  time?: ResolvedQueryTime;
  location?: ResolvedQueryLocation;
  raw: string;
}
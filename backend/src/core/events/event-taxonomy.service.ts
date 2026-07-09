// backend/src/core/events/event-taxonomy.service.ts
// F-EVENT-CONCEPT-FIRST-MODEL Fatia 3 — contratos SERVER-DRIVEN da taxonomia de evento. O frontend
// NUNCA enumera formato/categoria (só projeta o que estes contratos devolverem). Formato e tema =
// CONCEPT; categoria = facet governado (EVENT_CATEGORIES). Identidade em CONCEPT; aqui só projeção.

import { runQueriesWithTenant } from '@core/database/pool';
import { searchSubjectConcepts } from '@core/concepts/subject-pool.service';
import { EVENT_CATEGORIES, EVENT_LOCATION_MODES, EVENT_LOCATION_MODES_MVP_ENABLED, EVENT_ACCESS_TYPES } from './event.types';

const CATEGORY_LABELS: Record<string, string> = {
  social: 'Social', cultural: 'Cultural', gastronomico: 'Gastronômico', esportivo: 'Esportivo',
  profissional: 'Profissional', comunitario: 'Comunitário', espiritual: 'Espiritual',
  educacional: 'Educacional', comercial_institucional: 'Comercial / Institucional',
};
const LOCATION_MODE_LABELS: Record<string, string> = {
  fixed_place: 'Local fixo', online: 'Online', hybrid: 'Híbrido',
  to_be_defined: 'Ainda preciso de local', route: 'Rota / múltiplos pontos',
};
const ACCESS_TYPE_LABELS: Record<string, string> = {
  gratuito: 'Gratuito', pago: 'Pago', contribuicao_opcional: 'Contribuição opcional',
};

export interface EventFormatOption {
  key: string; conceptId: string; label: string;
  supportsCapacity: boolean; supportsTicketPrice: boolean;
  supportsRouteLocation: boolean; supportsOrchestration: boolean;
  requiredCapabilities: string[] | null;
}

class EventTaxonomyService {
  /** Formatos de evento PERMITIDOS (contrato governado). MVP: todos enabled (required_capabilities dos
   *  seeds = NULL → sem gate por capability ainda; o gate por actor/capability entra quando semeado). */
  async listFormats(tenantId: string): Promise<EventFormatOption[]> {
    const rows = await runQueriesWithTenant<{
      slug: string; concept_id: string; label: string;
      supports_capacity: boolean; supports_ticket_price: boolean;
      supports_route_location: boolean; supports_orchestration: boolean;
      required_capabilities: string[] | null;
    }>(
      tenantId,
      `SELECT c.slug, c.concept_id, cs.name AS label,
              efc.supports_capacity, efc.supports_ticket_price,
              efc.supports_route_location, efc.supports_orchestration, efc.required_capabilities
         FROM event_format_concepts efc
         JOIN concepts c ON c.concept_id = efc.concept_id
         JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.status = 'active'
        WHERE efc.enabled = true
        ORDER BY efc.sort_order ASC`,
      []
    );
    return rows.map((r) => ({
      key: r.slug, conceptId: r.concept_id, label: r.label,
      supportsCapacity: r.supports_capacity, supportsTicketPrice: r.supports_ticket_price,
      supportsRouteLocation: r.supports_route_location, supportsOrchestration: r.supports_orchestration,
      requiredCapabilities: r.required_capabilities,
    }));
  }

  /** Temas = CONCEPT livre (o grafo inteiro é buscável). Composição formato × tema. Nunca texto livre. */
  async searchThemes(tenantId: string, q: string, limit = 20): Promise<Array<{ key: string; conceptId: string; label: string }>> {
    // RFC-SHARED-SUBJECT-CONCEPT-POOL: elegibilidade de TEMA vem do pool de ASSUNTO (autoridade =
    // shared_subject_concepts), NÃO mais de canonical_services flat. Mesmo reader do picker de interesse.
    return searchSubjectConcepts(tenantId, q, limit);
  }

  /** Categorias = facets de descoberta (governadas). Múltiplas por evento. */
  listCategories(): Array<{ key: string; label: string }> {
    return EVENT_CATEGORIES.map((k) => ({ key: k, label: CATEGORY_LABELS[k] ?? k }));
  }

  /** Modos de local governados; 'route' vem enabled=false no MVP (com motivo). */
  listLocationModes(): Array<{ key: string; label: string; enabled: boolean; reasonDisabled: string | null }> {
    return EVENT_LOCATION_MODES.map((k) => {
      const enabled = (EVENT_LOCATION_MODES_MVP_ENABLED as string[]).includes(k);
      return { key: k, label: LOCATION_MODE_LABELS[k] ?? k, enabled, reasonDisabled: enabled ? null : 'Rota/múltiplos pontos ainda não disponível no MVP.' };
    });
  }

  /** Tipos de acesso/custo governados (anúncio, Δbank=0). */
  listAccessTypes(): Array<{ key: string; label: string }> {
    return EVENT_ACCESS_TYPES.map((k) => ({ key: k, label: ACCESS_TYPE_LABELS[k] ?? k }));
  }
}

export const eventTaxonomyService = new EventTaxonomyService();

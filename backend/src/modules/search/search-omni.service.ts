// search-omni.service.ts
// F-GLOBAL-SEARCH-OMNI-SLICE-A — gateway federado de busca ("omnibox"). READ-ONLY, money-free.
//
// TESE (aprovada por Clayton 2026-07-03): busca universal tem pistas com semânticas DIFERENTES que
// nunca se misturam — QUEM (identidades: pessoas/empresas/grupos — match de nome sobre projeção
// pública) e O QUÊ (ofertas: serviços por vocabulário controlado termo→alias→CONCEPT, produtos por
// item canônico, eventos por título sob piso de discovery). O gateway federa; cada seção é resolvida
// pelo SEU reader canônico com os SEUS gates — busca é PROJEÇÃO, não verdade nova.
//
// LEI DE COERÊNCIA (nenhuma verdade paralela criada aqui):
//   · serviços  → REUSA servicesDiscoveryService.searchByTerm (alias→concept, miss honesto)
//   · produtos  → REUSA searchCanonicalItems (mesmo SELECT da rota /catalog/items/search)
//   · eventos   → REUSA eventsService.searchEvents (evoluído com `term`; piso de discovery intacto,
//                 discoveryUserId = req.user server-side, DECISION-0113)
//   · grupos    → REUSA groupsService.listGroups + filtro em memória (não nasce 2º SQL de grupos)
//   · pessoas/empresas → reader NOVO (nenhum existia) sobre `actors`, previsto pelo SSOT registry
//                 ("Leitores futuros: busca/matching (read), via service"). Vocabulário canônico
//                 DECISION-0157: 'user' = Pessoas, 'page' = Empresas. PROJEÇÃO SEGURA APENAS —
//                 id/display_name/slug/avatar_url/bio/actor_type. NUNCA user_id/global_user_id/
//                 external_id/kyc_*/metadata (D13/IDENTITY_SSOT_PRECEDENCE: PII fora de payload).
//
// NOTA public_profiles: a tabela existe mas está VAZIA (0 rows, módulo dormente) — construir o QUEM
// sobre ela seria busca que mente. `actors.display_name` é a projeção viva (já exposta a autenticados
// via GET /social/actors/:id). Quando public_profiles materializar (visibility/followers_only), o
// resolver de identidades migra pra lá — trocando O READER, não o contrato do gateway.
//
// FAIL-SOFT por seção (padrão enterprise de omnibox): uma pista quebrada não derruba as outras;
// a seção falha vai nomeada em sectionErrors (transparente, nunca silencioso).

import { runQueriesWithTenant } from '@core/database/pool';
import { servicesDiscoveryService } from '@modules/services/services-discovery.service';
import { eventsService } from '@modules/events/events.service';
import { groupsService } from '@modules/groups/groups.service';
import { searchCanonicalItems } from '@modules/marketplace/canonical-item-search.service';

// Projeção pública de identidade — SOMENTE campos seguros (anti-PII por construção).
interface PublicActorRow {
  id: string;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  bio: string | null;
  actor_type: string;
}

export interface OmniIdentityHit {
  actorId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface OmniGroupHit {
  groupId: string;
  name: string;
}

export interface OmniEventHit {
  eventId: string;
  title: string;
  datetimeStart: string | null;
  status: string;
}

export interface OmniProductHit {
  canonicalProductId: string;
  name: string;
  brand: string | null;
}

export interface OmniSearchResult {
  q: string;
  sections: {
    people: OmniIdentityHit[];
    companies: OmniIdentityHit[];
    groups: OmniGroupHit[];
    services: { conceptIds: string[]; results: unknown[] };
    products: OmniProductHit[];
    events: OmniEventHit[];
  };
  sectionErrors: string[];
}

// normalização accent-insensitive p/ filtros em memória (grupos) — espelha unaccent+lower do SQL
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

class SearchOmniService {
  /**
   * Busca identidades (QUEM) por nome sobre a projeção pública de `actors`.
   * Vocabulário canônico DECISION-0157: só 'user' (Pessoas) e 'page' (Empresas) —
   * valores legados congelados NUNCA aparecem em superfície nova.
   */
  private async searchPublicActors(
    tenantId: string,
    q: string,
    perSection: number
  ): Promise<{ people: OmniIdentityHit[]; companies: OmniIdentityHit[] }> {
    const rows = await runQueriesWithTenant<PublicActorRow>(
      tenantId,
      `SELECT id, display_name, slug, avatar_url, bio, actor_type
         FROM actors
        WHERE tenant_id = $1
          AND actor_type IN ('user', 'page')
          AND unaccent(display_name) ILIKE unaccent($2)
        ORDER BY display_name ASC
        LIMIT $3`,
      [tenantId, `%${q}%`, perSection * 2]
    );

    const toHit = (r: PublicActorRow): OmniIdentityHit => ({
      actorId: r.id,
      displayName: r.display_name,
      slug: r.slug,
      avatarUrl: r.avatar_url,
      bio: r.bio,
    });

    return {
      people: rows.filter((r) => r.actor_type === 'user').slice(0, perSection).map(toHit),
      companies: rows.filter((r) => r.actor_type === 'page').slice(0, perSection).map(toHit),
    };
  }

  async searchOmni(
    tenantId: string,
    // cityId: filtro pós-busca OPCIONAL (aplicado só às seções cujo substrato o suporta HOJE:
    // serviços e eventos — regra de ouro: nenhum filtro prometido sem substrato verdadeiro).
    input: { q: string; perSection?: number; discoveryUserId?: string; cityId?: string | null }
  ): Promise<OmniSearchResult> {
    const q = input.q.trim();
    const perSection = Math.min(Math.max(input.perSection ?? 5, 1), 10);
    const sectionErrors: string[] = [];

    const result: OmniSearchResult = {
      q,
      sections: {
        people: [],
        companies: [],
        groups: [],
        services: { conceptIds: [], results: [] },
        products: [],
        events: [],
      },
      sectionErrors,
    };

    // termo curto demais → seções vazias honestas (sem varrer o banco com '%a%')
    if (q.length < 2) {
      return result;
    }

    // ── QUEM: pessoas + empresas (projeção pública de actors) ──
    try {
      const { people, companies } = await this.searchPublicActors(tenantId, q, perSection);
      result.sections.people = people;
      result.sections.companies = companies;
    } catch {
      sectionErrors.push('people', 'companies');
    }

    // ── QUEM: grupos (reader canônico listGroups + filtro em memória) ──
    try {
      const groups = await groupsService.listGroups(tenantId, { isActive: true });
      const nq = normalize(q);
      result.sections.groups = groups
        .filter((g) => normalize(g.name).includes(nq))
        .slice(0, perSection)
        .map((g) => ({ groupId: g.groupId, name: g.name }));
    } catch {
      sectionErrors.push('groups');
    }

    // ── O QUÊ: serviços (vocabulário controlado termo→alias→CONCEPT; miss honesto = vazio) ──
    try {
      const data = await servicesDiscoveryService.searchByTerm(tenantId, { term: q, cityId: input.cityId ?? null });
      result.sections.services = {
        conceptIds: data.conceptIds,
        results: data.results.slice(0, perSection),
      };
    } catch {
      sectionErrors.push('services');
    }

    // ── O QUÊ: produtos (item canônico READY, DECISION-0117 F/CP5) ──
    try {
      const items = await searchCanonicalItems(tenantId, { q, limit: perSection });
      result.sections.products = items.map((i) => ({
        canonicalProductId: i.id,
        name: i.name,
        brand: i.brand,
      }));
    } catch {
      sectionErrors.push('products');
    }

    // ── O QUÊ: eventos (reader canônico com piso de discovery; term aditivo) ──
    try {
      const events = await eventsService.searchEvents(tenantId, {
        term: q,
        limit: perSection,
        discoveryUserId: input.discoveryUserId,
        cityId: input.cityId ?? undefined,
      });
      result.sections.events = events.map((e) => ({
        eventId: e.id,
        title: e.title,
        // tipo declara Date, runtime pode ser null (draft sem data — dívida conhecida do
        // arco profile-readers); null-safe defensivo
        datetimeStart: (e.datetimeStart as Date | null)?.toISOString?.() ?? null,
        status: e.status,
      }));
    } catch {
      sectionErrors.push('events');
    }

    return result;
  }
}

export const searchOmniService = new SearchOmniService();

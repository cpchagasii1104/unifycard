// backend/src/modules/actor-page/actor-page.repository.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — probes READ-ONLY do substrato vivo que decidem quais blocos acendem.
// Cada probe é uma CONTAGEM tenant-scoped sobre o SSOT do pilar (Lei §5: projeta, não duplica).
// Anti-PII: nenhum SELECT toca cpf/tax_id/kyc/global_user_id/documentos; header só campos públicos.

import { runQueryWithTenant } from '@core/database/pool';

export interface ActorHeaderRow {
  id: string;
  actor_type: string;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  company_id: string | null;
  group_id: string | null;
}

class ActorPageRepository {
  async getActorHeaderRow(tenantId: string, actorId: string): Promise<ActorHeaderRow | undefined> {
    return runQueryWithTenant<ActorHeaderRow>(
      tenantId,
      `SELECT id, actor_type, display_name, slug, avatar_url, cover_url, bio, company_id, group_id
         FROM actors WHERE tenant_id = $1 AND id = $2`,
      [tenantId, actorId]
    );
  }

  /** headline do cartão público (o dono escolheu exibir — mecanismo metadata.card já vivo) */
  async getPublicCardHeadline(tenantId: string, actorId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ headline: string | null }>(
      tenantId,
      `SELECT metadata->'card'->>'headline' AS headline
         FROM public_profiles WHERE tenant_id = $1 AND actor_id = $2 AND visibility = 'public'`,
      [tenantId, actorId]
    );
    return row?.headline ?? null;
  }

  private async countOf(tenantId: string, sql: string, params: unknown[]): Promise<number> {
    const row = await runQueryWithTenant<{ n: string }>(tenantId, sql, params as any[]);
    return Number(row?.n ?? 0);
  }

  /** posts publicados do actor (pilar social) */
  countPublishedPosts(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM posts
        WHERE tenant_id = $1 AND actor_id = $2 AND is_published = true AND is_deleted = false`,
      [tenantId, actorId]
    );
  }

  /** serviços ativos do actor (pilar services) */
  countActiveServices(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM services
        WHERE tenant_id = $1 AND actor_id = $2 AND status = 'active'`,
      [tenantId, actorId]
    );
  }

  /** ofertas de produto ativas do actor-merchant (pilar marketplace) */
  countActiveProductOffers(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM product_offers
        WHERE tenant_id = $1 AND merchant_id = $2 AND is_active = true`,
      [tenantId, actorId]
    );
  }

  /** recursos de locação ativos do actor (pilar rental) */
  countActiveRentals(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM rentable_resources
        WHERE tenant_id = $1 AND owner_actor_id = $2 AND is_active = true`,
      [tenantId, actorId]
    );
  }

  /** disponibilidade futura do actor como dono da agenda (pilar tempo) */
  countFutureAvailability(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM availability
        WHERE tenant_id = $1 AND owner_id = $2 AND end_datetime > now()`,
      [tenantId, actorId]
    );
  }

  /** eventos futuros do actor (pilar eventos — Programação de banda/casa) */
  countUpcomingEvents(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM events
        WHERE tenant_id = $1 AND actor_id = $2 AND datetime_start > now()
          AND status NOT IN ('cancelled', 'CANCELLED')`,
      [tenantId, actorId]
    );
  }
}

export const actorPageRepository = new ActorPageRepository();

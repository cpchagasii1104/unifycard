// backend/src/modules/actor-page/actor-page.repository.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — probes READ-ONLY do substrato vivo que decidem quais blocos acendem.
// Cada probe é uma CONTAGEM tenant-scoped sobre o SSOT do pilar (Lei §5: projeta, não duplica).
// Anti-PII: nenhum SELECT toca cpf/tax_id/kyc/global_user_id/documentos; header só campos públicos.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

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

  /**
   * Vendas asset-first ativas do actor (pilar asset_sales — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3, D-β).
   * READ-MODEL DEDICADO: lê o SSOT da venda asset-first (actor_assets + actor_asset_modes('sale') +
   * actor_asset_sale_terms). NÃO conta em product_offers (que é oferta de PRODUTO/ESTOQUE PJ, pilar próprio).
   * "ativo" = termo de venda is_active=true + modo sale enabled.
   */
  countActiveAssetSales(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n
         FROM actor_assets a
         JOIN actor_asset_modes m
           ON m.asset_id = a.id AND m.activation_mode = 'sale' AND m.enabled = true
         JOIN actor_asset_sale_terms s
           ON s.asset_id = a.id
        WHERE a.tenant_id = $1 AND a.owner_actor_id = $2 AND s.is_active = true`,
      [tenantId, actorId]
    );
  }

  /**
   * Recursos de locação ativos do actor (pilar rental).
   * F-ASSET-MULTI-OFFER-FOUNDATION 2b-R: a locação convergiu POR DESENHO para asset-first — a
   * identidade é actor_assets, a ATIVAÇÃO é actor_asset_modes.activation_mode='rental' (enabled), e
   * os termos/status vivem em actor_asset_rental_terms. Semântica de "ativo" preservada do probe
   * antigo (is_active=true). Sem category como autoridade.
   *
   * ⚠️ NOTA DE ESTADO (2026-08-04): a frase acima é verdade sobre o DESENHO e sobre o CÓDIGO —
   * nenhum caminho vivo trata `rentable_resources` como identidade, e `audit-asset-rental-convergence`
   * garante isso. Mas NÃO descreve o BANCO: medido hoje, `rentable_resources` = 3 linhas ativas e
   * `actor_assets` = 1 no sistema inteiro. Consequência prática e visível: quem só tem locável
   * legado aparece com a aba `Locações` apagada. O conserto é migrar o DADO (frente própria, GO
   * do dono), nunca fazer esta sonda ler os dois.
   */
  countActiveRentals(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n
         FROM actor_assets a
         JOIN actor_asset_modes m
           ON m.asset_id = a.id AND m.activation_mode = 'rental' AND m.enabled = true
         JOIN actor_asset_rental_terms t
           ON t.asset_id = a.id
        WHERE a.tenant_id = $1 AND a.owner_actor_id = $2 AND t.is_active = true`,
      [tenantId, actorId]
    );
  }

  /**
   * ITENS de locação para o bloco — SÓ asset-first, a fonte canônica.
   *
   * 🔴 ERRO MEU, REVERTIDO NO MESMO DIA (2026-08-04): eu tinha feito esta função e a contagem acima
   * lerem TAMBÉM `rentable_resources`, para acender a aba de um fornecedor cujos 3 locáveis vivem
   * no substrato legado. `audit-asset-rental-convergence` mordeu — e está certo: ele é a
   * EXECUÇÃO da RFC que decidiu asset-first, e proíbe tratar `rentable_resources` como identidade
   * do item em qualquer caminho vivo. Ler os dois teria transformado uma migração pendente em duas
   * verdades permanentes, que é o defeito que esta casa mais paga caro.
   *
   * A aba fica apagada para quem só tem locável legado — e isso é a VERDADE do estado atual, não
   * uma falha da tela. O conserto é converger o DADO, não afrouxar a leitura.
   */
  async listRentalItems(tenantId: string, actorId: string, limite = 12): Promise<Array<{
    id: string; label: string | null; priceCents: number | null; pricingUnit: string | null; origem: 'asset';
  }>> {
    const linhas = await runQueriesWithTenant<{
      id: string; label: string | null; price_cents: string | number | null; pricing_unit: string | null;
    }>(
      tenantId,
      `SELECT a.id::text AS id, a.label, t.price_cents, t.pricing_unit
         FROM actor_assets a
         JOIN actor_asset_modes m
           ON m.asset_id = a.id AND m.activation_mode = 'rental' AND m.enabled = true
         JOIN actor_asset_rental_terms t
           ON t.asset_id = a.id
        WHERE a.tenant_id = $1 AND a.owner_actor_id = $2 AND t.is_active = true
        ORDER BY a.created_at ASC
        LIMIT $3`,
      [tenantId, actorId, limite]
    );
    return linhas.map((r) => ({
      id: r.id,
      label: r.label,
      priceCents: r.price_cents === null ? null : Number(r.price_cents),
      pricingUnit: r.pricing_unit,
      origem: 'asset' as const,
    }));
  }

  /**
   * Disponibilidade futura do actor como dono da agenda (pilar tempo).
   * FIX (Fatia 4, achado no read-first): `ownerType` é OBRIGATÓRIO no CHECK físico
   * (`chk_availability_owner_type`) — sem ele, a contagem misturava owners de tipos diferentes
   * (o mesmo `owner_id` pode existir para `service`/`service_offering`/`rentable_resource`, que já
   * têm probes próprios). PF usa `AvailabilityOwnerType.USER`, PJ usa `PAGE` — o caller resolve.
   */
  countFutureAvailability(tenantId: string, actorId: string, ownerType: 'user' | 'page'): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n FROM availability
        WHERE tenant_id = $1 AND owner_id = $2 AND owner_type = $3 AND end_datetime > now()`,
      [tenantId, actorId, ownerType]
    );
  }

  /**
   * Usos operacionais ativos do actor (pilar service_use — D-G do adendo RFC_ASSET_SERVICE_USE_OPERATIONAL).
   * Lê o SSOT dedicado: identidade em actor_assets, ATIVAÇÃO em actor_asset_modes('service_use'), vínculo em
   * actor_asset_service_usages. NUNCA conta em service_offerings (não é a SSOT do uso operacional do asset).
   * Fatia 4B: v1 = SOMENTE dono-operador (operator_actor_id = owner_actor_id do asset).
   */
  countActiveServiceUses(tenantId: string, actorId: string): Promise<number> {
    return this.countOf(
      tenantId,
      `SELECT COUNT(*)::text AS n
         FROM actor_assets a
         JOIN actor_asset_modes m
           ON m.asset_id = a.id AND m.activation_mode = 'service_use' AND m.enabled = true
         JOIN actor_asset_service_usages u
           ON u.asset_id = a.id
        WHERE a.tenant_id = $1 AND a.owner_actor_id = $2 AND u.is_active = true`,
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

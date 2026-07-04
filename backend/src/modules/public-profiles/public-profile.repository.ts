// backend/src/modules/public-profiles/public-profile.repository.ts
// SPRINT 79: Repository para public_profiles

import { runQueryWithTenant, runQueriesWithTenant, pool } from '@core/database/pool';
import type { PublicProfile, CreatePublicProfileInput, UpdatePublicProfileInput, PublicProfileFilters, GlobalDiscoveryHit, GlobalPublicProfileView, PublicProfileType, PublishVisibility } from './public-profile.types';

interface PublicProfileRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  profile_type: string;
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PublicProfileRepository {
  private toProfile(row: PublicProfileRow): PublicProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      profileType: row.profile_type as any,
      slug: row.slug,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      coverUrl: row.cover_url,
      visibility: row.visibility as any,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Gera slug único a partir do display name
   */
  private generateSlug(displayName: string): string {
    let slug = displayName
      .toLowerCase()
      .trim()
      // Remover acentos básicos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remover caracteres especiais, manter apenas letras, números e hífens
      .replace(/[^a-z0-9-]/g, '-')
      // Remover múltiplos hífens consecutivos
      .replace(/-+/g, '-')
      // Remover hífens no início e fim
      .replace(/^-+|-+$/g, '')
      // Limitar tamanho
      .substring(0, 200);

    if (!slug) {
      slug = `profile-${Date.now()}`;
    }

    return slug;
  }

  /**
   * Gera slug único verificando se já existe
   */
  private async generateUniqueSlug(
    tenantId: string,
    baseSlug: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
        SELECT id
        FROM public_profiles
        WHERE tenant_id = $1 AND slug = $2
        LIMIT 1
        `,
        [tenantId, slug]
      );

      if (!existing) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  async createProfile(
    tenantId: string,
    input: CreatePublicProfileInput
  ): Promise<PublicProfile> {
    // Gerar slug se não fornecido
    let slug = input.slug;
    if (!slug) {
      const baseSlug = this.generateSlug(input.displayName);
      slug = await this.generateUniqueSlug(tenantId, baseSlug);
    } else {
      // Verificar se slug já existe
      const existing = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
        SELECT id
        FROM public_profiles
        WHERE tenant_id = $1 AND slug = $2
        LIMIT 1
        `,
        [tenantId, slug]
      );

      if (existing) {
        throw new Error(`Slug '${slug}' já existe para este tenant`);
      }
    }

    const row = await runQueryWithTenant<PublicProfileRow>(
      tenantId,
      `
      INSERT INTO public_profiles (
        tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata,
        created_at, updated_at
      `,
      [
        tenantId,
        input.actorId,
        input.profileType,
        slug,
        input.displayName,
        input.bio || null,
        input.avatarUrl || null,
        input.coverUrl || null,
        // alinhado ao CHECK da tabela ('public'/'private'/'followers_only' minúsculo) —
        // o default antigo 'PUBLIC' violava o CHECK (módulo dormente nunca rodou).
        input.visibility || 'public',
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar perfil público');
    }

    return this.toProfile(row);
  }

  async updateProfile(
    tenantId: string,
    profileId: string,
    input: UpdatePublicProfileInput
  ): Promise<PublicProfile> {
    const updates: string[] = [];
    const params: any[] = [tenantId, profileId];
    let paramIndex = 3;

    if (input.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(input.displayName);
      paramIndex++;
    }

    if (input.bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      params.push(input.bio || null);
      paramIndex++;
    }

    if (input.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex}`);
      params.push(input.avatarUrl || null);
      paramIndex++;
    }

    if (input.coverUrl !== undefined) {
      updates.push(`cover_url = $${paramIndex}`);
      params.push(input.coverUrl || null);
      paramIndex++;
    }

    if (input.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex}`);
      params.push(input.visibility);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nada para atualizar, retornar perfil atual
      const profile = await this.getProfileById(tenantId, profileId);
      if (!profile) {
        throw new Error('Perfil público não encontrado');
      }
      return profile;
    }

    updates.push(`updated_at = NOW()`);

    const row = await runQueryWithTenant<PublicProfileRow>(
      tenantId,
      `
      UPDATE public_profiles
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata,
        created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Perfil público não encontrado');
    }

    return this.toProfile(row);
  }

  async getProfileById(tenantId: string, profileId: string): Promise<PublicProfile | null> {
    const row = await runQueryWithTenant<PublicProfileRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata,
        created_at, updated_at
      FROM public_profiles
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, profileId]
    );

    if (!row) {
      return null;
    }

    return this.toProfile(row);
  }

  async getProfileBySlug(tenantId: string, slug: string): Promise<PublicProfile | null> {
    // 🔴 F4 FIX (YALA 2026-07-04): resolução por slug é caminho PÚBLICO (rota pública GET /:slug e
    // storefront de venue /v/:slug). Antes NÃO filtrava visibility → perfil 'private'/'followers_only'
    // (ou despublicado) seguia legível por quem adivinhasse o slug (slug deriva do display_name =
    // enumerável), anulando o "unpublish". Só perfil PÚBLICO resolve por slug; a visão do dono do
    // próprio perfil não-público vive em GET /mine (autenticado), não aqui.
    const row = await runQueryWithTenant<PublicProfileRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata,
        created_at, updated_at
      FROM public_profiles
      WHERE tenant_id = $1 AND slug = $2 AND visibility = 'public'
      `,
      [tenantId, slug]
    );

    if (!row) {
      return null;
    }

    return this.toProfile(row);
  }

  async listProfiles(
    tenantId: string,
    filters: PublicProfileFilters = {}
  ): Promise<PublicProfile[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.profileType) {
      conditions.push(`profile_type = $${paramIndex}`);
      params.push(filters.profileType);
      paramIndex++;
    }

    if (filters.visibility) {
      conditions.push(`visibility = $${paramIndex}`);
      params.push(filters.visibility);
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<PublicProfileRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, profile_type, slug, display_name,
        bio, avatar_url, cover_url, visibility, metadata,
        created_at, updated_at
      FROM public_profiles
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toProfile(row));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // F-DISCOVERY-PUBLIC-PROFILE-SLICE-A (VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Projeção SEGURA do actor para materializar a plaquinha (leitura prevista pelo SSOT registry:
   * "Leitores futuros: busca/matching (read), via service"). NUNCA seleciona user_id/
   * global_user_id/external_id/metadata — anti-PII por construção.
   */
  async getActorProjection(
    tenantId: string,
    actorId: string
  ): Promise<{ id: string; display_name: string; slug: string | null; avatar_url: string | null; bio: string | null; actor_type: string } | null> {
    const row = await runQueryWithTenant<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      bio: string | null;
      actor_type: string;
    }>(
      tenantId,
      `SELECT id, display_name, slug, avatar_url, bio, actor_type
         FROM actors
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, actorId]
    );
    return row ?? null;
  }

  /**
   * Publica/atualiza a plaquinha do actor na vitrine (1 perfil por actor — uq_public_profiles_actor).
   * Idempotente: ON CONFLICT atualiza projeção + visibility. Slug gerado no primeiro publish e
   * PRESERVADO nos seguintes (identidade de URL estável).
   */
  async upsertByActor(
    tenantId: string,
    input: {
      actorId: string;
      profileType: PublicProfileType;
      displayName: string;
      bio: string | null;
      avatarUrl: string | null;
      visibility: PublishVisibility;
      metadata?: Record<string, unknown>;
    }
  ): Promise<PublicProfile> {
    const baseSlug = this.generateSlug(input.displayName);
    const slug = await this.generateUniqueSlug(tenantId, baseSlug);
    const metadataJson = JSON.stringify(input.metadata ?? {});

    const row = await runQueryWithTenant<PublicProfileRow>(
      tenantId,
      `INSERT INTO public_profiles (
         tenant_id, actor_id, profile_type, slug, display_name, bio, avatar_url, visibility, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (tenant_id, actor_id) DO UPDATE SET
         profile_type = EXCLUDED.profile_type,
         display_name = EXCLUDED.display_name,
         bio          = EXCLUDED.bio,
         avatar_url   = EXCLUDED.avatar_url,
         visibility   = EXCLUDED.visibility,
         metadata     = EXCLUDED.metadata,
         updated_at   = NOW()
       RETURNING id, tenant_id, actor_id, profile_type, slug, display_name,
         bio, avatar_url, cover_url, visibility, metadata, created_at, updated_at`,
      [tenantId, input.actorId, input.profileType, slug, input.displayName, input.bio, input.avatarUrl, input.visibility, metadataJson]
    );

    if (!row) {
      throw new Error('Erro ao publicar perfil na vitrine');
    }
    return this.toProfile(row);
  }

  /**
   * LEITURA DA VITRINE — deliberadamente SEM filtro de tenant.
   *
   * Esta é a única query cross-tenant do módulo, e é LEGAL por construção (desenho canônico
   * selado): public_profiles NÃO tem RLS (criada após 20260516100000_rls_critical_tables, fora
   * da lista), só recebe PLAQUINHA (projeção pública publicada por ESCOLHA do dono via
   * canRepresentActor), e visibility='public' é o único degrau exposto. Mesmo padrão de
   * canonical_products scope='global' (Lei de Coerência §4.10.3). Dinheiro/agenda/documentos
   * NUNCA passam por aqui. `pool.query` direto (não runQueryWithTenant) porque a semântica é
   * global — usar o helper de tenant mentiria sobre a intenção.
   */
  async searchGlobalPublic(q: string, limit: number): Promise<GlobalDiscoveryHit[]> {
    const res = await pool.query<{
      actor_id: string;
      tenant_id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      bio: string | null;
      profile_type: string;
    }>(
      `SELECT actor_id, tenant_id, display_name, slug, avatar_url, bio, profile_type
         FROM public_profiles
        WHERE visibility = 'public'
          AND profile_type IN ('user', 'page')
          AND unaccent(display_name) ILIKE unaccent($1)
        ORDER BY display_name ASC
        LIMIT $2`,
      [`%${q}%`, limit]
    );
    return res.rows.map((r) => ({
      actorId: r.actor_id,
      tenantId: r.tenant_id,
      displayName: r.display_name,
      slug: r.slug,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      profileType: r.profile_type as PublicProfileType,
    }));
  }

  /**
   * LEITURA DA VITRINE (perfil único, destino do clique no hit global) — mesma legalidade cross-tenant
   * de `searchGlobalPublic`: `pool.query` direto (semântica global), SÓ a plaquinha, SÓ
   * visibility='public', tenant_id NÃO retornado (anti-leak de origem). NUNCA PII/dinheiro/agenda.
   */
  async getGlobalPublicProfileByActor(actorId: string): Promise<GlobalPublicProfileView | null> {
    // headline/link são EXTRAÍDOS explicitamente do cartão (metadata->'card') — só esses 2 campos
    // seguros, NUNCA o blob metadata inteiro (anti-PII/anti-leak; o guard vigia).
    const res = await pool.query<{
      actor_id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      bio: string | null;
      profile_type: string;
      headline: string | null;
      link: string | null;
    }>(
      `SELECT actor_id, display_name, slug, avatar_url, cover_url, bio, profile_type,
              metadata->'card'->>'headline' AS headline,
              metadata->'card'->>'link'     AS link
         FROM public_profiles
        WHERE actor_id = $1 AND visibility = 'public'
        LIMIT 1`,
      [actorId]
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      actorId: r.actor_id,
      displayName: r.display_name,
      slug: r.slug,
      avatarUrl: r.avatar_url,
      coverUrl: r.cover_url,
      bio: r.bio,
      profileType: r.profile_type as PublicProfileType,
      headline: r.headline,
      link: r.link,
    };
  }
}

export const publicProfileRepository = new PublicProfileRepository();








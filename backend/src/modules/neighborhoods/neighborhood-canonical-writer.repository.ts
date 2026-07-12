// backend/src/modules/neighborhoods/neighborhood-canonical-writer.repository.ts
// F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-E — wrapper do writer canônico. NÃO reimplementa a escrita:
// chama a função SQL fn_create_canonical_neighborhood (SECURITY DEFINER) que valida ownership-direto,
// asere as duas capabilities (create+approve), emite/consome o token do HOLD, faz o INSERT único e grava
// os dois eventos de auditoria — tudo atômico. Exige um TxQueryClient (mesma transação do service); SEM
// fallback para pool. Mapeia denial/validation/conflict; erro de INFRA PROPAGA (nunca vira 403 silencioso).

import { HttpError } from '@core/errors/http-error';

/** Client de transação (PoolClient). O writer só roda dentro de withTransaction — nunca abre conexão própria. */
export interface TxQueryClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface CreateCanonicalNeighborhoodArgs {
  tenantId: string;            // server-side
  authenticatedUserId: string; // server-side (req.user.userId)
  granteeActorId: string;      // server-side (Actor pessoal do usuário)
  cityId: string;              // identidade do recurso (Location Core)
  name: string;
  sourceKind: string;
  sourceReference: string;
  evidence: string;
  reason: string;
}

export const neighborhoodCanonicalWriterRepository = {
  /**
   * Cria o bairro canônico via a função SQL, no MESMO client/transação. Retorna somente o neighborhood_id.
   * Denial de autoridade → 403 uniforme; nome inválido → 400 validation; conflito de identidade → 409;
   * proveniência inválida → 400; QUALQUER outro erro (infra/DB) PROPAGA.
   */
  async createCanonicalNeighborhood(client: TxQueryClient, a: CreateCanonicalNeighborhoodArgs): Promise<string> {
    try {
      const r = await client.query<{ neighborhood_id: string }>(
        `SELECT public.fn_create_canonical_neighborhood($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9) AS neighborhood_id`,
        [a.tenantId, a.authenticatedUserId, a.granteeActorId, a.cityId, a.name, a.sourceKind, a.sourceReference, a.evidence, a.reason]
      );
      const id = r.rows[0]?.neighborhood_id;
      if (!id) throw new Error('NEIGHBORHOOD_WRITER_NO_ID: função canônica não retornou neighborhood_id.');
      return id;
    } catch (error: any) {
      const msg = error?.message || '';
      // denial de autoridade (ownership-direto OU capability) — uniforme, não-vazante
      if (/TERRITORIAL_CAPABILITY_DENIED/.test(msg)) throw HttpError.forbidden('TERRITORIAL_CAPABILITY_DENIED');
      // validation (distinta de denial): nome inválido
      if (/NEIGHBORHOOD_NAME_INVALID/.test(msg)) throw HttpError.badRequest('NEIGHBORHOOD_NAME_INVALID');
      // conflito de identidade (mesmo nome normalizado na cidade)
      if (error?.code === '23505' || /uq_neighborhood|neighborhoods_city_name_unique|duplicate key/i.test(msg)) {
        throw HttpError.conflict('NEIGHBORHOOD_ALREADY_EXISTS_IN_CITY');
      }
      // proveniência inválida (source_kind/evidence/reason)
      if (error?.code === '23514' || /chk_neighborhoods_|chk_nce_/.test(msg)) throw HttpError.badRequest('NEIGHBORHOOD_PROVENANCE_INVALID');
      // infra/DB inesperado → PROPAGA (lição D.3: nunca vira 403 silencioso)
      throw error;
    }
  },
};

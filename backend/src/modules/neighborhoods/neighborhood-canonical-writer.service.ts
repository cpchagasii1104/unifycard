// backend/src/modules/neighborhoods/neighborhood-canonical-writer.service.ts
// F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-E — transaction-service interno (SEM rota) do writer canônico.
//
// CONTEXTO AUTENTICADO (server-side) é SEPARADO do PAYLOAD do recurso — nunca um objeto único que uma
// futura rota possa preencher inteiro pelo body. A representabilidade humana é COMPOSTA aqui como
// prevalidation (canRepresentActor), mas a barreira MATERIAL é a função SQL (ownership-direto + 2 grants +
// token + INSERT + auditoria, atômicos). Abre withTransaction e usa o MESMO client para a função canônica;
// nunca INSERT direto; nunca chama fn_assert_territorial_capability fora da função. Retorna só neighborhood_id.
//
// Contrato de erro (lição D.3): canRepresentActor=false → denial antecipado (403 uniforme); canRepresentActor
// LANÇA → INFRA propaga (nunca vira false/403). Denial/validation/conflict da função vêm do repository.

import { authorizationService } from '@core/authorization/authorization.service';
import { withTransaction } from '@core/database/transaction.helper';
import { HttpError } from '@core/errors/http-error';
import {
  neighborhoodCanonicalWriterRepository,
  type TxQueryClient,
} from './neighborhood-canonical-writer.repository';

/** Contexto AUTENTICADO server-side (nunca do body). */
export interface NeighborhoodWriterContext {
  tenantId: string;
  userId: string;
  granteeActorId: string;
}

/** PAYLOAD do recurso (dados do bairro). */
export interface NeighborhoodCreatePayload {
  cityId: string;
  name: string;
  sourceKind: string;
  sourceReference: string;
  evidence: string;
  reason: string;
}

export const neighborhoodCanonicalWriterService = {
  /**
   * Cria um bairro canônico (create+approve atômico). Contexto e payload separados. Retorna neighborhood_id.
   */
  async createCanonicalNeighborhood(ctx: NeighborhoodWriterContext, payload: NeighborhoodCreatePayload): Promise<string> {
    // presença do contexto autenticado → denial uniforme (fail-closed)
    if (!ctx.tenantId?.trim() || !ctx.userId?.trim() || !ctx.granteeActorId?.trim()) {
      throw HttpError.forbidden('TERRITORIAL_CAPABILITY_DENIED');
    }
    // presença do payload de domínio → validation (distinta de denial)
    if (!payload.cityId?.trim() || !payload.name || !payload.sourceKind?.trim()
      || !payload.sourceReference?.trim() || !payload.evidence?.trim() || !payload.reason?.trim()) {
      throw HttpError.badRequest('NEIGHBORHOOD_INPUT_INVALID');
    }

    // PREVALIDATION de representabilidade (não é a barreira material — a SQL impõe ownership-direto).
    // false = denial legítimo; um THROW é INFRAESTRUTURA e PROPAGA (sem try/catch aqui — lição D.3).
    const canRep = await authorizationService.canRepresentActor(ctx.tenantId, ctx.userId, ctx.granteeActorId);
    if (!canRep) {
      throw HttpError.forbidden('TERRITORIAL_CAPABILITY_DENIED');
    }

    // ATÔMICO: representabilidade material + duas capabilities + token + INSERT + dois eventos na MESMA
    // transação/client (dentro da função SQL). O service nunca faz INSERT direto nem duplica a query.
    return withTransaction(ctx.tenantId, (client: TxQueryClient) =>
      neighborhoodCanonicalWriterRepository.createCanonicalNeighborhood(client, {
        tenantId: ctx.tenantId,
        authenticatedUserId: ctx.userId,
        granteeActorId: ctx.granteeActorId,
        cityId: payload.cityId,
        name: payload.name,
        sourceKind: payload.sourceKind,
        sourceReference: payload.sourceReference,
        evidence: payload.evidence,
        reason: payload.reason,
      })
    );
  },
};

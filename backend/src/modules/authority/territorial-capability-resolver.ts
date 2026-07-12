// backend/src/modules/authority/territorial-capability-resolver.ts
// F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.3 (DECISION-0173 + ADENDO N2-D.3 D1..D8).
//
// RESOLVER/ASSERTION de CAPABILITY TERRITORIAL — wrapper interno que COMPÕE a autoridade territorial a
// partir de DUAS provas cumulativas, reutilizando a casa canônica de grants (NUNCA segunda verdade):
//
//   A. REPRESENTABILIDADE (runtime, tenant server-side): a pessoa autenticada pode VESTIR o grantee Actor?
//      → authorizationService.canRepresentActor(tenantId, userId, granteeActorId)  [D1.A]
//   B. CAPABILITY (banco, atômico p/ a row): esse Actor detém grant territorial ATIVO para a key EXATA e a
//      cidade canônica EXATA? → fn_assert_territorial_capability (SECURITY DEFINER, FOR SHARE)  [D1.B / D2]
//
// Nenhuma isolada basta (representar ≠ capability; capability ≠ representabilidade). canRepresentActor
// permanece PURO (não sabe de território). O `tenantId` é o tenant AUTENTICADO da requisição — serve para
// localizar/representar o Actor; NUNCA se recebe `actorTenantId` do cliente, nem se busca Actor globalmente
// para depois comparar tenant. A função SQL não filtra tenant (grant global por city; tenant_id NULL).
//
// FONTE ÚNICA: `has*` e `assert*` compartilham o mesmo `resolveTerritorialGrantId`. `has*` mapeia negação →
// false; `assert*` → 403 uniforme. Erro INESPERADO de infra/DB PROPAGA nos dois (nunca vira false/allow).
//
// SUPERFÍCIE (D3): módulo interno. ZERO rota (pública/admin), ZERO grant real, ZERO frontend, ZERO cache.
// D6: nenhum writer territorial existe ainda; esta fatia NÃO reivindica atomicidade completa entre
// representabilidade humana + capability + escrita (isso é envelope próprio da N2-E). D7: o `scopeCityId`
// deve vir do recurso canônico server-side (Location Core), nunca do body — contrato do futuro writer.

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { actorCapabilityGrantRepository } from './actor-capability-grant.repository';
import { isTerritorialCapabilityKey, type TerritorialCapabilityKey } from './actor-capability-grant.types';

export interface TerritorialCapabilityContext {
  /** Tenant AUTENTICADO da requisição (server-side). Localiza/representa o Actor; nunca do body. */
  tenantId: string;
  /** Principal autenticado (req.user.userId). */
  userId: string;
  /** Actor tenant-bound que teria recebido a autoridade territorial. */
  granteeActorId: string;
  /** Capability territorial — validada por conjunto EXATO (isTerritorialCapabilityKey), sem prefixo. */
  capabilityKey: string;
  /** Cidade canônica (cities.city_id) do recurso — derivada server-side (Location Core), nunca do body. */
  scopeCityId: string;
}

/** Erro de domínio uniforme e NÃO-vazante para negação territorial (nunca expõe grant_id/tenant/city/status). */
export const TERRITORIAL_CAPABILITY_DENIED = 'TERRITORIAL_CAPABILITY_DENIED';

/**
 * FONTE ÚNICA da regra. Retorna o `grant_id` aprovado, ou `null` quando NEGADO (key fora do conjunto,
 * sem representabilidade, ou negação da função SQL). Erro inesperado de infra/DB PROPAGA (não vira null).
 * Ordem fail-closed barata→cara: key exata (sem DB) → representabilidade → função SQL (lock).
 */
async function resolveTerritorialGrantId(ctx: TerritorialCapabilityContext): Promise<string | null> {
  // Inputs vazios → deny (fail-closed), sem tocar DB.
  if (!ctx.tenantId?.trim() || !ctx.userId?.trim() || !ctx.granteeActorId?.trim() || !ctx.scopeCityId?.trim()) {
    return null;
  }

  // (1) key territorial por CONJUNTO EXATO (nunca startsWith/prefix). Não chega ao repository se inválida.
  if (!isTerritorialCapabilityKey(ctx.capabilityKey)) {
    return null;
  }

  // (2) representabilidade humana (tenant server-side). SEPARAÇÃO ESTRITA (veredito Yala N2-D.3):
  //   - CONTEÚDO false → negação LEGÍTIMA (deny): resolve→null, has→false, assert→403 uniforme;
  //   - ERRO LANÇADO (timeout/conexão/SQL/repository/runtime) → INFRAESTRUTURA: deve PROPAGAR integralmente,
  //     nunca convertido em false/null/403/denial. SEM try/catch aqui: `false` nega; um throw sobe intacto.
  const canRep = await authorizationService.canRepresentActor(ctx.tenantId, ctx.userId, ctx.granteeActorId);
  if (!canRep) {
    return null;
  }

  // (3) capability no banco (assertion + lock atômico da row). Denial → null; infra inesperada → PROPAGA.
  return actorCapabilityGrantRepository.assertTerritorialCapability(
    ctx.tenantId,
    ctx.granteeActorId,
    ctx.capabilityKey,
    ctx.scopeCityId
  );
}

/**
 * Primitivo booleano de leitura. `true` só se representabilidade + grant territorial válido coincidirem.
 * Erro inesperado de infra/DB PROPAGA (nunca é silenciado como false — falha operacional não vira deny mudo).
 */
export async function hasTerritorialCapability(ctx: TerritorialCapabilityContext): Promise<boolean> {
  const grantId = await resolveTerritorialGrantId(ctx);
  return grantId !== null;
}

/**
 * Assertiva fail-closed. Retorna o `grant_id` aprovado; lança 403 uniforme (não-vazante) na negação.
 * Erro inesperado de infra/DB PROPAGA. Nunca expõe grant_id/tenant/city/status na mensagem pública.
 */
export async function assertTerritorialCapability(ctx: TerritorialCapabilityContext): Promise<string> {
  const grantId = await resolveTerritorialGrantId(ctx);
  if (grantId === null) {
    throw HttpError.forbidden(TERRITORIAL_CAPABILITY_DENIED);
  }
  return grantId;
}

export type { TerritorialCapabilityKey };

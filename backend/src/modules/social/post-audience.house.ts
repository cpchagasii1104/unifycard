// CASA CANÔNICA ÚNICA de decisão de audiência de publicação (DECISION-0162 + DECISION-0176).
//
// É o ÚNICO lugar que decide quem pode ver uma publicação. Todos os readers vivos de `posts` que expõem
// conteúdo DEVEM compor esta casa — via `postAudiencePredicateSql` (queries de coleção/contagem) ou
// `canViewPost` (detalhe por ID e conteúdo derivado da publicação-mãe: comentário/thread/repost/preview/
// notificação). Proibido duplicar o predicado por rota ou manter um segundo predicado que possa divergir.
//
// Composição (mais restritiva vence):
//   AUTORIA (bypass explícito)  OR  ( visibility relacional (0162)  ⋀  audiência territorial (0176) )
// Territorial: audience_city_id IS NULL → sem restrição; = city da residência actor-scoped VIGENTE do leitor.
// Leitor sem residência actor-scoped → viewerCity NULL → não elegível a posts territoriais (fail-closed).
// Erro de infraestrutura ao resolver a residência PROPAGA (nunca vira NULL/false silencioso).

import { getClientWithTenant } from '@core/database/pool';

// DECISION-0176 (S-CITY-1): city_id canônico de Curitiba (piloto). ID server-side, NUNCA env/nome — a trava
// anti-expansão do guard garante que só Curitiba habilita audiência territorial na escrita.
export const CURITIBA_CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';

/**
 * Predicado SQL canônico de audiência (componível). `viewerParam` = placeholder do actor LEITOR resolvido
 * server-side; `viewerCityParam` = placeholder da city_id da residência actor-scoped vigente do leitor
 * (NULL quando ausente). A autoria é cláusula EXPLÍCITA de bypass.
 */
export function postAudiencePredicateSql(postAlias: string, viewerParam: string, viewerCityParam: string): string {
  const relational = `(
    ${postAlias}.visibility = 'public'
    OR (
      ${postAlias}.visibility = 'connections'
      AND ${viewerParam}::uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM actor_relationships ar
        WHERE ar.tenant_id = ${postAlias}.tenant_id
          AND ar.status = 'accepted'
          AND (
            (ar.from_actor_id = ${postAlias}.actor_id AND ar.to_actor_id = ${viewerParam})
            OR (ar.from_actor_id = ${viewerParam} AND ar.to_actor_id = ${postAlias}.actor_id)
          )
          AND (
            ${postAlias}.audience_relationship_types IS NULL
            OR (
              CASE WHEN ar.from_actor_id = ${postAlias}.actor_id
                   THEN ar.requester_label ELSE ar.target_label END
            ) = ANY(${postAlias}.audience_relationship_types)
          )
      )
    )
  )`;
  const territorial = `(
    ${postAlias}.audience_city_id IS NULL
    OR ${postAlias}.audience_city_id = ${viewerCityParam}::uuid
  )`;
  return `(
    ${postAlias}.actor_id = ${viewerParam}
    OR ( ${relational} AND ${territorial} )
  )`;
}

/**
 * Resolve a city_id da RESIDÊNCIA actor-scoped VIGENTE do leitor. NULL quando não há residência actor-scoped
 * (não elegível a posts territoriais — fail-closed). NUNCA usa profile/RESIDENCE nem actor_active_location
 * (o resolver consulta só owner_type='actor'). Erro de infraestrutura PROPAGA.
 */
export async function resolveViewerResidenceCity(tenantId: string, viewerActorId: string | null | undefined): Promise<string | null> {
  if (!viewerActorId) return null;
  const { resolveActorTerritory } = await import('@core/location/actor-territorial-resolver');
  const t = await resolveActorTerritory(tenantId, viewerActorId, 'ACTOR_RESIDENCE');
  return t.cityId;
}

/**
 * Autorização de UMA publicação para um leitor — para DETALHE POR ID e CONTEÚDO DERIVADO (publicação-mãe de
 * comentário/thread/repost/preview/notificação). Mesma decisão das coleções (não diverge). Retorna false
 * quando não autorizado (nunca revela existência/conteúdo). Erro de infra do resolver PROPAGA.
 */
export async function canViewPost(tenantId: string, viewerActorId: string | null | undefined, postId: string): Promise<boolean> {
  if (!postId) return false;
  const viewerCity = await resolveViewerResidenceCity(tenantId, viewerActorId);
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query(
      `SELECT 1 FROM posts p WHERE p.id = $1 AND ${postAudiencePredicateSql('p', '$2', '$3')} LIMIT 1`,
      [postId, viewerActorId ?? null, viewerCity],
    );
    return r.rows.length > 0;
  } finally {
    client.release();
  }
}

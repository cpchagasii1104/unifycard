// backend/src/modules/relationships/actor-relationship.service.ts
// F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 — regra de negócio da aresta de relação tipada.
//
// FRONTEIRAS (invioláveis — guard audit-actor-relationship-boundary.mjs morde regressão):
//   · relação ≠ autoridade: NUNCA lê/escreve company_users, NUNCA concede canManageCompany/permissão.
//     Aceitar 'colaborador' NÃO liga ninguém à operação da empresa — o grant é ato SEPARADO do dono
//     no substrato real de autoridade (fatia de onboarding, DECISION-0125).
//   · Δbank=0: nada de dinheiro.
//   · vocabulário GOVERNADO fail-closed: label fora do seed aprovado → rejeitado (400/422).
//   · a AUTORIDADE de "agir COMO o actor" (canRepresentActor) é provada na ROTA (DECISION-0113);
//     este service assume from/responder JÁ PROVADOS e valida só a semântica da aresta.

import { actorRelationshipRepository, type ActorKindRow } from './actor-relationship.repository';
import {
  FEED_PRIORITIES,
  PAIR_ALLOWED_LABELS,
  RELATIONSHIP_LABELS,
  pairKey,
  type ActorKind,
  type ActorRelationship,
  type FeedPriority,
  type RelationshipFilters,
  type RelationshipLabel,
  type RespondRelationshipInput,
  type SendRelationshipInput,
} from './actor-relationship.types';

class RelationshipError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Classifica o lado da aresta. PF = actor humano; PJ = empresa/page. Grupo/canal/outros = fora
 *  do seed aprovado nesta fatia → fail-closed (extensão = RFC/DECISION, não feature). */
function actorKindOf(row: ActorKindRow): ActorKind | null {
  if (row.actor_type === 'page' || row.company_id) return 'pj';
  if (row.actor_type === 'user' || row.actor_type === 'actor_human' || row.actor_type === 'person') return 'pf';
  return null;
}

function isRelationshipLabel(value: unknown): value is RelationshipLabel {
  return typeof value === 'string' && (RELATIONSHIP_LABELS as readonly string[]).includes(value);
}

/** Vocabulário governado da frequência de feed — fail-closed (400) fora do seed. */
function assertFeedPriority(value: unknown): FeedPriority {
  if (typeof value !== 'string' || !(FEED_PRIORITIES as readonly string[]).includes(value)) {
    throw new RelationshipError(400, 'Frequência de feed inválida — fora do vocabulário governado');
  }
  return value as FeedPriority;
}

/** Label precisa (a) estar no vocabulário total e (b) valer para o PAR de tipos (seed §7). */
function assertLabelAllowedForPair(label: unknown, kindA: ActorKind, kindB: ActorKind): RelationshipLabel {
  if (!isRelationshipLabel(label)) {
    throw new RelationshipError(400, `Tipo de relação inválido — fora do vocabulário governado`);
  }
  const allowed = PAIR_ALLOWED_LABELS[pairKey(kindA, kindB)] ?? [];
  if (!allowed.includes(label)) {
    throw new RelationshipError(
      422,
      `Tipo '${label}' não vale para este par de actors (${pairKey(kindA, kindB)})`
    );
  }
  return label;
}

class ActorRelationshipService {
  /** Resolve e valida o par (existência no tenant + tipos suportados pelo seed). */
  private async resolvePairKinds(
    tenantId: string,
    fromActorId: string,
    toActorId: string
  ): Promise<{ fromKind: ActorKind; toKind: ActorKind }> {
    const [fromRow, toRow] = await Promise.all([
      actorRelationshipRepository.findActorKindRow(tenantId, fromActorId),
      actorRelationshipRepository.findActorKindRow(tenantId, toActorId),
    ]);
    if (!toRow) throw new RelationshipError(404, 'Actor destino não encontrado neste tenant');
    if (!fromRow) throw new RelationshipError(404, 'Actor de origem não encontrado neste tenant');
    const fromKind = actorKindOf(fromRow);
    const toKind = actorKindOf(toRow);
    if (!fromKind || !toKind) {
      throw new RelationshipError(422, 'Tipo de actor fora do seed de relação desta fatia (PF/PJ)');
    }
    return { fromKind, toKind };
  }

  /** Enviar pedido de conexão JÁ classificando o outro (assimetria: a MINHA ótica no envio). */
  async sendRequest(
    tenantId: string,
    fromActorId: string,
    userId: string,
    input: SendRelationshipInput
  ): Promise<ActorRelationship> {
    const toActorId = input?.toActorId;
    if (!toActorId || typeof toActorId !== 'string') {
      throw new RelationshipError(400, 'toActorId é obrigatório');
    }
    if (toActorId === fromActorId) {
      throw new RelationshipError(400, 'Auto-conexão não é permitida (from = to)');
    }

    const { fromKind, toKind } = await this.resolvePairKinds(tenantId, fromActorId, toActorId);
    const requesterLabel = assertLabelAllowedForPair(input?.requesterLabel, fromKind, toKind);

    const existing = await actorRelationshipRepository.findByPair(tenantId, fromActorId, toActorId);
    if (existing) {
      throw new RelationshipError(409, `Já existe relação entre estes actors (status=${existing.status})`);
    }

    return actorRelationshipRepository.create(tenantId, fromActorId, toActorId, requesterLabel, userId);
  }

  /** Solicitações RECEBIDAS pendentes, com allowedTargetLabels POR ITEM (regra de par server-side —
   *  a tela só projeta; nunca duplica a regra no frontend). Achado de Clayton 2026-07-07. */
  async listPendingReceived(tenantId: string, actorId: string) {
    const rows = await actorRelationshipRepository.listPendingReceived(tenantId, actorId);
    const meRow = await actorRelationshipRepository.findActorKindRow(tenantId, actorId);
    const myKind = meRow ? actorKindOf(meRow) : null;
    return Promise.all(rows.map(async (r) => {
      const fromRow = await actorRelationshipRepository.findActorKindRow(tenantId, r.from_actor_id);
      const fromKind = fromRow ? actorKindOf(fromRow) : null;
      const allowed = myKind && fromKind ? (PAIR_ALLOWED_LABELS[pairKey(myKind, fromKind)] ?? []) : [];
      return {
        id: r.id,
        fromActorId: r.from_actor_id,
        fromDisplayName: r.from_display_name,
        fromActorType: r.from_actor_type,
        requesterLabel: r.requester_label,
        requestedAt: r.requested_at,
        allowedTargetLabels: allowed,
      };
    }));
  }

  /** Responder ao pedido: aceite CLASSIFICADO (target_label obrigatório) ou rejeição.
   *  `respondingActorId` = o actor PROVADO na rota; precisa ser o DESTINO da aresta. */
  async respond(
    tenantId: string,
    respondingActorId: string,
    userId: string,
    relationshipId: string,
    input: RespondRelationshipInput
  ): Promise<ActorRelationship> {
    const edge = await actorRelationshipRepository.findById(tenantId, relationshipId);
    if (!edge) throw new RelationshipError(404, 'Relação não encontrada');
    // fail-closed: só o actor DESTINO responde (representar outro actor qualquer não basta)
    if (edge.toActorId !== respondingActorId) {
      throw new RelationshipError(403, 'Só o actor destino do pedido pode respondê-lo');
    }
    if (edge.status !== 'pending') {
      throw new RelationshipError(409, `Relação não está pendente (status=${edge.status})`);
    }

    if (input?.action === 'reject') {
      const updated = await actorRelationshipRepository.respond(tenantId, relationshipId, 'rejected', null, userId);
      if (!updated) throw new RelationshipError(409, 'Relação não está mais pendente');
      return updated;
    }

    if (input?.action !== 'accept') {
      throw new RelationshipError(400, "action deve ser 'accept' ou 'reject'");
    }

    // aceite classificado: o TO classifica o FROM pela sua ótica (mesmo par, ótica invertida)
    const { fromKind, toKind } = await this.resolvePairKinds(tenantId, edge.fromActorId, edge.toActorId);
    const targetLabel = assertLabelAllowedForPair(input?.targetLabel, toKind, fromKind);
    // frequência de feed opcional no aceite (ideia Clayton 2026-07-07) — default 'padrao'
    const feedPriority = input?.feedPriority !== undefined ? assertFeedPriority(input.feedPriority) : 'padrao';

    const updated = await actorRelationshipRepository.respond(
      tenantId, relationshipId, 'accepted', targetLabel, userId, feedPriority
    );
    if (!updated) throw new RelationshipError(409, 'Relação não está mais pendente');
    return updated;
  }

  /** Reajustar a frequência de feed DO MEU LADO (mesmas regras de participação da reclassify). */
  async reclassifyFeedPriority(
    tenantId: string,
    actorId: string,
    relationshipId: string,
    priority: unknown
  ): Promise<ActorRelationship> {
    const edge = await actorRelationshipRepository.findById(tenantId, relationshipId);
    if (!edge) throw new RelationshipError(404, 'Relação não encontrada');

    const iAmRequester = edge.fromActorId === actorId;
    const iAmTarget = edge.toActorId === actorId;
    if (!iAmRequester && !iAmTarget) {
      throw new RelationshipError(403, 'Só participantes da relação podem ajustá-la');
    }
    if (edge.status !== 'accepted' && edge.status !== 'pending') {
      throw new RelationshipError(409, `Relação não ajustável (status=${edge.status})`);
    }
    if (iAmTarget && edge.status !== 'accepted') {
      throw new RelationshipError(409, 'Configure ao aceitar — a relação ainda está pendente');
    }

    const validPriority = assertFeedPriority(priority);
    const updated = await actorRelationshipRepository.updateMyFeedPriority(
      tenantId,
      relationshipId,
      iAmRequester ? 'requester' : 'target',
      validPriority
    );
    if (!updated) throw new RelationshipError(404, 'Relação não encontrada');
    return updated;
  }

  /** Reclassificar O MEU LADO da aresta (achado Clayton 2026-07-07: "conhecido → amigo").
   *  Regras: só PARTICIPANTE muda; cada um muda SÓ a própria ótica (requester_label se enviei,
   *  target_label se recebi); label validado no PAR governado; quem RECEBEU só classifica
   *  depois do aceite (antes disso a ótica dele nasce no próprio aceite). */
  async reclassify(
    tenantId: string,
    actorId: string,
    relationshipId: string,
    label: unknown
  ): Promise<ActorRelationship> {
    const edge = await actorRelationshipRepository.findById(tenantId, relationshipId);
    if (!edge) throw new RelationshipError(404, 'Relação não encontrada');

    const iAmRequester = edge.fromActorId === actorId;
    const iAmTarget = edge.toActorId === actorId;
    if (!iAmRequester && !iAmTarget) {
      throw new RelationshipError(403, 'Só participantes da relação podem reclassificá-la');
    }
    if (iAmTarget && edge.status !== 'accepted') {
      throw new RelationshipError(409, 'Classifique ao aceitar — a relação ainda está pendente');
    }
    if (edge.status !== 'accepted' && edge.status !== 'pending') {
      throw new RelationshipError(409, `Relação não reclassificável (status=${edge.status})`);
    }

    // mesma régua do envio/aceite: label precisa valer pro PAR, pela MINHA ótica
    const { fromKind, toKind } = await this.resolvePairKinds(tenantId, edge.fromActorId, edge.toActorId);
    const myKind = iAmRequester ? fromKind : toKind;
    const otherKind = iAmRequester ? toKind : fromKind;
    const validLabel = assertLabelAllowedForPair(label, myKind, otherKind);

    const updated = await actorRelationshipRepository.updateMyLabel(
      tenantId,
      relationshipId,
      iAmRequester ? 'requester' : 'target',
      validLabel
    );
    if (!updated) throw new RelationshipError(404, 'Relação não encontrada');
    return updated;
  }

  /** "Minhas conexões" (CRM: filtro por label = meus clientes/fornecedores/colaboradores). */
  async listMine(
    tenantId: string,
    actorId: string,
    filters: RelationshipFilters = {}
  ): Promise<ActorRelationship[]> {
    return actorRelationshipRepository.listForActor(tenantId, actorId, filters);
  }
}

export const actorRelationshipService = new ActorRelationshipService();

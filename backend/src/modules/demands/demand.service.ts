// backend/src/modules/demands/demand.service.ts
// DECISION-0164 — regra de negócio da demanda (fatia A).
// Regimes (adendo 2): automatico = aceite PREENCHE vaga na hora · com_analise = candidatura,
// o EMISSOR escolhe. Cancelamento do provider LIBERA a vaga (adendo 3 — re-push é fatia C).
// Δbank=0: valores são registro. Autoridade provada na ROTA (0113); aqui só semântica.

import { demandRepository } from './demand.repository';
import {
  DEMAND_ACCEPTANCE_MODES, DEMAND_PRICING_MODES, DEMAND_VINCULOS,
  type CreateDemandInput, type DemandResponse, type ServiceDemand,
} from './demand.types';

class DemandError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) { super(message); this.statusCode = statusCode; }
}

function assertIn(value: unknown, allowed: readonly string[], label: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new DemandError(400, `${label} inválido — fora do vocabulário governado (${allowed.join('|')})`);
  }
  return value;
}

class DemandService {
  /** ESPELHO NO FEED (item 1 do fechamento): a demanda gera um post-projeção com a MESMA
   *  plateia. Falha do espelho NUNCA derruba a demanda (verdade = motor; feed = projeção). */
  private async mirrorToFeed(tenantId: string, userId: string, demand: ServiceDemand): Promise<void> {
    try {
      const { social2Service } = await import('../social/social-2.0.service');
      const money = demand.offeredPriceCents !== null ? ` · R$ ${(demand.offeredPriceCents / 100).toFixed(2)}` : '';
      const when = demand.dateStart ? ` · ${demand.dateStart}${demand.timeStart ? ` ${String(demand.timeStart).slice(0, 5)}–${String(demand.timeEnd ?? '').slice(0, 5)}` : ''}` : '';
      const content = `🎯 Oportunidade: ${demand.title}${when}${money}\n${demand.description ?? ''}\n\n👉 Ver e responder em Oportunidades`;
      const post = await social2Service.createPost(
        tenantId, userId, content, demand.actorId, [], 'personal',
        { intent_canonical: 'REQUEST_HELP', demand_id: demand.id, concept_slug: demand.conceptSlug },
        {}, undefined, undefined, userId, demand.actorId,
        demand.visibility as 'public' | 'connections',
        demand.audienceRelationshipTypes ?? undefined
      );
      await demandRepository.setPostId(tenantId, demand.id, (post as any).post_id);
    } catch (err) {
      console.warn('Espelho da demanda no feed falhou (não crítico — demanda criada):', err);
    }
  }

  async create(tenantId: string, actorId: string, input: CreateDemandInput, userId?: string): Promise<ServiceDemand> {
    if (!input?.title || !input.title.trim()) throw new DemandError(400, 'title é obrigatório');
    const vinculo = assertIn(input.vinculo, DEMAND_VINCULOS, 'vinculo');
    const acceptanceMode = input.acceptanceMode !== undefined
      ? assertIn(input.acceptanceMode, DEMAND_ACCEPTANCE_MODES, 'acceptanceMode') : 'com_analise';
    const pricingMode = input.pricingMode !== undefined
      ? assertIn(input.pricingMode, DEMAND_PRICING_MODES, 'pricingMode') : 'preco_ofertado';

    // O QUE = CONCEPT (SSOT semântico) — nunca texto livre
    const concept = await demandRepository.findConcept(tenantId, {
      conceptId: input.conceptId, conceptSlug: input.conceptSlug,
    });
    if (!concept) throw new DemandError(400, 'Concept não encontrado — a demanda referencia o catálogo governado');

    // coerência temporal mínima por vínculo (wizard se molda; servidor revalida)
    if (vinculo === 'diaria' && !input.dateStart) throw new DemandError(400, 'diaria exige dateStart');
    if (vinculo === 'periodo' && (!input.dateStart || !input.dateEnd)) throw new DemandError(400, 'periodo exige dateStart e dateEnd');
    if (vinculo === 'recorrente' && (!input.weekdays || input.weekdays.length === 0)) throw new DemandError(400, 'recorrente exige weekdays');

    // Espelho 0162: refinamento ⊆ vocabulário typed-edge; exige visibility='connections'
    const visibility = input.visibility === 'connections' ? 'connections' : 'public';
    let audienceTypes: string[] | null = null;
    if (input.audienceRelationshipTypes !== undefined && input.audienceRelationshipTypes !== null
        && input.audienceRelationshipTypes.length > 0) {
      const { RELATIONSHIP_LABELS } = await import('../relationships/actor-relationship.types');
      if (input.audienceRelationshipTypes.some((t) => !(RELATIONSHIP_LABELS as readonly string[]).includes(t))) {
        throw new DemandError(400, 'Refinamento de plateia fora do vocabulário governado (typed-edge)');
      }
      if (visibility !== 'connections') throw new DemandError(400, "Refinamento exige visibility='connections'");
      audienceTypes = input.audienceRelationshipTypes;
    }

    const quantity = input.quantity && input.quantity > 0 ? Math.floor(input.quantity) : 1;
    const demand = await demandRepository.create(tenantId, actorId, {
      conceptId: concept.concept_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      vinculo, quantity,
      dateStart: input.dateStart ?? null,
      dateEnd: input.dateEnd ?? null,
      timeStart: input.timeStart ?? null,
      timeEnd: input.timeEnd ?? null,
      weekdays: input.weekdays ?? null,
      radiusKm: input.radiusKm ?? null,
      breakMinutes: input.breakMinutes && input.breakMinutes > 0 ? Math.floor(input.breakMinutes) : null,
      acceptanceMode, pricingMode,
      offeredPriceCents: input.offeredPriceCents ?? null,
      cancelNoticeHours: input.cancelNoticeHours ?? null,
      visibility,
      audienceRelationshipTypes: audienceTypes,
    });
    if (userId) await this.mirrorToFeed(tenantId, userId, demand);
    return demand;
  }

  async listMine(tenantId: string, actorId: string) {
    return demandRepository.listMine(tenantId, actorId);
  }

  async listOpportunities(tenantId: string, providerActorId: string, onlyMatching: boolean) {
    return demandRepository.listOpportunities(tenantId, providerActorId, onlyMatching);
  }

  /** AUDIÊNCIA (fix Yala #6): fora da plateia = 404 (não vaza existência). Vale pra LER e AGIR. */
  private async assertAudience(tenantId: string, viewerActorId: string, demandId: string): Promise<void> {
    const ok = await demandRepository.isActorInAudience(tenantId, viewerActorId, demandId);
    if (!ok) throw new DemandError(404, 'Demanda não encontrada');
  }

  async getWithResponses(tenantId: string, actorId: string, demandId: string) {
    await this.assertAudience(tenantId, actorId, demandId);
    const demand = await demandRepository.findById(tenantId, demandId);
    if (!demand) throw new DemandError(404, 'Demanda não encontrada');
    // respostas completas SÓ pro emissor; provider vê a própria (projeção mínima)
    const all = await demandRepository.listResponses(tenantId, demandId);
    const responses = demand.actorId === actorId ? all : all.filter((r) => r.providerActorId === actorId);
    return { demand, responses };
  }

  /** Provider responde: automatico → accepted + fillSlot (fechou = fechou);
   *  com_analise → pending (candidatura na fila do emissor). */
  async respond(tenantId: string, providerActorId: string, demandId: string,
    input: { quoteCents?: number; message?: string }): Promise<{ demand: ServiceDemand; response: DemandResponse }> {
    // Fix Yala #6 (o pior achado): AGIR também exige estar na plateia — não-conexão não
    // pode aceitar/consumir vaga de demanda restrita (mutação não-autorizada barrada).
    await this.assertAudience(tenantId, providerActorId, demandId);
    const demand = await demandRepository.findById(tenantId, demandId);
    if (!demand) throw new DemandError(404, 'Demanda não encontrada');
    if (demand.actorId === providerActorId) throw new DemandError(400, 'Não é possível responder à própria demanda');
    if (demand.status !== 'open') throw new DemandError(409, `Demanda não está aberta (status=${demand.status})`);
    if (demand.pricingMode === 'orcamento' && (input?.quoteCents === undefined || input.quoteCents === null)) {
      throw new DemandError(400, 'Esta demanda pede ORÇAMENTO — informe quoteCents');
    }

    // Selo de agenda (TEMPO consistente): compromisso não colide com compromisso
    if (await demandRepository.hasScheduleConflict(tenantId, providerActorId, demand)) {
      throw new DemandError(409, 'Agenda em conflito: você já tem um compromisso aceito nessa janela');
    }

    if (demand.acceptanceMode === 'automatico') {
      const filled = await demandRepository.fillSlot(tenantId, demandId);
      if (!filled) throw new DemandError(409, 'Vaga já preenchida — a demanda fechou');
      try {
        const response = await demandRepository.createResponse(
          tenantId, demandId, providerActorId, 'accepted', input?.quoteCents ?? null, input?.message ?? null);
        return { demand: filled, response };
      } catch (err: any) {
        await demandRepository.releaseSlot(tenantId, demandId); // rollback da vaga (ex.: resposta duplicada)
        if (String(err?.message ?? '').includes('uq_sd_responses_demand_provider')) {
          throw new DemandError(409, 'Você já respondeu a esta demanda');
        }
        throw err;
      }
    }

    try {
      const response = await demandRepository.createResponse(
        tenantId, demandId, providerActorId, 'pending', input?.quoteCents ?? null, input?.message ?? null);
      return { demand, response };
    } catch (err: any) {
      if (String(err?.message ?? '').includes('uq_sd_responses_demand_provider')) {
        throw new DemandError(409, 'Você já se candidatou a esta demanda');
      }
      throw err;
    }
  }

  /** Emissor ESCOLHE candidato (com_analise): pending → chosen + preenche vaga. */
  async choose(tenantId: string, emitterActorId: string, demandId: string, responseId: string) {
    const demand = await demandRepository.findById(tenantId, demandId);
    if (!demand) throw new DemandError(404, 'Demanda não encontrada');
    if (demand.actorId !== emitterActorId) throw new DemandError(403, 'Só o emissor da demanda escolhe candidatos');
    const response = await demandRepository.findResponse(tenantId, responseId);
    if (!response || response.demandId !== demandId) throw new DemandError(404, 'Candidatura não encontrada');
    if (response.status !== 'pending') throw new DemandError(409, `Candidatura não está pendente (status=${response.status})`);
    // Selo de agenda também na ESCOLHA: o candidato pode ter fechado outra janela entretanto
    if (await demandRepository.hasScheduleConflict(tenantId, response.providerActorId, demand)) {
      throw new DemandError(409, 'Agenda do candidato entrou em conflito nessa janela — escolha outro');
    }

    const filled = await demandRepository.fillSlot(tenantId, demandId);
    if (!filled) throw new DemandError(409, 'Sem vagas restantes nesta demanda');
    // transição CONDICIONAL (fix Yala #4): se o candidato correu (withdraw) no meio, devolve a vaga
    const updated = await demandRepository.updateResponseStatusIf(tenantId, responseId, ['pending'], 'chosen');
    if (!updated) {
      await demandRepository.releaseSlot(tenantId, demandId);
      throw new DemandError(409, 'Candidatura mudou de estado — vaga devolvida, escolha outro');
    }
    return { demand: filled, response: updated };
  }

  /** Provider CANCELA (adendo 3): accepted/chosen → withdrawn + vaga LIBERA (reabre se filled).
   *  Candidatura pending → withdrawn sem mexer em vaga. */
  async withdraw(tenantId: string, providerActorId: string, demandId: string, responseId: string) {
    const response = await demandRepository.findResponse(tenantId, responseId);
    if (!response || response.demandId !== demandId) throw new DemandError(404, 'Resposta não encontrada');
    if (response.providerActorId !== providerActorId) throw new DemandError(403, 'Só quem respondeu pode cancelar a própria resposta');
    if (response.status === 'withdrawn') throw new DemandError(409, 'Resposta já cancelada');

    // transição CONDICIONAL (fix Yala #4): 2 withdraws concorrentes → só UM transiciona;
    // o perdedor recebe 409 e a vaga é liberada UMA única vez (sem double-release/over-fill).
    const hadSlot = response.status === 'accepted' || response.status === 'chosen';
    const updated = await demandRepository.updateResponseStatusIf(
      tenantId, responseId, ['pending', 'accepted', 'chosen'], 'withdrawn');
    if (!updated) throw new DemandError(409, 'Resposta já cancelada');
    const demand = hadSlot
      ? await demandRepository.releaseSlot(tenantId, demandId)
      : await demandRepository.findById(tenantId, demandId);
    return { demand: demand!, response: updated };
  }
}

export const demandService = new DemandService();

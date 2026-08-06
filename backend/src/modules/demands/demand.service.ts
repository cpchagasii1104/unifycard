// backend/src/modules/demands/demand.service.ts
// DECISION-0164 — regra de negócio da demanda (fatia A).
// Regimes (adendo 2): automatico = aceite PREENCHE vaga na hora · com_analise = candidatura,
// o EMISSOR escolhe. Cancelamento do provider LIBERA a vaga (adendo 3 — re-push é fatia C).
// Δbank=0: valores são registro. Autoridade provada na ROTA (0113); aqui só semântica.

import { demandRepository } from './demand.repository';
import {
  DEMAND_ACCEPTANCE_MODES, DEMAND_PRICING_MODES, DEMAND_VINCULOS,
  DEMAND_QUOTE_DEFAULT_VALIDITY_DAYS,
  type CreateDemandInput, type DemandResponse, type ServiceDemand,
} from './demand.types';
import { assertQuoteUsable } from './quote-validity';
import {
  DemandCommitmentError, DEMAND_COMMITMENT_TIMEZONE,
  demandWindowToInterval, resolveCommitmentOwner, type CommitmentOwner,
} from './demand-commitment';

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
  /**
   * 🔴 F2 · O ACEITE ATÔMICO (DECISION-0196 §D7 · GATE + GO Clayton 2026-08-06).
   *
   * UMA transação: preenche a vaga → grava a resposta aceita → **cria a availability, o booking e o
   * CONFIRM**. Se qualquer passo falha, **reverte inteira**: o cliente vê erro honesto, o orçamento
   * segue válido e aceitável, e **nenhum estado órfão persiste**. O estado *"aceito + confirm
   * falhou"* deixa de existir em vez de ganhar nome (§D7).
   *
   * ⚠️ Isto substitui a SAGA com compensação manual (`fillSlot` → `createResponse` →
   * `catch releaseSlot`). O `releaseSlot` de compensação **sai**: com transação real, o ROLLBACK
   * desfaz a vaga sozinho. Compensação à mão em caminho que vira compromisso é o que a §D7 mandou
   * eliminar — e cada passo novo multiplicava os ramos dela.
   *
   * 📌 O confirm passa pelo **chokepoint único** (`unifiedAvailabilityService.updateBooking`), com o
   * client externo: cascata do §B.4 resolvida aqui, mas a trava (advisory lock + conflito + a
   * `EXCLUDE` do banco) continua sendo a de sempre, dentro desta MESMA transação.
   *
   * Devolve `null` em `booking` quando o vínculo não tem janela (`recorrente`/`efetivo`): o aceite
   * é registro COMERCIAL válido; o que não acontece é ocupar agenda (STOP nomeado da G10).
   */
  private async aceitarComCompromisso(
    tenantId: string,
    demandId: string,
    providerActorId: string,
    quoteCents: number | null,
    message: string | null,
    expiresAt: Date,
    offeringId: string | null,
    assetId: string | null,
    statusResposta: 'accepted' | 'chosen',
    responseIdExistente: string | null,
  ): Promise<{ demand: ServiceDemand; response: DemandResponse; bookingId: string | null; stop: string | null }> {
    const { getClientWithTenant } = await import('@core/database/pool');
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const { unifiedAvailabilityRepository } = await import('@core/availability/unified-availability.repository');
    const { UnifiedBookingStatus } = await import('@core/availability/unified-availability.types');

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      const filled = await demandRepository.fillSlot(tenantId, demandId, client);
      if (!filled) throw new DemandError(409, 'Vaga já preenchida — a demanda fechou');

      let response: DemandResponse | null;
      if (responseIdExistente) {
        // caminho `choose`: a candidatura já existe e transita condicionalmente (anti-corrida)
        response = await demandRepository.updateResponseStatusIf(
          tenantId, responseIdExistente, ['pending'], statusResposta, client);
        if (!response) throw new DemandError(409, 'Candidatura mudou de estado — escolha outro');
      } else {
        response = await demandRepository.createResponse(
          tenantId, demandId, providerActorId, statusResposta, quoteCents, message, expiresAt,
          offeringId, assetId, client);
      }

      // ── O COMPROMISSO ────────────────────────────────────────────────────────────────────────
      let bookingId: string | null = null;
      let stop: string | null = null;
      try {
        const janela = demandWindowToInterval(filled);
        const owner: CommitmentOwner = resolveCommitmentOwner({
          offeringId, assetId, providerActorId,
          providerActorType: await this.actorTypeOf(tenantId, providerActorId, client),
        });

        // §B.1: a agenda só é tocada AQUI, no aceite — nunca no pedido nem na resposta.
        const availability = await unifiedAvailabilityRepository.create(tenantId, {
          ownerType: owner.ownerType as any,
          ownerId: owner.ownerId,
          availabilityType: 'fixed',
          startDatetime: janela.startIso as any,
          endDatetime: janela.endIso as any,
          timezone: DEMAND_COMMITMENT_TIMEZONE,
          metadata: { source: 'demand_accept', demandId, responseId: response.id, degrau: owner.degrau },
        } as any, client);

        const booking = await unifiedAvailabilityRepository.createBooking(
          tenantId,
          {
            availabilityId: availability.availabilityId,
            requesterActorId: filled.actorId, // quem PEDIU é quem reserva o tempo do fornecedor
            metadata: { source: 'demand_accept', demandId, responseId: response.id },
            bookedStartDatetime: janela.startIso as any,
            bookedEndDatetime: janela.endIso as any,
          } as any,
          { query: async (q: any) => (await client.query(q)).rows }
        );

        // chokepoint ÚNICO de confirm, na MESMA transação (client externo).
        const confirmado = await unifiedAvailabilityService.updateBooking(
          tenantId, booking.bookingId, providerActorId,
          { status: UnifiedBookingStatus.CONFIRMED }, client);
        bookingId = confirmado.bookingId;
      } catch (e: any) {
        // 🔴 STOP nomeado (vínculo sem janela / page sem agenda / tipo não decidido) NÃO derruba o
        // aceite comercial: ele registra por que a agenda não foi tocada. Qualquer OUTRO erro
        // derruba a transação inteira — inclusive o conflito de agenda, que é o ponto da §D7.
        if (e instanceof DemandCommitmentError && (e.statusCode === 501 || e.code === 'DEMAND_COMMITMENT_PAGE_HAS_NO_AGENDA')) {
          stop = e.code;
        } else {
          throw e;
        }
      }

      await client.query('COMMIT');
      return { demand: filled, response, bookingId, stop };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* tx pode já não estar ativa */ }
      throw e;
    } finally {
      client.release();
    }
  }

  /** Tipo do actor, lido do schema vivo DENTRO da transação — nunca do body (0113/G9). */
  private async actorTypeOf(tenantId: string, actorId: string, client: any): Promise<string> {
    const r = await client.query(
      `SELECT actor_type FROM actors WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [actorId, tenantId]);
    const t = r.rows[0]?.actor_type;
    if (!t) throw new DemandError(404, 'Actor respondente não encontrado neste tenant');
    return String(t);
  }

  /** ESPELHO NO FEED (item 1 do fechamento): a demanda gera um post-projeção com a MESMA
   *  plateia. Falha do espelho NUNCA derruba a demanda (verdade = motor; feed = projeção).
   *
   * 🔴 DIRIGIDA NÃO ESPELHA (F4-b, 2026-08-06). Defeito que EU introduzi na F4 e que só apareceu
   * ao ler o caminho inteiro: a demanda dirigida nascia com `visibility='public'` (porque quem
   * estreita a plateia é o `target_actor_id`, no servidor) e o espelho a publicava NO FEED, com o
   * texto "🎯 Oportunidade". Ou seja: um pedido ENDEREÇADO a uma pessoa aparecia para todo mundo —
   * o oposto exato do que a F4 provou nos dois readers. A plateia estreitava no motor e vazava na
   * projeção. *Espelho tem de espelhar a plateia, não a coluna `visibility`.* */
  private async mirrorToFeed(tenantId: string, userId: string, demand: ServiceDemand): Promise<void> {
    if (demand.targetActorId) return; // dirigida: não há "oportunidade" pública a anunciar
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

  /**
   * O NÚCLEO de criar UMA demanda — usado pelo item único e por cada linha do lote, para que lote
   * NÃO seja atalho de regra. `client` opcional: no lote, todas as linhas na MESMA transação.
   */
  private async criarUm(
    tenantId: string,
    actorId: string,
    input: CreateDemandInput,
    client?: import('pg').PoolClient,
    eventIdParaAmarrar?: string | null,
    naoAmarrados?: string[]
  ): Promise<ServiceDemand> {
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

    // 🔴 DECISION-0196 §H — a chave evento↔demanda. FK ANULÁVEL: nulo = demanda avulsa, o caso de
    // 100% do dado hoje; nada regride. A COERÊNCIA DE TENANT é imposta AQUI porque o banco não
    // consegue: `event_operational_needs` não tem `tenant_id` (ele mora um salto adiante, em
    // `events`) e não tem RLS, enquanto `service_demands` tem os dois. Sem esta trava, uma demanda
    // do tenant A apontaria para need de evento do tenant B — duas respostas para "de quem é isto".
    // DECISION-0146 §A.6: "onde FK condicional não couber, guard/writer fail-closed". Guard:
    // audit-demand-need-tenant-coherence.
    let needId: string | null = null;
    if (input.needId !== undefined && input.needId !== null && String(input.needId).trim() !== '') {
      const eventId = await demandRepository.findNeedEventIdInTenant(tenantId, String(input.needId));
      if (!eventId) {
        throw new DemandError(400,
          'DEMAND_NEED_NOT_IN_TENANT: a necessidade referenciada não existe neste tenant. ' +
          'A demanda só se liga a necessidade de evento do PRÓPRIO tenant (DECISION-0196 §H · 0146 §A.6).');
      }
      needId = String(input.needId);
    }

    // 🔴 F4 / DECISION-0196 §G.1 — PEDIDO DIRIGIDO. O botão "Solicitar orçamento" da ActorPage abre
    // uma demanda COM alvo; nulo = broadcast (§C/D4: MESMA entidade, nunca uma segunda).
    // O alvo é validado contra o schema vivo NO TENANT — nunca aceito cru do body (0113).
    let targetActorId: string | null = null;
    if (input.targetActorId !== undefined && input.targetActorId !== null && String(input.targetActorId).trim() !== '') {
      const alvo = String(input.targetActorId);
      if (alvo === actorId) {
        throw new DemandError(400, 'DEMAND_TARGET_IS_SELF: não se pede orçamento a si mesmo.');
      }
      const existe = await demandRepository.actorExistsInTenant(tenantId, alvo);
      if (!existe) {
        throw new DemandError(400,
          'DEMAND_TARGET_NOT_IN_TENANT: o destinatário do pedido não existe neste tenant.');
      }
      targetActorId = alvo;
    }

    // 🔗 F4-b — AMARRAÇÃO AO EVENTO por NECESSIDADE (o elo FORTE da §H). Só o lote passa `eventId`;
    // o caminho de item único segue exatamente como estava. A necessidade só nasce se o concept
    // estiver no TEMPLATE do formato (regra de `eventOperationalNeedsService.add`) — fora dele, o
    // item é criado SEM amarração e volta NOMEADO em `naoAmarrados`. Silenciar aqui seria a tela
    // dizendo "amarrei" sobre o que não amarrou.
    if (!needId && eventIdParaAmarrar) {
      const { eventOperationalNeedsService } = await import('@core/events/event-operational-needs.service');
      const need = await eventOperationalNeedsService.add(tenantId, eventIdParaAmarrar, concept.concept_id);
      if (need) {
        const resolvido = await demandRepository.findNeedIdByEventAndConcept(tenantId, eventIdParaAmarrar, concept.concept_id);
        if (resolvido) needId = resolvido;
      }
      if (!needId) naoAmarrados?.push(input.title?.trim() || concept.concept_id);
    }

    const quantity = input.quantity && input.quantity > 0 ? Math.floor(input.quantity) : 1;
    const demand = await demandRepository.create(tenantId, actorId, {
      needId, targetActorId,
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
    }, client);
    return demand;
  }

  /** Porta pública do item ÚNICO — comportamento idêntico ao de sempre (pool, espelho no feed). */
  async create(tenantId: string, actorId: string, input: CreateDemandInput, userId?: string): Promise<ServiceDemand> {
    const demand = await this.criarUm(tenantId, actorId, input);
    if (userId) await this.mirrorToFeed(tenantId, userId, demand);
    return demand;
  }

  /**
   * 🔴 F4-b · PEDIDO COM VÁRIOS ITENS (GO Clayton 2026-08-06).
   *
   * *"se eu for ficar pedindo item por item pode complicar"* — mas **item por item é o desenho
   * CERTO no banco**, e o próprio Clayton provou por quê: *"o cara orça a segurança de um jeito e a
   * limpeza de outro, e outra empresa é mais barata na segurança e mais cara na limpeza"*. Se os N
   * itens virassem UM objeto ("orçamento nº 47"), o fornecedor responderia UM preço para o conjunto
   * e a comparação por item MORRERIA — só daria para aceitar ou recusar tudo.
   * ⇒ **Multi-item é conveniência de TELA, nunca entidade.** Aqui nascem N demandas, cada uma com a
   *   SUA configuração (data/quantidade/horário — colunas que já existiam), cada uma comparável e
   *   aceitável sozinha. Zero tabela nova, zero coluna nova.
   *
   * ⚛️ **ATÔMICO**, pela mesma razão da F2: 3 itens entram os 3 ou nenhum. Meio pedido é pior que
   * pedido nenhum — o fornecedor veria uma lista que o cliente não escreveu.
   *
   * 🔗 **AMARRAÇÃO (opcional):** com `eventId`, cada item vira uma NECESSIDADE daquele evento
   * (`event_operational_needs`) e a demanda aponta para ela por FK — o elo FORTE da `§H`, não
   * `metadata`. Sem `eventId`, os N saem como pedidos dirigidos independentes.
   * ⚠️ **NÃO invento "ocasião" para o caso sem evento.** Clayton decidiu que *obra ≠ evento* e que a
   * ideia de "coisa que tem necessidades" ganhará casa PRÓPRIA, separada de eventos. Criar hoje um
   * agrupamento — seja `events` draft, seja tabela nova — seria erguer a casa errada para a frente
   * dele derrubar depois. Fica declarado, não disfarçado.
   *
   * ⚠️ A necessidade só nasce se o concept estiver no TEMPLATE do formato do evento
   * (`event-operational-needs.service.ts:47-63` — seleção das sugestões, não catálogo livre). Fora
   * do template, a demanda é criada **sem** `need_id` e o item volta marcado — nunca em silêncio.
   */
  async createBatch(
    tenantId: string,
    actorId: string,
    input: { targetActorId?: string | null; eventId?: string | null; items: CreateDemandInput[] },
    userId?: string
  ): Promise<{ demands: ServiceDemand[]; naoAmarrados: string[] }> {
    const itens = Array.isArray(input?.items) ? input.items : [];
    if (itens.length === 0) throw new DemandError(400, 'Nenhum item no pedido');
    if (itens.length > 20) throw new DemandError(400, 'DEMAND_BATCH_TOO_LARGE: no máximo 20 itens por pedido');

    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);
    const criadas: ServiceDemand[] = [];
    const naoAmarrados: string[] = [];
    try {
      await client.query('BEGIN');
      for (const item of itens) {
        // Cada item passa pela MESMA porta de um pedido único — validação, alvo e vocabulário
        // governado idênticos. Lote não é atalho de regra: é atalho de clique.
        const d = await this.criarUm(tenantId, actorId, {
          ...item,
          targetActorId: input.targetActorId ?? item.targetActorId ?? null,
        }, client, input.eventId ?? null, naoAmarrados);
        criadas.push(d);
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* tx pode já não estar ativa */ }
      throw e;
    } finally {
      client.release();
    }
    // Espelho no feed só para o que NÃO é dirigido (ver mirrorToFeed) e fora da transação.
    if (userId) for (const d of criadas) await this.mirrorToFeed(tenantId, userId, d);
    return { demands: criadas, naoAmarrados };
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
    input: { quoteCents?: number; message?: string; offeringId?: string; assetId?: string }
  ): Promise<{ demand: ServiceDemand; response: DemandResponse }> {
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

    // 🔴 DECISION-0196 §B.2/§B.4 — a resposta declara O QUE está sendo ofertado.
    // O BANCO garante EXCLUSIVIDADE (chk_sd_responses_offer_ref_exclusive); a OBRIGATORIEDADE por
    // pricing_mode é AQUI, porque CHECK não atravessa tabelas (pricing_mode mora na demanda).
    // Declarado na migration para ninguém supor que o banco cobre o que ele não cobre.
    const offeringId = input?.offeringId ?? null;
    const assetId = input?.assetId ?? null;
    if (offeringId && assetId) {
      throw new DemandError(400, 'Informe a oferta OU o ativo, nunca os dois (DECISION-0196 §B.2)');
    }
    // 🔴 §B.4 EMENDADA (2026-08-06) — a FK é OPCIONAL, sempre. A versão anterior exigia
    // offering/asset em `pricing_mode='orcamento'`, e a medição a derrubou: NENHUM dos 12 actors
    // `user` tem oferta cadastrada, então a exigência expulsaria 11 de 12 — a persona central do
    // produto (pessoa física respondendo com preço), não gordura.
    // O dono da agenda deixa de ser exigido AQUI e passa a resolver em CASCATA no ACEITE:
    //   FK presente → offering/asset · FK ausente + `user` → o próprio actor (§D.1, 0146 V1)
    //   · FK ausente + `page` → recusa honesta (R1: a empresa AGREGA, não é recurso).
    // A EXCLUSIVIDADE (offering XOR asset) permanece — acima, e no CHECK do banco.

    // §C/D1 — validade injetada NA ESCRITA, nunca por default de banco.
    const expiresAt = new Date(Date.now() + DEMAND_QUOTE_DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    // Selo de agenda (TEMPO consistente): compromisso não colide com compromisso
    if (await demandRepository.hasScheduleConflict(tenantId, providerActorId, demand)) {
      throw new DemandError(409, 'Agenda em conflito: você já tem um compromisso aceito nessa janela');
    }

    if (demand.acceptanceMode === 'automatico') {
      // 🔴 F2 — ACEITE ATÔMICO (§D7). Antes: saga (fillSlot → createResponse → catch releaseSlot).
      // Agora: UMA transação que também cria availability + booking + confirm. O `releaseSlot` de
      // compensação SAIU: o ROLLBACK desfaz a vaga sozinho, e compensação à mão era o que a §D7
      // mandou eliminar.
      try {
        const r = await this.aceitarComCompromisso(
          tenantId, demandId, providerActorId, input?.quoteCents ?? null, input?.message ?? null,
          expiresAt, offeringId, assetId, 'accepted', null);
        return { demand: r.demand, response: r.response };
      } catch (err: any) {
        if (String(err?.message ?? '').includes('uq_sd_responses_demand_provider')) {
          throw new DemandError(409, 'Você já respondeu a esta demanda');
        }
        throw err;
      }
    }

    try {
      const response = await demandRepository.createResponse(
        tenantId, demandId, providerActorId, 'pending', input?.quoteCents ?? null, input?.message ?? null, expiresAt, offeringId, assetId);
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

    // 🔴 DECISION-0196 §C/D1+D2 — A IMPOSIÇÃO da expiração preguiçosa. Derivar na leitura sem impor
    // AQUI deixaria a tela honesta e o motor permissivo: alguém escolheria por uma aba velha e o
    // compromisso nasceria de um preço que já não vale. Vencido MORRE (não renova): o fornecedor
    // responde de novo. LEITOR ÚNICO — a comparação mora em `quote-validity`, nunca aqui.
    assertQuoteUsable(response.expiresAt);
    // Selo de agenda também na ESCOLHA: o candidato pode ter fechado outra janela entretanto
    if (await demandRepository.hasScheduleConflict(tenantId, response.providerActorId, demand)) {
      throw new DemandError(409, 'Agenda do candidato entrou em conflito nessa janela — escolha outro');
    }

    // 🔴 F2 — O SEGUNDO VERBO DE ACEITE, e ele NÃO podia ficar de fora. A §B.4 condena "duas
    // espécies de aceito" como segunda verdade sobre o que aceitar SIGNIFICA: se só o `respond`
    // automático tocasse a agenda, metade dos compromissos nasceria sem ela. Mesma transação, mesma
    // cascata, mesmo confirm. A transição CONDICIONAL (fix Yala #4) sobrevive DENTRO da transação —
    // e o `releaseSlot` de compensação sai, porque agora existe ROLLBACK de verdade.
    const r = await this.aceitarComCompromisso(
      tenantId, demandId, response.providerActorId, response.quoteCents, response.message,
      new Date(response.expiresAt), response.offeringId, response.assetId, 'chosen', responseId);
    return { demand: r.demand, response: r.response };
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

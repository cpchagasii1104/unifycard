# MOTOR DE EVENTOS — MAPA DE ACOPLAMENTO (2026-07-22)

> Síntese da direção a partir de 6 descobertas read-only (prontidão: taxonomia, artistas, local/setores,
> wiring; orquestração: needs/RFQ/demanda/staff/rentals/split; tempo: SSOT temporal/availability/booking).
> Tese de produto em memória: [motor único Actor-projetado] + [economia margem→fundo regional].
> **Lei deste trabalho: ACOPLAR pela arquitetura promulgada, nunca greenfield.** Guia: `GUIA_MESTRE_ACOPLAMENTO_CRM_ERP_PDV.md` §8.

## TESE
O motor de eventos é UM SÓ; o que diverge é QUEM cria (Actor) e a escala/modo (context-projection). Ele
**orquestra tudo** — descoberta → agenda (tempo SSOT) → contratação → local/setores → ingresso — muito maior
que Eventim/diskingressos, e com a economia revertendo à comunidade. **~70% do substrato já está construído;
o trabalho é ELOS (acoplamentos), não tijolos.** Dinheiro fica fail-closed até a porta-01.

## AS 5 CAMADAS (o que já existe)
1. **Identidade/taxonomia (o que o evento É):** concept-first VIVO — formato=concept N0, tema=pool canônico,
   categoria=facet governado, FK real a `concepts`, 23 formatos seedados. Criação Actor-soberana viva
   (bifurcada: v2 concept-first + enum legado a aposentar). Casamento/aniversário JÁ criáveis por aqui.
2. **Orquestração (o que o evento PRECISA):** `event_operational_needs` VIVO (declara necessidades por
   formato, organizer-gated) → `event_rfq` VIVO (cotação/dispatch/matching/from-spec; `acceptQuote` CONTIDO
   R7b) → `event_staff`/assignStaff VIVO (vincula contratado, Bank-free) → split declarativo (cachê) existe
   mas persiste in-memory. Motor de demanda 0164 VIVO (matching concept∩tempo∩quantidade) mas sem elo `event_id`.
3. **Tempo (QUANDO):** SSOT temporal DECISION-0156 (CLOSED). `core/availability/` unificado — janelas
   fixed/recurring/on_demand, template semanal declarativo→janelas, booking + estados, locks anti-double-book
   (provider-lock + resource-lock), EXCLUDE gist overlap, subperíodo. **8 owner_types (USER/PAGE/SERVICE/
   SERVICE_OFFERING/EVENT/GROUP/RENTABLE_RESOURCE/ACTOR_ASSET).** Mesmo substrato p/ serviço/salão/locação/evento.
4. **Descoberta (achar fornecedor):** marketplace-canonical-search + canonical-item-search + professional-c1
   VIVOS. Via DEMANDA já casa fornecedor por perfil C1. Locações P2P (chácara = `space`) VIVAS (CRUD+nearby+book).
5. **Dinheiro (porta-01, DEFERIDO):** checkout firewall fail-closed default-OFF; split→fundo regional (0179/4E);
   economic/v2 501. Nada se move até GO institucional + PORTA.

## A ESPINHA REUSÁVEL (o atalho que destrava tudo)
Modelar **toda oferta contratável (artista/banda/local/equipe) como `service_offering`** — aí o discovery com
**filtro de agenda futura** (`services.service.ts:481-499`) e o **booking com provider-lock** JÁ funcionam
ponta-a-ponta. Uma banda = Actor página + service_offering (a "apresentação") com agenda (availability) +
atributo de gênero → descoberta → reserva para a data. "Contratar banda na data" reusa "contratar chácara na data".

## ELOS A CONSTRUIR (Bank-free) — agrupados
**Fundação:** convergir os 2 stacks de evento (bilheteria sprint76 se dobra no `core/events` governado; ingresso/
check-in passam a operar sobre o evento com taxonomia+localização+orquestração).

**Orquestração:** `event_operational_needs` → disparo de demanda/RFQ (hoje declara mas "não dispara", fronteira
intencional a levantar) · unificar as 2 vias de matching (demanda-C1 × RFQ-services.category) sob o canônico +
faceta de gênero · persistir RFQ (metadata→tabela) e split (in-memory→tabela) · elo evento→locação (chácara via
rentable-resource; aguarda RFC F-RENTAL-ESPACOS-E-EVENTOS).

**Tempo/agenda:** oferta contratável de artista/local como service_offering (ganha discovery+agenda+booking de
graça) · expor "livre no dia X" público do artista (hoje agenda de página é privada owner-scoped) · descoberta
por GÊNERO ligada à checagem de agenda · **booking do EVENTO contra a agenda do fornecedor/local** (hoje evento↔
agenda é read-only informacional; coordenação transacional das 3 agendas artista×local×evento está em HOLD 0156).

**Identidade/taxonomia:** taxonomia de tipos de ingresso (setor/lote/meia/cortesia) · venue reutilizável +
setores + capacidade + quantidade-ligada-à-capacidade · qualificar Actor como performer com atributos (gênero/
modalidade) + verticais (lutador/esportista/DJ) · estabelecimento como modo de Actor · aposentar legado.

**Frontend:** painel do organizador de tipos de ingresso (backend pronto) · UI de contratação (achar por gênero
→ ver agenda → contratar) · ligar botão de compra no /events/:id · convergir paradigmas de UI.

## HOLDS DELIBERADOS (decisões de levantar, não bugs)
- `acceptQuote` CONTIDO (R7b) — aguarda fluxo de confirmação do provider.
- Booking evento→fornecedor em HOLD (DECISION-0156 §HOLD "2º provider material · worker").
- Evento→locação aguarda RFC F-RENTAL-ESPACOS-E-EVENTOS.
Levantá-los é decisão soberana + desenho de confirmação, não só acoplamento.

## ROADMAP EM FATIAS BANK-FREE (até a porta-01) — proposta a validar
- **S0 — Motor único (fundação):** bilheteria dobra no core/events governado; ingresso/check-in sobre o evento
  com taxonomia+localização. Sem isso o resto bifurca.
- **S1 — Oferta contratável = service_offering:** artista/banda/local/equipe como oferta com agenda + atributo
  (gênero/modalidade); reusa discovery+availability+booking. Verticais de performer.
- **S2 — Contratação orquestrada:** `event_operational_needs` → dispara descoberta/RFQ pela via canônica
  unificada; persiste RFQ+split; vincula via event_staff. (accept e booking evento→fornecedor: decisão de HOLD.)
- **S3 — Agenda coordenada:** "livre no dia X" público do artista/local; booking do evento reserva a agenda do
  fornecedor/local (levanta HOLD 0156 com confirmação). Coordenação transacional das 3 agendas.
- **S4 — Local + setores + ingresso:** venue reutilizável, setores, capacidade, tipos de ingresso governados
  ligados a setor/capacidade.
- **S5 — Vaquinha (substrato):** limiar mínimo, contagem, estado "aguardando viabilização" (Bank-free; escrow é porta-01).
- **S6 — Frontend:** painel de ingressos, UI de contratação (gênero→agenda→contratar), ligar compra, convergir UI.
- **PORTA-01 (depois):** abrir firewall; cobrança; comissão→fundo regional/indicação/grupo; escrow/devolução da
  vaquinha; cachê dos contratados; settlement.
Ordem a validar; S0 é pré-requisito; S1 destrava S2/S3 (espinha service_offering).

## DECISÕES SOBERANAS (Clayton) — isoladas, não inventar
Modelo de emissão (agregado vs individual+QR) · regra da vaquinha (limiar/prazo/devolução) · comissão (%/estrutura
→ mapear em split→fundo regional/indicação/grupo) · canais de venda (artista vende na própria página → múltiplos
vendedores por evento) · "estabelecimento" como projeção de Actor · levantar os 3 HOLDs (acceptQuote, booking
evento→fornecedor, evento→locação) · abertura do firewall (PORTA institucional).

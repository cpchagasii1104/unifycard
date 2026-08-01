# PLANO DE CONCLUSÃO DO MOTOR DE EVENTOS — UNIFICARD (2026-07-22)

> Plano canônico para fechar TODO o motor de eventos. Baseado em `EVENT_ENGINE_COUPLING_MAP.md` (6 descobertas
> read-only) + visões em memória (motor único Actor-projetado; economia margem→fundo regional). Cada FATIA =
> envelope próprio GATE(se preciso)→GO→material→Yala→selo. Ordem soberana; Clayton pode reordenar.

## DEFINIÇÃO DE "PRONTO"
Um motor de eventos ÚNICO onde QUALQUER Actor (pessoa física, estabelecimento, artista/banda, agência) cria um
evento pelo mesmo caminho (guided flow), com o modo PROJETADO pelo Actor; declara o que precisa (banda, som,
segurança, local/chácara); ACHA e CONTRATA fornecedores/artistas pelo próprio sistema, checando a AGENDA deles
(SSOT temporal); monta local/setores/ingressos; opcionalmente usa vaquinha (limiar mínimo); e — na porta-01 —
vende ingresso, paga cachê, e a comissão do sistema RETORNA à comunidade (fundo regional/indicação/grupo).
Maior que Eventim/diskingressos, com Actors e economia autogerida.

## INVARIANTES (valem para TODA fatia — não-negociáveis)
1. **Coerência sistêmica:** §2 (sistema único, sem realidade paralela) · §3.2 (cada pilar→sua SSOT) · §4.8
   (writer único/âncora; actors só via actor-writer) · §4.9.5 (validação ANTES de mutação) · §4.9.8 (autoridade
   pela fachada; usos diretos-core = transição documentada).
2. **A verdade vive no BACKEND.** Toda garantia é de backend e provada por API/serviço DIRETO — nunca "o
   frontend não chama mais".
3. **Bank-free até a porta-01.** Nada move dinheiro até o GO institucional + PORTA. Substrato de dinheiro pode
   ser desenhado antes; o MOVIMENTO fica fail-closed.
4. **Acoplar, não greenfield.** Reusar o ~70% já construído; substrato novo só com justificativa.
5. **Uma frente material por vez.** GATE→GO→material→Yala→selo. Map-first + stop-if-surprised.
6. **Actor projeta o modo.** Modo (pessoa/estabelecimento/artista/agência) vem de capability/context-projection,
   não de flag solta nem actor_type novo.

## ESTADO ATUAL (selado)
- ✅ F1 — catálogo de tipo de ingresso governado (`event_tickets`, autoridade de evento).
- ✅ Contenção das rotas mortas sprint76 (cancel/checkin/checkout → 501).
- ✅ F0-grupo — vínculo governado evento↔grupo no writer format-first (autoridade antes da escrita, atômico).

---

## FASE A — FUNDAÇÃO (writer único / verdade única) · Bank-free
### A1 · F0-WRITER-ÚNICO  [PRÓXIMA]
- **Objetivo:** um só writer de evento (format-first governado). Eliminar a realidade paralela (§2/§4.8).
- **Escopo:** conter no BACKEND os 3 caminhos legados de `INSERT INTO events` — W1 rota `/` (eventType, órfã),
  W2 (`/api/events/create`, GrupoDetailPage), W3 (sprint76 `/events`, órfã) → 501/redirect ANTES do INSERT,
  provado por API DIRETA. Rotear a UI legada (GrupoDetailPage etc.) ao guided flow (que já aceita contexto de
  grupo — F0-grupo). Guard "nenhum INSERT INTO events fora de core/events/event.service".
- **Fecha:** `DT-GROUP-EVENTS-BINDING-DRIFT` (W2 morto contido). **Prova:** E2E API-direta (legado→501, avulso+
  grupo pelo governado). **Deps:** F0-grupo (feito). **Decisão soberana:** nenhuma.

---

## FASE B — ACENDER O GUIDED FLOW (cada passo → substrato) · Bank-free
### B1 · STEP 3 — TEMPO (agenda do evento)
- **Objetivo:** a data/janelas do evento vivem no SSOT temporal (Unified Availability), não em campo solto.
- **Acopla:** `core/availability` (janelas, template semanal, owner_type='event'). **Autoridade:** dono do
  evento. **Prova:** E2E cria janela do evento no SSOT. **Deps:** A1. **Decisão:** nenhuma.

### B2 · STEP 4 — LOCAL + VENUE + SETORES + CAPACIDADE
- **Objetivo:** local rico via Location Core (rua/número, coord real, não centróide); venue REUTILIZÁVEL (1
  espaço→N eventos); setores (pista/camarote/…); capacidade por setor.
- **Acopla:** Location Core (`address_assignments` owner_type='event'). **Substrato novo (justificado):** entidade
  `venue` + `event_sectors` (schema novo — DB virgem). **Autoridade:** dono do evento / dono do venue.
- **Prova:** E2E. **Deps:** A1. **Decisão soberana:** venue/setores como entidade — MVP mínimo vs completo.

### B3 · INGRESSO RICO (taxonomia de tipo)
- **Objetivo:** tipos de ingresso (setor/lote/meia/cortesia) como vocabulário GOVERNADO (CHECK, não enum novo,
  §4.9.7); quantidade ligada à capacidade do setor (Σ ≤ capacidade).
- **Acopla:** catálogo F1 (`event_tickets`) + B2 (setores/capacidade). **Prova:** E2E cria tipo por setor;
  rejeita Σ>capacidade. **Deps:** B2. **Decisão soberana:** modelo de emissão (agregado vs QR-individual) —
  molda o schema (barato agora, DB virgem).

---

## FASE C — CONTRATAÇÃO E PERFORMERS (o coração da visão) · Bank-free
### C1 · PERFORMERS (qualificar Actor + oferta contratável)
- **Objetivo:** representar artista/banda/lutador/esportista/DJ/apresentador como Actor qualificado (atributos:
  gênero/modalidade); a oferta contratável do performer = `service_offering` (ganha discovery+agenda+booking de graça).
- **Acopla:** Actor soberano + professional-c1 + service_offering + shared_subject_concepts (gênero). **Substrato
  novo (justificado):** atributos de performer (converger o subsistema cultural PAC para C1+services — NÃO reviver
  a tabela-fantasma cultural_profiles). **Prova:** E2E. **Deps:** A1. **Decisão soberana:** verticais a cobrir no MVP.

### C2 · EVENT_ACTORS (line-up / elenco / equipe / local declarativo)
- **Objetivo:** materializar o vínculo governado Actor↔evento com papel (artist/venue/staff/sponsor) e
  `revenueShareBps` DECLARADO (Bank-free). O TIPO `EventActorRole` já existe; falta a tabela+writer+autoridade.
- **Acopla:** o tipo existente + `event_staff`/operational-commitments (corrigir o assignStaff só-usuário → actor-first).
  **Autoridade:** `manage_events` sobre o dono + `canRepresentActor` do contratado (fachada §4.9.8). **Prova:** E2E
  API-direta. **Deps:** A1. **Decisão soberana:** multi-vendedor (artista vende na própria página → vários vendedores/fatias).

### C3 · CONTRATAÇÃO ORQUESTRADA (needs → descoberta → RFQ → bind)
- **Objetivo:** o evento declara necessidade (banda/som/segurança) → ACHA fornecedor pela via canônica + faceta de
  gênero → cotação (RFQ) → VINCULA (event_actors). Persistir RFQ (metadata→tabela) e split declarativo (in-memory→tabela).
- **Acopla:** `event_operational_needs` (vivo, **6 linhas**) + RFQ (⚠️ **NÃO É TABELA** — vive em
  `events.metadata.rfqs`, JSON; `event-rfq.service.ts:33` confirma. Este plano dizia "`event_rfq` (vivo)"
  como se fosse tabela: **corrigido 2026-08-01**, `\dt *rfq*` → nenhuma relação. Persistir RFQ em tabela
  continua sendo o trabalho desta fase, não um fato já entregue) + marketplace-canonical-search + professional-c1
  (unificar as 2 vias de matching) + C2 (event_actors). **HOLD:** `acceptQuote` contido (R7b) — levantar exige
  fluxo de confirmação do provider (decisão soberana). **Prova:** E2E. **Deps:** C1, C2. **Decisão soberana:** levantar HOLD acceptQuote.

### C4 · AGENDA COORDENADA (o fluxo "achar banda → checar agenda → contratar na data")
- **Objetivo:** expor "livre no dia X" público do artista/local; BOOKING do evento contra a agenda do fornecedor/
  local (coordenar as 3 agendas: artista × local × evento). Reservar chácara (evento→locação).
- **Acopla:** Unified Availability + booking/provider-lock (maduro) + rentals P2P. **HOLD:** booking evento→
  fornecedor (DECISION-0156 §HOLD) + evento→locação (RFC F-RENTAL-ESPACOS-E-EVENTOS). **Prova:** E2E conflito/reserva.
  **Deps:** C3, B1. **Decisão soberana:** levantar HOLDs 0156 + RFC locação; confirmação do provider.

---

## FASE D — VAQUINHA (substrato Bank-free) · Bank-free
### D1 · VAQUINHA — ESTADO DE VIABILIZAÇÃO
- **Objetivo:** limiar mínimo de participantes; contagem de COMPROMISSOS (intenção, Bank-free); máquina de estado
  "aguardando viabilização"/"viável"/"inviável". Retenção/escrow/DEVOLUÇÃO do dinheiro = porta-01 (não aqui).
- **Acopla:** `events.min_attendees` + substrato de estado novo (justificado). **Prova:** E2E de estado. **Deps:**
  B3. **Decisão soberana:** regra do limiar, prazo, política de devolução.

---

## FASE E — FRONTEND RICO (F6) · Bank-free
### E1 · UX DE CADA PASSO
- Painel do organizador de tipos de ingresso; UI de contratação (achar por gênero → ver agenda → contratar);
  UI de venue/setores; UI de vaquinha. **Deps:** as fatias de backend correspondentes. Frontend só PROJETA a
  verdade resolvida no backend.
### E2 · CONVERGIR PARADIGMAS DE UI
- Unificar "cultural events" (feed) e "events-v2" (/events/:id) num só. **Decisão soberana:** produto.

---

## FASE F — MODOS POR ACTOR (persona) · Bank-free (atravessa)
### F1 · ESTABELECIMENTO + MODOS
- **Objetivo:** "estabelecimento" (bar/casa noturna/restaurante/sinuca/quadra) como MODO de Actor = page +
  company VERIFIED + capability (tríade 0189), NÃO actor_type novo. Modos pessoa/artista/agência projetados por capability.
- **Acopla:** capability/context-projection existentes. **Decisão soberana:** promulgar capability tipo
  `can_host_events` no vocabulário governado. **Deps:** A1.

---

## FASE G — PORTA-01 (DINHEIRO) · NÃO Bank-free · institucional
- **G0 · RATIFICAÇÕES SOBERANAS (pré-requisito):** emissão (QR×agregado) · estrutura da comissão (%→fundo
  regional/indicação/grupo) · regra da vaquinha · multi-vendedor · abertura do firewall (PORTA).
- **G1 · ABRIR FIREWALL** (checkout-financial-firewall) por GO institucional + PORTA (DECISION-0190/POLITICA_ATIVACAO).
- **G2 · COMPRA:** checkout → `ticket_sales` bank-wired; split→fundo regional/indicação/grupo (reusa
  event-split-declarative + fundo 0179/4E). **G3 · VAQUINHA:** escrow/retenção + devolução se inviável.
- **G4 · CACHÊ:** pagamento dos contratados (artistas/equipe). **G5 · SETTLEMENT + REEMBOLSO.**
- Materializar os ghosts de dinheiro (event_settlements/custody/authorization) SÓ aqui.

---

## HARDENING (paralelo, baixa prioridade — DTs registradas)
- `DT-AUTHORITY-FACADE-NO-TRANSACTIONAL-REPRESENT` — fachada expor canRepresentActor transaction-aware; convergir usos diretos.
- `DT-GROUP-ACTOR-NOT-EAGERLY-CREATED` — createGroup materializar o group-actor eager (+ backfill).
- Aposentar de vez os stacks/telas legados após o writer único.

## SEQUÊNCIA RECOMENDADA + MARCOS
A1 → **[MARCO: writer único, verdade única]** → C1+C2 (performers + line-up) → C3 (contratação) → B1/B2/B3
(tempo/local/setores/ingresso) → C4 (agenda coordenada, levanta HOLDs) → D1 (vaquinha) → E (frontend) → F1
(modos) → **[MARCO: diskingressos completo, navegável a SECO]** → G (porta-01, dinheiro) → **[MARCO: venda viva]**.
Racional: A1 fecha a fundação; C1-C3 são o coração da visão (achar/contratar banda) e destravam o valor; o resto
enriquece; a porta-01 é a última fronteira e depende das ratificações soberanas (G0).

# DECISION-0146 — Integridade temporal da oferta e conflito de booking por provider (F-OFFER-5 + F-OFFER-6)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL / INTEGRIDADE TEMPORAL DA OFERTA E CONFLITO DE BOOKING POR PROVIDER** (Clayton 2026-06-21; ChatGPT APPROVED_WITH_GUARDS — guards adicionais G8–G12 incorporados).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/frontend/backend. Precede a execução material (F-OFFER-5A/6A), que só roda após READ-FIRST de execução + GO próprio (**MODO C provável** — toca `createBooking`+concorrência; **promulgação condicional NÃO autorizada**).

**Data:** 2026-06-21 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `bca473fa`
· **Tipo:** arquitetural / régua de integridade temporal (docs-only) · **Frente:** F-OFFER (F-OFFER-5 + F-OFFER-6 fundidos no nível decisório)
· **Responsável:** Clayton (decisão soberana) / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
· **READ-FIRST (2 elos):** IA-TEMPO **PARTIAL** (substrato suporta a oferta; faltam garantias temporais) · IA-BANCO **PASS_PARA_DECISAO** (substrato único, virgem: `service_offering`=0/`service`=0/`user`=48; sem overlap-guard/FK/rollup — tudo grátis na janela virgem).

**Deriva de / subordinada a:** **Constituição temporal Art. II** (conflito = FATO→ALERTA→humano; proibido auto-resolver) · **DECISION-0117 D** (`availability.owner_type` polimórfico de 6 tipos; `service_offering`→`provider_actor_id`) · DECISION-0132 (gate de propósito protegido no booking; `purpose_concept_id`) · DECISION-0143/0144/0145 (cadeia CONCEPT→SERVICE→SERVICE_OFFERING) · DECISION-0113 (actorId=hint; autoridade server-side).

---

## §0 — Natureza e contexto
A cadeia de oferta (declaração→service→offering→discovery) está viva. Falta **a oferta ganhar TEMPO confiável**. O READ-FIRST provou: `owner_type='service_offering'` **já é suportado** (enum+policy+CHECK 6 tipos fail-closed), o writer é gated (`canRepresentActor`), o booking lê por id — **mas NÃO existe nenhuma garantia temporal**: trigger de overlap é **fantasma** (comentários afirmam, nenhuma migration cria), `detect_availability_conflicts` é **STUB** (`RETURN;`) chamado só p/ `owner_type='user'`, `owner_id` é **polimórfico sem FK**, e **nenhuma estrutura agrega o tempo das ofertas de um mesmo provider**. Em agenda pessoal isso é tolerável (alerta); em **oferta contratável é falha econômica** (vender o mesmo recurso 2×). Substrato **virgem** (0 linhas de oferta-tempo) ⇒ endereçar é **grátis agora**, caro depois.

## §A — A RÉGUA (decisão soberana de Clayton, 2026-06-21)

**Eixo central — distinguir DECLARAÇÃO de COMPROMISSO:**

1. **`availability` = DECLARAÇÃO temporal.** Overlap em availability **NÃO bloqueia**. Conflito é **FATO/ALERTA→humano**: o sistema pode detectar, exibir, registrar e orientar; **NÃO** auto-resolve, **NÃO** hard-blocka a declaração. (Preserva Art. II — vale p/ **todos** os owners, inclusive `service_offering`.) Janelas sobrepostas declaradas podem ser intenção/disponibilidade ampla/preferência/erro humano — decisão é do humano.

2. **`booking` confirmado = COMPROMISSO econômico/operacional.** Criar um **2º booking em estado de compromisso real** sobre o **mesmo `provider_actor_id`** com **intervalo sobreposto** **FALHA de forma controlada** (fail-closed). Isto **NÃO é auto-resolver conflito** — é **recusar compromisso impossível sobre slot já vendido** (integridade econômica). Erro controlado, ex.: `BOOKING_PROVIDER_TIME_CONFLICT` (ou código do padrão vivo); **nunca 500 genérico**.

3. **Recurso de conflito (rollup) = `provider_actor_id`, NÃO `service_offering` isolada.** O conflito **agrega as ofertas do mesmo provider**. Ex.: fotógrafo X tem oferta-casamento e oferta-aniversário; se já há booking confirmado 14h–18h numa oferta, **outra oferta do mesmo X não confirma 15h–17h**. (Este é o conteúdo do F-OFFER-6.)

4. **Status bloqueantes vêm do SCHEMA VIVO — não inventar.** Só bookings em **estado de compromisso real** bloqueiam (ex.: `confirmed`/`accepted`/`paid`/`reserved`/`in_progress` — **a lista exata deve ser mapeada do schema/código vivo na execução**). `pending`/`requested`/`proposed`/`cancelled`/`rejected`/`expired` **NÃO** bloqueiam, salvo regra viva expressa do produto. **Ambiguidade sobre quais status = compromisso → STOP_DECISION_REQUIRED** (não inventar status).

5. **`service_offering` é o owner canônico do tempo contratável da oferta.** `availability` segue como declaração de janela; `booking` consome/valida disponibilidade da oferta. O **reader legado `service` (service-feed)** deve ser **CONTIDO** para não reabrir tempo por `service` genérico (cravar `service_offering` como owner único de oferta-tempo).

6. **Integridade por tipo de owner.** `owner_type`/`owner_id` **validado no writer** (fail-closed). Onde couber FK material, aplicar; onde FK condicional não couber, guard/writer fail-closed. (`owner_id` hoje é polimórfico sem FK — 0 integridade referencial.)

7. **PROIBIDO `EXCLUDE` constraint em `availability`.** Hard-block na declaração colide com a régua (§A.1 / Art. II). Se houver constraint forte, ela mira **compromisso real de booking**, **não** declaração de disponibilidade.

8. **Concorrência à prova de corrida.** O bloqueio de booking confirmado é **transacional**: duas tentativas simultâneas p/ o mesmo `provider_actor_id` + intervalo sobreposto **não podem confirmar ambas**. App-level exige lock correto; DB-level (em booking) respeita os status bloqueantes (§A.4). Cenário de concorrência deve ser **provado**.

## §B — Escopo (V1)

**ENTRA (nível decisório 0146; execução fatiável):**
- **F-OFFER-5:** `service_offering` como owner temporal canônico da oferta (substrato já suporta; contenção do reader legado `service`; integridade de `owner_id`).
- **F-OFFER-6:** guard de conflito de booking confirmado por `provider_actor_id` (rollup cross-oferta do mesmo provider), transacional, fail-closed, por status vivos.

**V1 assume `provider_actor_id` como o RECURSO.** Bloqueio é por provider. **Futuro multi-recurso** (equipe, capacidade >1, sala/cadeira/frota/inventário) exige **entidade própria de recurso/capacidade** — **NÃO inventar agora**.

**FORA (0146 e execução inicial):** dinheiro · payout · `bank_ledger` · split · ranking · discovery · marketplace · preço · **política de remarcação/reschedule** · indenização · múltiplos recursos/capacidade por equipe · operador/grants · presença/check-in · `docs/01_normative`.

## §B-bis — Guards estruturais a materializar (insumo para a execução; não-exaustivo)
G1. **availability overlap NUNCA hard-blocka** — sem `EXCLUDE`/trigger-de-bloqueio em availability; conflito de declaração = FATO/alerta. (NP: introduzir EXCLUDE em availability → guard morde.)
G2. **booking confirmado conflitante BLOQUEIA** — createBooking recusa 2º compromisso sobre `provider_actor_id`+intervalo sobreposto em status vivo de compromisso. (NP: remover o check → guard morde / teste de double-booking falha.)
G3. **rollup por `provider_actor_id`**, não por `service_offering` isolada (NP: escopar por offering.id só → teste cross-oferta do mesmo provider falha).
G4. **status bloqueantes = lista viva mapeada** (NP: tratar `pending`/`cancelled` como bloqueante → teste falha; ou hardcode divergente do schema → STOP).
G5. **owner_id validado por tipo no writer** (NP: aceitar owner_id órfão/tipo errado → guard/teste morde).
G6. **service-feed legado contido** (não reabre tempo por `service` genérico como owner de oferta).
G7. **concorrência**: 2 confirmações simultâneas não passam ambas (prova de corrida obrigatória).
G8. **Intervalo canônico `[start, end)`** (TIMESTAMPTZ): sobreposição é meio-aberta — **back-to-back NÃO é conflito** (fim de um = início do outro é permitido).
G9. **`provider_actor_id` do booking DERIVADO server-side** da cadeia material `booking → service_offering → service/provider` — **NUNCA** do body como autoridade. (NP: aceitar provider do body → guard morde.)
G10. **Resolução ambígua/ausente → STOP_DECISION_REQUIRED**: booking sem `service_offering_id` material, ou `service_offering→provider_actor_id` ambíguo → para (não adivinhar o recurso).
G11. **Bloqueio na TRANSIÇÃO para confirmado/comprometido**, não só no create inicial: se o fluxo permite criar `pending`/`requested` e confirmar depois, o guard incide **no momento da confirmação** (não basta cercar `createBooking`).
G12. **Status pagamento × confirmação operacional**: se o schema/status vivo misturar os dois, **mapear de 1ª mão e parar em ambiguidade** — não inventar semântica de status (reforça §A.4).

## §C — Execução (fatiável após promulgação)
**0146 = decisão única** (funde 5+6 no nível decisório). **Execução** conforme READ-FIRST de baixo risco:
- **5A** — owner temporal `service_offering` (contenção legado + integridade owner_id).
- **6A** — booking conflict guard por `provider_actor_id` (transacional, status vivos).
- **OU pacote único** (MODO B/C) se o READ-FIRST de execução provar baixo risco. **MODO C provável** (toca `createBooking` + concorrência) → promulgação condicional **não** se aplica a MODO C; vai a GO explícito.
Ritual: minuta → ChatGPT ratifica → Clayton promulga → READ-FIRST de execução (mapear status vivos!) → GO → IA-YALA → Clayton.

## §D — STOPs (vinculantes)
- Conflito de **declaração** = FATO→ALERTA→humano (Art. II) — **proibido auto-resolver/escolher horário**.
- Bloqueio **só** no compromisso (booking confirmado), **nunca** na declaração (availability).
- **Status de compromisso ambíguos no schema vivo → STOP_DECISION_REQUIRED** (não inventar status; não tratar pending/requested/proposed como confirmed sem regra viva).
- **Não** criar entidade de recurso/capacidade multi-recurso agora (V1 = `provider_actor_id`).
- **Não** tocar dinheiro/payout/ledger/split/ranking/discovery/marketplace/remarcação/presença.
- `service_offering` é owner de **tempo**; **não** criar coluna de tempo na oferta (JOIN read-only à availability).
- Análise/minuta = INSUMO; execução só sob GO após promulgação.

---

## Resumo seco
**availability declara e alerta · booking confirmado compromete e bloqueia · `provider_actor_id` é o recurso V1 · `service_offering` é o owner temporal da oferta · status bloqueantes vêm do schema vivo (ambiguidade = STOP) · sem EXCLUDE em availability · concorrência provada.**

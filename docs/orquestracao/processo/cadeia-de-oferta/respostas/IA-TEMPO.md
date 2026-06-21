# IA-TEMPO — respostas (barramento docs/orquestracao)

> Instância READ-ONLY do eixo tempo/agenda/disponibilidade. Append-only. Escrevo só este arquivo + minha memória.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS · eixo TEMPO

**(1) HEAD vivo:** `9f5e9c5e` (revalidei de 1ª mão; `git rev-parse`). Branch `rescue-structural`.
HEAD do INBOX citava `dd270f41` → **STALE**; o disco moveu (último commit: `feat(semantic): seed needs-graph pilot 'festa-de-casamento' … U1b / DECISION-0142`). Auditei o HEAD vivo, não o citado.

**(2) Revalidou no disco/banco:** **PARCIAL.** Código + migrations + função SQL = lidos de 1ª mão. **Aplicação no banco vivo** (função stub vs real aplicada, CHECK aplicado, coluna viva, rowcounts) = **NÃO** (READ-ONLY de disco) → marcado **INCONCLUSIVE → IA-BANCO**.

**(3) Arquivos/tabelas lidos:**
- `backend/src/core/availability/unified-availability.types.ts:18-25` (enum `AvailabilityOwnerType`)
- `backend/src/core/availability/availability-owner-authority.ts:53,71-74` (policy polimórfica; service_offering→provider_actor_id)
- `backend/src/core/availability/unified-availability.repository.ts:103-128,172-174,710-749` (create exige owner; list filtra por ownerType; detectConflicts)
- `backend/src/core/availability/unified-availability.service.ts:178-247` (conflito pós-booking, não-bloqueia, só `ownerType==='user'`)
- `backend/src/core/availability/unified-availability.routes.ts:89-101,234-254,734-741,979-984,1080-1596` (writes gated por `canRepresentActor` sobre owner authority resolvido)
- `backend/migrations/20260530491000_create_unified_availability_tables.sql` (**`detect_availability_conflicts` = STUB `BEGIN RETURN; END`**)
- `backend/migrations_archive/0577_availability_participants.sql:109-150` (versão REAL superada: escopava `owner_id = p_actor_id`, 1 owner só)
- `backend/migrations/20260612110000_availability_owner_type_check.sql` (CHECK 6 tipos)
- `backend/src/core/calendar/unified-calendar.service.ts:49-149` (read-model, escopado por `filters.actorId = owner_id`)
- `backend/src/modules/services/service-feed.plugin.ts:203-211` (READ `availability WHERE owner_type='service'` — legado)
- `backend/src/modules/human-mvp/human-mvp-service-offer.service.ts` (sem tempo); `backend/src/core/profile/profile-professional.service.ts:190-212,608-622` (`professional_profile.availability` = INPUT DECLARATIVO, **não** verdade temporal)

---

### (4) MATRIZ — eixo TEMPO

| SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT/READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO |
|---|---|---|---|---|---|---|---|---|---|
| `unified_availability` `owner_type='service_offering'` | quando a OFERTA está livre | services do domínio unified_availability | **SSOT temporal** (tabela `availability`) | owner_id = `service_offerings.id`; authority → `provider_actor_id` | `purpose_concept_id` (0132, p/ agenda pessoal; não p/ oferta) | `canRepresentActor(provider_actor_id)` via policy | **canônico** | — | **âncora correta da oferta** (fonte real = DECISION-0117 D, **não** 0132) |
| `unified_availability` `owner_type='service'` | quando o SERVIÇO LEGADO está livre | (writers legados) / lido por `service-feed.plugin` | mesma tabela, **2º vocabulário de oferta-tempo** | owner_id = `services.service_id` | não | mesma policy (owner='service') | canônico (mesma tabela) | **dual offer-time**: um serviço com row legada em `services` E em `service_offerings` pode ter tempo sob 2 owners | **CONVERGIR em F-OFFER**: definir qual owner é a oferta-real; não deixar `service` e `service_offering` competindo |
| `unified_availability` `owner_type='user'` / `'page'` | quando o ACTOR (pessoa/página) está livre | services unified_availability | **SSOT temporal** | owner_id = `actors.id` | `purpose_concept_id` | `canRepresentActor(actor)` | canônico | — | agenda pessoal do actor — coerente, MESMA tabela |
| `professional_profile.availability` (JSONB) | grade declarativa "atendo seg/qua…" | `profile-professional.service` | **read/INPUT declarativo — NÃO SSOT temporal** | actor PJ/profissional | não | grava no próprio perfil | **NÃO é tempo** (blob) | **agenda paralela latente**: declarada, nunca materializada em slots reais (DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING) | manter como input; **falta bridge** declarativo→`availability` (frente própria, não F-OFFER) |
| `human_mvp_service_offers` | "faço X" (human-mvp) | human-mvp service | paralelo de oferta (IA-OFERTA) | actor | (ver IA-OFERTA) | (buraco — ver contexto) | **SEM tempo** | não cria tempo paralelo, mas **oferta sem tempo = não-contratável** | converger p/ service_offering+availability OU 501 |
| `user_skills_categories` | "tenho skill Y" | profile | paralelo (IA-OFERTA/IA-ACTOR) | actor | category, não concept | (buraco) | **SEM tempo** | idem | idem |
| `unified_bookings` | consumo do tempo (reserva) | services unified_availability | **SSOT** (eventos derivados) | requester × owner | — | `canRepresentActor(requester)` | canônico | — | ok |
| `unified-calendar` | projeção consolidada (avail+eventos) | — (read) | **READ-MODEL** | escopado `filters.actorId=owner_id` | — | deriva | read-only | projeção por `actorId` casa só `owner_type='user'/'page'` (offering owner_id≠actor) → agenda da oferta não aparece no calendário pessoal por actorId | nota de projeção; não bloqueia F-OFFER |
| `detect_availability_conflicts(...)` | conflito de horário | função SQL | — | (param actorId) | — | — | **STUB vivo: `RETURN;` (não detecta nada)** | conflito NUNCA dispara → alerta morto | DT — reativar como detecção real (escopada), **sem** auto-resolver |

---

### Respostas diretas às 6 perguntas do foco

1. **Disponibilidade real da oferta vive só em `unified_availability owner_type='service_offering'`?**
   Em uma única TABELA (SSOT temporal), **sim** — não há tabela de tempo paralela. **Porém há DOIS owner-vocabulários de oferta-tempo na mesma tabela:** `service_offering` (canônico, 0117 D) **e** `service` (legado, ainda LIDO por `service-feed.plugin.ts:211`). Não é verdade-paralela de substrato (mesma tabela), mas é **ambiguidade de owner** a convergir em F-OFFER.

2. **Agenda do ACTOR × agenda da OFERTA — há `owner_type='profile'/'actor'`?**
   **NÃO.** O enum tem 6 (`user, service, event, group, page, service_offering`) — **sem `profile`/`actor`**. Agenda do actor = `user`/`page`; agenda da oferta = `service_offering`. **Coerentes** (mesma tabela, owners distintos, escopados). O único "perfil" com tempo é `professional_profile.availability`, mas é **declarativo, não SSOT** (não compete).

3. **CRÍTICO — prestador (1 actor) com N ofertas: "prestador ocupado" é cross-oferta ou por oferta isolada?**
   **GAP CONFIRMADO.** (a) Estruturalmente, cada oferta tem `owner_id = service_offerings.id` próprio; **não existe chave que role up o tempo de todas as ofertas do mesmo `provider_actor_id`** (o link offering→provider existe na *policy de autoridade*, mas **nenhuma query de conflito usa**). (b) Funcionalmente, `detect_availability_conflicts` é **STUB** (`RETURN;`) e o serviço só chama conflito quando `ownerType==='user'` (`service.ts:184`) — **nunca para `service_offering`**. (c) A versão superada (archive 0577) escopava `owner_id = p_actor_id` (um owner só) e checava o **requester**, não o provider cross-oferta. ⇒ **o "fotógrafo em 2 casamentos no mesmo horário" NÃO é prevenido em lugar nenhum.** É gap de orquestração (a desenhar no macro), não corrupção de SSOT.

4. **Os paralelos (human_mvp/user_skills/services-legado) criam agenda/tempo próprio = 5ª verdade paralela?**
   **NÃO criam tempo próprio.** `human_mvp_service_offers` e `user_skills_categories` **não têm tempo** (não escrevem `availability`). `services` legado **não tem tabela de tempo** — usa a MESMA `unified_availability` via `owner_type='service'`. `professional_profile.availability` é blob **declarativo, não temporal**. ⇒ **nenhuma 5ª verdade paralela de TEMPO**; o risco real é o oposto: **oferta/skill SEM tempo = não-contratável** (viola "oferta sem tempo não é oferta real").

5. **Writes de availability passam por `canRepresentActor`? Conflito = fato→alerta→humano (Art. II), nunca auto-resolução?**
   **SIM (autoridade) — forte.** Routes resolvem o owner via policy polimórfica e **provam `canRepresentActor(authorityActorId)`** antes de criar/editar/reservar (`routes.ts:89-101,254,638,734,1080…`) — explícito "NÃO cria actor; NUNCA chama com ownerId cru". **SIM (Art. II) por desenho:** conflito é detectado **APÓS** o booking, **não bloqueia**, só emite effect `AVAILABILITY_CONFLICT_DETECTED` (`service.ts:179-245`) — nunca auto-resolve/otimiza. **MAS materialmente MORTO:** como `detect_availability_conflicts` é stub e só roda p/ `owner_type='user'`, o alerta **nunca dispara**. Conformidade correta, execução inerte → **DT**.

6. **"oferta sem tempo não é oferta real" — interseção oferta×availability limpa?**
   A interseção é **limpa por desenho** (read-only, owner-escopada, tempo na tabela canônica, oferta **não** armazena tempo — confirmado: `service_offerings` sem coluna temporal, cf. IA-OFERTA/IA-BANCO). **Porém** o tempo está **frequentemente DESCONECTADO da oferta concreta na prática**: ofertas em human_mvp/user_skills e perfis com `professional_profile.availability` declarativo **não têm `availability` real materializada** → a interseção retorna vazio → "oferta não-real". O caminho canônico (`service_offering` + `availability owner_type='service_offering'`) é o único que fecha a interseção de verdade.

---

### (5) VEREDITO

**PARTIAL.**
O substrato temporal da oferta é **único e são** para convergir (uma tabela SSOT `unified_availability`, owner `service_offering` ancorado em DECISION-0117 D, writes gated por `canRepresentActor`, Art. II respeitado por desenho — sem verdade-paralela de TEMPO). **Não é BLOCKER** para abrir F-OFFER. Mas **não é PASS limpo**: há (i) ambiguidade owner `service`(legado)×`service_offering`, (ii) gap de conflito cross-oferta do mesmo provider, (iii) função de conflito stub/morta, (iv) `professional_profile.availability` declarativo nunca materializado, (v) ofertas paralelas sem tempo. Esses são itens de **design-forward** a laçar no macro, não defeitos que impeçam abrir.
Itens de **aplicação no banco** (stub vs real aplicado; CHECK aplicado; coluna `purpose_concept_id` viva; rowcounts de availability por owner_type) → **INCONCLUSIVE → IA-BANCO**.

### (6) Verdades paralelas (eixo TEMPO)
- **NENHUMA verdade-paralela de substrato temporal** (tudo que tem tempo está em `unified_availability`). ✅
- **Ambiguidade de owner da oferta-tempo:** `owner_type='service'` (legado, lido por service-feed) **vs** `owner_type='service_offering'` (canônico) — convergir.
- **Tempo declarativo latente (não-SSOT):** `professional_profile.availability` (blob) — input, nunca vira slot.
- **Tempo ausente (oferta não-real):** `human_mvp_service_offers`, `user_skills_categories` — sem `availability`.

### (7) STOPs para F-OFFER
1. **Decidir owner único da oferta-tempo:** `service_offering` é o canônico (0117 D). **Não** abrir F-OFFER deixando `owner_type='service'` competir; definir migração/contenção do legado (sinalizar, não corrigir agora).
2. **Não tratar `professional_profile.availability` como agenda real.** Materialização declarativo→`availability` é **frente própria** (DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING), **fora** de F-OFFER.
3. **Conflito cross-oferta do mesmo provider é GAP — projetar no macro, nunca por carona.** Quando desenhar: rollup por `provider_actor_id` (o link existe na policy), **detecção como FATO→ALERTA→HUMANO** (Art. II), **proibido auto-resolver/escolher horário**. Reativar `detect_availability_conflicts` (hoje stub) com escopo correto.
4. **`canRepresentActor` é pré-condição de qualquer write de availability/booking da oferta** — manter; não criar atalho de owner cru.
5. **"Oferta sem tempo não é oferta real":** a discovery de F-OFFER deve **INTERSECTAR** `service_offerings × unified_availability(owner_type='service_offering')` read-only; oferta sem availability = filtrada (filtro legítimo), **não** "resolver conflito".
6. **0132 ≠ owner_type.** Reforço da Rodada 1: a fonte de `owner_type='service_offering'` é **DECISION-0117 D**; 0132 governa `purpose_concept_id` (finalidade/booking-gate da agenda pessoal). Não confundir finalidade temporal com owner da oferta no desenho de F-OFFER.

**Encaminhamentos:** prova-viva DB → **IA-BANCO** (stub/real, CHECK, coluna, rowcounts por owner_type) · owner-vocabulário `service`×`service_offering` e price/concept → **IA-OFERTA** · `canRepresentActor`/representação do provider → **IA-ACTOR/IA-AUTORIDADE** · registro de DT (conflito stub; cross-oferta gap; profile-availability) → **IA-DECISOES-DT/IA-DOCUMENTOS**.

**Carimbo:** HEAD `9f5e9c5e` · branch `rescue-structural` · revalidou no vivo: PARCIAL (disco SIM / banco INCONCLUSIVE→IA-BANCO) · **Status: RESPONDIDO** (com INCONCLUSIVE de banco delimitado). Análise = INSUMO, não GO.

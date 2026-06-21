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

---

## DRILL ("próximo", ciclo adaptativo) · ownership temporal · IA-TEMPO

**HEAD vivo:** `bca473fa` (revalidei de 1ª mão; o `9f5e9c5e` da resposta anterior já moveu — último commit `docs(orchestration): version F-OFFER-4 read-first evidence`). Branch `rescue-structural`. Revalidou no vivo: disco **SIM** / banco **INCONCLUSIVE→IA-BANCO**.
**Lidos:** `migrations/20260427120000_unified_availability_base.sql` · `migrations/20260530491000_create_unified_availability_tables.sql` · `availability-owner-authority.ts` (íntegro) · `unified-availability.service.ts:120-247` · `unified-availability.repository.ts:6,84,103-128,172-174,207,278,710-749`.
> Nota de barramento: respondi no caminho novo `processo/cadeia-de-oferta/respostas/IA-TEMPO.md` (a pasta `respostas/` raiz foi migrada pela DIRETORA; disco venceu a narrativa do METODO §Estrutura, ainda apontando p/ raiz).

### 1. Quem é o owner temporal HOJE (`availability.owner_type`/`owner_id`)
DDL viva (`20260530491000:CREATE TABLE availability`): `owner_type VARCHAR(30) NOT NULL` · `owner_id UUID NOT NULL` · index `(tenant_id, owner_type, owner_id)`. **`(owner_type, owner_id)` identifica o RECURSO dono da janela — NÃO o actor** (`availability-owner-authority.ts:4-11`). Mapa vivo (policies, linhas 53-103):

| owner_type | owner_id aponta p/ | authority actor derivado (schema vivo) |
|---|---|---|
| `user` | `actors.id` (actor_type=user) | o próprio actor |
| `page` | `actors.id` (actor_type=page) | o próprio actor |
| `service` | `services.service_id` | `services.actor_id` |
| `service_offering` | `service_offerings.id` | `service_offerings.provider_actor_id` (0117 D) |
| `event` | `events.id` | `events.actor_id` |
| `group` | `groups.id` | `COALESCE(groups.owner_actor_id, actor_id)` |

⇒ **owner temporal HOJE é polimórfico de 6 tipos**, agenda pessoal (`user`/`page`) e agenda de recurso/oferta (`service`/`service_offering`/`event`/`group`) na MESMA tabela SSOT.

### 2. `availability` já suporta `owner='service_offering'`?
**SIM, plenamente, no código/migration:** enum `unified-availability.types.ts:24` · policy `availability-owner-authority.ts:71-80` (→`provider_actor_id`) · CHECK físico `20260612110000:25,32` (6 tipos, fail-closed, espelhado no enum). **Fonte = DECISION-0117 D** (não 0132). Aplicação do CHECK no banco vivo → **IA-BANCO**.

### 3. Quem ESCREVE janelas (writer/autoridade)
- **Writer:** só services do domínio unified_availability — `repository.createAvailability` (exige `ownerType`+`ownerId`, `:103-128`) e `updateAvailability` (`:278`). Não há writer fora do core (confirmado Rodada 7: nada além de `core/availability` faz INSERT/UPDATE em `availability`).
- **Autoridade (forte, fail-closed):** `resolveAvailabilityOwnerAuthority` (`:139-157`) resolve o recurso → deriva authority actor do schema vivo → **prova `canRepresentActor(req.user, authorityActorId)` server-side**. 404 (recurso/tipo) · 403 (sem representação). Proíbe explicitamente tratar `owner_id` como actor, `as never`, fallback de actor do cliente, `ensureUserActor`. As rotas chamam em todos os writes (`routes.ts:254,638,1080,1155,1240,1485…`).

### 4. Como o BOOKING lê isso
`service.createBooking` (`:134-177`): (a) `findAvailabilityById` lê a janela; (b) **GATE 0132 §4** — se `availability.purposeConceptId` ∈ protegidos (estudo/cuidados/lazer) → 400 `AVAILABILITY_PERSONAL_PROTECTED`; `trabalho`/NULL bookáveis; (c) `requesterActorId` obrigatório + validado; (d) `createBooking` **não executa pagamento**; (e) conflito detectado **APÓS**, não-bloqueia, só p/ `owner_type='user'`. Autoridade do booking = `canRepresentActor(requesterActorId)` (lado comprador, `routes.ts:734`). Oferta (`service_offering`) tem `purpose_concept_id=NULL` → o gate 0132 não a afeta (é semântica de agenda pessoal).

### 5. Onde ainda há owner genérico/polimórfico PERIGOSO
O polimorfismo em si é **CONTIDO** por `resolveAvailabilityOwnerAuthority` (uso correto). Os perigos REAIS:
- **`owner_id UUID` SEM FK** (DDL): nenhuma integridade referencial — `owner_id` órfão/dangling fisicamente possível; um UUID coincidente de outro tipo só não autoriza porque a *policy* checa tipo (app-level, não DB). → integridade fraca; **IA-BANCO** confirma ausência de FK.
- **Trigger de sobreposição FANTASMA:** `repository.ts:6,84,207` afirmam "Trigger previne sobreposição de horários por owner", mas **NENHUMA migration vigente cria esse trigger** (nem `20260427120000` nem `20260530491000`; nenhum `EXCLUDE/tstzrange/OVERLAPS`). Comentário stale → **NÃO há guarda de overlap no DB**. (Trigger stale só no banco vindo de archive `0576` = drift possível → **IA-BANCO** lista triggers de `availability`.)
- **`detect_availability_conflicts` = STUB** (`20260530491000:RETURN;`) e só chamado p/ `owner_type='user'` → conflito nunca dispara.
- **`unified-calendar`** filtra `owner_id = filters.actorId` cru (`:88-90`): correto p/ `user`/`page`, mas conceitualmente trata owner_id como actor — p/ `service_offering` (owner_id=offering.id) a agenda da oferta **não** aparece no calendário pessoal por actorId. Projeção, não vazamento; sinalizo.

### 6. O que QUEBRA se a agenda passar de pessoa/service → oferta
**Estruturalmente, nada quebra** — `service_offering` já é owner suportado (enum+policy+CHECK), authority mapeia p/ `provider_actor_id`, writes gated, booking lê por id. A migração de eixo é aditiva. **O que fica EXPOSTO/CRÍTICO ao virar oferta:**
- **Double-booking da oferta NÃO é prevenido:** sem trigger de overlap + conflito stub + conflito só p/ `user` ⇒ a mesma `service_offering` (ou o mesmo provider em N ofertas) pode receber 2 bookings sobrepostos. Em agenda pessoal era tolerável (alerta); em **oferta contratável é falha econômica**.
- **Conflito cross-oferta do mesmo provider continua GAP** (owner_id por-oferta, sem rollup por `provider_actor_id` — o link existe na policy, nenhuma query usa).
- **Ambiguidade `service`×`service_offering`:** os DOIS são owner de oferta-tempo vivos (legado lido por `service-feed.plugin:211`); ao mover p/ oferta é preciso cravar `service_offering` como único e conter `service`.
- **`owner_id` sem FK** vira risco maior: oferta apagada deixaria availability órfã apontando p/ offering inexistente (sem `ON DELETE`).
- **Calendário/projeção:** agenda da oferta não casa com filtro `actorId` pessoal — a UI do provider precisaria projetar por `provider_actor_id`→offerings→availability.

### VEREDITO do drill: **PARTIAL** (o substrato suporta a oferta; faltam 3 guardas materiais)
Owner `service_offering` está pronto como ENDEREÇO temporal. **Antes de a agenda virar oferta de verdade, F-OFFER precisa LAÇAR (desenho, gated):** (1) guard de **overlap por owner** no DB (hoje fantasma) — FATO/ALERTA→humano onde a Constituição Art. II exigir, **bloqueio só onde for double-booking de oferta contratável** (decisão de Clayton: oferta tolera overlap? em geral NÃO); (2) **conflito cross-oferta por `provider_actor_id`** (rollup); (3) reativar `detect_availability_conflicts` (stub) com escopo correto; (4) **FK/ON DELETE** de `owner_id` por tipo (IA-BANCO/IA-OFERTA); (5) convergir `service`→`service_offering`.
**Reverse-check (N→1, METODO):** para o fim "oferta contratável confiável no tempo" ser verdadeiro, a camada TEMPO precisa garantir *não-duplo-booking do recurso* — **hoje NÃO garante** (3 furos acima). Pelo `<` load-bearing, isso é **rachadura de fundação da camada 4 (TEMPO) sob ESTADO/FINANCEIRO** → **GOAL-BREAKER quando houver dado real**, mas **baixo custo agora** (janela virgem: 0 rows — confirmar rowcount `availability` por owner_type com IA-BANCO).
**INCONCLUSIVE→IA-BANCO:** FK em `owner_id`; lista de triggers vivos em `availability` (overlap real vs fantasma); CHECK aplicado; função stub vs real; rowcount por owner_type (custo da janela virgem).

**STOPs:** conflito = FATO→ALERTA→humano (Art. II) — **proibido auto-resolver/escolher horário**, mesmo virando oferta · não criar coluna de tempo na oferta (JOIN read-only) · não tratar `owner_id` como actor sem resolver tipo · writes só via core unified_availability sob `canRepresentActor` · 0132≠owner_type (0117 D é a fonte). Análise = INSUMO, não GO.

**Carimbo:** HEAD `bca473fa` · branch `rescue-structural` · revalidou no vivo: PARCIAL (disco SIM / banco INCONCLUSIVE→IA-BANCO) · **Status: RESPONDIDO**.

---

## F-OFFER-5/6 EXECUÇÃO — READ-FIRST 1º elo: semântica do compromisso · IA-TEMPO

**HEAD vivo:** `891dfa87` (revalidei de 1ª mão; INBOX/0146 citam `bca473fa` — já moveu; último commit `docs(orchestration): version F-OFFER-5/6 read-first evidence (DECISION-0146)`). Branch `rescue-structural`. Revalidou no vivo: **SIM** (código/schema de disco) / banco vivo = IA-BANCO (já entregou PASS_PARA_DECISAO: offering=0/service=0/user=48).
**Fonte:** DECISION-0146 (§A régua, G1–G12) · `unified-availability.types.ts:51-58` (enum status) `:88-105` (Booking) · `unified-availability.repository.ts:300-333` (createBooking) `:291-310` (updateBooking) · `unified-availability.service.ts:134-247,381-424` · `unified-availability.routes.ts:935-1022` (PUT transição) `:1054,1129` (check-in/out) · `availability-owner-authority.ts:71-80` · `migrations/20260530491000` (DDL) `:20260427120000` (base).
**READ-ONLY:** mapeei código vivo; não editei, não propus implementação.

### 1. QUANDO intenção vira compromisso (ciclo de vida do booking)
**Nasce SEMPRE `requested` — NÃO nasce confirmado.** `createBooking` (`repository.ts:319-333`) faz `INSERT INTO bookings (...status...)` com valor **hardcoded `UnifiedBookingStatus.REQUESTED`**; `CreateUnifiedBookingInput` (`types.ts:191`) **não tem campo status** (cliente não escolhe); DB default = `'requested'` (`20260530491000:29` e base `:40`). **Confirmação é transição SEPARADA do create.** Não há método `confirm()` dedicado: a confirmação passa por `updateBooking` via **`PUT /bookings/:id`** (`routes.ts:935-1022`), que **NÃO é setter genérico** (`:947-948,968-971`) — só aceita **CONFIRM** e **CANCEL**.
**Ciclo:** `create → requested` → `PUT confirm → confirmed` → `checkIn (exige confirmed, service.ts:394) → checked_in` → `checkOut → checked_out`. Cancelar = `PUT cancel → cancelled` (emite outbox de slot liberado, `service.ts:311-351`).

### 2. STATUS VIVOS + semântica (G4/G12) — `UnifiedBookingStatus` (`types.ts:51-58`), 6 valores
| status | semântica (comentário vivo) | COMPROMISSO REAL? (bloqueia?) |
|---|---|---|
| `requested` | "pedido solicitado (aguardando resposta)" | **NÃO** (intenção, pré-aceite) |
| `confirmed` | "confirmado (aceito)" | **SIM** — compromisso aceito |
| `cancelled` | "cancelado" | **NÃO** (terminal negativo) |
| `expired` | "expirado" | **NÃO** (terminal negativo) |
| `checked_in` | "check-in realizado" | **SIM** — compromisso em execução |
| `checked_out` | "check-out realizado" | **SIM** — compromisso executado (passado; intervalo já não sobrepõe futuro, mas é commitment real) |

**Conjunto bloqueante recomendado (mapeado, não inventado): `{confirmed, checked_in, checked_out}`.** Não-bloqueante: `{requested, cancelled, expired}`.
**G12 — pagamento × confirmação operacional = RESOLVIDO, NÃO ambíguo:** o enum é **puramente operacional**; **não existe `paid`/`reserved`/`in_progress`/`accepted`/`pending`/`proposed`** no schema vivo. Comentário do enum (`types.ts:48-50`): "Check-in/check-out são apenas registro, **NÃO executam pagamento**". ⇒ status de booking **não carrega pagamento** (dinheiro é eixo separado, fora de escopo 0146/§B). **Não há mistura → não dispara STOP_DECISION_REQUIRED por G12.** (Única decisão fina, não-bloqueante, para a DIRETORA: incluir `checked_out` no bloqueio? — recomendo SIM por integridade; inócuo pois intervalo passado não sobrepõe futuro.)

### 3. PONTO DE TRAVA (G11) — onde o guard de conflito DEVE incidir
**No CONFIRM, não no create.** Como o booking nasce `requested` (não-bloqueante) e só vira compromisso no `PUT confirm`, **cercar `createBooking` NÃO basta** (G11 confirmado materialmente). O ponto exato = **`PUT /bookings/:id` quando `target === CONFIRMED`** (`routes.ts:995-1001`), que hoje já: (a) exige **owner-only** (`canRepresentActor` sobre o owner da availability → 403 `BOOKING_CONFIRM_OWNER_ONLY`); (b) exige **estado `requested`** (→ 409 `BOOKING_CONFIRM_INVALID_STATE`). **Falta ali o guard de conflito de provider.** O conflito atual (`service.ts:179-246`) está no lugar ERRADO (dentro do createBooking, só `owner_type='user'`, e `detect_availability_conflicts` é **STUB** `RETURN;`) → inerte e mal posicionado. `updateBooking` (`repository.ts:291-310`) só carimba timestamps por status; sem state-machine no repo (validação de transição é na rota).

### 4. CADEIA booking→service_offering→provider_actor_id (G9/G10)
**Booking NÃO tem `service_offering_id` material** (`UnifiedBooking`, `types.ts:88-105`: só `availabilityId` + `requesterActorId`). A derivação do provider é **1 salto via availability**, server-side, determinística:
`booking.availabilityId → availability(owner_type, owner_id)` → **se `owner_type='service_offering'`** → `service_offerings.id = owner_id` → **`provider_actor_id`** (`availability-owner-authority.ts:71-80`, `SELECT provider_actor_id FROM service_offerings WHERE id=owner_id`).
**Determinístico (G10 OK):** 1 booking → 1 availability → 1 owner → 1 provider. **Ambiguidade só se** `owner_type≠service_offering` (ex.: booking sobre availability `user`/`service` legado) — aí a oferta não é `service_offering` e o rollup por provider-de-oferta não se aplica (G10 → tratar como fora do escopo do guard de oferta, não adivinhar). **Rollup cross-oferta (G3/F-OFFER-6):** `provider_actor_id → todas service_offerings do provider → availabilities owned → bookings em status bloqueante com intervalo sobreposto` — query a construir (não agora).

### 5. AVAILABILITY declarativa (G1) — overlap NÃO se toca
Confirmado alinhado à régua §A.1: **o guard mira BOOKING (compromisso), nunca availability (declaração).** Overlap de declaração = FATO/ALERTA→humano (Art. II). Hoje **não há** `EXCLUDE`/trigger de bloqueio em `availability` (verifiquei: nenhuma migration cria; o "trigger previne sobreposição" dos comentários `repository.ts:6,84,207` é **FANTASMA**). ⇒ G7 (proibido `EXCLUDE` em availability) já é o estado atual; nada a remover. Atenção na execução: **não** "consertar" o comentário fantasma virando trigger de bloqueio na availability (violaria §A.1/G1).

### 6. CONCORRÊNCIA (G7/G8) — onde travar
- **Intervalo canônico `[start, end)` TIMESTAMPTZ (G8):** `availability.start_datetime`/`end_datetime` são **TIMESTAMPTZ NOT NULL** (`20260530491000` DDL). O booking herda o intervalo da availability (não tem intervalo próprio). Sobreposição **meio-aberta**: back-to-back (fim=início) **NÃO** é conflito.
- **Ponto de corrida = o CONFIRM** (§3). Hoje o caminho é um `UPDATE` simples (`repository.ts:291-310`) **sem `SELECT … FOR UPDATE`/advisory-lock** → 2 confirmes simultâneos sobre o mesmo `provider_actor_id` com intervalos sobrepostos **passariam ambos**. `createBooking` aceita `trx` (transação existe na casa), mas a confirmação não usa lock.
- **Plano de concorrência (DESENHO, não execução):** o guard de confirm precisa rodar **dentro de transação** que serialize por provider — ex.: `pg_advisory_xact_lock(hashtext(provider_actor_id))` **ou** `SELECT … FOR UPDATE` nas linhas de booking bloqueante do provider, **antes** de checar overlap e gravar `confirmed`. Cenário de corrida = **prova obrigatória** (2 confirmes concorrentes → 1 confirma, outro recebe `BOOKING_PROVIDER_TIME_CONFLICT`/409). Mecanismo exato (advisory vs FOR UPDATE) = decisão de execução + IA-BANCO (suporte/índice).

---

### ENTREGA

**Mapa de status:** `requested`(não), `confirmed`(SIM), `cancelled`(não), `expired`(não), `checked_in`(SIM), `checked_out`(SIM). Bloqueante = `{confirmed, checked_in, checked_out}`. **G12 resolvido** (zero status de pagamento; booking = operacional puro).
**Ponto de trava:** transição **CONFIRM** em `PUT /bookings/:id` (`routes.ts:995-1001`), owner-only + `requested→confirmed`. **NÃO** o createBooking (nasce `requested`). Guard de conflito atual está inerte e no lugar errado.
**Cadeia provider:** server-side, determinística, 1 salto: `booking→availability(owner_type='service_offering', owner_id)→service_offerings.provider_actor_id`. Booking sem `service_offering_id` direto; `owner_type≠service_offering` → fora do guard de oferta (não adivinhar).
**Plano de concorrência:** travar no CONFIRM, dentro de transação, lock por `provider_actor_id` (advisory-xact ou FOR UPDATE), intervalo `[start,end)` TIMESTAMPTZ meio-aberto, prova de corrida obrigatória.

**VEREDITO: PRONTO_PARA_GO (pacote 5A+6A, MODO C).**
A **semântica do compromisso é INEQUÍVOCA** — booking nasce `requested`, compromisso = transição CONFIRM (owner-only, `requested→confirmed`), bloqueantes = `{confirmed,checked_in,checked_out}`, pagamento NÃO está no status (G12 resolvido). O ponto de trava (G11), a cadeia provider (G9/G10) e o tipo de intervalo (G8) estão **provados no disco**. **Não há ambiguidade de status** → **não** é STOP_DECISION_REQUIRED. É **MODO C** (toca `createBooking`/CONFIRM + concorrência; promulgação condicional não se aplica → GO explícito + IA-YALA).
**Itens que o GO precisa fixar (não bloqueiam o GO; são conteúdo da fatia):** (i) confirmar conjunto bloqueante (`checked_out` incluído? recomendo sim); (ii) mecanismo de lock (advisory vs FOR UPDATE) — IA-BANCO; (iii) contenção do reader legado `service` (G6/§A.5) na fatia 5A; (iv) FK/integridade `owner_id` (G5) — IA-BANCO/IA-OFERTA.
**INCONCLUSIVE→IA-BANCO** (já em PASS_PARA_DECISAO; reconfirmar na execução): stub vs real de `detect_availability_conflicts` no banco vivo; ausência de FK em `owner_id`; suporte a advisory-lock/índice de overlap; rowcount atual (custo janela virgem).

**STOPs:** guard só no COMPROMISSO (CONFIRM), nunca na declaração (availability) · proibido `EXCLUDE`/trigger de bloqueio em availability (e não transformar o comentário-fantasma em bloqueio) · conflito = recusa de compromisso impossível (fail-closed `BOOKING_PROVIDER_TIME_CONFLICT`), **não** auto-resolver/escolher horário (Art. II) · provider derivado server-side, nunca do body (G9) · `owner_type≠service_offering` → não adivinhar recurso (G10) · não criar coluna de tempo na oferta · não tocar dinheiro/payout/ranking/discovery/remarcação/presença · análise = INSUMO, execução só sob GO pós-promulgação.

**Carimbo:** HEAD `891dfa87` · branch `rescue-structural` · revalidou no vivo: SIM (disco) / banco→IA-BANCO · **Status: RESPONDIDO** · VEREDITO **PRONTO_PARA_GO (5A+6A, MODO C)**.

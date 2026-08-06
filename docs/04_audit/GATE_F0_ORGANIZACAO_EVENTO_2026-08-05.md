# GATE F0 — organizacaoevento.md · READ-ONLY

> **Categoria:** auditoria
> **Status:** vivo
> **Fonte canônica:** `docs/01_normative/00_AGENT_PROTOCOL.md` (§2.2.2 prova de rastreabilidade · §2.3.2 GATE) — este documento é **relatório**, nunca norma
> **Obrigatório:** não — leitura obrigatória só para quem for executar `organizacaoevento.md`
> **Governado por:** Clayton (GO e decisões) · direção (execução read-only do GATE)

**Modo:** GUARDIÃO · **Data:** 2026-08-05 · **Banco:** `unificard_dev` · **Branch:** `rescue-structural`
**Escrita:** ZERO (nenhum código, nenhuma migration, nenhuma linha de banco). Este documento é o único artefato.
**Estado medido de 1ª mão nesta sessão:** `validate:regression-guards` **258 COMMANDS OK · drift 0** ·
`node_modules/.bin/tsc -p tsconfig.build.json --noEmit` **0** · `frontend npm run typecheck` **0**.

> ⚠️ **Todo número aqui tem o comando ao lado.** Não acredite em nenhum — rode.
> As queries rodaram por script no scratchpad contra `DATABASE_URL` do `backend/.env`, com trava
> `if (db !== 'unificard_dev') exit 1` na primeira linha.

---

## §0 · PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Documentos de `docs/01_normative/` lidos integralmente para esta execução:**
`00_AGENT_PROTOCOL.md` · `CONSTITUICAO_UNIFICARD.md` · `LEIS_OPERACIONAIS_UNIFICARD.md` ·
`SSOT_REGISTRY_UNIFICARD.md` (§SSOT TEMPORAL).
**Fora de `01_normative/`, com status declarado:** `DECISION_0146_...md` (**PROMULGADA**) ·
`DECISION-0164` (lida através do código que ela governa + `governed-vocabularies.manifest.ts`;
**o arquivo de decisão não foi aberto** — declarado como limite) · `SELO_AGENDA_UNIFIED_AVAILABILITY.md`
(**SELO, 2026-06-01**) · `INDICE_ONDE_ESTA_O_QUE_2026-07-29.md` (ponteiro) ·
`PAINEL_DIVIDA_VIVA.md` (placar) · `REMEDIATION_DT_LOG.md` (topo).

**Por que este conjunto é suficiente para o escopo:** o GATE é **read-only** e não altera tabela,
SSOT nem contrato — o §2.3.2 não é acionado. O domínio é **TEMPORAL** (+ **AUTORIDADE** como
domínio cruzado, por causa da pergunta (e)); nenhuma das cinco perguntas toca financeiro, e o
§8 do protocolo (pacote SSOT do Bank) **não foi acionado**: nada aqui lê ou escreve `bank_*`.
**Δbank = 0 por construção — este GATE não executou nada.**

**SSOT que governa o pilar:** **TEMPORAL → `unified_availability`** (tabelas `availability` +
`bookings`), por `SSOT_REGISTRY_UNIFICARD.md §SSOT TEMPORAL` e **CONSTITUIÇÃO ARTIGO II.1**.
**SEMÂNTICO → CONCEPT** (`concepts`) — `service_demands.concept_id` é FK para `concepts(concept_id)`,
não para `categories`, o que está **correto** por Lei 7.
**Estruturas que NÃO são SSOT aqui:** `categories` (árvore de navegação, não identidade) ·
`slug` (sem validade normativa) · `service_demand_responses` (registro de resposta comercial —
**não** é fonte de verdade temporal; ver Achado ①).

**Precedência aplicada:** `CONSTITUIÇÃO > LEIS > SSOT_REGISTRY > 18_DOMAIN_ONTOLOGY > demais`.
Nos dois conflitos achados (§2, Achados ① e ②) **prevalece a CONSTITUIÇÃO ARTIGO II**, e o código
é que está em desacordo — não o contrário.

**Ambiguidade de domínio (§2.2.6):** declarada e resolvida por **união** — TEMPORAL ∪ AUTORIDADE.
Não escolhi "o domínio principal".

---

## §1 · AS CINCO RESPOSTAS

### (a) 🔴 `page` como dona de agenda é **DESENHO**, e o desenho é **maior do que a pergunta supunha**

**Não é resíduo. É frente selada.** As 8 linhas são a **materialização da grade semanal do perfil**,
`DECISION-0072 B1`, selada em `docs/02_decisions/SELO_AGENDA_UNIFIED_AVAILABILITY.md` (2026-06-01).

```sql
SELECT owner_type, count(*), min(created_at), max(created_at) FROM availability GROUP BY 1;
-- service_offering 58 (2026-08-04) · page 8 (2026-07-07 08:27:18.566→.629) · actor_asset 4 (2026-08-05)
SELECT * FROM availability WHERE owner_type='page';
-- as 8: metadata = {"source":"profile_weekly_template","templateKey":"weekly:monday:<data>:09:00-18:00",...}
--       availability_type='recurring', status='active', tz America/Sao_Paulo, capacity NULL
--       owner_id ÚNICO: 52165a0b-… → actors.actor_type='page'  (1 dono, 8 segundas-feiras)
```
```
grep -rn profile_weekly_template  →  backend/src/core/availability/weekly-template-materializer.service.ts:35
                                     frontend/src/utils/temporal/reconstructWeeklySchedule.ts:11
                                     frontend/src/components/ProfileAgenda.tsx:34
```

**Quem criou:** `PUT /availability/weekly-template` (`unified-availability.routes.ts:624`) →
`weeklyTemplateMaterializerService.materialize`. `page` tem policy de autoridade própria
(`availability-owner-authority.ts:62` — *"page: o recurso É o próprio page actor"*), o que confirma
cidadania de primeira classe, não acidente.

**O que usa: NADA, ainda.**
```sql
SELECT b.booking_id FROM bookings b JOIN availability a USING(availability_id) WHERE a.owner_type='page';
-- []   (bookings total = 4: actor_asset confirmed 1 · actor_asset requested 1 · service_offering expired 2)
```

> #### 🔴 A CORREÇÃO QUE MUDA A FILA: **a exposição não é "8 linhas de `page`" — é `user` também, e `user` é o DEFAULT**
>
> ```ts
> unified-availability.routes.ts:80
>   ownerType: z.enum([AvailabilityOwnerType.USER, AvailabilityOwnerType.PAGE]).optional(),
> unified-availability.routes.ts:672
>   ownerType: parsed.data.ownerType ?? AvailabilityOwnerType.USER,   // ← DEFAULT
> ```
> O único caminho vivo que materializa agenda aceita **`user` e `page`**, e **omitir o campo produz
> `user`**. Hoje `user` tem 0 janelas só porque ninguém salvou a agenda por lá — **12 actors `user`
> existem no banco**. O terceiro ramo do confirm não é um caso de borda de 8 linhas: é o
> **comportamento padrão** da agenda de pessoa física.

**E o ramo sem trava não é esquecimento — é uma leitura ERRADA da norma, escrita em três lugares:**

```ts
unified-availability.service.ts:449   if (input.status === CONFIRMED) {
unified-availability.service.ts:454   // G10: owner_type ≠ service_offering → fora do guard cross-oferta
                                      //      (não adivinhar recurso); confirma normal.       ← AQUI
unified-availability.service.ts:455   if (ownerType === SERVICE_OFFERING) → confirmBookingWithProviderLock  (repo:414, advisory lock)
unified-availability.service.ts:518   if (ownerType === ACTOR_ASSET)      → confirmBookingWithResourceLock  (repo:473, advisory lock)
unified-availability.service.ts:533   ↓ cai fora → repository.updateBooking (repo:576) = UPDATE simples, ZERO lock, ZERO checagem
```
```
backend/scripts/audit-booking-provider-conflict.mjs:51
  if (!/AvailabilityOwnerType\.SERVICE_OFFERING/.test(svc)) failures.push(
    '… sem gate owner_type=service_offering (G10; owner_type≠service_offering fica fora do guard).')
```

🔴 **`DECISION-0146 G10` diz o CONTRÁRIO do que o código faz.** Literal:
> *"G10. Resolução ambígua/ausente → **STOP_DECISION_REQUIRED**: booking sem `service_offering_id`
> material, ou `service_offering→provider_actor_id` ambíguo → **para** (não adivinhar o recurso)."*

O código traduziu *"não adivinhar o recurso"* por **"confirma normal"**. A norma manda **PARAR**;
a implementação **passa**. E o guard, escrito depois, **congelou a tradução errada como se fosse a
regra** — é o padrão *"guard escrito depois do conserto nasce descrevendo o conserto, não a regra"*,
aqui na variante mais cara: o guard **exige** que o gate exista e **declara a ausência de trava como
conformidade**.

**VEREDITO (a):** **DESENHO** quanto ao dono (`page`/`user` são agenda legítima, frente selada) e
**BUG DE CORRIDA REAL** quanto ao confirm, hoje com **alcance 0 por ausência de dado**, não por trava.
Não sobe na fila por urgência de dado; sobe por ser **norma promulgada contrariada com guard
carimbando a contrariedade**. Consertar é barato agora (0 bookings) e caro depois.

---

### (b) 🔴 **NEM `service_offering` NEM `actor_asset` — a pergunta não tem resposta derivável, e a F-1 não é executável como está**

Três medições independentes, cada uma sozinha já bastaria para parar a F2.

**① `service_demand_responses` NÃO TEM COLUNA QUE DIGA O QUE ESTÁ SENDO OFERTADO.**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='service_demand_responses';
-- id · tenant_id · demand_id · provider_actor_id · status · quote_cents · message · created_at · updated_at
```
Nove colunas. **Nenhum `offering_id`, nenhum `asset_id`.** A resposta identifica **quem** responde,
nunca **com o quê**. Para gravar uma availability declarada o código teria de **escolher** um owner —
e escolher sem dado é **adivinhar o recurso**, exatamente o que a `0146 G10` proíbe por nome.

**② E não dá para derivar do outro lado: os dois vocabulários não se encontram.**
```sql
-- a demanda é chaveada por CONCEPT:
service_demands.concept_id → FK concepts(concept_id)         (service_demands_concept_id_fkey)
-- a oferta NÃO tem concept_id:
SELECT column_name FROM information_schema.columns WHERE table_name='service_offerings';
-- id · tenant_id · canonical_service_id · provider_actor_id · company_id · service_id · price_cents
-- · duration_minutes · professional_actor_id · modality · location · service_area · conditions
-- · status · created_at · updated_at · booking_approval_mode · accept_direct_same_city
-- · accept_direct_radius_km · audience_min · audience_max
```
E mesmo que houvesse ponte, **o provider típico tem mais de uma oferta ativa**:
```sql
SELECT n_ativas, count(*) FROM (SELECT provider_actor_id, count(*) FILTER (WHERE status='active') n_ativas
  FROM service_offerings GROUP BY 1) t GROUP BY 1;
-- 1 oferta: 3 providers · 2 ofertas: 1 · 3 ofertas: 2 · 4 ofertas: 1
```
**4 dos 7 providers têm 2+ ofertas ativas.** Não existe "a oferta do provider".

**③ 🔴 E O TIRO DE MISERICÓRDIA: declarar janela sobreposta HOJE dá 409. O plano afirma o oposto.**

`organizacaoevento.md §5 F-1` diz: *"Cinco orçamentos na mesma janela = cinco declarações
sobrepostas (0146 abençoa) e só um vira compromisso."* **Contra o código vivo, isso é falso.**

```ts
unified-availability.service.ts:93-100  (createAvailability, ANTES de escrever)
  const conflicts = await repository.findOverlapping(tenantId, ownerType, ownerId, start, end);
  if (conflicts.length > 0) throw new ConflictError('RENTAL_AVAILABILITY_OVERLAP: …');
unified-availability.service.ts:150-157 (updateAvailability revalida o mesmo)
unified-availability.repository.ts:189-192
  SELECT * FROM availability WHERE tenant_id=$1 AND owner_type=$2 AND owner_id=$3
    AND status='active' AND start_datetime < $5 AND end_datetime > $4
```
E os donos **já têm janela ativa exatamente na faixa em que um orçamento cairia**:
```sql
SELECT owner_type, owner_id, count(*) FILTER (WHERE status='active') ativas,
       min(start_datetime), max(end_datetime) FROM availability GROUP BY 1,2 ORDER BY 3 DESC;
-- 8 owners de service_offering com 6 janelas ativas cada, cobrindo 2026-08-12 → 2026-09-04
-- 5 owners com 2 janelas ativas, cobrindo 2026-08-16 → 2026-08-30
-- 4 actor_asset com 1 janela cada, cobrindo 2026-08-04 → 2026-09-03
SELECT count(*) FROM availability a JOIN availability b ON …sobreposição…;  -- []  (zero pares: a trava morde)
```

**Consequência dura: a F-1 não falha "às vezes". Ela falha no caso comum** — o fornecedor com agenda
publicada (que é o fornecedor que se quer no marketplace) **não consegue** gravar a declaração do
orçamento, porque ela colide com a própria janela dele.

> #### 🔴 ACHADO ① — `RENTAL_AVAILABILITY_OVERLAP` contraria a CONSTITUIÇÃO ~~e ninguém ratificou~~
>
> > ### ⚠️ ERRATA DA RODADA 2 — LEIA ANTES DO BLOCO ABAIXO
> > O título original dizia *"e ninguém ratificou"*. **Meio falso.** São **DOIS** mecanismos e eu
> > tratei como um. Detalhe completo em **§7.1**; o resumo que muda a leitura daqui:
> > · o **409 de aplicação** (`service.ts:93-100`, todos os owner_types) — **segue sem ratificação**,
> >   e é o que este bloco descreve corretamente;
> > · a **`EXCLUDE` de banco** `availability_rental_no_overlap` — **existe** (eu disse que não),
> >   **é ratificada** (GO de Clayton, cartório `:29494`, "TRAVA 3"), e cobre só
> >   `owner_type='rentable_resource'`, que hoje tem **0 linhas**.
> > **Os três greps abaixo continuam corretos** — eles procuram o código de erro, e a `EXCLUDE` tem
> > outro nome. Foi assim que ela escapou.
>
> **CONSTITUIÇÃO ARTIGO II:** *"2. Conflito nunca gera ação automática. 3. Conflito gera fato.
> 4. Fato gera alerta. 5. Alerta vai para o humano. **Proibição: Bloquear, resolver ou otimizar
> conflitos automaticamente.**"*
> **DECISION-0146 §A.1:** *"Overlap em availability **NÃO bloqueia**."* · **§A.7:** *"Hard-block na
> declaração colide com a régua (§A.1 / Art. II)."* · **G1:** *"availability overlap **NUNCA**
> hard-blocka."*
>
> Procurei ratificação e **não existe**:
> ```
> grep -n "RENTAL_AVAILABILITY_OVERLAP\|F-RENTAL-AVAILABILITY-OVERLAP" REMEDIATION_DT_LOG.md   → 0
> grep -rln "RENTAL_AVAILABILITY_OVERLAP" docs/                                                 → 0
> grep -rln "RENTAL_AVAILABILITY_OVERLAP\|findOverlapping" backend/scripts/                     → 0
> ```
> Zero no cartório, zero em decisão, **zero guard**.
>
> **De onde veio** (`git log -S`, commit `f43a78e2c`, 2026-07-08):
> > *"Clayton criou janela DENTRO de outra […]. O comentario 'trigger previne sobreposicao' era
> > FALSO […]. **Nao usei EXCLUDE constraint global** — check no chokepoint de escrita, seguro."*
>
> 📌 **A causa é a família que o `CLAUDE.md` nomeia: comentário que mente.** Alguém achou um
> comentário falso (*"trigger previne sobreposição"*) e, em vez de **apagar a mentira**, **construiu
> o que a mentira descrevia**. E contornou a proibição pela letra (`EXCLUDE` **global**) sem tratar a
> substância (**hard-block na declaração**), que é o que a norma proíbe.
> ⚠️ **Errata:** *"pela letra"* estava certo por acidente — meses depois a `EXCLUDE` foi criada
> mesmo, **parcial**, com GO. A letra que ele contornou (*global*) não é a que a norma escreve
> (*"PROIBIDO `EXCLUDE` constraint em `availability`"*, sem qualificativo). Ver **§7.1**.
>
> ⚖️ **Isto NÃO é acusação de má-fé, e a ressalva importa:** o commit nasceu de **fricção de uso do
> próprio Clayton** — ele criou uma janela dentro de outra e o sistema aceitou calado. O sinal de
> produto é legítimo. **A resposta da norma para esse sinal é `FATO → ALERTA → humano`, não `409`.**
> Só que **Art. II é constitucional** e ARTIGO XI exige **emenda explícita, pública e justificada**
> para mudar. Portanto: **decisão de Clayton, e só dele.** Enquanto não decidir, a F-1 está travada.

**VEREDITO (b):** **BLOQUEIA A F2**, e por motivo mais fundo do que "qual dos dois donos".
Há **três** saídas materialmente distintas (e §3 lista o que cada uma custa) — nenhuma é a do plano.

---

### (c) ✅ `quantity` / `quantity_filled` estão **VIVOS, COMPLETOS E ATÔMICOS** — a pergunta estava desatualizada

Não é substrato dormente. É motor implementado, com trava de corrida correta.

```sql
SELECT column_name, data_type, column_default FROM information_schema.columns
 WHERE table_name='service_demands' AND column_name LIKE 'quantity%';
-- quantity integer DEFAULT 1 NOT NULL · quantity_filled integer DEFAULT 0 NOT NULL
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='service_demands'::regclass;
-- chk_service_demands_filled_le_qty  CHECK (quantity_filled <= quantity)
-- service_demands_quantity_check     CHECK (quantity > 0)
-- service_demands_quantity_filled_check CHECK (quantity_filled >= 0)
-- chk_service_demands_status         CHECK (status IN ('open','filled','closed','cancelled'))
```
```ts
demand.repository.ts:244  fillSlot     — UPDATE … quantity_filled = quantity_filled + 1,
                                          status = CASE WHEN quantity_filled+1 >= quantity THEN 'filled' ELSE status END
                                          WHERE status='open' AND quantity_filled < quantity  RETURNING *
demand.repository.ts:260  releaseSlot  — GREATEST(quantity_filled-1, 0); status 'filled' → 'open'
demand.service.ts:147     respond (automatico) → fillSlot; se createResponse falha → releaseSlot (rollback da vaga)
demand.service.ts:187     choose  (com_analise) → fillSlot + updateResponseStatusIf(['pending']→'chosen');
                                                   se a transição falha → releaseSlot (vaga devolvida)
demand.service.ts:208     withdraw → updateResponseStatusIf(['pending','accepted','chosen']→'withdrawn')
                                     + releaseSlot UMA vez (sem double-release)
```

🔴 **`fillSlot` é UM ÚNICO `UPDATE` com o predicado da condição no `WHERE`.** Não há check-then-act,
não há TOCTOU. É o oposto estrutural do cap de grupos (`CLAUDE.md §4`), que é check-then-act em
código. **Registro isto com o cuidado de um achado: quem "consertar" isso vai piorar.**

**O que isto derruba no plano:**
- ❌ **`§7 D6a` (*"aceitar N respostas até encher `quantity`?"*) NÃO é decisão pendente — já está
  implementado e atômico.** Perguntar de novo é pedir a Clayton que redecida o que ele já decidiu.
- ✅ **`§7 D6b` (*"ao encher, as pendentes auto-rejeitam ou ficam?"*) É genuinamente aberta**, e a
  medição dá o estado atual: **ficam `pending` para sempre** — nada as toca. Quem tentar responder
  depois recebe `409 Demanda não está aberta (status=filled)` (`demand.service.ts:136`), mas quem já
  estava na fila **não é avisado de nada**. É a família *"porta de saída sem gatilho"*.
- ⚠️ **`§7 Q2/D6c` (independentes ou composto?) segue aberta** — e continua encostando em
  `0146 §B` (*"Futuro multi-recurso […] exige entidade própria de recurso/capacidade — NÃO inventar agora"*).

---

### (d) ✅ Quem lê `service_demands` — inventário fechado, e o motor está **ponta a ponta ligado**

```
grep -rn "service_demands" backend/src backend/scripts frontend/src backend/migrations | cut -d: -f1 | sort | uniq -c
  17  backend/migrations/20260707120000_service_demand_substrate.sql
  10  backend/src/modules/demands/demand.repository.ts        ← ÚNICO leitor/escritor de runtime
   4  backend/src/core/governance/governed-vocabularies.manifest.ts   (registro de vocabulário)
   3  backend/src/scripts/smoke-demand-orchestration.ts       (smoke)
   3  migrations/20260707140000_service_demands_break_minutes.sql
   3  migrations/20260707130000_service_demands_audience_refinement.sql
   1  backend/src/modules/composer/composer.service.ts        ← ⚠️ apenas COMENTÁRIO (:51), não é leitor
   1  backend/src/modules/rentals/rentable-resource.repository.ts ← ⚠️ apenas COMENTÁRIO (:235), não é leitor
   + 6 guards/migrations auxiliares
```
**Um só repositório toca as tabelas.** Os dois "leitores" que um grep ingênuo reportaria são
**comentários** — anotado aqui para a próxima instância não os contar.

**Backend:** `app.builder.ts:740-742`, `protectedScope`, prefixo `/demands`. **7 rotas, não 5**
(o plano §2.1 lista 5 e perde três):
`POST /demands` · `GET /demands/mine` · `GET /demands/opportunities` · **`GET /demands/concepts`** ·
`GET /demands/:id` · `POST /demands/:id/respond` · **`POST /demands/:id/responses/:rid/choose`** ·
**`POST /demands/:id/responses/:rid/withdraw`**.

**Frontend — as duas pontas estão ligadas de verdade** (o plano marcava isto como "confirmado por
grep, não por navegação"; segue sem navegação, mas agora com os call-sites, não só os imports):
```
frontend/src/api/demands.ts:66,71,76,81,86,92,98,104   → as 7 rotas + concepts
frontend/src/pages/OpportunitiesPage.tsx:63 listOpportunities · :64 listMyDemands
                                        :73 respondDemand · :81 getDemand
                                        :146 chooseResponse · :153 withdrawResponse
frontend/src/App.tsx:419  <Route path="oportunidades" element={<OpportunitiesPage />} />   ← rota REGISTRADA
frontend/src/components/demands/DemandPublishForm.tsx  (embutido em OpportunitiesPage e IntentComposer)
```

**Governança já existente** (a pergunta *"onde isso já existe?"* aplicada a guards):
`backend/scripts/audit-demand-orchestration-boundary.mjs` já vigia — Δbank=0, catraca 0113 1:1 com
as rotas, RLS FORCE + GUC nas 2 tabelas, vocabulário composto da fonte. **Não construa outro.**

**E as duas tabelas estão entre as poucas com isolamento real:**
```sql
SELECT relname, relrowsecurity rls, relforcerowsecurity force,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename=c.relname) policies FROM pg_class c …;
-- service_demands           rls=t force=t policies=1
-- service_demand_responses  rls=t force=t policies=1
-- actor_assets              rls=t force=t policies=1
-- availability              rls=f force=f policies=0   ← 🔴
-- bookings                  rls=f force=f policies=0   ← 🔴
-- service_offerings         rls=f force=f policies=0   ← 🔴
```
⚠️ **Não acione isto agora.** Vale a ordem já registrada no PLACAR — *contexto → role → RLS* — e o
app conecta como `postgres` (`bypassrls`), então ligar policy hoje não bloqueia nada e amanhã apaga
tudo em silêncio. **Fica NOMEADO, não tratado.**

```sql
SELECT (SELECT count(*) FROM service_demands), (SELECT count(*) FROM service_demand_responses);
-- 0 · 0
```
✅ **Confirmado: zero linhas.** *"Ninguém nunca atravessou"* é verdade sobre **DADO**. Sobre
**CÓDIGO** é falso: o motor está inteiro, auditado (o código cita *"fix Yala #4, #6, #9"*) e vigiado.

---

### (e) ✅ `POST /demands/:id/respond` **VALIDA** autoridade sobre `provider_actor_id` — e valida mais do que a pergunta pedia

**Três camadas, nesta ordem:**
```ts
demand.routes.ts:95   const actorId = requireContext(req, reply);        // 400 sem actionContext.actorId
demand.routes.ts:96   await assertRepresentsActor(req, reply, actorId);  // 401 sem user · 403 fail-closed
demand.routes.ts:11-18
   ok = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
   catch { ok = false }                                                  // fail-closed no erro
demand.routes.ts:98   demandService.respond(tenant, actorId, params.id, body)
                       ↑ providerActorId = o actor JÁ PROVADO. O body só carrega quoteCents/message.
demand.service.ts:132  await this.assertAudience(...)   // fora da plateia → 404, NÃO 403 (não vaza existência)
demand.service.ts:135  demanda própria → 400
demand.service.ts:136  status ≠ 'open' → 409
```
```sql
-- e o banco fecha a porta do duplo-registro:
CREATE UNIQUE INDEX uq_sd_responses_demand_provider ON service_demand_responses (demand_id, provider_actor_id);
FOREIGN KEY (provider_actor_id) REFERENCES actors(id);
```

📌 **O `provider_actor_id` nunca vem do corpo da requisição.** É o actor do contexto, provado por
`canRepresentActor` **antes** de o service ser chamado. O `404` para fora-da-plateia (não `403`) é o
mesmo padrão adotado no conserto de grupos secretos de 2026-08-05 — **coerente, não acidental**.

**VEREDITO (e):** ✅ **Está certo. Registrado como certo, de propósito** — para que a próxima
instância não "conserte" o que funciona.
⚠️ **Limite declarado:** verifiquei por **leitura de código**. Não subi servidor, não chamei rota,
não provei o 403/404 por HTTP.

---

## §2 · ACHADOS QUE O GATE NÃO FOI PEDIDO PARA PROCURAR (e que mudam o plano)

### ① 🔴 (acima, em (b)) `RENTAL_AVAILABILITY_OVERLAP` × ARTIGO II — sem ratificação, sem guard

### ② 🟠 SEGUNDA VERDADE TEMPORAL — `hasScheduleConflict` decide agenda **sem olhar a agenda**

> ### ⚠️ ERRATA DA RODADA 2 — a gravidade CAI, e o motivo importa mais que o achado
> Escrevi este bloco **sem procurar ratificação** — e ela existe. Cartório `:13083`, 2026-07-07:
> *"**Item 2 — AGENDA OCUPADA NO ACEITE (Clayton: "é o orquestrador")** […] Cobre `diaria`/`periodo`;
> `recorrente`/`efetivo` + **espelho na Agenda UNIVERSAL** (`createAvailability`, API mapeada) =
> **fase 2 nomeada**."* O TOCTOU também já está aceito e nomeado (`:13078`).
> **Segue sendo segunda verdade temporal — mas é CONTENÇÃO DECIDIDA com sucessor declarado**, não
> violação ignorada. 🔴→🟠, família `DT-CONTAINMENT-WITHOUT-DEADLINE` (sem prazo, sem dono).
> 📌 **A assimetria que me pegou:** para o ① eu procurei ratificação (3 greps); para o ② **não
> procurei** e afirmei igual. *Mesma cadeia, um elo verificado e o outro suposto, no mesmo documento.*
> Nome: `DT-DEMAND-AGENDA-MIRROR-PHASE2-WITHOUT-DEADLINE`.

```ts
demand.service.ts:142
  if (await demandRepository.hasScheduleConflict(tenantId, providerActorId, demand))
    throw new DemandError(409, 'Agenda em conflito: você já tem um compromisso aceito nessa janela');
demand.service.ts:183   // e de novo no choose
demand.repository.ts:149-169
  SELECT EXISTS (SELECT 1 FROM service_demand_responses r JOIN service_demands x ON x.id = r.demand_id
    WHERE r.provider_actor_id = $2 AND r.status IN ('accepted','chosen')
      AND daterange(...) && daterange(...) AND (…time overlap…))
```

**A query se chama "conflito de AGENDA" e não toca `availability` nem `bookings` uma única vez.**
Ela responde *"este provider tem outra RESPOSTA DE DEMANDA aceita nessa janela"*.

- **CONSTITUIÇÃO ARTIGO II.1:** *"A agenda (Unified Availability) é **a única** fonte de verdade
  sobre disponibilidade."*
- **`SSOT_REGISTRY §SSOT TEMPORAL`:** *"`unified_availability` é a fonte única de verdade para
  estado temporal."*

📌 **É `SUBSTRATO PARALELO`, não `SUBSTRATO SUBSTITUÍDO`** — a categoria que o PLACAR mais quer
vigiar, na variante pior: aqui não é *"função viva chamando o nome errado"*, é **função viva
respondendo a pergunta certa a partir do substrato errado**. Um provider com `booking` **confirmado**
em `availability` passa limpo por esta checagem; um provider com `accepted` numa demanda é barrado
mesmo com a agenda livre. **As duas verdades divergem e nenhuma sabe da outra.**

O próprio código admite metade disso (`demand.repository.ts:147-148`):
> *"Cobre `diaria`/`periodo` com horários; `recorrente`/`efetivo` = fase 2 (integração Agenda
> universal, **nomeada**)."*

E `hasScheduleConflict` **retorna `false` silenciosamente** para `recorrente`/`efetivo`
(`:150` → `if (vinculo !== 'diaria' && vinculo !== 'periodo' || !dateStart) return false`) —
`false` ali significa *"sem conflito"*, isto é, **afirma ausência quando não sabe**. É a regra
`Zero é uma afirmação; desconhecido é a verdade`, em vocabulário booleano.

**Por que isto é o achado mais importante do GATE:** o plano quer ligar orçamento a agenda. **Já
existe um elo, e ele liga no lugar errado.** Construir a declaração de availability por cima, sem
tratar isto, produz **TRÊS** autoridades temporais em vez de uma.

### ③ 🟡 `live_presence.status` **TEM CHECK** — o plano afirma que não tem

`organizacaoevento.md §2.5`: *"⚠️ `status` SEM CHECK — vocabulário sem trava."* · `§8`:
*"Pré-requisito quando ativarem: CHECK em `live_presence.status`."*
```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='live_presence'::regclass AND contype='c';
-- live_presence_status_check  CHECK (status = ANY (ARRAY['ONLINE','OFFLINE']))
```
**O CHECK existe.** O pré-requisito do §8 já está satisfeito.
⚠️ **Mas há um defeito real ali, e é outro:** `status`/lifecycle é **minúsculo** por
`07_NOMENCLATURA §4.11` e pela tabela de case do `CLAUDE.md §3.2`. `ONLINE`/`OFFLINE` está
**MAIÚSCULO**. Tabela vazia (0 linhas) ⇒ é o momento mais barato de convergir. **Fica NOMEADO.**

### ④ 🟡 `OpportunitiesPage` afirma "não há" quando está quebrado — a família fechada em 2026-08-05

```ts
frontend/src/pages/OpportunitiesPage.tsx:63  listOpportunities(onlyMatching).then(setOpps).catch(() => setOpps([]));
frontend/src/pages/OpportunitiesPage.tsx:64  listMyDemands().then(setMine).catch(() => setMine([]));
```
Erro de rede, 403, 500 — tudo vira **lista vazia**, indistinguível de *"não há oportunidades"*.
É `DT-CULTURAL-FEED-ASSERTS-EMPTY-WHEN-BROKEN` reencarnada na tela que o plano quer usar como
superfície do orçamento. **Não consertei — o GATE é read-only.** Nomeado.

### ⑤ 🟡 `availability.capacity` existe e **quase ninguém a respeita**

```sql
SELECT owner_type, capacity, count(*) FROM availability GROUP BY 1,2;
-- actor_asset capacity=1 (4) · page capacity=NULL (8) · service_offering capacity=NULL (58)
```
`confirmBookingWithResourceLock` (`repo:490-505`) usa capacidade — mas lê de
`actor_asset_rental_terms.quantity`, **não** de `availability.capacity`. O ramo `service_offering`
ignora capacidade por completo, e o terceiro ramo não tem trava nenhuma. **A coluna é aceita na
escrita (`routes:37,47,279`) e projetada na leitura, e nada a consome como limite.**
Relevante para `Q2`/`D6c` (*N compromissos independentes ou composto?*): **a casa da capacidade já
existe e está inerte.**

### ⑥ ⚪ `execution_fund_movements` / `execution_fund_rules` — o GO que espera Clayton
```sql
SELECT count(*) FROM execution_fund_movements;  -- 0
SELECT count(*) FROM execution_fund_rules;      -- 0
```
Confirmadas vazias. **Não toquei, não recomendo tocar neste GATE** — `CLAUDE.md §5`: deleção de
módulo pré-existente exige autorização explícita do dono, e estas duas **codificam desenho de
produto**. Apenas registro que a medição bate com o que o mandato dizia.

---

## §3 · O QUE ISTO FAZ COM AS FATIAS DO PLANO

| fatia | veredito do GATE |
|---|---|
| **F-ZERO** (3º ramo do confirm) | 🔴 **Sobe, mas com escopo maior:** não é "page, 8 agendas" — é **`user`, que é o DEFAULT** da única rota de agenda. E a correção não é só "pôr trava": é reconciliar `0146 G10`, que manda **PARAR**, com o código, que **passa**, e com o guard, que **carimba a passagem**. Alcance de dado hoje: **0 bookings**. |
| **F0** (este GATE) | ✅ entregue |
| **F1** (`valid_until` + `target_actor_id` + validade única + ciclo da declaração) | ⚠️ **As duas colunas seguem ausentes e a lacuna é real** (`L1`/`L2` confirmadas por `information_schema`). **Mas o "ciclo de vida da declaração" pressupõe a declaração**, que a (b) mostrou não ser executável. **Fatiar:** `valid_until` + `target_actor_id` + função única de validade **não dependem** da (b) e podem andar; o ciclo da declaração **depende** e não pode. |
| **F2** (aceite → compromisso) | ⛔ **TRAVADA.** Três bloqueios independentes: sem coluna que diga o que é ofertado (b①) · sem ponte concept↔oferta e provider com N ofertas (b②) · declaração sobreposta **rejeitada com 409** (b③). Nenhum é contornável por código sem decisão de produto. |
| **F3** (dashboard, 3 números) | ✅ Não bloqueada. Read-model puro sobre `service_demands`+`responses`, que estão vivos, isolados por RLS e com um único leitor. **`quote_cents` não é segundo ledger** — confirmo: é `bigint`, sufixo ausente por ser *"cents"* no nome da coluna, sem custódia, sem movimento. `SSOT_EXCLUSIVE_BANK_RULE` intacta. |
| **F4** (a tela) | ⚠️ Não bloqueada, mas **carrega o ④** (catch que afirma vazio) para dentro do fluxo do orçamento. |

### As três saídas para o (b) — e o que cada uma custa

> **Não estou escolhendo. Escolher é ato de Clayton.** Estou nomeando as três e o preço de cada uma,
> porque o plano assumiu uma quarta que não existe.

1. **A declaração não vira `availability`.** O orçamento aceito vira compromisso por outro caminho
   (ou por nenhum, no V1). **Custo:** o aceite não bloqueia agenda — mas hoje já não bloqueia, então
   nada regride. **Ganha:** F1/F3/F4 andam imediatamente. **Perde:** o ⑤ do plano (aceite → agenda)
   fica para depois. **É a única saída que não exige mexer em norma constitucional.**
2. **`service_demand_responses` ganha coluna dizendo o que é ofertado** (`offering_id` **ou**
   `asset_id`, exclusivos). **Custo:** migration + o fornecedor passa a **escolher** a oferta ao
   responder (mudança de UX real, não cosmética) + reabre `0146 §A.5` (`service_offering` é o owner
   temporal canônico) contra o asset-first. **Ganha:** owner derivável, lock existente reaproveitado
   sem inventar nada.
3. **`RENTAL_AVAILABILITY_OVERLAP` deixa de bloquear e vira FATO→ALERTA** (o que Art. II e
   `0146 §A.1` já mandam). **Custo:** 🔴 **emenda constitucional não é necessária para isto — o
   contrário é: hoje o CÓDIGO é que está fora da Constituição.** O custo real é de produto: volta a
   ser possível criar janela dentro de janela, que foi a fricção que Clayton apontou em 08/07. A
   resposta canônica é alertar, não recusar — **mas o alerta não existe** e teria de ser construído.

---

## §4 · ERROS DO `organizacaoevento.md` DERRUBADOS POR ESTE GATE

O §9 do plano pede que se assuma que sobrou pelo menos um erro da mesma família. **Sobraram cinco**,
e são todos o mesmo padrão: **mediu o substrato e não voltou para corrigir o desenho.**

| # | o plano afirma | medição |
|---|---|---|
| 1 | `§5 F-1`: *"cinco declarações sobrepostas (0146 abençoa)"* | 🔴 **FALSO no código vivo** — `createAvailability` recusa com 409 (`service.ts:93-100`). O plano leu a NORMA e não o CÓDIGO |
| 2 | `§7 D6a`: *"aceitar N respostas até encher `quantity`?"* como **decisão pendente** | 🔴 **Já implementado e atômico** (`fillSlot`, `repo:244`). Pedir a Clayton que decida isto é pedir que ele redecida |
| 3 | `§2.5`: *"`live_presence.status` SEM CHECK"* | 🔴 **FALSO** — `live_presence_status_check` existe (`ONLINE·OFFLINE`) |
| 4 | `§2.1`: lista **5 rotas** vivas | ⚠️ **São 7** — faltam `/demands/concepts`, `/choose`, `/withdraw`. E `/choose`+`/withdraw` são exatamente o "⑤ cliente aceita ou recusa" que o plano trata como a construir |
| 5 | O plano **não cita `DECISION-0164` nenhuma vez** | 🔴 É **a decisão que governa o motor inteiro** que ele está redesenhando — está em `governed-vocabularies.manifest.ts:104-131` (3 vocabulários), no cabeçalho dos 4 arquivos do módulo, no guard e no `app.builder`. **É a falha de "onde isso já existe?" mais cara do documento** |

E o `§10` (*"o que não está auditado"*) pode riscar duas linhas: o runner **rodou** (258 OK),
os typechecks **rodaram** (0/0), e `demand.routes.ts`+`service`+`repository` **foram lidos inteiros**.

---

## §5 · O QUE ESTE GATE **NÃO** MEDIU (denominador honesto)

- **Nenhuma corrida foi provocada.** O furo do 3º ramo é **leitura de código**, igual à YALA — com a
  diferença de que agora se sabe que **não há booking algum** em `page`/`user` para correr.
- **Servidor não subiu, rota não foi chamada.** O `403`/`404` de (e) é leitura, não HTTP.
- **Navegador não foi aberto.** *"O frontend alcança as duas pontas"* segue provado por **call-site**,
  não por navegação — melhor que grep de import, ainda não é uso.
- **`DECISION-0164` não foi lida no arquivo de decisão**, só através do código e do manifesto.
- **Não reverifiquei** a expiração preguiçosa de `group_invites` (`§2.4`) nem a descobribilidade
  175/175 — ambas seguem como medição de terceiros.
- **`ARQUITETURA/DOCS/00-fundamentos/checagens-obrigatorias.md`** (19 famílias) não foi varrido; os
  achados ②③④⑤ saíram do caminho do próprio GATE, não de campanha.
- **RLS:** contei as 6 tabelas do escopo. **Não** recontei as 239/128 do PLACAR.

---

## §6 · O QUE ESPERA DECISÃO DE CLAYTON

> Nada abaixo foi decidido por mim. `CLAUDE.md §5`: **não se autorize.**

1. 🔴 **`RENTAL_AVAILABILITY_OVERLAP` × ARTIGO II.** O código bloqueia a declaração; a Constituição e
   a `0146` mandam alertar. Nasceu de fricção de uso sua, sem cartório e sem guard. **Mantém o
   bloqueio (e então a norma precisa de emenda, ARTIGO XI) ou vira alerta (e o alerta precisa existir)?**
   **A F2 inteira depende desta resposta.**
2. 🔴 **`hasScheduleConflict` como segunda verdade temporal.** Converge para `availability` ou fica
   nomeado como contenção **com prazo e dono**? (`Contenção sem prazo é abandono com status code melhor`.)
3. 🔴 **A saída do (b):** 1, 2 ou 3 da tabela do §3.
4. 🟠 **`0146 G10`:** o terceiro ramo do confirm passa a **PARAR** (como a norma manda) ou ganha
   trava própria? São coisas diferentes e o guard atual carimba a terceira, que é *"passa calado"*.
5. 🟡 `§7` do plano: **Q1** (respondida aqui: DESENHO) · **Q2/D6c** · **D1·D2·D3·D4·D5** · **D6b** ·
   **D7**. **D6a sai da lista** — já implementado.
6. ⚪ `execution_fund_*` e RLS: sem mudança de estado neste GATE.

---

**FIM DO GATE.** Nenhuma linha de código, nenhuma migration, nenhuma escrita em banco.
`runner 258 OK · tsc BE 0 · tsc FE 0 · Δbank = 0`.

---
---

# §7 · RODADA 2 — a DECISION-0164 lida inteira, e a hipótese do 409 atacada

**Mesmo modo: GUARDIÃO, read-only.** Zero código, zero migration, zero escrita em banco.
`runner 258 COMMANDS OK · tsc BE 0 · tsc FE 0 · Δbank = 0` (remedidos nesta rodada).

## §7.1 · ERRATA — eu cometi a assinatura do §2.1 dentro do GATE que a denunciava

**Errei duas vezes, e a segunda ensina mais que a primeira.**

**Erro 1 — filtro mais estreito que a afirmação.** Na rodada 1 rodei
`SELECT … FROM pg_constraint WHERE conrelid='availability'::regclass AND contype='c'` e escrevi
sobre a ausência de `EXCLUDE`. **`contype='c'` responde "quais CHECKs existem", nunca "que
constraints existem".** Existe uma `EXCLUDE`, e ela é real:

```sql
SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='availability'::regclass;
-- availability_rental_no_overlap | x |
--   EXCLUDE USING gist (owner_id WITH =, tstzrange(start_datetime,end_datetime,'[)') WITH &&)
--   WHERE (owner_type = 'rentable_resource' AND status = 'active')
```

**Erro 2 — procurei pelo nome que EU uso, não pelo nome que ELE tem.** Afirmei *"zero ratificação"*
com três greps por `RENTAL_AVAILABILITY_OVERLAP`. Os três greps estão **corretos**; a conclusão,
não. O artefato se chama `availability_rental_no_overlap`, nasceu em
`backend/migrations/20260708200000_trava3_availability_overlap_quantity_hardening.sql` —
cabeçalho literal ***"GO Clayton 2026-07-08"*** — e tem entrada cartorial própria em
`REMEDIATION_DT_LOG:29494`, sob o nome **"TRAVA 3"**.

> **A regra que fica:** *procurar pelo nome que eu uso não prova ausência — prova que eu não conheço
> o nome que o artefato tem.* É `leia a QUERY, nunca o nome` virado do avesso: li o nome certo do
> artefato errado.

### O achado ① se parte em dois — e só uma metade sobrevive

| mecanismo | alcance | ratificado? | veredito |
|---|---|---|---|
| **409 de aplicação** `service.ts:93-100` → `findOverlapping` (`repo:181`) | **TODOS** os owner_types vivos (58+8+4) | ❌ **não** — os 3 greps seguem valendo | 🔴 **DE PÉ.** É esta metade que trava a F-1 |
| **`EXCLUDE` de banco** `availability_rental_no_overlap` | só `owner_type='rentable_resource'` = **0 linhas** | ✅ **sim** — GO + cartório + migration | 🟠 vira **reconciliação de norma**, não violação |

⚠️ **A `EXCLUDE` faz LITERALMENTE o que a `DECISION-0146 §A.7` proíbe por escrito** (*"PROIBIDO
`EXCLUDE` constraint em `availability`"*, sem qualificativo) — **com GO posterior de Clayton, e sem
a decisão ter sido emendada**. Não é clandestino: é **GO atropelando decisão promulgada**.
`ARTIGO XI` exige emenda explícita. **Reconciliar é ato de Clayton — e é barato agora**, porque a
trava não alcança nada.

### 🔴 E o erro escondia um achado melhor: a garantia de BANCO ficou para trás na mudança de substrato

```sql
SELECT owner_type, count(*) FROM availability GROUP BY 1;  -- service_offering 58 · page 8 · actor_asset 4
SELECT count(*) FROM availability WHERE owner_type='rentable_resource';  -- 0
SELECT count(*) FROM rentable_resources;                                 -- 0
SELECT extname FROM pg_extension;   -- btree_gist instalada
```

A migration da TRAVA 3 (`:20-23`) declara o escopo **de propósito**: *"Partial WHERE → não afeta os
outros owner_types (user/page/service_offering)"*. **Estava certa em 08/07**, quando
`rentable_resource` era o substrato vivo (o cabeçalho cita o "Silverado"). **Horas depois, no mesmo
dia**, `20260708420000_availability_owner_type_check_canonical.sql`
(F-ASSET-MULTI-OFFER-FOUNDATION 2b-4) admitiu `actor_asset` no CHECK, e o arco asset-first levou a
locação para lá.

**A trava não foi junto.** Hoje `actor_asset` (4 janelas, dado real) é protegido **só** por
check-then-act de aplicação, enquanto `rentable_resource` (zero linhas) tem `EXCLUDE` com
`btree_gist`. **Ninguém percebeu porque a constraint continua lá — e constraint que existe parece
proteção.**

→ **`DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION`**
📌 *Não é vocabulário morto por descuido: é trava CORRETA cujo substrato foi movido embaixo dela.*
**Procure os irmãos — toda migração de substrato pode ter deixado a sua.** Fatia própria; não abri
campanha aqui.

---

## §7.2 · O QUE A DECISION-0164 DECIDE — e o que ela derruba do `organizacaoevento.md`

**Status confirmado no CARTÓRIO, não no cabeçalho** (a armadilha 0191 do `CLAUDE.md`):
o header diz *"✅ RATIFICADA por Clayton 2026-07-07"* e o cartório **confirma e vai além** —
`:13019` **RE-SELO YALA CONCEDIDO**, auditoria adversarial de 2ª rodada, *"Clayton ratificou o SELA"*.
**Não é só ratificada: é SELADA com re-auditoria.** Duas ressalvas obrigatórias (#6 plateia como
controle de acesso; #4 double-release) foram corrigidas e reverificadas por mutação.

### 🔴 A cláusula que muda o RITO, não o conteúdo

Cartório `:13026`, no corpo do re-selo:
> *"Módulo `demands` está **FECHADO** — próxima reabertura **só por nova frente nomeada
> (F-SERVICE-DEMAND-\*), não patch solto**."*

O `organizacaoevento.md` redesenha esse módulo, **não cita a 0164 nenhuma vez**, e **não é frente
nomeada**. Isto não é crítica ao conteúdo dele — é porta: **antes de qualquer GO, o plano precisa
virar `F-SERVICE-DEMAND-<algo>`**, senão reabre por fora da porta que a própria YALA fechou.
→ **`DT-DEMAND-MODULE-SEALED-REOPENED-AS-LOOSE-PATCH`**

### As quatro coisas que a 0164 JÁ RESOLVEU e o plano trata como abertas

| `organizacaoevento.md` | `DECISION-0164` / cartório |
|---|---|
| §1 — orçamento como coisa **a construir** (*"o cartão se comporta como reserva"*) | **D2 + ADENDO 6** promulgam `pricing_mode: preco_ofertado \| orcamento`. O motor **já exige** `quoteCents` quando é `orcamento` (`demand.service.ts:137`), e o CHECK físico existe. **O modo orçamento não é novo — é vocabulário governado desde 07/07** |
| §5 — *"as declarações perdedoras não têm porta de saída"* (acréscimo da direção) | **ADENDO 3** já decidiu: cancelamento reabre a vaga **e** *"a janela na agenda do cancelante **LIBERA** (TEMPO consistente)"*. O ciclo de vida existe como decisão; falta material |
| §4 ⑧ — *"quem resolve quando dá errado: não tem caminho hoje, fica NOMEADO"* | **ADENDO 4** já nomeia com detalhe: no-show como **FATO** registrado pelo emissor, avaliação mútua, e a **régua do público** (só fatos agregados — nota, nº de serviços, taxa de cancelamento/no-show; **proibido** julgamento de caráter). Nomear de novo é perder a régua |
| §7 **D6b** — *"auto-reject com aviso"* como decisão de produto | **D3**: *"a re-orquestração (push) é **fatia C** (depende de central de notificações)"*. **A central não existe** (substrato notify é schema-ghost). **D6b não é decisão — é dependência bloqueada** |

### 🔴 E a 0164 aponta um trilho que nem o plano nem o meu GATE tinham visto

**ADENDO 6(c):** *"`orcamento` (providers cotam, emissor escolhe — **o trilho RFQ JÁ EXISTE no
substrato de eventos, compor dele**)"*
**ADENDO 7(c):** *"compõe com o trilho RFQ existente + **`service_offerings`** (a política de visita
pode morar na **oferta do provider** como default, sobrescrevível por cotação)"*

**O trilho existe, está REGISTRADO, está VIVO por feature flag — e está VAZIO:**
```
backend/src/modules/events/event-rfq.routes.ts                        → 10 rotas
                          event-rfq{,-matching,-opportunity}.service.ts
events.module.ts:29-34    if (isRFQEnabled()) register(eventRFQRoutes)
backend/.env              FEATURE_RFQ_ENABLED=true
event-rfq.service.ts:32   "RFQ vive em metadata do evento (event.metadata.rfqs)"
event-rfq.service.ts:33   "Propostas vivem em metadata do RFQ (rfq.quotes)"
event-rfq.service.ts:40   "quote é PROPOSTA — NÃO aceita quote, NÃO agenda booking"
```
```sql
SELECT count(*) eventos, count(*) FILTER (WHERE metadata ? 'rfqs') com_rfq FROM events;   -- 8 · 0
-- quotes dentro de metadata->'rfqs':                                                     -- 0
SELECT relname FROM pg_class WHERE relname LIKE '%rfq%' OR relname LIKE '%quote%';        -- []
```

🔴 **Existem DUAS casas de orçamento, ambas vazias, e o plano propõe uma TERCEIRA sem citar
nenhuma.** E a que a 0164 manda compor persiste em **`jsonb`** — exatamente o que a **própria D1 da
0164** rejeitou ao criar `service_demands` (*"matching consulta concept∩tempo∩quantidade — **jsonb
em posts não indexa**"*).

⚖️ **A norma se contradiz entre D1 e ADENDO 6(c)** — e a contradição não é minha para resolver.
Também não é livre de consequência: `event.metadata.rfqs` é **escopado a EVENTO**, e a demanda de
serviço não pressupõe evento. **Resolver é ato de Clayton.**
→ **`DT-TWO-EMPTY-QUOTE-ENGINES-NORM-CONTRADICTS-ITSELF`**

### ⚠️ Um ponteiro da própria 0164 que já envelheceu

**ADENDO 5(c):** *"a MESMA demanda serve pra RECURSOS […] substrato **`rentable_resource`** JÁ
EXISTE […] o motor é UM só, o que muda é o concept ser serviço-humano ou recurso-locável."*
`rentable_resources` tem **0 linhas**; o vivo é `actor_assets` (4). **A decisão aponta para o nome
que morreu** — mesmo par que a §7.1. A *intenção* (motor único, distinção por CONCEPT) segue de pé;
o *substrato citado*, não. **Fica registrado para quem for executar não seguir o ponteiro velho.**

---

## §7.3 · VEREDITO SOBRE A HIPÓTESE DA DIREÇÃO: **CAI**

> **A hipótese:** *se a declaração não vira availability e é o **ACEITE** que cria a janela
> (availability + booking + confirm na mesma transação), o segundo cliente bate no
> `RENTAL_AVAILABILITY_OVERLAP` e recebe **409 do banco** — garantia mais forte que o advisory lock,
> e resolve o terceiro ramo sem trava de quebra.*

**CAI**, por três medições independentes. Qualquer uma sozinha já bastaria.

### (a) Vale para todos os owner_type? — **Sim, o de aplicação; e é isso que a derruba**
`service.ts:93` **não está dentro de nenhum `if`** — `createAvailability` chama `findOverlapping`
sempre. A `EXCLUDE` de banco, essa, vale só para `rentable_resource` (0 linhas). Ou seja: **o que
alcança tudo não é do banco, e o que é do banco não alcança nada.**

### (b) Dispara em declarativa ou só em ativa? — **A pergunta pressupõe uma distinção que não existe**
```sql
-- chk_availability_status: CHECK (status IN ('active','paused'))     ← não há "declarativa"
SELECT availability_type, status, count(*) FROM availability GROUP BY 1,2;
-- fixed/active 62 · recurring/active 8
```
`availability_type` (`fixed`/`recurring`) é **forma de recorrência**, não grau de compromisso —
`DECISION-0146` chama de "declaração" **toda** linha de `availability`. E o predicado filtra
`status='active'` **nas linhas EXISTENTES**; o status da linha nova não entra. **Criar como `paused`
não escapa.**

### (c) A transação comporta as três escritas? — **NÃO. E não é deadlock, é forma**
```
repository.create              (:97)   — NÃO aceita trx; usa runQueryWithTenant (pool)
repository.createBooking       (:348)  — aceita trx ✅ (3º parâmetro opcional)
confirmBookingWithProviderLock (:414)
confirmBookingWithResourceLock (:473)  — abrem o PRÓPRIO client e dão BEGIN; não entram em tx externa
```
Duas das três não sabem participar de uma transação externa. E o modo de falha, se alguém tentasse,
**não seria 409**: o confirm roda em **outra conexão**, não enxerga a availability não-commitada →
`findAvailabilityById` → `null` → **`NotFoundError`**. *Falharia pelo motivo errado, com o erro
errado, num caminho de dinheiro futuro.* Não há **ordem** de aquisição que conserte isso — é
**forma**, não sequência.

### (d) Quem é o dono? — **A pergunta não some; piora**
No aceite não existe nem o pretexto de *"declaração do fornecedor"* para escolher o owner.
`service_demand_responses` segue com **9 colunas e nenhuma** dizendo o que é ofertado. A hipótese
**move** a pergunta (b) para um momento onde há **menos** informação, não mais.

### (e) 🔴 Contradiz a 0146? — **SIM, no eixo. E o banco já tem a prova pronta**

`DECISION-0146 §A.3`: *"Recurso de conflito (rollup) = **`provider_actor_id`**, NÃO `service_offering`
isolada. […] se já há booking confirmado 14h–18h numa oferta, **outra oferta do mesmo X não confirma
15h–17h**."*

`findOverlapping` agrupa por **`(owner_type, owner_id)` = por OFERTA**. Consequência, medida agora
no banco oficial:
```sql
SELECT o1.provider_actor_id, count(*) AS pares
  FROM availability a1 JOIN service_offerings o1 ON o1.id = a1.owner_id
  JOIN availability a2 ON a2.tenant_id = a1.tenant_id AND a2.owner_type='service_offering'
                       AND a2.availability_id > a1.availability_id
  JOIN service_offerings o2 ON o2.id = a2.owner_id
 WHERE a1.owner_type='service_offering' AND a1.status='active' AND a2.status='active'
   AND o1.provider_actor_id = o2.provider_actor_id AND a1.owner_id <> a2.owner_id
   AND a1.start_datetime < a2.end_datetime AND a1.end_datetime > a2.start_datetime
 GROUP BY 1;
-- c6747160… 18 · e40197e3… 18 · a952de20… 12        ⇒  48 pares
```
**48 pares de janelas sobrepostas do MESMO provider, em ofertas diferentes, ATIVAS no banco agora —
e o "409 do banco" nunca disparou em nenhum.** É precisamente o caso que a `§A.3` manda pegar.

### 🔴 E o golpe final: **não é garantia de banco. É check-then-act**

`findOverlapping` é um `SELECT` seguido de um `INSERT` — **sem constraint, sem trigger, sem lock**
para os owner_types vivos. O próprio commit que a criou admite: *"**Nao usei EXCLUDE constraint
global** — check no chokepoint de escrita"*. **É TOCTOU:** dois aceites simultâneos selecionam
*"sem conflito"* e **ambos inserem**.

> **Portanto a hipótese inverte a comparação que ela mesma faz.** O `pg_advisory_xact_lock` é
> serialização real dentro de uma transação; o 409 do overlap é leitura otimista fora de qualquer
> transação. **É estritamente MAIS FRACA — e mede o eixo errado.**

### 📌 Mas a hipótese pagou o que custou

Ela forçou a varredura completa de `pg_constraint` — e é daí que saíram **a `EXCLUDE` que eu tinha
negado**, o `DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION` e os **48 pares**. E os 48 pares
provam algo que reforça a fila: **`confirmBookingWithProviderLock` é a única coisa no sistema que
protege o eixo que a norma exige.** Isso torna o terceiro ramo *mais* urgente, não menos.

---

## §7.4 · A LISTA FINAL DE CLAYTON — já sem o que virou FATO

**Saíram da lista** (viraram fato medido, não decisão):
~~Q1 `page` é desenho?~~ → **é desenho selado** · ~~D6a aceitar N até encher?~~ → **implementado e
atômico** · ~~a hipótese do 409~~ → **CAI** · ~~D6b como decisão de produto~~ → **é dependência da
fatia C / central de notificações, que não existe** · ~~⑧ resolução de conflito "não tem caminho"~~ →
**ADENDO 4 já nomeia, com régua do público**.

| # | decisão | por que só você |
|---|---|---|
| **1** | 🔴 **O 409 de aplicação em `createAvailability`**: mantém como bloqueio, ou vira `FATO→ALERTA→humano` (Art. II / `0146 §A.1`)? Nasceu de fricção de uso **sua**; o alerta **não existe** e teria de ser construído | **Art. II é constitucional.** A F-1 inteira depende |
| **2** | 🔴 **Reconciliar a `EXCLUDE` (TRAVA 3) com a `0146 §A.7`**, que a proíbe por escrito. Seu GO veio depois da decisão e não a emendou | `ARTIGO XI` exige emenda explícita. **Barato agora** — a trava não alcança nada |
| **3** | 🔴 **`DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION`**: a garantia de banco fica em `rentable_resource` (0 linhas) ou acompanha o substrato vivo (`actor_asset`, 4)? E há irmãos a varrer? | migration = ato com GO |
| **4** | 🔴 **A contradição D1 × ADENDO 6(c) da própria 0164**: orçamento vive em tabela indexável (`service_demand_responses`) ou no `jsonb` do RFQ de evento? **Duas casas vazias; o plano quer uma terceira** | é norma sua contra norma sua |
| **5** | 🔴 **A saída do (b)** — `[1]` declaração não vira availability (única que não mexe em norma constitucional; F1/F3/F4 andam já) · `[2]` `service_demand_responses` ganha coluna do que é ofertado · `[3]` o overlap vira alerta. ⚠️ **ADENDO 7(c) já aponta `service_offerings`** — não é resposta completa, mas é direção sua já escrita | produto |
| **6** | 🟠 **`0146 G10`**: o terceiro ramo do confirm passa a **PARAR** (como a norma manda) ou ganha trava própria? O guard hoje carimba a terceira opção — *"passa calado"* | norma × código × guard |
| **7** | 🟠 **`DT-DEMAND-AGENDA-MIRROR-PHASE2-WITHOUT-DEADLINE`**: o espelho na Agenda universal está nomeado como fase 2 desde 07/07, **sem prazo e sem dono** | *contenção sem prazo é abandono com status code melhor* |
| **8** | 🟠 **`DT-DEMAND-MODULE-SEALED-REOPENED-AS-LOOSE-PATCH`**: o `organizacaoevento.md` vira `F-SERVICE-DEMAND-<algo>` antes do GO? | a YALA fechou a porta; reabrir é ato seu |
| **9** | 🟡 Do plano, seguem abertas e **só** estas: **Q2/D6c** (N aceites independentes ou composto — encosta em `0146 §B`, *"não inventar"*) · **D1** validade · **D2** vencido revive/morre · **D3** qual chave governa a visibilidade · **D4** dirigido = mesma entidade · **D5** modo × tipo · **D7** estado do orçamento quando o confirm falha | produto |
| **10** | ⚪ Sem mudança de estado: `execution_fund_*` (0/0) · RLS (ordem contexto→role→RLS) · `live_presence.status` MAIÚSCULO com tabela vazia · `OpportunitiesPage:63-64` `catch(()=>[])` | nomeados, não tratados |

---

## §7.5 · O QUE ESTA RODADA **NÃO** MEDIU

- **Continua sem corrida provocada, sem servidor, sem navegador.** Os 48 pares são **dado em
  repouso**, não uma race reproduzida.
- **Não abri as 10 rotas do RFQ uma a uma.** Medi registro (flag + `events.module.ts`), persistência
  (`event.metadata.rfqs`) e **dado (0)**. *"10 rotas vivas"* é registro, **não alcance provado** —
  a mesma distinção que derrubou 4 de 7 alegações do PLACAR em 30/07.
- **Não varri os irmãos** do `DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION`. Nomeei a família;
  não medi quantas outras travas ficaram para trás. **`?` é a resposta honesta, não `0`.**
- **Não li os packs citados pela 0164** (`ranking pack`, `READINESS_PORTA1`), nem a `DECISION-0132`
  (finalidade temporal), nem a `0151` (exclusividade por recurso) no arquivo — só pelo código.
- **Não reverifiquei** a 0164 contra `migrations_archive` — se `service_demands` teve forma anterior,
  não sei.
- **Nenhuma migalha `§6` deixada**: não toquei arquivo em trabalho real (GATE é read-only). Duas
  candidatas ficam **propostas para o GO, não escritas**: `unified-availability.service.ts:90-100`
  (a trava sem norma que a autorize) e `audit-booking-provider-conflict.mjs:51` — **esta segunda
  atribui à `0146 G10` uma regra que a G10 não diz**, e é da família *"comentário que mente"*, cuja
  correção o `CLAUDE.md §6` torna **obrigatória**. Não a corrigi porque o mandato desta rodada
  proíbe editar guard. **Fica nomeada para não se perder.**

---

**FIM DA RODADA 2.** Nenhuma linha de código, nenhuma migration, nenhuma escrita em banco.
`runner 258 OK · tsc BE 0 · tsc FE 0 · Δbank = 0`. GO segue com Clayton.

---
---

# §8 · GATE-PEQUENO + VARREDURA DIAGNÓSTICA + O CORPO DO GUARD

**GUARDIÃO, read-only.** Zero código, zero migration, zero escrita em banco, **nada movido**.
`runner 258 COMMANDS OK · tsc BE 0 · tsc FE 0 · Δbank = 0`.

## §8.1 · [A] GATE-PEQUENO — **SIM, o bloqueio do CONFIRM teria prevenido. E já prevenia.**

> **A pergunta:** *o que o bug de 08/07 (`f43a78e2c`) quebrou MATERIALMENTE, e o bloqueio do CONFIRM
> teria prevenido?*

### A datação, que responde sozinha

```
git log -S "confirmBookingWithResourceLock" -- backend/src/core/availability/unified-availability.repository.ts
  6359d31cc  2026-06-23  feat(rental): enforce resource booking conflicts
git log -S "RENTAL_RESOURCE_TIME_CONFLICT"
  6359d31cc  2026-06-23  ·  f891bff3b  2026-06-23  docs(rental): register resource conflict enforcement
git show f43a78e2c   ← o bloqueio de DECLARAÇÃO
  f43a78e2c  2026-07-08
```

🔴 **A trava do COMPROMISSO é 15 dias ANTERIOR ao bloqueio da DECLARAÇÃO.** Às 03:05 de 08/07,
quando Clayton criou a janela dentro da outra, a impossibilidade física — alugar o mesmo recurso
duas vezes na mesma janela — **já estava protegida**, e protegida **exatamente na camada que a
`0146 §A.7` prescreve**: no compromisso, com `pg_advisory_xact_lock` e checagem+gravação na mesma
transação (`repository.ts:473-525`).

### E janelas sobrepostas não abrem buraco nessa trava

```ts
repository.ts:496-502   (confirmBookingWithResourceLock)
  FROM bookings b2 JOIN availability a2 ON a2.availability_id = b2.availability_id
 WHERE a2.owner_type='actor_asset' AND a2.owner_id = $2          ← o RECURSO, não a janela
   AND b2.status IN ('confirmed','checked_in','checked_out')
   AND COALESCE(b2.booked_start_datetime, a2.start_datetime) < $5
   AND COALESCE(b2.booked_end_datetime,   a2.end_datetime)   > $4
```
O conflito é por **`owner_id` = o recurso, sobre TODAS as janelas dele**. Duas reservas penduradas
em duas janelas **sobrepostas** do mesmo recurso caem no **mesmo predicado**. A sobreposição das
declarações é irrelevante para a trava.
⚠️ *Prova por leitura de query. Não provoquei corrida.*

### 🔴 E as 6 provas do commit não falam do dano — falam do cheque novo

`f43a78e2c` lista: *janela CONTIDA · cruza início · cruza fim · fora · contígua · editar a própria*.
**Todas sobre criar JANELA. Nenhuma sobre booking, reserva ou aluguel duplo.** O commit prova que o
cheque novo funciona; **nunca mediu o que a ausência dele custou**. E o diff de frontend é **uma
mensagem de toast** (`RentalResourceListPage.tsx`, +10/-2 linhas).

### 🔴 O golpe: a migration do MESMO DIA mediu o dano — e ele era ZERO

`backend/migrations/20260708200000_trava3_…sql:5-8`, escrita horas depois:
> *"8 janelas `availability` de `rentable_resource` **ÓRFÃS** (`owner_id` não existe em
> `rentable_resources` — recursos fantasma criados por smokes 2026-07-07) violariam a EXCLUDE.
> **NÃO são dados reais** (recursos vivos como o Silverado **NÃO estão sobrepostos: overlap
> real=0**)."*

**A única sobreposição existente era lixo de smoke.** Os 2 bookings removidos por cascade estavam
pendurados em janelas de recursos **que não existiam** — não podiam ser aluguel duplo de nada.

### ⚠️ Limite honesto

As linhas foram **apagadas por aquela migration**. Não posso medir hoje o par exato criado às 03:05.
O que sustento é a **convergência de três medições independentes**: a trava do compromisso é
anterior · o commit não prova dano · a migration do mesmo dia mediu `overlap real = 0` entre recursos
vivos. **Não afirmo "dano zero"; afirmo "dano não demonstrado, e a cobertura anterior demonstrada".**

### ⚖️ VEREDITO

**O bloqueio de DECLARAÇÃO é desnecessário para a impossibilidade física, e está na camada errada.**
**Nenhuma emenda constitucional é necessária** — Artigo II e `0146 §A.1/§A.7/G1` se cumprem
**removendo** o bloqueio, não emendando a norma.

⚠️ **Resíduo que o confirm NÃO cobre, e que não é impossibilidade física:** duas janelas ativas
sobrepostas **confundem a projeção** — o dono e a descoberta veem a mesma capacidade duas vezes.
Isso é **read-model**, e a resposta canônica do Art. II é `FATO → ALERTA → humano`. **O alerta não
existe e teria de ser construído.** É a única parte que sobra para decidir.

---

## §8.2 · [B] VARREDURA DIAGNÓSTICA — mapa, nada movido

### O denominador honesto: o banco inteiro tem **DUAS** `EXCLUDE`, e as duas alcançam **ZERO** linhas

```sql
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype='x';
-- availability.availability_rental_no_overlap    WHERE owner_type='rentable_resource' AND status='active'
-- pdv_sessions.pdv_sessions_one_open_per_actor   WHERE status='open'
SELECT (SELECT count(*) FROM availability WHERE owner_type='rentable_resource' AND status='active'),
       (SELECT count(*) FROM pdv_sessions WHERE status='open');
-- 0 · 0
```

> ### 🧭 A BÚSSOLA REFINADA PELA MEDIÇÃO — *"alcança o vivo?"* não basta
> As duas alcançam zero, e **só uma é dívida**:
>
> | garantia | o que o `WHERE` prende | alcance 0 significa |
> |---|---|---|
> | `pdv_sessions_one_open_per_actor` | **ESTADO de ciclo de vida** (`open`) | *"não há caixa aberto AGORA"* — amanhã alcança. ✅ **sadia** |
> | `availability_rental_no_overlap` | **NOME de substrato** (`rentable_resource`) | o nome foi **aposentado** — alcance 0 **para sempre**. 🔴 **dívida** |
>
> **A pergunta que separa: o `WHERE` prende um ESTADO ou um NOME?** Estado volta; nome aposentado
> não volta. *(Registro isto porque, com a bússola só de alcance, eu teria classificado
> `pdv_sessions` como dívida — e "consertá-la" seria estragar uma garantia correta.)*

### 🔴 E a varredura achou uma garantia perdida que é **LOAD-BEARING**

```sql
rentable_resources (legado)      0 linhas
actor_assets (vivo)              4
actor_asset_rental_terms (vivo)  4
```
A maioria das regras **migrou** do legado para o vivo (`chk_aart_resource_type`, `chk_aart_mileage`,
`chk_aart_modality`, `chk_aart_pricing_unit`, `chk_aart_quantity`…). **Uma não migrou:**

```sql
-- SÓ em rentable_resources (0 linhas):
rentable_quantity_single_unless_equipment   CHECK (resource_type = 'equipment' OR quantity = 1)
-- em actor_asset_rental_terms (4 linhas, VIVO): sem equivalente.
--   chk_aart_quantity é apenas  CHECK (quantity >= 1)
```

**E é exatamente essa coluna que a trava de exclusividade lê:**
```ts
repository.ts:490  SELECT quantity FROM actor_asset_rental_terms WHERE asset_id = $1
repository.ts:491  const capacity = Math.max(1, Number(qRow.rows[0]?.quantity ?? 1));
repository.ts:505  if (overlap.n >= capacity) throw RENTAL_RESOURCE_TIME_CONFLICT
```

🔴 **Gravar `quantity = 10` num `resource_type = 'vehicle'` faz o confirm aceitar 10 reservas
confirmadas sobrepostas do MESMO CARRO.** Nada no banco impede a escrita. O dado vivo respeita a
regra **por sorte, não por trava**:
```
Tenda 10x10       equipment  quantity 10   ✅ legítimo
Gerador 180 kVA   equipment  quantity 10   ✅
Banheiro químico  equipment  quantity 10   ✅
Fiat Argo 2018    vehicle    quantity  1   ✅ — e NADA obriga
```

📌 **Isto reclassifica a DT.** Eu a nomeei como *"trava que não protege nada"* — soa decorativa.
**Não é:** a metade que ficou para trás é a que **sustenta a única trava de impossibilidade física
do sistema**. Sobe de 🔴 estrutural para **🔴 caminho de exclusividade**.

### O que foi varrido, e o que não foi

✅ **Exaustivo:** todas as `EXCLUDE` (2) · todo CHECK/EXCLUDE citando `owner_type`/`resource_type`/
`actor_type`/`entity_type`/`context_type` literal (18).
❌ **NÃO varrido:** triggers (apenas listados) · FKs · índices únicos parciais por `status`
(centenas — a maioria é o padrão legítimo *"um ativo por X"*, e separá-los exige a bússola
ESTADO×NOME aplicada um a um). **`?`, não `0`.**
⛔ **Nada movido.** O mandato é mapear; mover antes do [A] multiplicaria o erro.

---

## §8.3 · [C] O CORPO DO GUARD — ele morde no sentido **OPOSTO** ao da norma

**Lido, não deduzido pelo nome.** `backend/scripts/audit-rental-hardening-constraints.mjs`:

```js
:7-10  //   MORDE se:
       //     1. a migration de hardening sumir / perder a EXCLUDE (availability_rental_no_overlap);
       //     3. QUALQUER migration fizer DROP CONSTRAINT de uma delas.
:36    if (!/owner_type\s*=\s*'rentable_resource'[\s\S]{0,60}?status\s*=\s*'active'/i.test(sql))
         failures.push('EXCLUDE de overlap sem partial WHERE (owner_type=rentable_resource …)')
:59    '→ … o service protege ANTES, mas o banco é a última linha.'
```

**Três achados, em ordem de gravidade:**

**1. 🔴 O guard PINA a garantia no vocabulário morto — e BLOQUEIA ATIVAMENTE o conserto.**
A linha `:36` **exige** o `WHERE owner_type='rentable_resource'`. Quem mover a garantia para o
substrato vivo (`actor_asset`) — que é o conserto do `DT-DB-GUARANTEE-LEFT-BEHIND` — **faz o guard
FALHAR**. Não é um guard neutro que ficou desatualizado: **é um guard que reprova o conserto.**

**2. 🔴 Sentido invertido em relação à norma.**
`DECISION-0146 §B-bis G1`: *"availability overlap **NUNCA** hard-blocka […] **(NP: introduzir
EXCLUDE em availability → guard morde.)**"*
A norma quer um guard que morda ao **INTRODUZIR**. O guard vivo morde ao **REMOVER**.
**Norma e guard apontam para lados opostos sobre o mesmo objeto** — e o guard tem GO (2026-07-08),
enquanto a norma é anterior e **nunca foi emendada**.

**3. 🟠 É estático — não conecta ao banco.**
Prova que o **texto** da constraint existe na migration; **não** que ela protege alguma linha. Mesma
família do *"guard estático prova que a contenção está ESCRITA, não que DISPARA"*. Foi assim que ele
passou verde durante todo o período em que o alcance caiu para zero.

📌 **A mensagem `:59` é o desacordo escrito pelo próprio guard:** *"o service protege ANTES, mas o
banco é a última linha"* — declara a camada de **DECLARAÇÃO** como linha de defesa, quando a `§A.7`
diz que a constraint forte mora no **COMPROMISSO**. **Não é comentário mentiroso: é doutrina
concorrente, escrita em guard.** E guard é onde as pessoas vão ler a regra — por isso pesa mais que
código.

→ **`DT-GUARD-PINS-GUARANTEE-TO-DEAD-VOCABULARY-AND-BLOCKS-FIX`**

⚠️ **Retratação de terceiro, registrada porque é o padrão que interessa:** a direção afirmou
*"nenhum guard vigia isso"* com um `echo` incondicional **depois** de o grep ter devolvido o
arquivo — o comando não podia produzir aquela conclusão. **Mesma família dos meus dois erros da
rodada 2:** afirmação derivada de ferramenta cuja saída não a sustenta.

---

## §8.4 · [D] AS DUAS MIGALHAS — texto **PROPOSTO**, nada escrito

⛔ **Não escritas.** O mandato proíbe editar guard, e a ② descreve um estado que só se fixa **depois**
da decisão de camada — anotar antes seria carimbar uma leitura antes do GO.

**① `backend/scripts/audit-booking-provider-conflict.mjs`** — a mensagem `:51` atribui à `0146 G10`
uma regra que a G10 **não diz** (a G10 manda `STOP_DECISION_REQUIRED`, não *"fica fora do guard"*).
Isto é **"comentário que mente" em guard**, cuja correção o `CLAUDE.md §6` torna **obrigatória**.
```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/02_decisions/DECISION_0146_…md §A.3 (rollup por provider) · §B-bis G10
// ║ NÃO:     ler "fora do guard cross-oferta" como conformidade com G10 — a G10 manda PARAR
// ║ EM VEZ:  owner_type ≠ service_offering hoje CONFIRMA SEM TRAVA; ver GATE_F0 §1(a)
// ╚════════════════════════════════════════════════════════════════
```
E a mensagem de falha da `:51` deveria dizer *"owner_type≠service_offering está FORA da cobertura
deste guard — isso NÃO é conformidade com G10"*, em vez de citar a G10 como se a autorizasse.

**② `backend/scripts/audit-rental-hardening-constraints.mjs`**
```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — pina a EXCLUDE em rentable_resource (0 linhas desde o arco asset-first)
// ║ NORMA:   DECISION-0146 §A.7 / §B-bis G1 (constraint forte mora no COMPROMISSO)
// ║ NÃO:     tratar o verde deste guard como prova de que a locação está protegida no banco
// ║ EM VEZ:  a trava viva é confirmBookingWithResourceLock (repository.ts:473); ver GATE_F0 §8
// ╚════════════════════════════════════════════════════════════════
```

---

## §8.5 · O QUE ESTA RODADA **NÃO** MEDIU

- **Não reproduzi o dano de 08/07** — as linhas foram apagadas pela própria migration daquele dia.
  O veredito do [A] apoia-se em **três medições convergentes**, não numa reconstituição.
- **Continua sem corrida provocada, sem servidor, sem navegador.** *"O confirm cobre janelas
  sobrepostas"* é **leitura de query**.
- **Não varri triggers, FKs, nem os índices únicos parciais por `status`.** A bússola ESTADO×NOME
  existe agora; aplicá-la a centenas de índices é fatia própria.
- **Não medi se o `quantity` do vivo é escrevível por rota** — provei que **o banco** não impede
  `vehicle` + `quantity>1`; **não** provei que existe superfície HTTP que grave isso hoje.
  **Referência não é alcance** — a régua que este próprio GATE aplicou aos outros.
- **Não li** `DECISION-0151` no arquivo (só pelo código) nem o pack de locações.

---

**FIM DO §8.** Nada movido, nada editado em código ou guard.
`runner 258 OK · tsc BE 0 · tsc FE 0 · Δbank = 0`. GO segue com Clayton.

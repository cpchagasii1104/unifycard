# Cleiton.md — Propósito + Mapa de pendências da auditoria

## 🎯 PROPÓSITO (o norte — ler antes de tudo)

**O objetivo do Unificard é fazer o lucro voltar para a sociedade.**

Chegamos a um ponto da tecnologia em que não faz mais sentido a sociedade continuar enriquecendo
bilionários, grandes intermediários e plataformas que capturam valor de quem realmente produz,
consome, trabalha e movimenta a economia local. Não precisamos mais deles como antes — eles é que
precisam da gente.

Tudo que hoje funciona como intermediário — Uber, iFood, bancos, cartões, métodos de pagamento,
Mercado Livre, venda de shows, ingressos, eventos, prestação de serviços, locação de veículos,
locação de imóveis e qualquer outra intermediação — precisa ser repensado. O dinheiro que hoje sai
das regiões e vai para grandes empresas bilionárias deve voltar para a própria comunidade.

**Redistribuição por caminhos concretos** (o valor recapturado pode ser dividido entre):
- **Código de indicação** — parte volta para quem indicou;
- **Fundo regional** — parte fica na região onde o valor foi gerado;
- **Grupos de autogestão** — parte fortalece grupos vinculados ao sistema, integrados à rede social.

**Controle social:** cada usuário pode participar de até **3 grupos** e acompanhar, fiscalizar e
monitorar como os recursos são usados (sua torcida, uma instituição, uma comunidade local, qualquer
grupo organizado). O dinheiro deixa de ser capturado por intermediários distantes e passa a circular
de volta onde foi gerado — com transparência, participação e controle social.

> O Unificard não é só sistema financeiro nem só rede social. É **infraestrutura para devolver poder
> econômico às pessoas, às regiões e às comunidades.**

**Implicação para a auditoria:** cada pendência abaixo deve ser pesada contra este norte — "isto
ajuda o valor a voltar para a comunidade, ou deixa o sistema parecido com os intermediários que ele
quer substituir?". Alinhado a: Lei §12 (cooperativismo), Fundo Regional (SSOT Registry §5.9.2),
código de indicação (referral), rede social como autogestão (não atenção).

---

# Mapa de pendências da auditoria

> Mapa para a próxima instância resolver. Escopo auditado: cadastro → identidade → perfil → SSOT, fluxo PJ, Bank, rede social.
> Veredito: fundação correta. Itens abaixo são borda, acabamento, 1 bug de gate e a "última milha" (PJ + presença social).
> Severidade: 🔴 bloqueia operação real · 🟠 bug/risco vivo · 🟡 dívida governada · 🟢 cosmético.

---

## 🟠 ARCO DECISION-0113 — AUTHORITY BINDING (núcleo remediado · resíduo de leituras ABERTO · 2026-06-08)

> **⛔ CORREÇÃO 2026-06-08:** a versão anterior dizia "CONCLUÍDO nas superfícies vivas". A **verificação
> adversarial da Yala** verificou os 3 commits F6 ✅ mas achou **caso (d)** — leituras vivas cross-user que a
> fatia 6 deixou passar → o fechamento foi **RETRATADO**. O **núcleo de alta sensibilidade está remediado e
> verificado** (abaixo), mas há **resíduo amplo de leituras OPERACIONAIS** sem gate (`DT-OPERATIONAL-READ-
> ACTORID-UNVALIDATED`, OPEN): `feed/contextual`, `social-inbox` (IDOR), `commitments` (`/me/*` que a F6.3
> deixou passar), `contextual-thread`, `service-order`, eventos privados, + ~candidatos a classificar (F6.5.0).
> **A DT-mãe segue OPEN.**
>
> **Tese:** `actionContext.actorId` é um HINT declarado pelo cliente (spoofável), **não autoridade**. Toda
> operação sensível/keyed em actor prova autoridade server-side via `req.user` + `canRepresentActor`/
> `canManageCompany`/self. Núcleo executado em 9 commits (esteira: executora `unificard` escreve;
> Yala verifica READ-ONLY; Clayton serializa). HEAD `6c8be18c` · branch `rescue-structural` · dev 365.

| Fatia | Commit | O que fechou |
|---|---|---|
| F1 — RBAC bind `req.user` | `2d35c91a` | `rbac.plugin` chama `assertActorRepresentable` antes do lookup de role/permission; nasce o primitivo `canRepresentActor(tenantId, userId, actorId)` (permission-agnóstico, registry-independente) |
| F2 — escalation membros/org | `04b74909` | company-members + organization provam `canManageCompany`/`canRepresentActor` antes de mintar membership/`actor_delegations` (fim da "fábrica de crachá falso") |
| F3 — money LIVE (3 rotas) | `e6c369fe` | event-settlement/payment-method/unifycard-method: autoria server-side; Bank boundary intacta |
| F5.1 — plan + identity-config | `bc103e34` | viram **self** (sujeito = `req.user`, não o actor declarado) |
| F5.2 — profile-C1 | `9363670e` | professional/learning/interest: `resolveActorGuarded` deixou de ser existence-only → `canRepresentActor` antes de read/write (403 não-leak) |
| F5.3 — lifestyle / LGPD | `e85d9f8b` | `canRepresentActor` + `performedByActorId` server-side (sem fallback ao subject; sem performer → 403) + leitura private-by-autoridade; **DECISION-0071 intocada** |
| F6.1 — 5 reads financeiros | `77cd8a0f` | `social /ledger`+`/summary`, `identity /wallet/actor-statement`+`/wallet`+`/ledger`: `canRepresentActor` antes da leitura |
| F6.2/6.3 — config + `/me/*` | `da7f1377` | `/identity/configurations` GET → self; `/me/active-location`+`/impact-overview`+`/pending-responsibilities` → `canRepresentActor` |
| F6.4 — criação de grupo | `6c8be18c` | `POST /groups` → **self** (`req.user.userId`): fechou o spoof de **criar grupo em nome de outro** (`userId` spoofável alimentava identity_status E `createGroup`) |

- **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`** → **OPEN (fechamento RETRATADO 2026-06-08)** — Yala verificou os 3 commits F6 ✅ mas bloqueou o fechamento por achar o resíduo de leituras operacionais. Só fecha após F6.5.0 (classificação) + F6.5.x (gate dos privados-vazando) + selo Yala.
- **Resíduo novo:** `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` (OPEN) — leituras operacionais cross-user vivas sem gate; classe E latente (marketplace-money) confirmada em `DT-MONEY-LATENT-REACTIVATION-TRAP`. Ver `REMEDIATION_DT_LOG.md`.
- **⭐ 2º VETOR (Yala, 2026-06-08) — `DECISION-0113` é maior do que a campanha mirou:** além do `actionContext.actorId`, existe **header `x-actor-id`/`x-acting-actor-id`** e **query `actor_id`** via `resolveActiveActorFromRequest` (`actor.utils.ts`) — outro canal de spoof **intocado pela campanha**. Leak vivo: `GET /my-orders` via `x-actor-id:<vítima>` lista orders alheias. **Primitivo corrigido em `9996cbd2`** (canRepresentActor central; behavioral real 9/9) — **aguarda selo Yala + sweep dos 5 consumidores** (crm/my-orders/presence/subscriptions/venue). **Enquadramento canônico (Clayton):** DECISION-0113 = **qualquer `actorId` declarado pelo cliente** (5 canais: actionContext · x-actor-id · query actor_id · params actorId · params id de recurso privado). `DT-X-ACTOR-ID-RESOLVER-OWNERSHIP-UNVALIDATED` = PRIMITIVO FECHADO / SWEEP RESIDUAL.
- **Progresso F6.5.x (Yala selou):** 6.5.1 inbox/commitments · 6.5.2 ledger · 6.5.3 contextual-thread · 6.5.4 feed · 6.5.5 company-members · 6.5.6a service-order reads ✅. **Restam:** 6.5.6b events · 6.5.7 dashboard/reports · 6.5.8 availability/votes/notifications/services · 6.5.9 ERP/marketplace (re-auditar **por handler** — flag Yala: "Proxy-dead" não vale como bloco).
- **DTs-folha CLOSED:** `PLAN-PUT-PRIVILEGE-SPOOF`, `IDENTITY-CONFIG-ACTOR-SPOOF`, `PROFILE-C1-EXISTENCE-ONLY-RESOLVER`, `LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND`, `GROUPS-CREATE-ACTOR-SPOOF` (aberta+fechada na F6.4), `CROSS-USER-READ-ACTORID-UNVALIDATED`.
- **⚠️ Resíduo do arco (NÃO fechado):** **money LATENTE (fatia 4)** — services marketplace Proxy reject-all (inertes) carregam autoria spoofável; cobrança viva em `DT-MONEY-LATENT-REACTIVATION-TRAP` (OPEN). **Religar exige gate de autoria no mesmo corte.**
- **⚠️ Resíduos próprios fora do arco:** `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` (OPEN, entregue p/ aguardar selo) · `DT-PJ-EPHEMERAL-FIXTURES-STALE-VS-BASELINE-365` (ruído de teste, não regressão funcional).
- **Próxima raiz provável (CONGELADA até o 0113 fechar de verdade):** **R2 — Delegação / `actor_delegations`**. O **desenho R2 está correto** (`dividas.md` §2/§3): NÃO é greenfield — `actor_delegations` existe, com repo + writer parcial (company-members) + reader (`canRepresentActor`); o gap real é **semântico/normativo** (`relationship_type` sócio/diretor/procurador · cadeia §4.9.9 `granted_by`/`previous_link_id` · audit append-only · camada de risco). **MAS R2 NÃO está autorizado** — a premissa "0113 fechada" envelheceu (arco reaberto + 2º vetor). **Pré-condição correta:** fechar os **DOIS vetores** (actionContext.actorId **e** x-actor-id/actor_id) → concluir F6.5.x → **Yala selar `9996cbd2`** → **sweep dos consumidores do resolver** → fechar/enquadrar `DT-CANACTAS-CHECKOWNERSHIP-STALE` → **só então R2.0 read-only**. **Achados a somar ao desenho R2 (1ª mão):** (1) `actor-capabilities.service.ts:161` TAMBÉM lê `findActiveByUserActor` (2º reader — blast-radius); (2) `actor_delegations` **sem FK→`actors`/CHECK em `status`/audit append-only** — FK exige cuidado (94 atores legados `global_user_id IS NULL`). **Qualquer uso futuro do plano R2 revalida HEAD/migrations/DTs** (o relatório estava ancorado em `6c8be18c`; HEAD vivo ≈ `5205ecbb`). _Síntese: R2 é a próxima raiz provável depois do fechamento REAL da DECISION-0113; o plano é bom, mas está congelado até os dois vetores de spoof de actorId estarem fechados e selados._ R3 (grupo/Bank) e R4 (marketplace) **congelados**.

---

## CADASTRO / IDENTIDADE / PERFIL

| # | Severidade | Pendência | Onde | Status |
|---|---|---|---|---|
| 1 | 🟠 | Gate de gênero pode barrar não-binário/"prefiro não informar" de criar grupo (`identity_status` só aceitaria `male/female`) | `core/core.service.ts` (cálculo `identity_status`); gate em `modules/groups/groups.routes.ts` | **A VERIFICAR** — origem é doc desatualizado (item 5). ⚠️ NOTA (F6.4, `6c8be18c`): a **autoridade** do `POST /groups` foi trocada para self (`req.user.userId`), mas a **lógica de gênero/`identity_status` NÃO foi tocada** — esta pendência segue intacta para verificação própria. |
| 2 | 🟡 | `/register` aceita nome/nascimento/gênero como opcionais; UI os exige (borda frouxa, deixa entrar dado civil incompleto) | `core/auth/auth.routes.ts:17-19` | Apertar Zod; checar seeds/e2e antes |
| 3 | 🟡 | `profiles.cpf` ainda escrito como sombra (DECISION-0062 F4/F5 pendentes) | `core/auth/auth.service.ts` (INSERT profiles) | Convergência governada |
| 4 | 🟢 | Resíduo de blob (`preferences`/`physicalMetadata`) em metadata | `global_users.metadata`/`profiles.metadata` | DT consciente |
| 5 | 🟢 | Doc de auditoria descreve arquitetura antiga e se diz "pronto p/ produção" (origem do item 1) | `docs/02_decisions/AUDITORIA_CADASTRO_IMUTAVEL.md` | Arquivar ou atualizar |

## FLUXO PJ (criação de empresa)

Régua: `EMPRESA_NASCIMENTO_CANONICO.md` + `CRIACAO_DE_EMPRESAS.md`. Espinha (nascimento inerte + classificação) construída e correta — não mexer. Falta a "última milha" (inerte → operante/descoberto).

| # | Severidade | Pendência | Onde |
|---|---|---|---|
| PJ-1 | 🔴 | Ativação operacional não publica → empresa ativada fica invisível na descoberta | `companies.service.ts` `activateCompanyOperationally` não chama writer de `tenant_concept_offerings` (`company-publications.service.ts:77-103`) |
| PJ-2 | 🔴 | Trilho de serviços sem onboarding nem ligação com agenda (produtos têm wizard completo) | `services.service.ts:34-79` existe; falta fluxo guiado + availability. Comparar com `storeOnboardingService` |
| PJ-3 | 🟠 | Feed/oportunidade/matching ignoram empresas (user-scoped, opportunity mockado) | `core/opportunity/opportunity.service.ts:31-46`; `core/feed/feed.service.ts:29-99` |
| PJ-4 | 🟡 | Par `(primary_company_type_id, primary_concept_id)` sem CHECK no banco (só validação em código) | schema `companies` |
| PJ-5 | 🟡 | `company_status` segunda-verdade: 2 colunas (`status`+`company_status`), `DEFAULT 'ACTIVE'`, ghost `APPROVED`. Leitura já reconciliada (verdade = `fiscal_identities.kyb_status`, DECISION-0089) | migration `0065`; `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` OPEN |
| PJ-6 | 🟡 | `actor_type` CHECK permissivo (11 valores) | `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` |

**Dependência causal sugerida:** PJ-2 → PJ-1 → PJ-3 (sem trilho de serviços e sem publicação, descoberta não adianta).

**Já corrigido (não reabrir):** divergência de tipo de dinheiro produto/serviço (ambos `*_cents` desde migration `20260331150000`); `DomainSelector`/`businessType` drift (DECISION-0102/0098).

## BANK — sólido com a identidade criada? (passo 5)

Veredito: SÓLIDO no SSOT. Carteira lazy é escolha de timing a ratificar, não bug.

- ✅ `bank_accounts` ancora em `actor_id` (FK `actors(id)`); `global_user_id` NÃO é chave de dinheiro (§4.8.1 ok). Constraint `bank_accounts_actor_required_for_actor_owner` (migration `0056`) impede conta órfã. Read path `actor_id→conta` limpo (`identity.routes.ts:761-795`).
- 🟡 BANK-1 — Carteira lazy (não nasce junto). PF (registro) e PJ (criação) NÃO ganham `bank_accounts` na mesma transação do actor; conta criada no 1º uso financeiro. "Actor sem conta" é estado válido hoje (read retorna `actorWallet: null`, não quebra). Coerente com "nascer inerte" — **confirmar com Clayton se eager é desejado** (não é violação de §4.8.1).

## REDE SOCIAL — perfil criado conecta certo? (passo 6)

Veredito: actor-first correto, MAS presença social não nasce junto + mismatch de feed.

- ✅ `posts`/`follows`/`reactions` chaveiam por `actor_id`→`actors(id)` (migrations `20260530300000/310000/320000`). Page-actor PJ idem. Gate KYB social existe (`pj-kyb-gate.ts`, DECISION-0094).
- 🔴 SOCIAL-1 — Sem presença social ao nascer: criar actor (PF/PJ) NÃO cria `public_profiles`; actor pode postar mas não é descobrível até criação explícita (`public-profile.repository.ts:99` nunca chamado no registro/criação).
- 🟠 SOCIAL-2 — Mismatch actorId vs userId no feed: rota passa `actionContext.actorId` para serviço que espera `userId` (`feed.routes.ts:31` → `feed.service.ts:29`), sem ponte.
- 🟠 SOCIAL-3 — Gate KYB social incompleto na PJ: KYB gateia só publicação (`company-publications.service.ts:185`), não INSERT de post/follow/reaction.

## AGENDA UNIVERSAL (passo extra) — SÓLIDO ✅

- `unified_availability` é SSOT único para PF (`owner_type='user'`) E PJ (`owner_type='page'`) + service/event/group (`unified-availability.types.ts`). PJ NÃO cria calendário paralelo.
- Legado `schedules`/`schedule_slots` REVOGADO (migration `20260428200000`); writes antigos lançam `ScheduleLegacyError` (C63 fechado). `unified_calendar` = read-only. Services/events REFERENCIAM slots.
- 🟢 Resíduo: `event_sessions` tem colunas temporais (possível paralelo legado), mas booking roteia por unified_availability.

## DELEGAÇÃO DE AUTORIDADE NA PJ — PARTIAL 🔴 (o que falta para montar equipe)

Infra BUILT: `actor_delegations` (escopos JSONB), `canActAs` lê escopos, 62 permission keys granulares (`permission-keys.ts`), `canRepresentActor` (DECISION-0113). Gate de escalonamento em company-members exige `canManageCompany`.

- 🔴 AUTH-1 — Mapa role→escopo HARDCODED só p/ `admin`/`staff`/`contractor` (`getScopesForRole`; staff recebe só `publish_feed`+`create_events`). SEM papéis funcionais (financeiro/compras/estoque/operação/atendimento).
- 🔴 AUTH-2 — SEM endpoint para criar delegação com escopo customizado (owner não consegue dar `manage_financial`/`marketplace_manage_inventory` a uma pessoa).
- 🟠 AUTH-3 — Flags `company_users.can_manage_financial`/`can_manage_employees`/etc. gravadas mas NUNCA lidas na autorização (metadado morto; `canActAs` só lê `actor_delegations.scopes`).
- **Falta:** vocabulário de papéis funcionais + mapa papel→escopos canônicos + endpoint de delegação/override. Peças (permission keys) existem; falta fiação.

## MÓDULOS OPERACIONAIS (ERP/CRM/PDV/estoque/compras/serviços/marketplace/pagamentos/gestão) — acoplamento SÓLIDO ✅, com gaps

- ✅ Tudo chaveia `actor_id` (actor-first universal); `bank_ledger` é SSOT, nenhum módulo fora de `modules/bank/` o escreve (Lei §4.6 PASSA); `inventory_movements` append-only actor-keyed. SEM verdade paralela detectada.
- 🟠 MOD-1 — ERP (IRP) NÃO existe como módulo (só rastreio de impacto regional, stub).
- 🟠 MOD-2 — Pagamentos: PIX é MOCK por padrão (`pix.service.ts:32`, `PIX_PROVIDER=MOCK`); provider real pendente.
- 🟡 MOD-3 — Produtos/serviços ligam a concept via categoria (indireto; não viola, incompleto). Pedidos não impõem janela de `availability` ainda.

## AUTOGESTÃO / CIRCULAÇÃO ECONÔMICA — redistribuição REAL ✅, controle do grupo FALTA 🔴

- ✅ `bank-split-engine` divide CADA transação: referral 5% + grupos (0-100%, MÁX 3 imposto) + fundo regional (resto). Entradas reais em `bank_ledger`; testes confirmam (`bank-invariants.test.ts`). Fundo regional bank-backed (flag `USE_BANK_REGIONAL_FUND=true`). Referral paga 5% real ao indicador.
- ✅ Grupos: máx 3 imposto (`groups.service.ts:435`), ligados a conta bank, membros VEEM saldo/histórico (fiscalização-leitura), auto-post no recebimento.
- 🔴 AUTG-1 — Grupo é "cofrinho": recebe e mostra, mas SEM workflow de gasto/alocação/votação. Fundo regional tem governança (propostas/voto); grupos NÃO. Comunidade recebe mas não governa o uso.
- ⚠️ AUTG-2 — Social↔autogestão: transparência (read) existe; decisão (voto de gasto do grupo) não.

## SÍNTESE — 3 loops abertos que impedem "ponta a ponta"
1. **Operar** — PJ vender de fato (PJ-1/PJ-2): menos valor entra para redistribuir.
2. **Delegar** — montar equipe com autoridade real (AUTH-1/AUTH-2): PJ não escala além do dono.
3. **Decidir** — grupo controlar fundos / autogestão real (AUTG-1): comunidade recebe mas não governa.
O fluxo de valor voltar à comunidade ESTÁ VIVO (splits disparam); os 3 loops são fiação final, não realidade paralela.

Observações para resolver

> Registro de observações levantadas em auditoria conversacional (modo leitura) da espinha
> **cadastro → identidade → perfil → SSOT**. Escopo examinado: fluxo de registro, âncora de CPF,
> abas do perfil PF e sua persistência. NÃO examinado nesta passada: resolução de authority em
> runtime, ledger financeiro, matching. Veredito geral: fundação correta; itens abaixo são
> borda/acabamento/um bug de gate — não quebra estrutural.

## 🟠 1. Gate de gênero pode excluir pessoas reais de capability — A VERIFICAR
- **O quê:** `identity_status = COMPLETE` (doc de auditoria) só conta gênero válido se for
  `'male'|'female'`, mas o cadastro oferece 5 valores (`male/female/non_binary/other/prefer_not_to_say`).
  Se a regra ainda for essa no runtime, quem escolhe "não-binário" ou "prefiro não informar" fica
  `INCOMPLETE` para sempre e é **barrado de criar grupo** (gate exige COMPLETE).
- **Onde verificar:** `backend/src/core/core.service.ts` (cálculo de `identity_status`); gate em
  `backend/src/modules/groups/groups.routes.ts`.
- **Status:** NÃO confirmado materialmente — origem é o doc desatualizado (item 5). Primeiro passo:
  ler o cálculo real no `core.service.ts` para saber se é bug vivo ou já corrigido.
- **Por que importa:** colide com visão cooperativista (Lei §12) e com a tese de ambiente adaptativo
  (não filtro). Se vivo, é correção de comportamento, não cosmética.

## 🟡 2. Borda de validação frouxa no /register (frontend exige, backend não)
- **O quê:** o schema Zod de `POST /auth/register` marca `fullName`, `birthdate`, `gender` como
  `.optional()`, enquanto a UI (`Register.tsx`) os exige. O backend deixaria entrar cadastro civil
  incompleto.
- **Onde:** `backend/src/core/auth/auth.routes.ts:17-19`.
- **Risco da correção:** apertar o schema pode quebrar seeds/e2e que registram usuário mínimo
  (só email/password/cpf) — verificar `bootstrap-dev-canonical.ts` e `validate-pipeline-e2e-*`.
  O downstream (`auth.service.register`) já tolera ausência, então a lógica não é tocada.
- **Natureza normativa:** tornar campo obrigatório ratifica decisão de produto (são dados civis
  obrigatórios no cadastro?) — decisão de Clayton, parece ratificação do que UI+doc já expressam.

## 🟡 3. Convergência da DECISION-0062 (CPF SSOT) inacabada
- **O quê:** `profiles.cpf` ainda é escrito como sombra no registro; F4 (migrar leitura do CORE) e
  F5 (deprecar caches) pendentes.
- **Onde:** `backend/src/core/auth/auth.service.ts` (INSERT em `profiles`); ver memória
  `project_frente_decision_0062_cpf_ssot`.
- **Natureza:** governado, com critério de convergência — norma assintótica, não drift acidental.

## 🟢 4. Resíduo de blob legado
- **O quê:** `preferences` e `physicalMetadata` ainda vivem em `global_users.metadata`/`profiles.metadata`.
- **Status:** DT consciente; NÃO é SSOT semântico paralelo (learning/interest/lifestyle já saíram do
  blob via migrations `...160000`/`...180000`). Aceitável; não compromete contexto-first.

## 🟢 5. Doc de auditoria desatualizado induz erro
- **O quê:** `docs/02_decisions/AUDITORIA_CADASTRO_IMUTAVEL.md` (2025-01-02) descreve arquitetura
  anterior (tabelas `user_profiles`/`migration 111`, enum de gênero `'male'|'female'` apenas) e se
  declara "✅ PRONTO PARA PRODUÇÃO" — mas o código real usa `global_users`/`profiles`/`identities` e
  enum de 5 valores, com Zod opcional (item 2).
- **Por que importa:** é a norma/doc mentindo sobre o código — risco de induzir o próximo agente ao
  erro (origem do item 1, que herdei deste doc).
- **Resolução provável:** marcar como SUPERADO/ARQUIVADO ou atualizar para o estado real.


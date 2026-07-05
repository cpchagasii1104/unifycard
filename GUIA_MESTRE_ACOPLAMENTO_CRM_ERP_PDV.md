# GUIA MESTRE — ACOPLAMENTO CRM · ERP · PDV (a espinha que unifica tudo)

> **Status:** 🧭 GUIA VIVO — âncora de memória da executora (contexto apertado). Toda sessão que
> continuar esta missão LÊ ISTO PRIMEIRO. **Read-first obrigatório antes de qualquer código.**
> HEAD de referência: `bb909e208` (branch `rescue-structural`), 2026-07-04.

---

## 0. A MISSÃO (Clayton, 2026-07-04)

Fazer **CRM, ERP e PDV funcionando, ACOPLADOS** a tudo que construímos em meses — marketplace,
locações, serviços, eventos, social, agenda, bank. Não é "mais três módulos": é **acoplar o que já
existe** sob o mesmo substrato. Permissões concedidas **através das conexões**. **Seguro** (autoridade
blindada). Norte: **facilitar a vida das pessoas** + **dinheiro voltando às regiões**.

---

## 1. AS LEIS QUE NÃO SE NEGOCIAM (a bússola)

1. **Zero fonte de verdade paralela** (Lei Coerência §2/§5). Antes de criar QUALQUER tabela, procurar
   o que já existe. Se existe, ACOPLAR/PROJETAR; nunca duplicar.
2. **Zero dívida técnica nova.** Cada fatia com guard + E2E adversarial + negative-proof. Cartório
   (`REMEDIATION_DT_LOG.md`) atualizado.
3. **Relação ≠ autoridade.** Conexão social NUNCA concede poder. Poder = `company_users` +
   `canManageCompany` + mapa canônico (DECISION-0113/0125), sempre revalidado server-side.
4. **Nomenclatura canônica** (`07_NOMENCLATURA_CANONICA`): tabelas snake_case plural; `_at`
   timestamps; `<entidade>_id` FKs; **vocabulário de tipo = CHECK constraint**, NÃO tabela nova nem
   `concepts` (concepts = semântica de produto/serviço, não tipo social). Dinheiro só no Bank (§4.6).
5. **Ordem de composição** (§7): CONCEPT → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → DINHEIRO → EVENTO.
6. **Frontend nunca cria verdade** — projeta; ações roteiam pros fluxos vivos.
7. **Disciplina:** "a grandeza da visão é razão para MAIS disciplina" — uma fatia por vez, substrato
   antes de superfície, GO de Clayton antes de construir.

---

## 2. O QUE JÁ EXISTE (substrato vivo — ACOPLAR, não recriar)

| Domínio | SSOT vivo | Nota de acoplamento |
|---|---|---|
| Identidade | `actors` (writer único, §4.8) | tudo pendura em actor |
| Autoridade | `canRepresentActor` + `company_users` + `canManageCompany` + delegação (escopo FULL only) | catraca blindada nesta sessão |
| Dinheiro | `bank_ledger`/`bank_*` (RLS-live) | PORTA-1 fechada; contido por ledger vazio |
| Tempo | `unified_availability` | agenda universal |
| Catálogo/semântica | `concepts` + `canonical_*` | vocabulário de produto/serviço |
| Estoque | `inventory_movements` | SSOT físico (o "E" do ERP) |
| Produto/oferta | marketplace + `product_offers` | LIVE |
| Serviços | services + offerings | LIVE |
| Locações | rental resource (F-RENTAL-*, 2026-07-03) | LIVE |
| Social | `follows` (seguir assimétrico) + posts | LIVE |
| Vitrine/descoberta | `public_profiles` (cross-tenant opt-in) + cartão | LIVE (esta sessão) |
| **Fornecedor** | **`suppliers` VIVO** (repo/rotas/service) | ⚠️ registro DIGITADO (nome/tax_id), NÃO actor — modelo FRAGMENTADO antigo |
| B2B | `b2b_supply_orders`/`b2b_order_items`/b2b payment intents | maioria ghost (live=0), mas nomeado |
| CRM `contacts` | ⚫ FANTASMA (`DT-CRM-CONTACTS-PARALLEL-IDENTITY-RISK`) | identidade paralela — candidato a matar |
| PDV | `pdv_sessions` + módulo completo (service/repo/routes/firewall) | 🟢 VIVO, money-gated |

**RAIO-X PARCIAL CRM/ERP/PDV (varredura 2026-07-04 — INCOMPLETO, falta raio-x dedicado):**
- **PDV** 🟢 VIVO (`pdv_sessions`, módulo completo).
- **ERP inventário** 🟢 VIVO+wired (`inventory_movements/balances/reservations/lots`).
- **ERP `purchase_orders`** 🟢 VIVO+wired (2 arquivos runtime).
- **ERP `b2b_orders`** 🟡 VIVO mas MORTO (tabela live, zero runtime — reativar exige frente própria).
- **CRM** (`contacts`/`crm_notes`/`crm_tags`/`crm_consents`/`crm_contact_tags`) ⚫ FANTASMA (só
  `migrations_archive`; código referencia, tabela ausente = `DT-CRM-CONTACTS-PARALLEL-IDENTITY-RISK`).
- **`suppliers`** 🟢 VIVO (modelo fragmentado: nome/tax_id digitado, não actor).
- **⚠️ PRÓXIMA AÇÃO OBRIGATÓRIA:** RAIO-X DEDICADO (read-first arquivo-por-arquivo, contexto fresco)
  produzindo o MAPA DE ACOPLAMENTO antes de qualquer código. Não fingir que já se sabe.

**Guards de autoridade ativos** (não quebrar): `audit-actor-authority-boundary`,
`measure-handler-authority-gap` (GATE baseline-ratchet), `audit-actor-impersonation-writes`,
`audit-event-lifecycle-authority`, `audit-company-activation-kyc-gate`,
`audit-delegation-scope-containment`, `audit-public-profile-discovery-contract`. Rodar sempre
`npm run validate:regression-guards`.

---

## 2B. RAIO-X PROFUNDO CRM/ERP/PDV (2026-07-04, verificado arquivo/schema) — BASE DA EXECUÇÃO

### PDV 🟢 VIVO e coerente (o mais pronto)
- `pdv_sessions` **actor-anchored** (`actor_id` NOT NULL; UNIQUE 1 sessão OPEN por actor via EXCLUDE);
  status OPEN/CLOSED; module completo (`src/modules/pdv/`: service/repo/routes/**firewall**/types).
- Rotas: abrir/fechar sessão · criar pedido do PDV · add item por variante/peso · **pagar** (money-gated
  pelo firewall). Consome catálogo + inventário + Bank.
- **Acoplamento:** PDV = a superfície **Operar** de venda da página do actor (bloco "PDV/Vender" no
  modo Operando). Já é actor-first → acopla direto, sem reescrever.

### ERP 🟢 PARCIALMENTE VIVO (base real, ancorada no modelo fragmentado)
- **Inventário** VIVO+wired: `inventory_movements` (SSOT físico) + `balances/lots/reservations`.
- **`purchase_orders`** VIVO+wired: `supplier_id`→**`suppliers`** (FK dura), `created_by_actor_id`→actors,
  status DRAFT. Runtime: `purchase-order.service`, `accounts-payable.service`, `inventory-movement.repo`,
  `marketplace.routes`. É um fluxo de compra REAL (PO→recebimento→inventário→a-pagar).
- **`b2b_orders`** 🟡 VIVO mas MORTO (tabela existe, zero runtime).
- **Acoplamento:** ERP = **composição** (inventário + purchase_orders + accounts-payable + agenda +
  bank) projetada no modo **Operar** da página. **PROBLEMA:** o PO ancora em `suppliers` (fragmentado,
  não actor) — a reconciliação (§4) precisa dar ao `suppliers` uma **ponte para actor** SEM quebrar o
  fluxo vivo (FK `purchase_orders.supplier_id` não pode sumir).

### CRM ⚫ FANTASMA + fragmentado (a maior dívida a curar)
- `contacts` (archive/ghost): `name, tax_id (CPF/CNPJ), email, phone, user_id (SEM FK)` = **identidade
  PARALELA** (a `DT-CRM-CONTACTS-PARALLEL-IDENTITY-RISK`, mesma classe do `suppliers`).
- **DOIS caminhos de código** referenciam o ghost: `src/modules/crm/` (crm.repo/routes) E
  `src/modules/marketplace/contact.*` (contact-feature.guard/repo/service/routes) — ambos contidos
  (feature guard schema-ghost).
- **Acoplamento:** CRM = a **aresta de relação tipada projetada** ("meus clientes/fornecedores/
  colaboradores"). Ela **absorve** o ghost `contacts` e **reconcilia** `suppliers`. Um dado, N vistas.

### A CRUX DA RECONCILIAÇÃO (agora com fatos)
Hoje `suppliers` (fragmentado) é âncora de CRM E do ERP (purchase_orders FK). A visão quer a **aresta
actor↔actor** como CRM único. Custo real da unificação (Opção B, recomendada):
- adicionar `suppliers.actor_id` (nullable): quando o fornecedor É actor na plataforma, liga; a aresta
  de relação (tipo=fornecedor) referencia; quando é off-platform, `suppliers` vira **actor leve**
  (não-usuário) OU permanece registro externo com a aresta apontando pra ele;
- `purchase_orders.supplier_id` **continua vivo** (não quebra); ganha resolução via actor quando houver;
- `contacts` ghost **morre** (código migra pra ler a aresta) — fecha a DT.
Isto é migração + wiring cuidadoso, NÃO rip-replace. Guard + E2E provando que o fluxo vivo (PO→
inventário→a-pagar) não regride.

## 3. A TESE DE ACOPLAMENTO (como CRM/ERP/PDV se encaixam SEM módulo novo)

**CRM, ERP e PDV NÃO são módulos novos — são COMPOSIÇÕES/PROJEÇÕES do substrato** (DECISION-0159
"ERP Social = composição"; segmentos.md "um substrato, N verticais"):

- **CRM = a aresta de relação tipada** (`actor_relationships`, a construir) projetada por tipo:
  "meus clientes/fornecedores/colaboradores". Um dado (a aresta) → N vistas. **Mata o `contacts`
  fantasma** e reconcilia `suppliers`.
- **ERP = composição do que já é SSOT:** estoque (`inventory_movements`) + pedidos + agenda
  (`unified_availability`) + financeiro (`bank_ledger`) + a relação (fornecedor/cliente). "ERP" é a
  VISTA integrada dessas verdades pela ótica de uma empresa (actor page), não uma base nova.
- **PDV = a superfície de venda** (`pdv.service` já vivo) que consome catálogo + estoque + bank; a
  venda cria a relação cliente e alimenta o CRM. Já existe; falta acoplar ao resto.
- **Marketplace/Locações/Serviços/Eventos** já são composições vivas — acoplam via **página do actor**
  (blocos) + relação + agenda + ledger.

**O fio que costura tudo = a PÁGINA DO ACTOR (casca + blocos) + a RELAÇÃO TIPADA (social+CRM+B2B).**
Ver `DESENHO_PAGINA_DO_ACTOR.md` (SELADO) e `SPEC_FATIA1_RELACAO_TIPADA.md`.

---

## 4. ✅ DECISÃO TOMADA (Clayton 2026-07-04): OPÇÃO B RATIFICADA — reconciliação do CRM

`suppliers` (VIVO, registro digitado) vs a futura aresta de relação (actor↔actor) = risco de **fonte
paralela** para "meus fornecedores". Três caminhos (ver detalhe em `SPEC_FATIA1_RELACAO_TIPADA.md`):
- **(A)** fronteira: relação=on-platform (actor↔actor); `suppliers`=off-platform. Partição, sem overlap.
- **(B)** unificação actor-first: aresta = o CRM; fornecedor off-platform vira actor leve; `suppliers`
  converge; **mata `contacts` fantasma**. Mais ambicioso, coerência total (a tese "unifica").
- **(C)** reconciliar `suppliers`/`contacts` ANTES de construir a aresta.

**✅ Clayton confirmou a OPÇÃO B (2026-07-04, pós-compactação, via AskUserQuestion):** aresta = CRM
único; `suppliers.actor_id` ponte nullable SEM quebrar `purchase_orders.supplier_id`; `contacts`
ghost morre na Fatia 7 (fecha a DT). Migração + wiring cuidadoso, não rip-replace.

**✅ FATIA 1 EXECUTADA E FECHADA (2026-07-04):** migration `20260704120000_actor_relationships_typed_edge.sql`
(aresta + vocabulário CHECK seed §7 + UNIQUE par não-ordenado + RLS FORCE + ponte suppliers.actor_id) ·
módulo `src/modules/relationships/` (rotas `/relationships` · `/:id/respond` · `/mine`, canRepresentActor
no envio E aceite) · guard `audit-actor-relationship-boundary.mjs` (20 checks, na suite, negative-proof
mordeu) · E2E adversarial 12/12 PASS efêmero (aceite de colaborador NÃO cria company_users; Δbank=0) ·
regression-guards VERDE · cartório atualizado.

**✅ FATIA 2 EXECUTADA E FECHADA (2026-07-04, GO "execute o próximo passo"):** a PONTE colaborador→
autoridade — `POST /relationships/:id/grant-membership` (`actor-relationship-membership-bridge.routes.ts`,
arquivo separado, módulo da aresta segue puro). Precondições server-side: aresta accepted + um lado
empresa/um lado PF + ótica da EMPRESA = colaborador (bidirecional converge) + **canManageCompany
INLINE fail-closed** (funcionário nunca se auto-concede) → roteia `companyMembersService.createMember`
(company_users SSOT DECISION-0042; role/status governados; nunca can_manage_company). O gate
baseline-ratchet MORDEU o handler novo durante a construção (binding fora do segmento) → catraca
inlined, não allowlist. Guard +8 checks (28) · negative-proof mordeu · E2E 17/17 (auto-grant 403;
dono concede → delegação ESCOPADA sem `*`; canRepresentActor(funcionária→page)=FALSE; Δbank=0) ·
regression-guards exit=0.

**✅ FATIA 3 EXECUTADA E FECHADA (2026-07-04, GO "execute o próximo passo"):** casca universal +
registro de blocos + contrato server-driven. Backend `src/modules/actor-page/` (read-model puro):
`GET /actor-page/:actorId?mode=` → {header, actions, tabs, blocks}; BLOCK_REGISTRY com probes no
SSOT de cada pilar (posts/services/product_offers/rentals/availability/events) — aba acende SÓ se
probe>0; Conectar com allowedLabels do seed por par (Fatia 1); Comprar/Contratar nascem
enabled:false gatedBy PORTA-1; operating gated canRepresentActor 403. Frontend: `ActorPage.tsx`
(casca EntityHero + abas do contrato + bloco Posts reusa fluxo social vivo); **/profile/:id e
/company/:id CONVERGIRAM na casca** (SocialProfilePage/SocialCompanyPage/ProfilePage/CompanyPage
deletados — anti-página-paralela §2.3); /vitrine à parte (residual nomeado: converge com
source=global). Guard `audit-actor-page-contract.mjs` (20 checks, suite, negative-proof mordeu) ·
E2E 9/9 efêmero (aba fantasma=0; PORTA-1 nunca enabled; anti-PII; Δbank=0) · typecheck 0 ·
regression-guards exit=0. **Pós-teste visual de Clayton (2026-07-04, dois achados fechados):**
(a) a casca não tinha PORTA no menu → "Minha Página" (registry governado `module-registry.ts`
grupo Conta, rota `/minha-pagina` + `MyPageRedirect` que projeta o actor ATIVO → /profile ou
/company; distinção ratificada por Clayton: /perfil = configurar · Minha Página = como apareço);
(b) `/services` não reagia ao modo operante → `ProviderServiceHubPage` agora lê `useOperatingMode`
(doutrina D1: Consumindo = banner descoberta-primeiro "Buscar serviços" + hub reframeado abaixo;
Operando = central do prestador como está; nada escondido).

**✅ ACHADO E FECHADO ENTRE FATIAS (2026-07-05):** `DT-CANACTAS-REGISTRY-CAPABILITY-BLOCKS-ALL-PF`
— nenhuma pessoa física conseguia postar/criar evento/criar grupo (bug sistêmico pré-existente,
`canActAs` exigia capability de `actor_registry` institucional até para ownership direto de PF, que
por desenho nunca tem essa linha). Corrigido em `authorization.service.ts`; zero risco de IDOR
(ownership já provada por `user_id===userId`). Composer (`IntentComposer.tsx`) também corrigido
(textarea sumia no meio da digitação).

**✅ FATIA 4 EXECUTADA E FECHADA (2026-07-05, GO "execute a fatia 4"):** conteúdo rico dos blocos
— COMPOSIÇÃO PURA (zero SQL novo em `actor-page.service.ts`): Serviços via `servicesRepository.
findByActor` · Produtos via `listVisibleProducts` (+ `merchantActorId?` novo, extensão aditiva) ·
Agenda via `unifiedAvailabilityService.listAvailabilities` (fix colateral: probe de contagem agora
exige `ownerType` explícito — sem isso misturava owners de tipos diferentes) · Localização via
`operationalAddressHelper`+`getFullAddress` (Location Core DECISION-0020; só cidade/estado/bairro,
NUNCA rua/lat/lng/CEP; "aberto agora" NÃO construído — sem schema de horário, nomeado). Guard +11
checks (31 total) · negative-proof mordeu 3 mutações · E2E 14/14 (escopo por merchant provado;
isolamento por owner_type provado; anti-PII de endereço provado; Δbank=0) · typecheck 0 ·
regression-guards exit=0.

**✅ FATIA 5 EXECUTADA E FECHADA (2026-07-05, GO "execute a fatia 5"):** plateias na leitura —
fecha `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ`. Read-first revelou que a DT original
estava parcialmente errada: `posts.visibility` NUNCA existiu fisicamente (o `PostVisibility`
citado é schema fantasma do repository legado, fail-closed 501). Migration
`20260705120000_posts_visibility_governed.sql` cria `posts.visibility` GOVERNADO
(`public`/`connections`/`only_me`, default `public` não-destrutivo) — `connections` lê
`actor_relationships` (Fatia 1, aceita), NÃO `follows`, conforme DESENHO §2.4c SELADO. Predicado
único `postVisibilitySql` reusado em `getFeed`+`getActorPosts`+`getActorCounts`. **Achado de
autoridade fechado no processo:** `GET /social/feed` usava `actor_id` de querystring sem validação
(cosmético até então) — virou load-bearing pra plateia, então ganhou `canRepresentActor` fail-safe
ANTES de confiar nele (senão o próprio fix abriria impersonação de leitura). Frontend:
`PostComposer` ganhou "Só eu"; `IntentComposer` passou a usar a heurística de audiência que já
existia mas era descartada. Guard 19 checks + negative-proof (2 mutações mordidas) · E2E 9/9
(inclui prova adversarial do vetor de impersonação fechado) · typecheck 0 · regression-guards
exit=0.

**✅ FATIA 6 EXECUTADA E FECHADA (2026-07-05, GO "execute a próxima fatia"):** o Chamado, gated
por FATO DE NEGÓCIO real (não por conexão). Greenfield total — read-first confirmou que nenhum
módulo "Chamado" existia; os módulos `disputes`/`reconciliation` são disputa financeira/reversão
contábil interna, domínio DIFERENTE, conscientemente não reusado. A catraca causal: o chamado
referencia um evento de negócio ESPECÍFICO (`order`/`service_order`/`booking`) e o par
`{from,to}` declarado precisa bater EXATAMENTE com as duas partes reais resolvidas da fonte viva
(fail-closed 422 senão) — nunca "qualquer negócio", nunca confia no toActorId do cliente. Resolve
owner polimórfico de booking (`user`/`page` direto; `service_offering`/`service`/
`rentable_resource` via join; `event`/`group` fora de escopo, 404 fail-closed). Migration
`20260705130000_support_tickets_business_fact_gate.sql` + módulo `support-tickets/` (repository
100% composição — só lê as fontes vivas, nunca duplica). Nova ação `support_ticket` no contrato
da página do actor (reusa `hasAnyBusinessFact`). Frontend: modal na ActorPage (padrão do diálogo
Conectar). Achado colateral resolvido sem gambiarra: o fixture do E2E precisava de
`orders.total_cents` (NOT NULL) — em vez de INSERT bruto (bateria no ratchet financeiro
B4/DECISION-0158), passou a reusar `orderRepository.createOrder` real (composição, Lei §5),
baseline manteve 3846/3846. Guard 20 checks + negative-proof (2 mutações mordidas) · E2E 14/14
(3 tipos de fato + cadeia de join + 5 vetores adversariais fechados) · typecheck 0 ·
regression-guards exit=0. Frontend aguarda sign-off visual (mesmo padrão das Fatias 1-5).

**✅ FATIA 7 EXECUTADA E FECHADA (2026-07-05, GO "execute o próximo passo"):** CRM = projeção da
aresta + suppliers reconciliado. **Achado crítico do read-first que CORRIGE este guia:** a nota
acima ("ambos contidos") estava parcialmente errada — só `contact.*` estava de fato contido;
`crm.routes.ts` (SPRINT 88) estava VIVO e registrado (`/marketplace/crm/*`) SEM NENHUM guard,
lendo tabelas fantasma (`crm_notes`/`crm_tags`/`crm_consents`/`crm_contact_tags`) — bomba de
42P01/500 em runtime real. Clayton confirmou via AskUserQuestion a remoção completa do módulo
(classificador de segurança bloqueou o `rm -rf` autônomo sobre módulo pré-existente não nomeado
explicitamente — pausa correta). `crm.*` DELETADO (não só contido, já que a substituição nasceu
na mesma fatia); `contact.*` permanece INTOCADO (gênese própria, guard dedicado). `suppliers.actor_id`
(órfã desde a Fatia 1) agora WIRED — `assertActorExists` prova a existência antes de gravar,
nunca confia no hint; nova `PATCH /suppliers/:id/link-actor` (mesma catraca de qualquer mutação de
supplier). Frontend: `CrmPage.tsx` reescrito como projeção pura sobre `GET /relationships/mine?label=`
(já existia, zero endpoint novo) + `listSuppliers()`; `api/crm.ts`/`CrmContactDetailPage.tsx`
deletados. Achados colaterais consertados: guard `crm-myorders-route-prefix-contract` invertido
(agora prova que `crm.ts` PERMANECE removido); `PATCH /suppliers/:id/link-actor` triado no
`measure-handler-authority-gap` (binding via helper local, `actorId` do body é DADO não
autoridade); ratchet financeiro baixou (3846→3830/587→586) com a remoção do ghost — baseline
atualizado no mesmo commit (regra DECISION-0158). Guard 15 checks + negative-proof (2 mutações
mordidas) · E2E 8/8 (inclui prova de que `purchase_orders` continua insertável — ERP sem
regressão) · typecheck 0 · regression-guards exit=0. Frontend aguarda sign-off visual.

**✅ FATIA 8 EXECUTADA E FECHADA (2026-07-05, GO "execute o próximo passo"):** ERP composto —
vista integrada estoque+pedidos+agenda+financeiro. **Achado que refina este guia:**
accounts-payable/accounts-receivable (citados aqui como parte do "financeiro") estão DESLIGADOS
por decisão institucional própria (DECISION-0114 D5, Proxy reject-all + 403 fail-closed) —
religar exige frente própria, não é gap desta fatia. **Financeiro virou deeplink-only** (`/wallet`,
zero número embutido) — respeita literalmente a fronteira anti-dinheiro já documentada desde a
Fatia 3 ("o contrato nunca carrega... dinheiro"), mesmo confirmando que leitura de saldo é
tecnicamente distinta de PORTA-1. Novo bloco/aba `erp` no contrato server-driven, SÓ em
`mode=operating` + empresa (page+company_id, DECISION-0133) — nunca visitante, nunca página
pessoal. Composição pura: estoque/agenda REUSAM os blocos já computados na mesma chamada (zero
leitura nova); pedidos usa o único reader novo (`purchaseOrderRepository.listByOwner`, escopado
em SQL por owner_actor_id). Guard 11 checks + negative-proof (2 mutações mordidas: gate operating
removido, campo de saldo vazando) · E2E 7/7 (isolamento entre empresas provado; financeiro com
EXATAMENTE a chave `deeplink`, prova formal de zero dinheiro) · typecheck 0 · regression-guards
exit=0. Frontend aguarda sign-off visual.

**🔴 FATIA 9 = PORTA-1 (dinheiro soberano) — decision pack em 4 passos, NÃO um GO simples.** GO
"execute o próximo passo" acionou 2 rodadas de AskUserQuestion (o `READINESS_PORTA1.md` prescreve:
"nada disto é executável sem a decisão soberana de Clayton"). Decisões tomadas: (1) Core de
Aprovação COMPLETO — **já existia e já está construído** (DECISION-0128/0129/0130, payout
request→aprovação-4-olhos→execução, migration `20260614150000` aplicada, E2E já passando; o
`READINESS_PORTA1.md` citava nomes de tabela errados — os reais são `approval_requests`/
`approval_votes`); (2) firewall default-OFF DENTRO do sink (não por-caller); (3) split completo.
**PDV NÃO usa aprovação humana** (Clayton, 2ª pergunta): venda se autoaprova pelo ato de pagar,
diferente de payout (saída de dinheiro).

**✅ PASSO 2/4 FECHADO (2026-07-05): firewall no sink.** Achado (READINESS YALA #3): ≥18 módulos
de produção chamam `transfer`/`createTransactionWithSplit` DIRETO (P2P/escrow/payout/regional-
fund/gateway/workers), maioria sem firewall próprio, contida só pelo ledger vazio. Achado NOVO
durante a implementação: um 3º entrypoint (`createSimpleTransaction`) não mapeado pelo READINESS
também grava ledger direto. Novo `bank-transaction-sink-firewall.ts` (mesmo padrão
checkout/rides) — gate nos TRÊS entrypoints, protege todos os callers de uma vez (inclusive os
que já têm firewall próprio, defesa-em-profundidade dupla). 4 E2Es pré-existentes que chamavam o
sink direto ganharam o flag explícito pra preservar sua intenção original. Guard + negative-proof
(3 mutações mordidas) · E2E 7/7 (prova as DUAS pontas: default-off bloqueia, flag=true move
dinheiro real) · ratchet financeiro subiu deliberadamente (3830→3865/586→590, documentado —
vocabulário genuíno de payout/split/ledger no firewall, não wording incidental) · typecheck 0 ·
regression-guards exit=0.

**✅ PASSO 3/4 FECHADO (2026-07-05): motor de split (mecanismo, sem taxa real).** Clayton pediu
"garanta que está respeitando normas e leis" — read-first achou `CORE_SPLIT_PAGAMENTO_CANONICO.md`:
decide ARQUITETURA (BPS/economic_policy_engine/bank_splits imutável) mas NÃO fixa percentuais
comerciais — a norma se autodeclara pendente nisso 2x. 3 decisões: (1) só mecanismo/fail-closed,
sem taxa inventada — `economicPolicyEngineService` (PE-1) já era fail-closed, zero policy seedada,
zero número novo; `bank-split-engine` legado (hardcoded) preservado EXATAMENTE como DECISION-0048
já sancionava ("cutover gradual") — não revogado sem decisão própria. (2) treasury-split (2º motor
paralelo, percentuais 5/3/2/2/88, worker nunca chamado) CONGELADO via guard anti-revival — sua
responsabilidade migra pro par conta-`regional_fund`-única + governança de voto (não revivido,
não descartado). (3) PF resolvido — fecha `DT-PE5-PF-RESOLVER-PENDING`: `payer_identity_residence`/
`receiver_identity_residence` agora resolvem via `address_assignments(owner_type='profile',
role='RESIDENCE')`, mesmo SSOT de DECISION-0074. **Achado colateral sério registrado à parte**
(`DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST`): `regional-fund-governance.routes.ts` está VIVO
e registrado, SEM guard, lendo `regional_fund_proposals`/`regional_fund_votes` que NÃO EXISTEM no
banco — mesma classe do achado crm.* da Fatia 7, mas tangencial ao pedido desta fatia, então só
documentado (não corrigido), aguardando GO. 2 guards + negative-proof · E2E 3/3 novo (prova PF
resolve pra cidade certa, payer≠receiver) + E2E irmão (PE-5 PJ) corrigido · ratchet subiu
deliberadamente e documentado (3865→3869/590→591) · typecheck 0 · regression-guards exit=0.
**Próximo = passo 4 (semear saldo + E2E de dinheiro real em ambiente vivo) sob GO de Clayton — OU
decidir o achado da governança primeiro.**

---

## 5. SEQUÊNCIA DE FATIAS (do `DESENHO`, só após selo + decisão §4)

1. **Substrato de relação tipada** (`actor_relationships` + tipos via CHECK/seed governado) — base de
   CRM/plateias/chamado/B2B. Δbank=0, não concede autoridade. **BLOQUEADA pela decisão §4.**
2. **Convite → aceite classificado** (bidirecional: empresa convida OU funcionário envia; grant de
   permissão = ato separado do dono via `company_users`).
3. **Casca universal + registro de blocos** (a página do actor adaptativa por actor+modo operante).
4. **Blocos sem-dinheiro** (Sobre, Posts, Serviços/Produtos-ver, Agenda/Horário, Localização, Aberto-agora).
5. **Plateias na leitura** (fecha `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ`).
6. **Chamado** (gated por FATO DE NEGÓCIO — transação real no ledger/booking, não só conexão).
7. **CRM projetado** (vistas da aresta: clientes/fornecedores/colaboradores) + reconciliação `suppliers`.
8. **ERP composto** (vista integrada estoque+pedidos+agenda+financeiro pela empresa).
9. **PDV acoplado** + orquestração B2B (auto-RFQ/compra/baixa-estoque) = **PORTA-1** (dinheiro, soberano).

Cada fatia: spec → revisão Clayton → código + guard + E2E adversarial → cartório → commit.

---

## 6. PERMISSÕES ATRAVÉS DAS CONEXÕES (o ponto de segurança)

Ao aceitar conexão tipo `colaborador`, o dono PODE abrir painel e atribuir permissões — MAS:
- grant escreve o substrato REAL (`company_users` + permissão do mapa canônico), nunca paralelo;
- só quem tem `canManageCompany` concede (revalidado server-side); aceite social não concede nada;
- funcionário enviar solicitação NÃO se auto-concede (fail-closed, anti-escalonamento);
- herda contenção de escopo (canRepresentActor só delegação FULL; permissão fina via checkPermission).

Este é o vetor onde um erro reabre os IDORs que fechamos nesta sessão. **Máxima vigilância.**

---

## 7. ESTADO DA SESSÃO / DOCS DE REFERÊNCIA

- `DESENHO_PAGINA_DO_ACTOR.md` — SELADO (arquitetura da página + relação + onboarding + chamado + norte).
- `SPEC_FATIA1_RELACAO_TIPADA.md` — spec da fatia 1 (aguarda revisão + decisão §4).
- `MAPA_DE_FECHAMENTO.md` — autoridade ESGOTADA/blindada; PORTA-1 é a fronteira restante.
- `READINESS_PORTA1.md` — read-first do dinheiro (V3 sink, Core Aprovação, split, /cta contido).
- `REMEDIATION_DT_LOG.md` — cartório (528 DTs; ~16 vivas; 0 críticas).
- `PROMPT_YALA_AUDITORIA_SESSAO_3.md` — auditoria pendente (contenção dinheiro + baseline-ratchet).
- Normas: `LEI_DE_COERENCIA`, `07_NOMENCLATURA_CANONICA`, `segmentos.md`, DECISION-0113/0125/0159.

**Autoridade fechada nesta sessão (não regredir):** V1/V2/V4 IDOR eventos, F1-F5 YALA, KYC-âncora,
triagem 4 impersonações, delegação-escopo, página da vitrine + cartão público campo-a-campo.

---

## 8. RE-ENTRADA PÓS-COMPACTAÇÃO — LEIA NESTA ORDEM (auto-orientação da executora)

**Contexto foi compactado. Você é a executora retomando a missão. NÃO re-descubra — siga:**

**PASSO 1 — reancorar (ler, nesta ordem):**
1. Este guia INTEIRO (§1 leis · §2 substrato vivo · §2B raio-x profundo · §4 decisão · §5 fatias).
2. `DESENHO_PAGINA_DO_ACTOR.md` (SELADO) — a arquitetura da página/relação/blocos.
3. `SPEC_FATIA1_RELACAO_TIPADA.md` — o spec da fatia que vamos construir.
4. Memória: `project_frente_acoplamento_crm_erp_pdv` + `project_frente_auditoria_forense_autoridade`
   (autoridade blindada — NÃO regredir) + `project_frente_visibilidade_descoberta` (vitrine viva).

**PASSO 2 — confirmar o fork §4 com Clayton** (reconciliação CRM). Recomendação registrada = **Opção B**
(unificação actor-first: aresta = CRM; `suppliers` ganha `actor_id` ponte SEM quebrar
`purchase_orders.supplier_id`; `contacts` ghost morre → fecha DT). Se Clayton confirmar B, seguir.

**PASSO 3 — EXECUTAR A FATIA 1** (o plano JÁ decidido — "como fazer" abaixo):
- **Migração** (numeração canônica §15): `actor_relationships` (aresta assimétrica: `from_actor_id`,
  `to_actor_id`, `status` CHECK[pending/accepted/rejected/removed/blocked], `requester_label`,
  `target_label`, audit fields §4.13, UNIQUE par não-ordenado, `from<>to`); tipos via **CHECK**
  (não tabela nova) com o seed aprovado §7 do desenho. + `suppliers.actor_id` (nullable, ponte).
- **Repo/Service:** criar aresta (envio) + responder (aceite classificado); `canRepresentActor` no
  envio E no aceite (fail-closed 403); NUNCA tocar `company_users`/`bank_*` (relação≠autoridade).
- **Guard** `audit-actor-relationship-boundary.mjs`: aresta nunca importa/escreve company_users/
  bank_*; labels sempre ∈ vocabulário; + adicionar ao agregador `validate:regression-guards`.
- **E2E adversarial** (ephemeral, NUNCA unificard_dev): enviar/aceitar AS actor alheio→403; tipo fora
  do vocab→rejeitado; aceite NÃO cria linha em company_users; auto-conexão→rejeitada; Δbank=0.
- **Ciclo:** typecheck → guard → E2E → `validate:regression-guards` (verde) → cartório
  (`REMEDIATION_DT_LOG`) → commit. Só então Fatia 2.

**PASSO 4 — regras que não mudam:** §1 (leis). Dinheiro/split = PORTA-1 (não tocar). "impulso de
construir tudo" → PARAR. Substrato antes de superfície. Cada fatia: spec→revisão→código+guard+E2E.

**Ordem das fatias (§5):** 1 relação(+ponte suppliers) → 2 aceite classificado → 3 casca+blocos+
contrato server-driven → 4 blocos sem-dinheiro → 5 plateias na leitura → 6 chamado → 7 CRM projetado
(mata contacts ghost) → 8 ERP composto → 9 PDV+orquestração+split (PORTA-1).

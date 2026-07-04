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

## 4. 🔴 A DECISÃO BLOQUEANTE (Clayton precisa steerar — reconciliação do CRM)

`suppliers` (VIVO, registro digitado) vs a futura aresta de relação (actor↔actor) = risco de **fonte
paralela** para "meus fornecedores". Três caminhos (ver detalhe em `SPEC_FATIA1_RELACAO_TIPADA.md`):
- **(A)** fronteira: relação=on-platform (actor↔actor); `suppliers`=off-platform. Partição, sem overlap.
- **(B)** unificação actor-first: aresta = o CRM; fornecedor off-platform vira actor leve; `suppliers`
  converge; **mata `contacts` fantasma**. Mais ambicioso, coerência total (a tese "unifica").
- **(C)** reconciliar `suppliers`/`contacts` ANTES de construir a aresta.

**Recomendação da executora: (B)** — honra "unifica" e mata dívida em vez de criar. Mas é decisão de
Clayton. **NÃO construir a Fatia 1 até isso decidir** (senão viola as leis 1 e 2).

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

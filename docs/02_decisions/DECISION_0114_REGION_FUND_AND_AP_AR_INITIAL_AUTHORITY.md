# DECISION-0114 — Autoridade inicial sobre o Fundo Regional e sobre AP/AR latente

**Data:** 2026-06-07
**Tipo:** Autoridade / Financeiro (Fundo Regional, Accounts Payable/Receivable) — **docs-only**
**Status:** PROMULGADA (docs-only) — resolve a **pendência normativa de autoridade** levantada pelo `F-MONEY-LIVE-AUTHORSHIP-MAP`. **NÃO** autoriza código/runtime/migration/Bank/movimentação financeira; **NÃO** religa nenhum service Proxy; **NÃO** cria role/tabela/ledger; **NÃO** altera `company_status`/KYB. Apenas orienta as próximas fatias.
**Frente:** `DECISION MONEY AUTHORITY + F-MONEY-LIVE-AUTHORSHIP-MAP-SEAL` (docs-only, após o mapa READ-ONLY)
**HEAD de origem:** `04b74909`
**Decisor:** Clayton (diretrizes cravadas no go)
**Deriva de / subordinada a:** `DECISION-0113` (actorId hint não-soberano; autoridade exige binding com `req.user`), `AUTHORITY_PRECEDENCE` (autoridade > produto), `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5 — Bank SSOT), `SSOT_REGISTRY_UNIFICARD`, `08_AUTORIDADE_CANONICA` (autoridade sempre delegada/explícita), `project_localizacao_pilar_soberano`/`DECISION-0020` (regiões econômicas).
**Vinculada a:** `DT-MONEY-LATENT-REACTIVATION-TRAP`, `DT-REGION-FUND-DELEGATION-MODEL-PENDING`, `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING`, `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` (fatia 3).

---

## 1. Contexto / gap (mapa READ-ONLY `F-MONEY-LIVE-AUTHORSHIP-MAP`, HEAD `04b74909`)

- O mapa concluiu que **"money LIVE" é bem menor que a premissa**: a maioria dos services do cluster marketplace é **Proxy stub reject-all** (`Promise.reject('… migrated to Bank')`) — **LATENTE**: `unifycard.service`, `settlement.service` (+region), `region-account.service`, `accounts-payable.service`, `accounts-receivable.service`, `payment-split.service`, `payout.service`. Toda mutação lança antes de tocar tabela.
- **Genuinamente LIVE (SQL real, autoria spoofável, sem gate):** `POST /events/:id/settlement/settle` (`event_settlements`), `POST /payment-methods` (`payment_methods` + `unsetDefaultForActor` cross-actor), `POST /unifycard/methods` (`unifycard_payment_methods`). Essas 3 são a fatia `F3.1`.
- **Bank boundary intacta:** zero SQL direto em `bank_*` no cluster (os services "de verdade" migraram para o Bank — daí os Proxies). Sem `BANK_SQL_VIOLATION`.
- **Duas pendências de autoridade bloqueavam o trilho** (STOP do mapa): (a) **Fundo Regional** não tinha modelo de quem governa o fundo; (b) **AP/AR** não tinha dono de autoridade (sem `company_id`; payable=`supplierId`, receivable=`actorId`). Esta DECISION resolve a **autoridade inicial** dessas duas, para destravar o desenho — **sem** religar nada.

## 2. O que esta DECISION promulga

### 2.1 Fundo Regional
- **D1 — O Fundo Regional é da plataforma/sistema, NÃO uma empresa individual.** É conta/fundo vinculado ao sistema, alimentado por **porcentagem/comissão** direcionada ao fundo. **Nenhuma empresa governa o Fundo Regional.**
- **D2 — Autoridade operacional inicial (MVP): o fundador/criador do sistema** — referido como **"Clayton, fundador/criador do sistema, resolvido pelo SSOT de identidade/actor existente"** (sem novo identificador técnico, **sem CPF hardcoded**, sem criar user/actor). A resolução concreta para um actor/identidade é tarefa de uma fatia futura de autoridade, não desta DECISION.
- **D3 — Delegação futura é etapa própria e formal.** Diretor financeiro, diretoria, conselho, operador financeiro ou função equivalente só recebem autoridade sobre o fundo por **mecanismo explícito de authority/delegation** (frente própria). **Proibida** delegação implícita/inferida (alinhado a `08_AUTORIDADE_CANONICA`).

### 2.2 AP/AR (Accounts Payable / Receivable)
- **D4 — Enquanto AP/AR estiver latente/Proxy-dead e sem modelo company-owned claro, a autoridade inicial também recai sobre o fundador/criador do sistema** (mesma referência SSOT de D2).
- **D5 — A reativação de AP/AR exige decisão própria** sobre o modelo definitivo: (a) plataforma/tenant-finance; (b) company-finance; (c) papel delegado (diretor financeiro); (d) híbrido. Até lá, **AP/AR NÃO deve ser religado**, **nem** tratado como autorizado por `companyId` implícito ou por `actionContext.actorId`.

### 2.3 Limites desta DECISION (o que ela NÃO faz)
- Não autoriza movimentação financeira nova · não autoriza Bank write · não cria role runtime · não cria tabela · não altera ledger · não altera `company_status`/KYB · não religa Proxy · não executa `F3.1`.
- Apenas **resolve a pendência normativa de autoridade** para orientar as próximas fatias.

## 3. Consequências / trilho

- **`F3.1 — LIVE-NOW`** (fatia de código futura) fica restrita às **3 rotas vivas** (`event-settlement settle`, `payment-method create`, `unifycard-method create`), cada uma com seu gate (autoridade-sobre-o-evento / `canRepresentActor(input.actorId)` / tenant-admin).
- **Proxies latentes ficam FORA da F3.1** — religar exige gate + E2E no **mesmo corte** (anti-trap) e, para region/AP-AR, as decisões de modelo (D3/D5).
- DTs abertas (§4) carregam a pendência de delegação/modelo.

## 4. DTs

- `DT-MONEY-LATENT-REACTIVATION-TRAP` → **OPEN** (religar Proxy só com gate+E2E no mesmo corte).
- `DT-REGION-FUND-DELEGATION-MODEL-PENDING` → **OPEN** (autoridade inicial = fundador; delegação futura = frente própria).
- `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` → **OPEN** (modelo tenant-finance vs company-finance vs delegado, antes de religar).

## 5. Referências
`DECISION-0113`; `AUTHORITY_PRECEDENCE`; `08_AUTORIDADE_CANONICA`; Lei 5 (Bank SSOT); `DECISION-0020` (regiões econômicas); mapa `F-MONEY-LIVE-AUTHORSHIP-MAP` (HEAD `04b74909`); services Proxy `unifycard/settlement/region-account/accounts-payable/accounts-receivable/payment-split/payout`; rotas vivas `event-settlement.routes`/`payment-method.routes`/`unifycard-method.routes`.

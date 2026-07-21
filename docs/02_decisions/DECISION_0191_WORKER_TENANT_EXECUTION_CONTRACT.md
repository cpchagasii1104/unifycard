# DECISION-0191 — WORKER TENANT EXECUTION CONTRACT (aplicação nominal da DECISION-0149 aos workers cross-tenant)

**Data:** 2026-07-20 · **Status:** REDIGIDA — AGUARDANDO AUDITORIA INDEPENDENTE E SELO SOBERANO. **NÃO-SELADA. SELF-SEAL NÃO PERMITIDO.**
**Base:** HEAD `33027ee609221aca19cc8c944540a625c879fb1d` (branch `rescue-structural`). Denominador auditado NÃO-STALE.
**Modo:** DOCS-ONLY · ZERO CÓDIGO/MIGRATION/RUNNER/GUARD/WORKER/BANCO · PORTA-1 FECHADA · EXECUÇÃO MATERIAL NÃO AUTORIZADA.
**Deriva de / subordinada a:** [[DECISION-0149]] (RLS Cross-Tenant Connection Model · TENANT-LOOP canônico) · DECISION-0113/0118 (autoridade server-side). **Vinculada a:** `DT-RLS-RUNTIME-TENANT-CONTEXT-BASELINE`, `DT-WORKER-DORMANCY-SWEEP-RLS-PREFLIGHT`, resíduo #34.
**Origem probatória:** AUDIT-002 Passe 2 · Lote F-3 (`PLANO_RECUPERACAO.md`) + auditoria institucional independente do F-3 (Opus 4.8, Veredito B — decisão docs-only necessária).

---

## 0. NATUREZA E LIMITE DESTA DECISÃO

Esta decisão é **docs-only**. NÃO altera código, worker, migration, runner, guard, Bank, RLS, policy, FK; NÃO abre a PORTA-1; NÃO inicia frente material; NÃO cria arquitetura nova; NÃO declara o próprio selo. Ela **aplica nominalmente a DECISION-0149** (já vigente) a três workers que nunca foram trazidos à conformidade com ela, fechando nominalmente o resíduo #34 para este subconjunto.

Esta decisão **NÃO cria uma segunda arquitetura**. TENANT-LOOP (DECISION-0149) permanece o único modelo canônico. A classificação forense `GLOBAL_READER_WITH_TENANT_SCOPED_EFFECTS`, usada pelo relatório do F-3 para **descrever** o comportamento atual de dois workers, **não é categoria autorizativa** e não pode ser transformada em novo padrão institucional.

---

## D0 — REAFIRMAÇÃO DA DECISION-0149

A DECISION-0149 permanece **vigente** e é a **única arquitetura canônica** de processamento cross-tenant no runtime normal:

```
descobrir tenants por fonte global não-RLS
→ criar unidade de trabalho por tenant
→ configurar app.current_tenant
→ processar exclusivamente o tenant
→ encerrar o contexto
```

**Nenhum comportamento atual de código pode ser interpretado como exceção implícita à DECISION-0149.** A existência de um worker que hoje lê globalmente uma tabela tenant-scoped é um **desvio não corrigido**, não uma permissão adquirida por uso.

---

## D1 — REGRA UNIVERSAL PARA WORKERS

A regra vale para **todo worker presente ou futuro**. Todo worker que processe dados tenant-scoped deve ser classificado nominalmente em uma das categorias governadas (DECISION-0149 §A.8):

- `TENANT_CONTEXT` — processa um tenant já resolvido no request/contexto;
- `TENANT_LOOP` — descobre tenants por fonte não-RLS e itera com contexto por tenant;
- `ADMIN_ONLY` — operação administrativa estritamente necessária, sob decisão própria;
- `INFRA_ROLE` — exceção de infraestrutura, sob decisão própria + wrapper nomeado + allowlist;
- `HOLD` — contido/default-off até decisão;
- `NOT_TENANT_SCOPED` — infra genuína (outbox, retry, idempotency-cleanup) que não toca dado de tenant.

**Nenhuma categoria genérica de leitura global é criada nesta decisão.** Rejeita-se expressamente, como categoria autorizativa, a expressão `GLOBAL_READ_TENANT_SCOPED_WRITE` — ela permanece admissível **apenas como descrição forense** do comportamento atual, nunca como estado aprovado.

---

## D2 — PRIMEIRA TRANCHE

Esta decisão classifica **somente a primeira tranche nominal**:

- `governance-execution-worker.ts` (D3);
- `risk-identity-reconcile.worker.ts` (D4);
- `ledger-snapshot-worker.ts` (D5).

Isto **não significa** que os demais workers estejam aprovados. Registram-se nominalmente como **pendentes de auditoria própria**, sem presunção de conformidade:

- `saga-timeout.worker.ts` (padrão claim-global-depois-escopado, não auditado a fundo);
- `reconciliation-scheduled.worker.ts` (agregado `_all_tenants` por desenho, não auditado a fundo);
- `payment-worker.ts` (consumer de fila, não auditado a fundo);
- **qualquer outro worker** que faça claim, leitura ou descoberta global.

`reconciliation-engine-worker.ts` é registrado como caso de **conformidade parcial pré-existente**: faz tenant-loop, mas com fonte de descoberta PRÓPRIA (`listTenantsForReconciliation`), não o helper canônico `listTenantIdsForWorkerLoop` — a consolidação no helper canônico fica para auditoria/frente própria.

Nenhum worker pendente pode ser considerado conforme apenas por não integrar esta primeira tranche.

---

## D3 — GOVERNANCE EXECUTION WORKER

**Classificação institucional: `TENANT_LOOP_REQUIRED`.**

O worker **não está autorizado** a continuar usando `governance_proposals` como fonte global de descoberta. O desenho material futuro deverá separar:

```
descoberta dos tenants com trabalho
→ processamento tenant-scoped das propostas
```

A fonte de descoberta **não pode ser uma tabela tenant-scoped protegida por RLS** (DECISION-0149 §A.5). Alternativas admissíveis, a serem escolhidas por futura decisão **material** (esta decisão NÃO escolhe nem implementa nenhuma):

1. iterar tenants canônicos (tabela `tenants`) e verificar trabalho **dentro** de cada contexto;
2. criar, sob decisão + migration próprias, um registro mínimo **não-RLS** de tenants com trabalho pendente;
3. fila de jobs por tenant.

**Requisitos futuros obrigatórios:** tenant da unidade de trabalho resolvido server-side; queries de propostas sob `app.current_tenant`; idempotência por proposta; nenhum movimento financeiro direto; execução **apenas de decisão já aprovada** (o worker materializa decisão humana válida, não toma decisão nova); erro isolado por proposta/tenant; falha de um tenant não interrompe os demais; batch/paginação/retry governados; **nenhuma leitura global direta de `governance_proposals`**.

**Fato atual registrado (mudança material futura, não mera documentação):** o worker **não possui `try/catch` por item** — uma proposta com erro pode interromper o restante do batch até o ciclo seguinte (60s). Corrigir isso é mudança material, não documental.

---

## D4 — RISK IDENTITY RECONCILE WORKER

**Classificação institucional: `TENANT_LOOP_REQUIRED`** (com condição adicional).

**Não se autoriza processamento global permanente de `actor_events`** — risco e identidade são eixos sensíveis. Antes de qualquer material, um **GATE read-only próprio** deverá fechar o mapa completo de: `evaluateActorRisk`, `getOrCreateProfile`, `countEventsByTypeSince`, `listEventsByActor`, writers downstream, score, bloqueios, restrições, eventos emitidos, auditoria, e efeitos sobre autoridade ou acesso.

O material só poderá ser desenhado **depois de provar**: tenant threadado em toda a cadeia; zero cache global compartilhado; estado isolado por tenant; decisão auditável; erro isolado por Actor; nenhum efeito automático sem base normativa.

**Fato atual registrado:** o worker já isola erro **por-linha** (`try/catch` dentro do loop) — não interrompe as demais linhas; a lacuna é a leitura global de `actor_events` (sem RLS hoje) e a falta do mapa de efeitos de `evaluateActorRisk`.

---

## D5 — LEDGER SNAPSHOT WORKER

**Classificação atual: `FUNCTIONALLY_INERT · SAFE_NOOP_BY_RLS · HOLD`.**
**Classificação institucional futura: `TENANT_LOOP_REQUIRED OR RETIRE`.**

Registra-se que: o worker consulta `bank_ledger` **sem GUC**; `bank_ledger` possui **RLS+FORCE**; sob a role de runtime `unificard_app` (NOBYPASSRLS, RLS-live desde 2026-06-24) a consulta **retorna zero linhas**; o worker **não cria snapshots**; a ausência de resultado **não é monitorada**; ele está "seguro" **apenas porque está funcionalmente quebrado**.

**Proíbe-se tratar `SAFE_NOOP_BY_RLS` como arquitetura aprovada.** Antes de escolher entre `TENANT_LOOP` e `RETIRE`, exige-se um **GATE read-only** que identifique todos os writers e readers de `ledger_snapshots` — APIs, dashboards, relatórios, jobs, métricas, observabilidade, contratos dependentes.

Decisão futura, condicionada ao GATE:
- **sem consumidor vivo → `RETIRE`;**
- **com consumidor vivo e legítimo → `TENANT_LOOP_REQUIRED`.**

Até a decisão material: **`REVIVAL PROHIBITED WITHOUT MATERIAL GO`**. Nenhum bypass global de `bank_ledger` é autorizado — em particular, é proibido "consertar" a query removendo o efeito da RLS por qualquer meio (conexão global, `getClientWithPlatformAdmin`, role infra).

---

## D6 — RLS DAS TABELAS

Registram-se como **tenant-scoped**:

- `governance_proposals` — `RLS_GAP` (sem RLS hoje; sem FK `tenant_id → tenants`);
- `actor_events` — `RLS_GAP` (sem RLS hoje);
- `bank_ledger` — já possui **RLS+FORCE**.

**Nenhuma ausência atual de RLS constitui autorização de leitura global.** A ausência é dívida de schema não decidida, não desenho intencional de "tabela de plataforma".

---

## D7 — ATOMICIDADE DO ENVELOPE MATERIAL

Quando houver GO material, a conversão dos workers e a proteção das tabelas devem ocorrer **no mesmo envelope coerente**. Para `governance_proposals` e `actor_events`:

```
tenant-loop funcional
+ contexto canônico (app.current_tenant)
+ RLS
+ FORCE RLS
+ policies completas
+ guards
+ provas
```

**Ordem load-bearing:** NÃO adicionar RLS antes de converter os readers — isso silenciaria os workers sem erro, repetindo exatamente o defeito do `ledger-snapshot`. E NÃO converter o worker deixando a tabela indefinidamente sem proteção. O precedente do projeto (Grupos A/B financeiros: RLS+FORCE + tenant-loop no mesmo envelope) é o padrão a seguir.

---

## D8 — CAUSA-RAIZ DO PONTO CEGO

Registra-se que `audit-rls-tenant-context.mjs` **exclui `src/workers/` da varredura**. Essa exclusão permitiu que workers vivos permanecessem sem classificação nominal **apesar** de a DECISION-0149 §A.8 já exigir classificação de todo acesso cross-tenant.

Em futura frente material de guards (não autorizada aqui): remover/substituir conscientemente essa exclusão; inventariar todo worker; exigir classificação nominal; **falhar** quando surgir worker novo sem categoria; não presumir conformidade por presença no boot; não confundir default-off com segurança para ativação.

**Nenhuma alteração no guard é autorizada nesta DECISION docs-only.**

---

## D9 — DISCOVERY GLOBAL vs. LEITURA GLOBAL

Distinguem-se explicitamente:

1. **descoberta global de tenants** por fonte institucional **não-RLS** (ex.: tabela `tenants`) — pode existir como infraestrutura canônica;
2. **leitura global de dados tenant-scoped** — **não autorizada** no runtime normal.

Um scheduler global pode **distribuir unidades de trabalho** por tenant, mas **não pode ler diretamente tabelas tenant-scoped** para tomar decisões operacionais.

---

## D10 — ESCALA

TENANT-LOOP **não significa** necessariamente processamento serial de todos os tenants. A futura arquitetura pode escalar por: fila de jobs por tenant; shards; partições de tenants; workers paralelos; limite de concorrência; cursor por tenant; retry por tenant; idempotência por unidade de trabalho. **A paralelização não pode remover o contexto de tenant.**

---

## D11 — BUSCA OMNI E DISCOVERY PÚBLICO (separação de escopo)

Esta decisão **não altera**: Busca Omni; busca federada entre módulos; discovery de pessoas; perfis públicos; empresas; produtos; serviços; eventos; filtros por cidade; resolução territorial; localização de usuários; exposição pública governada entre tenants. Essas superfícies têm **contratos próprios** e não dependem dos três workers desta decisão. A busca pública/federada **não justifica** leitura global de `governance_proposals`, `actor_events` ou `bank_ledger`.

---

## D12 — AUTORIDADE E IDENTIDADE TÉCNICA

**Nenhum novo `actor_system`, "system Actor" ou Actor fictício deve ser criado.** Workers são processos técnicos, não Actors humanos ou institucionais. Autoridade material, quando necessária, permanece nos modelos canônicos existentes (`canRepresentActor`/`canActAs`/capability grants). Nenhum worker pode usar **ausência de Actor** como justificativa para bypass de tenant.

---

## D13 — BYPASS E ROLES

Não se autoriza: `BYPASSRLS`; `unificard_infra` no runtime normal; conexão global privilegiada; service role genérica; leitura administrativa informal; fallback de tenant; tenant controlado por payload; descoberta por tabela RLS sem contexto; bypass de `bank_ledger`. **Qualquer exceção futura exigirá decisão própria, nominal, estreita e auditada** (DECISION-0149 §A.7).

---

## D14 — GUARDS FUTUROS

**Nenhum guard deve ser criado antes da decisão material de comportamento.** Após os GATEs e GOs próprios, os guards futuros deverão proteger, conforme aplicável: classificação obrigatória de todo worker; tenant-loop; ausência de raw pool; effects tenant-scoped; isolamento de erro; ledger snapshot em HOLD; anti-revival; RLS+FORCE; policies; ausência de novos workers não classificados. **Um guard não pode legitimar comportamento apenas porque ele já existe** — o comportamento legítimo é definido primeiro, o guard o protege depois.

---

## D15 — SEQUÊNCIA GOVERNADA

Sequência obrigatória após esta DECISION:

1. auditoria independente docs-only desta DECISION;
2. selo docs-only da DECISION;
3. GATE read-only de consumers de `ledger_snapshots`;
4. GATE read-only completo de `evaluateActorRisk`;
5. auditoria dos demais workers com padrão global (D2);
6. desenho de envelopes materiais separados;
7. GO material explícito **por tranche**;
8. código, migration e guards **somente após** esses atos.

**F-4 permanece fechado** até decisão explícita de Clayton sobre a sequência da campanha.

---

## FORA DE ESCOPO

Esta DECISION **não autoriza**: alteração de worker; tenant-loop material; queue; scheduler; Redis; migration; RLS; FORCE RLS; policy; FK; guard; runner; banco; ledger; snapshot; avaliação de risco; mudança de governança; PORTA-1; busca; frontend; Social; Bank; commit material.

---

## VEREDITO INTERNO SOBRE A SUFICIÊNCIA DA REDAÇÃO

**A — suficiente e compatível.** Aplica nominalmente a DECISION-0149 (§D0/D1) sem criar arquitetura nova; classifica os 3 workers da primeira tranche (D3/D4/D5) com condições explícitas; registra os workers pendentes sem presunção de conformidade (D2); acopla a proteção de tabelas à conversão de readers (D6/D7); nomeia a causa-raiz do ponto cego (D8); separa descoberta de leitura (D9) e escala sem perder isolamento (D10); isola escopo de busca/identidade/bypass (D11/D12/D13); posterga guards (D14); fixa a sequência governada (D15). Rejeita explicitamente `GLOBAL_READ_TENANT_SCOPED_WRITE` como categoria autorizativa. **Ressalva não-bloqueante:** a suficiência final depende de auditoria independente e do selo soberano — esta decisão é REDIGIDA, não selada.

---

## CONFIRMAÇÃO

```
ZERO CODE CHANGE
ZERO MIGRATION
ZERO DATABASE ACCESS
ZERO RUNNER CHANGE
ZERO GUARD CHANGE
ZERO WORKER CHANGE
ZERO BANK CHANGE
PORTA-1 CLOSED
TENANT-LOOP REAFFIRMED AS SOLE CANONICAL CROSS-TENANT MODEL
GLOBAL_READ_TENANT_SCOPED_WRITE REJECTED AS AUTHORIZATIVE CATEGORY
MATERIAL EXECUTION NOT AUTHORIZED
F-4 NOT STARTED
SELF-SEAL NOT PERMITTED
```

**Encaminhamento:** esta decisão segue para **auditoria independente docs-only (instância separada)** antes de qualquer selo. Não selar aqui.

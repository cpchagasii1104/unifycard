# Execução de handlers e fiabilidade de efeitos

**STATUS:** CANÓNICO · VIGENTE  
**ÂMBITO:** UnifiCard — consumo de eventos após publicação no bus canónico (`eventBus.publish`) e relação com entrega assíncrona (`event_outbox`)

**PRECEDÊNCIA:** `CONSTITUICAO_UNIFICARD.md` > `LEIS_OPERACIONAIS_UNIFICARD.md` (em especial **Lei 5 — SSOT Absoluto**) > `AUTHORITY_LAW.md` / ordem decisória em `00_AGENT_PROTOCOL.md` (§2.3) > `SSOT_REGISTRY_UNIFICARD.md` > `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` > **este documento** > runbooks e implementação

**Relação com `EVENT_OUTBOX_E_ENTREGA_CANONICO.md`:** aquele documento fixa a **entrega transaccional** (mutação + outbox + worker até `publish`). **Este** documento fixa o **comportamento canónico** dos **handlers** depois do `publish` — incluindo falha, retry e idempotência. **Não** substitui a outbox; **complementa** a cadeia temporal.

**Relação com `10_EVENTS_CANONICA.md` / `17_EFFECTS_CANONICA.md`:** conceito de evento e efeito; aqui fixa-se **execução técnica** e **garantias** (ou a sua ausência) sobre efeitos aplicados por código reactivo.

---

## 1. Definição formal — duas camadas

| Camada | O que garante | SSOT / artefacto típico |
|--------|----------------|-------------------------|
| **Entrega** | O evento **chegou** ao mecanismo de publicação e foi **registado** para consumo idempotente de publicação | `event_outbox` (fila pré-`publish`); `event_log` (dedupe de `publish` no bus canónico, quando aplicável) |
| **Execução do efeito** | O **efeito** desejado (escrita derivada, notificação, projeção, orquestração) **foi aplicado** conforme contrato do handler | **Não** existe SSOT único para “efeito aplicado”; a verdade de negócio continua nos SSOT de domínio (`bank_ledger`, entidades de negócio, etc.) |

**Lei de separação:**

- **Outbox + worker + `publish` bem-sucedido** ⇒ **entrega** ao bus e registo de publicação conforme `EVENT_OUTBOX_E_ENTREGA_CANONICO.md`.
- **Handler concluído com sucesso** ⇒ **execução** daquele efeito, sujeita ao contrato declarado (§3).

**Corolário obrigatório:**

```text
Publicação bem-sucedida NÃO implica execução bem-sucedida de todos os handlers.
```

Qualquer código, documentação ou produto que trate `publish` ou presença em `event_log` como prova de que **todos** os efeitos downstream ocorreram está **em violação** desta norma, salvo excepção explícita aprovada por governança (RFC).

---

## 2. Regra absoluta — proibições

**É PROIBIDO:**

1. **Assumir sucesso do sistema** só porque o evento foi **publicado** ou está em `event_log`.
2. **Implementar ou manter efeito financeiro ou irreversível** sem **idempotência demonstrável** sob re-delivery / retry (ver `LEIS_OPERACIONAIS_UNIFICARD.md` **Lei 5**, `INVARIANTES_OPERACIONAIS_LEDGER.md`, `SSOT_REGISTRY_UNIFICARD.md`).
3. **Depender de execução única** (“exactly-once” lógico) sem mecanismo normado de dedupe (chave natural, `event_id` + `handler_key`, ou equivalente documentado).
4. **Ignorar falha silenciosa** de handler como aceitável quando o efeito for **crítico** para integridade, financeiro ou obrigações legais — deve haver política explícita: retry, DLQ de handler, alerta, ou rebuild; **“engolir” erro sem política** é dívida normativa.

**Alinhamento ao protocolo:** comportamento de handler **não previsto** neste documento, no outbox ou no contrato do módulo → sujeito à regra de **invalidação** por omissão normativa em `00_AGENT_PROTOCOL.md` (ambiguidade / lacuna).

---

## 3. Contrato obrigatório por handler

Todo **handler** registado no bus canónico (ou equivalente) que **escreva estado durável**, **dispare efeito económico** ou **actualize projeção usada como verdade operacional** **DEVE** ser documentado em implementação ou runbook com:

| Campo | Significado |
|-------|-------------|
| **`handler_key`** | Identificador estável e único (ex.: `reputation.applyReview`, `marketplace.dispatchAccepted.orders`) — usa-se para idempotência, métricas e filas de retry. |
| **`idempotency_key` / estratégia** | Como re-executar o mesmo `(tenant_id, event_id, handler_key)` **não** duplica efeito (UPSERT, guarda de estado, tabela de dedupe, etc.). |
| **`effect_class`** | `reversível` (rebuild possível), `irreversível_operacional` (ex.: notificação enviada), `financeiro` (sujeito a Lei 5 e invariantes do ledger), ou combinação explícita. |
| **`retry_policy`** | `none` (só observabilidade), `bounded_async` (fila ou tabela de retry com backoff e teto), `manual_only` (DLQ humana) — **deve** estar alinhada a `effect_class` (financeiro: **nunca** retry sem idempotência forte). |

**Handlers apenas informativos** (ex.: log, métricas sem efeito durável) podem declarar `effect_class: none` e `retry_policy: none`.

---

## 4. Modelo de execução canónico

Fluxo **prescrito** (conceitual; a infraestrutura concreta é implementação):

```text
mutation (TX) → event_outbox → worker → eventBus.publish → event_log (dedupe de publish)
    → handlers (um ou vários por tipo de evento)
        → sucesso: efeito aplicado conforme contrato
        → falha: política do §3 (retry de handler / DLQ / alerta) — NÃO confundir com retry da outbox
```

**NÃO é válido** como modelo mental operacional:

```text
publish = sucesso end-to-end do sistema
```

**Retry da outbox** (falha **antes** ou **durante** `publish` até à confirmação da política de outbox) **é camada 1**.  
**Retry de handler** (falha **depois** de `publish` e registo em `event_log`, quando aplicável) **é camada 2** — **obrigatório** para efeitos críticos quando a política não for “aceitar perda”.

O nome **`handler_retry_queue`** designa **genericamente** a segunda camada. **Implementação de referência no repositório:** tabela **`event_handler_failures`** (migration `20260511120000_event_handler_failures.sql`), worker `handler-failure.processor` / `handler-failure-worker`, integração no `event-bus.ts` e `BOOT.ts`.

### 4.1 Lei de persistência e unidade de retry

- **É obrigatório** persistir falhas de handler em armazenamento durável (**não** basta log em memória ou stdout).
- **Unidade de retry (regra absoluta):** `(tenant_id, event_id, handler_key)` — **única** combinação que identifica uma fila de recuperação; **proibido** tratar “reexecutar o evento inteiro” como substituto.
- **Baseline de política:** contador `attempts`, **backoff exponencial** com teto, estado terminal **`dead`** (DLQ de handler) após `max_attempts`.
- **É PROIBIDO** chamar `publish` / `emit` de novo **só** para recuperar um handler falho; **é PROIBIDO** reexecutar **todos** os handlers do mesmo `event_type` no ciclo de retry — **apenas** o `handler_key` registado na linha de falha.

---

## 5. Relação com SSOT

- **Handler não é SSOT.** Handler **consome** eventos e **aplica** transformações sobre fontes canónicas já definidas no `SSOT_REGISTRY_UNIFICARD.md`.
- **Verdade financeira** permanece em **`bank_ledger` / UnifyBank** (e artefactos bank canónicos). Handlers **não** criam segundo ledger nem saldo paralelo (**Lei 5**).
- **`event_log`** (quando usado) é SSOT de **“publicação deste `event_id` processada uma vez para efeito de dedupe de publish”**, não de **“todos os handlers terminaram”**.

### 5.1 Dependência do retry em `event_log`

A implementação de referência do retry de handler **lê o payload** a partir de **`event_log`** (com contexto de tenant). Se a linha **não existir** (retenção, perda, ambiente sem tabela, inconsistência de IDs), **não** é possível replay canónico via worker — o sistema regista falha persistida e log **`handler_failure_event_log_missing`** (ver runbook `docs/runbooks/handler-failures.md`).

Isto **não** substitui backup / retenção documentada de `event_log` em produção; é risco operacional explícito.

---

## 6. Relação com autoridade e guarda financeira

Conforme `AUTHORITY_LAW.md` e a ordem decisória em `00_AGENT_PROTOCOL.md` (Gate / precedência causal: **Mutation → Estado → Dinheiro → Evento** quando aplicável):

- **Guarda / integridade financeira** prevalece sobre conveniência de produto ou de IA.
- **Retry de handler** que toque dinheiro ou invariantes do ledger **NUNCA** pode ser justificado se **duplicar** efeito; a idempotência **DEVE** ser provável por revisão (teste, chave única, leitura de estado actual antes de efeito).

Duplicação de efeito financeiro por retry **é violação grave** (incidente de integridade), independentemente de intenção.

---

## 7. Observabilidade mínima (norma de comportamento)

Para handlers com `effect_class` financeiro ou irreversível:

- Falhas **DEVEM** ser **visíveis** (log estruturado, métrica ou fila de falhas) — não apenas `console` em silêncio em produção.
- Acumulação de falhas **DEVE** ter caminho operacional (runbook) — ver **`docs/runbooks/handler-failures.md`**.

**Eventos de log mínimos (implementação actual, campo `metric_event` no contexto):**

- `handler_failure_created` — falha registada após erro no handler no ciclo de `publish`.
- `handler_retry_attempt` — início de tentativa de retry no worker (antes de `invokeHandlerOnly`).
- `handler_dead_letter` — linha em estado terminal `dead` após esgotar tentativas.

*(Métricas agregadas e alertas: alinhar a `CORE_OBSERVABILITY_CONTRACT.md` e tarefas INFRA-6 no plano.)*

---

## 8. Read models — decisão arquitectural (projeção derivada)

Os handlers gerados por `read-model.projector.ts` tratam **read models como derivados reconstruíveis** (comentários de blindagem no próprio módulo: falha de projeção **não** invalida a verdade de negócio).

**Decisão vigente — Opção B (preferida para este pilar):**

- **Não** exigir, nesta fase, que **cada** falha parcial de projeção lance excepção até `event_handler_failures` (Opção A), para não misturar semântica de “efeito de negócio” com “vista derivada” sem um contrato por tipo de read model.
- **Sim** exigir **rebuild / catch-up** explícito (job ou comando operacional) quando a projeção materializada for usada como **SLA de UX** ou relatório crítico — documentar o job no plano / runbook de dados derivados quando existir.
- Handlers `read_model.actor_effect.*` que **propagarem** excepção continuam sujeitos à camada 2 como qualquer outro handler.

**Opção A (alternativa futura):** projector agregaria falhas e **lançaria** ao final do ciclo para forçar retry — só após RFC que defina quais `ReadModelType` são críticos e idempotência de projeção por evento.

---

## 9. Remissões

- `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` — transacção + outbox + idempotência no consumo (publicação)
- `SSOT_REGISTRY_UNIFICARD.md` — SSOT por domínio; **§5** Bank
- `LEIS_OPERACIONAIS_UNIFICARD.md` — **Lei 5** (SSOT financeiro)
- `INVARIANTES_OPERACIONAIS_LEDGER.md` — sagas, compensação, anti-duplicação
- `07_NOMENCLATURA_CANONICA.md` — §**4.12.1** (chaves de idempotência semânticas, quando aplicável)
- `00_AGENT_PROTOCOL.md` — precedência normativa, GATE, invalidação por lacuna
- `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` — §**INFRA-1** (estado de implementação outbox vs handler layer)
- `backend/migrations/20260511120000_event_handler_failures.sql` — schema camada 2
- `docs/runbooks/handler-failures.md` — operação e DLQ de handler

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT_PROTOCOL.md
- 07_NOMENCLATURA_CANONICA.md
- 10_EVENTS_CANONICA.md
- 17_EFFECTS_CANONICA.md
- AUTHORITY_LAW.md
- CONSTITUICAO_UNIFICARD.md
- CORE_OBSERVABILITY_CONTRACT.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
<!-- AUTO-GENERATED-END -->
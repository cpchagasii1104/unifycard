# Entrega de efeitos e outbox transacional

**STATUS:** CANÓNICO · VIGENTE  
**ÂMBITO:** UnifiCard — publicação assíncrona de eventos/efeitos **consistente** com o estado persistido  
**PRECEDÊNCIA:** `CONSTITUICAO_UNIFICARD.md` > `LEIS_OPERACIONAIS_UNIFICARD.md` > `SSOT_REGISTRY_UNIFICARD.md` (§5.9.0) > este documento > runbooks operacionais (backoff, métricas, ferramentas)

**Relação com `10_EVENTS_CANONICA.md`:** aquele documento fixa o **conceito** de evento; **este** documento fixa a **entrega técnica** (transação + fila + consumo). Em caso de tensão, a **implementação aplicada** e o **registry** prevalecem até alinhamento formal de governança.

---

## 1. Finalidade

Garantir que **efeitos comunicados ao exterior** (message bus, integrações) **não** ocorram **antes** do commit da transação que torna o estado interno verdadeiro — e que **retries** não dupliquem efeitos.

---

## 2. Lei — transação única (efeito + outbox)

**É obrigatório:** qualquer fluxo que hoje faça `INSERT/UPDATE` de estado durável seguido de `publish` **fora** da mesma unidade transacional **deve** migrar para o padrão:

1. Abrir transação.
2. Persistir o efeito de negócio (ex.: movimento, linha de pedido).
3. **`INSERT` em `event_outbox`** com `event_id` único, `event_type`, `payload`, `tenant_id` conforme schema vigente.
4. `COMMIT`.
5. Worker (pós-commit) lê a fila, publica, marca `published_at` (ou move para DLQ após política de retry).

**É proibido:** assumir que `publish` bem-sucedido **antes** do commit garante consistência se o commit **falhar** ou der **rollback**.

---

## 3. Lei — idempotência no consumo

O consumidor (ou o bus) **deve** permitir **reentrega** sem efeito duplicado. **Mínimo:** dedupe por **`event_id`** (ou chave estável equivalente documentada no handler).

Handlers que disparam **sagas** ou **compensações** **devem** validar **estado atual** antes de efeito colateral — ver `INVARIANTES_OPERACIONAIS_LEDGER.md` §4.1.

---

## 4. Ordenação e resiliência (referência)

A fila pendente **deve** ser consumida com **ordem estável** (ex.: `ORDER BY created_at ASC, id ASC` conforme schema). **Retries** **devem** respeitar **`next_retry_at`** / backoff quando a coluna existir; **teto** de tentativas e **DLQ** quando implementados — pormenores em **runbook**, não nesta lei.

---

## 5. O que não é duplicado aqui

- Nomes de métricas, dashboards, valores de SLO.
- Biblioteca concreta de filas (BullMQ, etc.) como exigência única — desde que o **contrato** transacional + idempotência seja respeitado.

---

## 6. Remissões

- `HANDLER_EXECUTION_AND_RELIABILITY.md` — **camada pós-`publish`:** contrato de handler, falha ≠ retry de outbox, idempotência e Lei 5 em efeitos financeiros
- `docs/runbooks/handler-failures.md` — operação da tabela `event_handler_failures` e DLQ de handler
- `SSOT_REGISTRY_UNIFICARD.md` — §**5.9.0**
- `INVARIANTES_OPERACIONAIS_LEDGER.md` — §**4.1** (saga / compensação)
- `07_NOMENCLATURA_CANONICA.md` — §**18.14** (produto / oferta / pedido)
- `00_AGENT_PROTOCOL.md` — domínio **EVENTOS / ENTREGA ASSÍNCRONA** na tabela **2.2.3**

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT_PROTOCOL.md
- 07_NOMENCLATURA_CANONICA.md
- 10_EVENTS_CANONICA.md
- CONSTITUICAO_UNIFICARD.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
<!-- AUTO-GENERATED-END -->
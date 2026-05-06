# Invariantes operacionais de ledger (monetário + físico)

**STATUS:** CANÓNICO · VIGENTE  
**ÂMBITO:** UnifiCard — persistência de dinheiro e de quantidade em estoque  
**PRECEDÊNCIA:** `CONSTITUICAO_UNIFICARD.md` > `LEIS_OPERACIONAIS_UNIFICARD.md` > `SSOT_REGISTRY_UNIFICARD.md` > este documento > planos operacionais (ex.: `UNIFICARD_PLANO_DEFINITIVO_v7.md`)

**Documentação única (dinheiro / centavos / ledger):** com o bloco **DOCUMENTAÇÃO ÚNICA** em `SSOT_REGISTRY_UNIFICARD.md`, este documento forma o **par normativo** que outros READMEs e guias devem citar — **não** redefinir SSOT financeiro nem a convenção `*_cents` fora deste par.

---

## 1. Finalidade

Este documento **formaliza** o que o código já implementa em grande parte: **dois SSOTs operacionais distintos** — um para **dinheiro** e outro para **quantidade física** — sem criar segundo ledger monetário e sem duplicar autoridade de movimentação de estoque.

Sem esta norma, **correção arquitetural depende só de disciplina humana**; triggers SQL impedem alguns erros, mas **não** impedem tabelas paralelas ou uso indevido de projeções.

---

## 2. SSOT por domínio (nomes canónicos)

| Domínio | Autoridade (tabela / serviço) | Papel |
|--------|------------------------------|--------|
| **Monetário** | `bank_accounts`, `bank_transactions`, `bank_ledger`, `bank_splits` | Única fonte de verdade para saldo e movimentação de dinheiro (**Lei 5**). |
| **Semântica de produto** | **CONCEPT** (`public.concepts`) + catálogo (ex.: `product_variants` ligados ao modelo de produto) | “O que é” a mercadoria no domínio (**Lei 7**). `category_id` / slug **não** são identidade. |
| **Quantidade em estoque (eventos)** | **`inventory_movements`** | Única fonte de verdade para **entradas, saídas e ajustes** de quantidade por variante (ledger físico **append-only**). |

**Declaração explícita:** **`inventory_movements` é o SSOT do ledger físico** (eventos de quantidade). **Não** se cria `inventory_events` nem qualquer tabela paralela com o mesmo papel sem **RFC** e migração que **absorva** ou **substitua** explicitamente esta autoridade.

---

## 3. Projeções e read models (não são SSOT)

- **`inventory_balances`:** materialização **opcional** do saldo por variante; **derivável** por agregação sobre `inventory_movements`. **Proibido** tratá-la como verdade primária quando contradizer a soma dos eventos.
- **`inventory_reservations`:** reserva **lógica**; não substitui movimentos; regras de consumo ficam nos serviços (ex.: consumo alinhado a fulfillment).
- **Custódia (“quem está com o quê”):** **view** ou tabela **derivada** (ex.: posição atual por ator/local/lote), reconstruível a partir de transferências + movimentos. **Não** é fonte primária se conflitar com eventos.
- **Accounting analítico / DRE / plano de contas:** **projeção** sobre `bank_ledger` (e, quando existir modelo de custo, sobre eventos de estoque). **Proibido** segundo ledger **monetário** (mantém-se **Lei 5**).

---

## 4. Correlação e reconciliação (crítico)

**Regra:** consistência **não** exige, em geral, um único `BEGIN … COMMIT` SQL entre `bank_ledger` e `inventory_movements`.

**Regra:** operações devem ser **rastreáveis e reconciliáveis**:

- Movimentos **OUT** ligados a venda/expedição devem ser correlacionáveis a **pedido / fulfillment** via `reference_type`, `reference_id`, `metadata` (ex.: `order_id`, `fulfillment_order_id`), conforme política do produto.
- Movimentos financeiros devem permanecer ligados a `bank_transaction_id` / contas canónicas pelos fluxos existentes do UnifyBank.
- **Excepções de negócio** (consignação, brinde, perda, ajuste inventário) exigem **`reason`** explícito e política documentada; **proibido** atalho sem rastreio.

O modelo **pagamento captura dinheiro → envio gera OUT** é **válido**; a obrigação é **correlação audítavel**, não forçar o mesmo commit transacional em todos os casos.

---

## 5. Escritores canónicos (implementação atual)

Alterações à autoridade **devem** concentrar-se nos pontos abaixo (lista para manter sincronizada com o código em revisões):

- **Ledger monetário:** `backend/src/modules/bank/bank-ledger.repository.ts`, `bank-transaction` / serviços que criam transações e entradas de ledger conforme genesis.
- **Movimentos de estoque:** `backend/src/modules/marketplace/inventory-movement.repository.ts`, `inventory.service.ts` / `inventoryService.addMovement`, e fluxos que os invocam (ex.: `fulfillment.service.ts` em **SHIPPED**; `stock-transfer.service.ts` em **shipTransfer** via `createMovementWithClient` na mesma transação com `FOR UPDATE` na transferência).

**Proibido:** novo `INSERT` direto em `inventory_movements` ou `bank_ledger` fora destes caminhos sem **RFC** e actualização desta lista.

---

## 6. Proibições explícitas

- Criar **tabela paralela** de eventos de stock com o mesmo papel de **`inventory_movements`**.
- Persistir **“stock atual”** como verdade **primária** sem linhagem em **`inventory_movements`**.
- **`UPDATE` / `DELETE`** em `inventory_movements` (salvo evolução normativa explícita; hoje: imutabilidade por trigger).
- **Ledger financeiro** fora de `bank_ledger` / estruturas autorizadas no **SSOT Registry** (**Lei 5**).
- Usar **`category_id` / slug** como identidade semântica de produto para decisões de estoque (**Lei 7**).

---

## 7. O que o PostgreSQL garante vs o que não garante

- **Garante (onde aplicável):** append-only em `bank_ledger` e em `inventory_movements` via triggers de migração.
- **Não garante:** ausência de **nova tabela** de stock; uso de projeção como “fonte”; correlação mínima nos metadados; disciplina de PR.

Por isso esta norma + revisão de código são **obrigatórios** em complemento ao banco.

---

## 8. Remissões

- `SSOT_REGISTRY_UNIFICARD.md` — secção **5.9** (Marketplace — movimentação física) e **5.10** (paralelismo de inventário proibido).
- `LEIS_OPERACIONAIS_UNIFICARD.md` — **Lei 5** (remissão quantidade física), **Lei 7** (CONCEPT).
- `00_AGENT_PROTOCOL.md` — domínio **ESTOQUE / LEDGER FÍSICO** na tabela **2.2.3**; gate **2.3.2** antes de alteração estrutural.

---

## Anexo A — Checklist de PR (anti-regressão)

Usar em revisões que toquem **marketplace, estoque, pagamentos ou ledger**.

- [ ] Nenhum **novo** SSOT de quantidade além de `inventory_movements` (sem RFC).
- [ ] Nenhuma **tabela/coluna** de saldo de stock como verdade primária sem eventos.
- [ ] Alterações de quantidade: apenas **novos** registos em `inventory_movements` (padrão append-only).
- [ ] Alterações de dinheiro: apenas fluxo **UnifyBank** (`bank_transactions` / `bank_ledger`); nenhum ledger paralelo.
- [ ] Movimentos OUT relevantes: `reference_*` / `metadata` permitem **ligar** a pedido/fulfillment quando a política exigir.
- [ ] `inventory_balances`: se alterado, justificar **sincronização** com a soma de movimentos (projeção).
- [ ] Semântica de produto: continua a respeitar **CONCEPT**; sem decisão por slug/categoria como identidade.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT_PROTOCOL.md
- CONSTITUICAO_UNIFICARD.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md
<!-- AUTO-GENERATED-END -->
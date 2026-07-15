# DECISION-0182 — FISCAL-4E · Commission Distributable Residual Continuation Contract: fechamento da matriz D10 (allowlist de economic policy lines vazia na 4E inicial) e contrato de continuação residual da linha Bank de `commission_gross`

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL FISCAL-4E NÃO RETOMADO · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** FISCAL-4E · D10 COMMISSION DISTRIBUTABLE RESIDUAL CONTINUATION CONTRACT
**Base:** `rescue-structural @ 7917f92dc` (selo final da canonicalização BankSplitType; DECISION-0179/0180/0181 seladas)
**Insumo:** GATE de retomada do material FISCAL-4E (read-only, 2026-07-15) — **STOP CORRETO da executora** ao provar de 1ª mão que a matriz D10 da DECISION-0179 (`line_type × commission_distributable → materializável_no_Bank`) **não fecha sem decisão adicional**: o único `line_type` institucionalmente fundamentado para `commission_distributable` é `regional_fund`, que é **B-CITY-2 (bloqueada e fora da 4E)**. Clayton ratifica o fechamento pela **opção A**.

**Deriva explicitamente de:** DECISION-0179 (D2 conservação global+bucket; D5 `tax_reserve` split type; D10 allowlist `line_type × applies_to × fase × materializável_no_Bank` — **"Se a lista não puder ser fechada sem decisão adicional → STOP antes do material"**; D13 4E dormente; D15 componentes externos fora; D16 full reversal; D19 preservação dos selos) · DECISION-0178 (`commission_gross = tax_reserve + commission_distributable`; `applies_to` 5/3/2) · DECISION-0177 (linha regional municipal futura `applies_to='commission_distributable'` = **B-CITY-2 BLOQUEADA**) · DECISION-0165 (pipeline canônico; `Σsplits == amount`) · SSOT_EXCLUSIVE_BANK_RULE · LEI DE COERÊNCIA §4.6-4.7/§8 · PROHIBITED_STRUCTURES.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FISCAL · FINANCEIRO (vocabulário/forma da composição; **nenhum** saldo/tx/split real) · POLICY/CONTEXTO · TERRITÓRIO (só para excluir a linha regional) · NOMENCLATURA · CONSERVAÇÃO.

**Documentos lidos e suficientes (1ª mão):** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 SSOT financeiro), `SSOT_REGISTRY_UNIFICARD.md` (§5 Bank), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira; §8 linguagem única), `PROHIBITED_STRUCTURES.md`, `07_NOMENCLATURA_CANONICA.md` (§4.55 split types; `applies_to`), DECISION-0177/0178/0179/0180/0181; código vivo `economic-policy.types.ts` (inventário dos 8 `line_type`), `bank-split.types.ts`, `governed-vocabularies.manifest.ts`. **Suficiência:** a frente é **de fechamento de matriz de vocabulário/composição** (docs-only), sem DB, sem migration e sem dinheiro; o conjunto cobre a equação de conservação selada (0178/0179), a fronteira financeira (o intocável) e o inventário vivo de `line_type` (a matéria de D10).

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > normas de domínio > decisions > cartório > código > conveniência.

**Pilar afetado:** FISCAL/FINANCEIRO (forma da composição; **nenhum** saldo/transaction/split real).

**SSOT monetário:** `bank_ledger` / UnifyBank. **Autoridade legítima do dinheiro:** domínio Bank. Esta DECISION **não cria** dinheiro/saldo/transaction/split — não toca o SSOT financeiro.

**Declarados NÃO-SSOT:** allowlist `line_type × applies_to` (vocabulário governado, projeção) · linha de continuação residual (transformação de forma, não nova autoridade) · guard/manifesto/nomenclatura (prova/projeção) · cartório (estado operacional).

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only**. Fecha a lacuna institucional apontada por DECISION-0179 **D10** e promulga a **forma** da continuação residual de `commission_distributable` no material 4E futuro. **NÃO autoriza material** (o material 4E permanece condicionado ao seu próprio `GO MATERIAL` após o selo Yala desta DECISION). **NÃO altera a DECISION-0179** nem qualquer decisão fiscal/financeira selada.

**Não governa e não autoriza:** código · migration · DDL · DML · manifesto · nomenclatura · guard · teste · Bank write · conta fiscal · transaction · split · ledger · policy · seed · caller · rota · worker · frontend · retomada do material 4E nesta sessão.

---

## FATO DO GATE (fundamento probatório, read-only 2026-07-15)

Inventário de 1ª mão dos `line_type` vivos (`economic-policy.types.ts`), **8 valores**:

```text
revenue_share · platform_fee · regional_fund · reserve · referral ·
group_allocation · channel_commission · custom
```

Varredura do corpo selado: o **único** `line_type` já relacionado institucionalmente a `commission_distributable` é **`regional_fund`** (DECISION-0177/0178: "linha regional municipal futura `applies_to='commission_distributable'`"). Essa linha é **B-CITY-2**, que está **BLOQUEADA** (DECISION-0177 F2) e **explicitamente fora da 4E** (DECISION-0179 D0/D9; envelope 4E §18). **Nenhum** dos outros 7 `line_type` tem fundamento selado para `commission_distributable`. Logo, a matriz D10 **não fecha com conjunto não-vazio/não-bloqueado sem decisão adicional** — condição literal de STOP de D10.

---

## D1 — ALLOWLIST D10 NA FASE 4E INICIAL: CONJUNTO VAZIO

Promulga-se, para a **fase FISCAL-4E inicial**, que o conjunto de `economic_policy_lines` **materializáveis no Bank sobre `commission_distributable`** é **VAZIO**.

Matriz `line_type × commission_distributable → materializável_no_Bank` (4E inicial):

| line_type | materializável no Bank sobre commission_distributable (4E inicial) |
|---|---|
| revenue_share | **NÃO** |
| platform_fee | **NÃO** |
| regional_fund | **NÃO** (pertence a B-CITY-2, bloqueada) |
| reserve | **NÃO** |
| referral | **NÃO** |
| group_allocation | **NÃO** |
| channel_commission | **NÃO** |
| custom | **NÃO** |

**Fundamentos:** (1) `regional_fund` é o único `line_type` já relacionado institucionalmente a `commission_distributable`; (2) sua ativação pertence à **B-CITY-2**; (3) B-CITY-2 permanece **bloqueada**; (4) FISCAL-4E **proíbe** policy regional e split regional real (0179 D0/D18); (5) nenhum outro `line_type` possui fundamento selado para essa base; (6) a **4E não deve inventar distribuição econômica**.

O inventário vivo dos 8 `line_type` é **preservado** (nenhum removido/renomeado). A ampliação desta allowlist (fase futura) exige **nova DECISION** (0179 D10).

---

## D2 — CONTRATO DE CONTINUAÇÃO RESIDUAL

Como não há `economic_policy_line` distributable materializável na 4E inicial, a parcela `commission_distributable` **não é uma nova linha nem uma nova distribuição**: é a **continuação da linha Bank original de `commission_gross`**, com o valor reduzido pela segregação fiscal.

**Contrato de entrada (interno, dormente):** a composição recebe, explicitamente identificada, a **COMMISSION GROSS SOURCE LINE** — a linha Bank original que representa a comissão bruta da plataforma **antes** da segregação fiscal, com `sourceLine.amount = commission_gross`.

**Transformação (conservadora de destino):**

```text
sourceLine (amount = commission_gross)
  →
continuationLine:
    mesmo destination account
    mesmo split type
    mesma titularidade (owner)
    mesma moeda
    mesma semântica econômica
    amount = commission_distributable
  +
taxReserveLine:
    split_type   = tax_reserve
    destination  = conta fiscal_reserve (resolver lookup-only, D4/0179)
    amount       = tax_reserve
```

Conservação vinculante (inteiros, sem float):

```text
commission_gross = commission_distributable + tax_reserve
```

A transformação **preserva o balanceamento global** da transação (`Σsplits == amount`): a soma `continuationLine.amount + taxReserveLine.amount` é **exatamente** `sourceLine.amount` — nenhum centavo criado, nenhum órfão, nenhum clamp.

**A linha residual (continuationLine):**
- **não** é uma nova `economic_policy_line`;
- **não** é policy regional; **não** é `regional_fund`; **não** é conta da população; **não** é voucher; **não** é remittance;
- **não** escolhe novo destino; **não** troca `platform_fees` por `platform_revenue` nem vice-versa;
- **não** cria conta; **não** cria fallback.

Ela **apenas** herda o destino/split_type/titularidade/moeda/semântica da `sourceLine` e reduz o `amount` para `commission_distributable`.

---

## D3 — IDENTIFICAÇÃO EXPLÍCITA DA SOURCE LINE (fail-closed)

A `COMMISSION GROSS SOURCE LINE` **deve** ser fornecida/identificada **explicitamente** no contrato interno da composição.

**Proibido inferir** a source line por: nome · primeiro match · somente `split_type` · somente `account_type` · saldo · `owner_id`.

**Falhas obrigatórias (fail-closed, antes de qualquer materialização):**

```text
source line ausente ........................ FAIL-CLOSED
mais de uma source line .................... FAIL-CLOSED
sourceLine.amount != commission_gross ...... FAIL-CLOSED
tenant/moeda divergentes ................... FAIL-CLOSED
destino incompatível ....................... FAIL-CLOSED
```

Esses fail-closed são **anteriores** ao advisory lock monetário / account lock / transaction / split / ledger (alinha 0179 D4/D8: lookup-only e Mutation→Estado→Dinheiro→Evento).

---

## D4 — DORMÊNCIA PRESERVADA

Esta DECISION **não retoma** o material 4E. O material 4E permanece **estritamente dormente** (0179 D13):

```text
zero caller · firewall OFF · zero conta fiscal real · zero transaction persistente ·
zero split persistente · zero ledger · zero saldo · zero integração regional ·
zero integração popular
```

`tax_reserve` continua **fora** de `BANK_SPLIT_TYPES` até o material 4E (extensão 6→7 sob GO próprio); esta DECISION **não** altera código, tuple, manifesto, nomenclatura, guard, migration ou Bank.

---

## D5 — PRESERVAÇÕES E FRONTEIRAS

**Preservados e intactos:** DECISION-0179 (byte-intacta; **não alterada**) · 0178/0177/0165 · 4d-1/4d-1-R/4d-2 · B-CITY-1 · canonicalização BankSplitType (0180/0181; guard estrutural + harness) · `applies_to` 5/3/2 · guard 4c-3 `942142f3…` · runner 185 (186 reservada à 4E).

**Manter OPEN:** `DT-INVOICING-HARDCODED-TAX-RATE` · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` (**não governa a reserva fiscal**). **Manter:** B-CITY-2 **BLOQUEADA**.

**PRÓXIMO PASSO (não automático):** após o selo Yala desta DECISION, a matriz D10 fica **fechada** (allowlist distributable = ∅ + contrato de continuação residual), e o material 4E poderá ser retomado pelo gatilho literal **`GO RETOMAR MATERIAL FISCAL-4E`**. **Nenhuma etapa autoriza automaticamente a seguinte.**

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; esta DECISION não cria saldo/transaction/split (Lei 5; SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).
- **Autoridade não emerge de estrutura**: a continuação residual herda a linha existente, não cria nova distribuição nem novo destino (PROHIBITED_STRUCTURES).
- `commission_gross = commission_distributable + tax_reserve` (0178/0179), agora com o destino de `commission_distributable` **fixado como continuação da linha original** — sem policy regional, sem inventar economia.
- 4E permanece dormente; ativação econômica só por PORTA governada; sink firewall fail-closed OFF.
- B-CITY-2 e policy regional permanecem fora; `regional_fund` não participa da 4E.

---

**STATUS: DECISION-0182 PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL FISCAL-4E NÃO RETOMADO · AGUARDA UMA ÚNICA AUDITORIA YALA.**

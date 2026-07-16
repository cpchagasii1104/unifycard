# DECISION-0183 — FISCAL-4E · Zero-Bucket Bank Materialization Contract: representação física selada dos buckets econômicos de valor zero na composição fiscal-Bank (continuação residual e reserva fiscal)

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL FISCAL-4E NÃO RETOMADO · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** FISCAL-4E · ZERO-BUCKET BANK MATERIALIZATION CONTRACT
**Base:** `rescue-structural @ 9798e2505` (PASSES 1 e 2 da FISCAL-4E materializados na working tree, não commitados; DECISION-0179/0180/0181/0182 seladas/promulgadas)
**Insumo:** STOP FÍSICO CORRETO da executora no PASSE 3 (COMPOSIÇÃO FISCAL-BANK, read-first 2026-07-15) — prova de 1ª mão de que a matriz de materialização da continuação residual (DECISION-0182 D2) **não fecha** para o estado `commission_distributable = 0`: DECISION-0182 D2 prescreve SEMPRE duas linhas, mas o sink canônico proíbe fisicamente uma linha Bank de valor zero (`bank_splits`/`bank_ledger` CHECK `amount_cents > 0`), e nenhuma decisão anterior sela a representação física do bucket zero. Clayton fecha a lacuna pela regra de **materialização apenas de buckets positivos** (envelope §12: "NÃO INVENTAR SEMÂNTICA" → decisão soberana).

**Deriva explicitamente de:** DECISION-0179 (D2 conservação global+bucket; D4 resolver fiscal_reserve lookup-only; D5 `tax_reserve` split type; D13 4E dormente; D16 full reversal; D19 preservação dos selos) · DECISION-0182 (D2 contrato de continuação residual `commission_gross → continuation + tax_reserve`; D3 identificação explícita fail-closed da source line; D4 dormência) · DECISION-0178 (`commission_gross = tax_reserve + commission_distributable`) · DECISION-0165 (pipeline canônico; `Σsplits == amount`) · SSOT_EXCLUSIVE_BANK_RULE · LEI DE COERÊNCIA §4.6-4.7/§8 · PROHIBITED_STRUCTURES.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FISCAL · FINANCEIRO (forma/representação física da composição; **nenhum** saldo/tx/split real) · CONSERVAÇÃO · NOMENCLATURA (sem alteração). Nenhum toque em código, migration, manifesto, guard, runner, Bank, frontend.

**Documentos lidos e suficientes (1ª mão):** `00_AGENT_PROTOCOL.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 SSOT financeiro), `SSOT_REGISTRY_UNIFICARD.md` (§5 Bank), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira), `PROHIBITED_STRUCTURES.md`, DECISION-0178/0179/0180/0181/0182; código vivo (read-only) `bank-transaction.service.ts` (sink `createTransactionWithExplicitSplitLines`, invariante `ΣsplitLines.amountCents === amountCents`), `bank-split.types.ts`; schema físico vivo `unificard_dev` (read-only): `bank_splits_amount_cents_check` e `bank_ledger_amount_cents_check`. **Suficiência:** a frente é de **fechamento da representação física de valor zero** (docs-only), sem DB, sem migration e sem dinheiro; o conjunto cobre a equação de conservação selada (0178/0179), o contrato de continuação (0182) e o CHECK físico do sink — o exato ponto de colisão.

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > normas de domínio > decisions > cartório > código > conveniência.

**Pilar afetado:** FISCAL/FINANCEIRO (forma/representação física; **nenhum** saldo/transaction/split real).

**SSOT monetário:** `bank_ledger` / UnifyBank. **Autoridade legítima do dinheiro:** domínio Bank. Esta DECISION **não cria** dinheiro/saldo/transaction/split — não toca o SSOT financeiro.

**Declarados NÃO-SSOT:** regra de materialização por bucket (representação física, projeção da conservação já selada) · matriz de materialização (derivação determinística dos amounts) · guard/manifesto/nomenclatura (prova/projeção) · cartório (estado operacional).

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only**. Fecha a lacuna física apontada pelo STOP do PASSE 3 e promulga a **representação física dos buckets econômicos de valor zero** na composição fiscal-Bank da FISCAL-4E. **NÃO autoriza material novo** além do já condicionado (o material 4E permanece sob o `GO MATERIAL` já existente, suspenso durante o rito desta DECISION e re-executável após o selo Yala, sem novo GO material). **NÃO altera** DECISION-0179 nem DECISION-0182 (ambas byte-intactas); **complementa** o contrato de continuação residual (0182 D2) cobrindo o ramo zero.

**Não governa e não autoriza:** código · migration · DDL · DML · manifesto · nomenclatura · guard · teste · runner · Bank write · conta fiscal · transaction · split · ledger · policy · seed · caller · rota · worker · frontend · remoção de CHECK.

---

## FATO FÍSICO (fundamento probatório, read-only 2026-07-15)

Prova de 1ª mão do schema vivo (`unificard_dev`, consulta read-only a `pg_constraint`):

```text
bank_splits_amount_cents_check :: CHECK ((amount_cents > 0))
bank_ledger_amount_cents_check :: CHECK ((amount_cents > 0))
```

**Consequência:** um bucket econômico de valor **zero** é um estado **válido** (0178/0179: `commission_gross = tax_reserve + commission_distributable`, ambas parcelas ≥ 0), mas uma **linha física Bank** (split + ledger leg) de valor zero é **fisicamente proibida** pelo sink canônico. DECISION-0182 D2, ao prescrever sempre duas linhas, é **silenciosa** e **inimplementável** quando um dos buckets é zero. Esta DECISION resolve a colisão **sem** remover o CHECK e **sem** inventar sentinela.

---

## D1 — REGRA CANÔNICA DE MATERIALIZAÇÃO POR BUCKET

Fixa-se a regra física, **simétrica** para os dois buckets da composição fiscal-Bank:

```text
BUCKET ECONÔMICO COM amount > 0  →  MATERIALIZA UMA LINHA BANK
BUCKET ECONÔMICO COM amount = 0  →  NÃO MATERIALIZA LINHA BANK
                                    (preserva o zero no EVENTO e no FINGERPRINT)
```

Vale igualmente para `commission_distributable` (continuation line) e `tax_reserve` (tax_reserve line).

A **ausência da linha zero é normalização física, não desaparecimento econômico**: o valor zero permanece registrado no `fiscal_provision_event` e participa do `fiscal_economic_context_fingerprint`. A presença física de cada linha é **derivável deterministicamente** do amount do bucket — não se cria nova coluna de flag (a derivação `amount > 0 ⇒ linha presente` é suficiente).

---

## D2 — MATRIZ DE MATERIALIZAÇÃO

```text
tax_reserve > 0  ·  commission_distributable > 0   →  continuation line + tax_reserve line   (DUAS)
tax_reserve > 0  ·  commission_distributable = 0   →  somente tax_reserve line                (UMA)
tax_reserve = 0  ·  commission_distributable > 0   →  somente continuation line               (UMA)
tax_reserve = 0  ·  commission_distributable = 0   →  INVARIANT VIOLATION neste caminho
```

O quarto caso (`tax_reserve = 0` **e** `commission_distributable = 0`) implica `commission_gross = 0`, **incompatível** com uma source split física positiva de `commission_gross` (a source line que dispara a transformação tem, por construção, `amount = commission_gross > 0`). Este caminho é **fail-closed** (violação de invariante), nunca uma linha de zero.

---

## D3 — CONSERVAÇÃO (não exigir duas linhas artificialmente)

Preservam-se, em inteiros e sem float:

```text
commission_gross = tax_reserve + commission_distributable
Σ(linhas POSITIVAS materializadas) = commission_gross
```

Exige-se **de uma a duas** linhas conforme os buckets positivos (não duas obrigatórias). Nenhum centavo pode ser: criado · descartado · deslocado para outra conta · compensado por bucket alheio. A conservação global do sink (`Σsplits == transaction amount`) é preservada exatamente: a soma das linhas positivas materializadas iguala o `amount` da source line consumida.

---

## D4 — CONTINUATION LINE ZERO (`commission_distributable = 0`)

Quando `commission_distributable = 0`:

- **não** criar continuation split;
- **não** criar ledger leg de zero;
- **preservar no evento**: `commission_distributable = 0`; identidade da source line; destination snapshot original; split type original; titularidade e semântica econômica originais;
- **não** escolher novo destino; **não** transformar o valor em policy line.

A source line original de `commission_gross` é **consumida** pela transformação; quando distributable é zero, a **única** linha positiva materializada é `tax_reserve` (que carrega integralmente `commission_gross`).

---

## D5 — TAX RESERVE ZERO (`tax_reserve = 0`)

Quando `tax_reserve = 0`:

- **não** criar `tax_reserve` split;
- **não** criar ledger leg de zero;
- **preservar** `tax_reserve = 0` no evento e no fingerprint;
- **não** exigir conta `fiscal_reserve`;
- **não** invocar o resolver fiscal_reserve;
- **não** retornar `FISCAL_RESERVE_ACCOUNT_MISSING`;
- materializar **somente** a continuation line positiva.

**A inexistência de conta fiscal_reserve NÃO bloqueia** uma operação cuja reserva calculada é zero: o resolver (DECISION-0179 D4, lookup-only) é **condicional** a `tax_reserve > 0`.

---

## D6 — SOURCE DESTINATION (preservada mesmo sem materialização)

Mesmo quando a continuation line **não** é materializada (amount zero), preservam-se no evento: destination account original · split type original · owner/titularidade · tenant · currency · finalidade · semântica econômica.

**Proibido:** reescolher destino · trocar `platform_fees ↔ platform_revenue` · fallback · criar conta · materializar linha sentinela.

---

## D7 — EVENTO E FINGERPRINT

Os **dois** amounts (`tax_reserve`, `commission_distributable`) sempre participam do estado fiscal-econômico persistido — **inclusive quando zero**. A presença física das linhas deriva deterministicamente dos amounts (`amount > 0 ⇒ linha presente`; `amount = 0 ⇒ linha ausente`). **Não** se exige nova coluna de flag. **Não** se altera a raiz externa de idempotência (`tenant_id + reference_type + reference_id`, DECISION-0179 D11), nem a separação identidade-op × payload.

---

## D8 — FULL REVERSAL

O full reversal (DECISION-0179 D16):

- reutiliza os amounts e snapshots **originais**;
- reverte **somente** as linhas positivas que foram materializadas;
- bucket original zero **permanece zero** — **não** cria reversal line de zero;
- **não** recomputa imposto; **não** relê policy; **não** cria linha ausente no original;
- conservação continua exata.

```text
original: somente tax_reserve   →  reversal: somente tax_reserve reversa
original: somente continuation   →  reversal: somente continuation reversa
original: duas linhas            →  reversal: duas linhas reversas
```

---

## D9 — PROIBIÇÕES EXPLÍCITAS

Rejeitam-se: considerar zero como negativo · rejeitar `commission_distributable = 0` · rejeitar `tax_reserve = 0` · remover CHECK `amount_cents > 0` · criar linha de zero · linha sentinela · arredondamento artificial · clamp · fallback de conta · regional fund · policy line distributable · remittance · frontend · caller · firewall ON.

---

## D10 — IMPACTO NO PASSE 3 (registro; não retoma material)

Após o selo Yala desta DECISION:

- o **PASSE 3** poderá ser retomado (dentro do envelope material único já existente);
- o serviço materializará **somente buckets positivos** (uma a duas linhas conforme a matriz D2);
- o resolver fiscal_reserve será **condicional** a `tax_reserve > 0` (D5);
- `commission_distributable = 0` e `tax_reserve = 0` continuam **estados válidos** (não erro), com a source destination preservada no evento (D4/D6);
- testes permanentes e o **guard 186** deverão cobrir **toda** a matriz D2 (incluindo o quarto caso como fail-closed);
- o **PASSE 4** permanece posterior ao PASSE 3.

O **GO MATERIAL FISCAL-4E já existente permanece suspenso** durante o rito desta DECISION e volta a ser executável **após o selo**, **sem** necessidade de novo GO material.

---

## D11 — DORMÊNCIA E FRONTEIRAS PRESERVADAS

O material 4E permanece **estritamente dormente** (0179 D13 / 0182 D4):

```text
zero caller · firewall OFF · zero conta fiscal real · zero transaction persistente ·
zero split persistente · zero ledger · zero saldo · zero integração regional · zero integração popular
```

**Preservados e intactos:** DECISION-0179 (byte-intacta) · DECISION-0182 (byte-intacta) · 0178/0177/0165 · 4d-1/4d-2 · B-CITY-1 · canonicalização BankSplitType (0180/0181) · `applies_to` 5/3/2 · guard 4c-3 · runner 185 (186 reservada à 4E). **Manter OPEN:** `DT-INVOICING-HARDCODED-TAX-RATE` · `DT-REGION-FUND-DELEGATION-MODEL-PENDING`. **Manter:** B-CITY-2 **BLOQUEADA**.

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; esta DECISION não cria saldo/transaction/split (Lei 5; SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).
- **Autoridade não emerge de estrutura**: a ausência de linha zero é normalização física; nenhum destino novo, nenhuma distribuição nova (PROHIBITED_STRUCTURES).
- `commission_gross = commission_distributable + tax_reserve` (0178/0179) e `Σ(linhas positivas) = commission_gross` — conservação exata, sem centavo criado/descartado/deslocado.
- CHECK físico `amount_cents > 0` **preservado** (nunca removido, nunca contornado por sentinela).
- 4E permanece dormente; ativação econômica só por PORTA governada; sink firewall fail-closed OFF.

---

**STATUS: DECISION-0183 PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL FISCAL-4E NÃO RETOMADO · AGUARDA UMA ÚNICA AUDITORIA YALA.**

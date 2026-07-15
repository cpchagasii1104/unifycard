# DECISION-0180 — Bank Split Type Canonicalization Prerequisite: fonte canônica única de `BankSplitType`, eliminação das uniões inline duplicadas, reabertura estritamente tipológica dos selos e destravamento da FISCAL-4E

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL PRÉ-REQUISITO NÃO INICIADO · FISCAL-4E SUSPENSA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** F-BANK-SPLIT-TYPE-CANONICALIZATION-PREREQUISITE
**Base:** `rescue-structural @ fbbab7be7` (DECISION-0179 selada pela Yala · Veredito A)
**Insumo:** GATE de retomada do material FISCAL-4E (read-only, 2026-07-15) — STOP correto da executora sob §27 do `GO MATERIAL FISCAL-4E`; colisão provada de 1ª mão com o guard vivo; opções A/B/C apresentadas; **Clayton ratificou B como frente pré-requisito separada**.

**Deriva explicitamente de:** DECISION-0179 (D5 `split_type` = união viva + `tax_reserve`, governança por CHECK+manifesto+nomenclatura+guard; D19 preservação dos selos 4D-1/4D-1-R/0178/4D-2/B-CITY-1; D21 envelope material 4e) · DECISION-0178 (4D-2: guard que pina `service-payment-execution.service.ts` por sha256; item C — *"Se a execução provar impossibilidade material dessa preservação → STOP e retornar ao GATE; não alterar B-CITY-1 silenciosamente"*) · DECISION-0177 (B-CITY-1; arquivos protegidos) · F-GOVERNED-VOCABULARY-MANIFEST (manifesto descobrível; lição C1/R2 — vocabulário paralelo) · SSOT_EXCLUSIVE_BANK_RULE · LEI DE COERÊNCIA §4.6-4.7 · PROHIBITED_STRUCTURES · 00_AGENT_PROTOCOL §2.2/§2.3.2.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FINANCEIRO · POLICY/CONTEXTO · NOMENCLATURA · PERSISTÊNCIA · GOVERNANÇA DE VOCABULÁRIO · AUTHORITY · EVENTO/AUDITORIA · IDEMPOTÊNCIA · FISCAL (somente pela dependência da 4e).

**Documentos lidos e suficientes:** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 SSOT financeiro; Lei 7 semântica), `SSOT_REGISTRY_UNIFICARD.md` (§5 Bank), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira), `SSOT_EXCLUSIVE_BANK_RULE.md`, `PROHIBITED_STRUCTURES.md`, `07_NOMENCLATURA_CANONICA.md`, DECISION-0165/0166/0167/0177/0178/0179, cartório `REMEDIATION_DT_LOG.md` e `dividatecnica.md`. **Suficiência:** a frente é **tipológica e de governança de vocabulário**, sem DB, sem migration e sem dinheiro; o conjunto acima cobre a fronteira financeira (o que NÃO pode ser tocado), a governança de vocabulário (a casa da correção) e os selos afetados (o que precisa ser reconciliado).

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > normas de domínio > decisions > cartório > código > conveniência.

**Pilar afetado:** FINANCEIRO (vocabulário do split; **nenhum** saldo/transaction/split real) · governança de NOMENCLATURA.

**SSOT financeiro:** `bank_ledger` / UnifyBank. **Autoridade legítima do dinheiro:** domínio Bank (SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE). A canonicalização de tipo **não cria** dinheiro, saldo, transaction ou split — não toca o SSOT financeiro.

**Declarados NÃO-SSOT:** `governed-vocabularies.manifest.ts` (registro descobrível / projeção verificada, nunca fonte) · `07_NOMENCLATURA_CANONICA.md` (nomenclatura, não autoridade de valor) · guards (prova, não verdade) · unions inline (que é exatamente o defeito a eliminar).

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only**. Promulga a **forma institucional** da canonicalização prévia de `BankSplitType` e **não autoriza material**, que exige `GO MATERIAL` próprio após o selo Yala desta DECISION.

**Não governa e não autoriza:** código · TypeScript · manifesto · nomenclatura · guard · hash/pin · migration · DDL · DML · Bank write · material FISCAL-4E · `tax_reserve` · CHECK de split type · conta fiscal · transaction · split · ledger · caller monetário · firewall · rota · worker · frontend.

---

## FATOS MATERIAIS DO GATE (fundamento probatório, read-only 2026-07-15)

Confirmados **de 1ª mão** no HEAD `fbbab7be7`:

**1 · Baseline preservado.** `bank_accounts=16 · regional_fund_accounts=1 · bank_transactions=0 · bank_ledger=0 · bank_splits=0 · saldo Curitiba=0 · Δbank=0`. Firewall `BANK_TRANSACTION_SINK_FIREWALL_ENABLED` default-OFF fail-closed. Zero caller monetário vivo. Material FISCAL-4E **não iniciado** (zero migration 4e; zero conta fiscal).

**2 · Vocabulário atual (6 valores).** Fonte tipológica viva: `src/modules/bank/bank-split.types.ts`, símbolo `BankSplitType` — hoje uma **union de tipo literal**, sem array de valores:

```text
fee · regional_fund · reserve · escrow · revenue_share · referral
```

`bank_splits.split_type` é **TEXT LIVRE, sem CHECK** no banco (a governança física é a 4e).

**3 · Duplicações reais (o defeito).** Uniões inline equivalentes ao vocabulário, declaradas fora da fonte canônica:

| Arquivo | Linha(s) | Forma |
|---|---|---|
| `src/modules/services/service-payment-execution.service.ts` | 65 | `splitType: 'fee' \| 'regional_fund' \| 'reserve' \| 'escrow' \| 'revenue_share' \| 'referral'` |
| `src/modules/bank/bank-integration.service.ts` | 237, 354 | idem |

**4 · Guard vivo e true-positive.** `scripts/audit-governed-vocabulary-manifest.mjs` está **vivo no runner**: `run-regression-guards.mjs` (linha 149) → `audit-authority-residual-hygiene-suite.mjs` (linha 17) → guard do manifesto. Sua trava **anti-paralelo** morde quando ≥ (n−1) valores reaparecem em arquivo que não referencia o símbolo canônico. Prova executada com o guard real (entrada registrada, guard rodado, sonda **revertida**, manifesto byte-intacto, guard de volta a `GATE OK` / 28 vocabulários, **zero resíduo**):

```text
GATE FAIL [governed-vocabulary-manifest]:
 [bank_splits.split_type] ANTI-PARALELO: 6/7 valores ... reaparecem em
   src/modules/bank/bank-integration.service.ts SEM importar/referenciar ...
 [bank_splits.split_type] ANTI-PARALELO: 6/7 valores ... reaparecem em
   src/modules/services/service-payment-execution.service.ts SEM importar/referenciar ...
```

A mordida é **legítima**: é cópia real do mesmo vocabulário — exatamente o smell C1/R2 que o manifesto existe para eliminar.

**5 · Proteção anterior (retificação factual do GATE).** Verificado de 1ª mão **quem realmente pina** `service-payment-execution.service.ts`:

- **`scripts/audit-fiscal-economic-policy-composition.mjs` (guard 4D-2) — ÚNICO que pina por sha256**, na trava `B1`:
  `eba0e1c3fd363e5bea7091d41d7898f475c6bfb27a18b0095af6ebad976c9dd2` — **idêntico ao hash vivo do arquivo** (confirmado).
- **`scripts/audit-bank-city-curitiba-foundation.mjs` (guard B-CITY-1) — NÃO pina hash algum.** Referencia o SPE por **caminho** (linha 29) e o assere por **regras de conteúdo** (R1–R9: `resolveActorTerritory` awaited, ausência de fallback `profile/RESIDENCE`, fail-closed de `cityId`, seleção payer/receiver por basis, cadeia territorial por FK, infra propaga). O guard não contém nenhum literal de 64 hex.

**Consequência institucional:** o único **repin de hash** exigido pela canonicalização é o `B1` do guard 4D-2. O guard B-CITY-1 permanece **intocado** — uma troca estritamente tipológica não altera nenhuma das regras R1–R9 que ele assere.

**6 · Sem cascata.** Nada pina o hash do próprio guard 4D-2 (`8d1e920f0bb3ffbbb73d6f729427587a5f7c7653d16fffd8a45a531bbe48c0c7`): repinar `B1` é alteração-folha, sem efeito dominó.

**7 · Arquitetura real do manifesto (fato decisivo para D3).** `governed-vocabularies.manifest.ts` **não importa nada** hoje (módulo de dados puro), e seu guard **parseia o manifesto textualmente** por regex, extraindo literais:

```js
const valuesRaw = (b.match(/values:\s*\[([^\]]+)\]/) || [])[1];
const values = valuesRaw.split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
```

Prova executada (entrada-sonda com referência TS `values: [...SYMBOL]`, guard real rodado, sonda **revertida**, guard de volta a `GATE OK` / 28, **zero resíduo**):

```text
GATE FAIL [governed-vocabulary-manifest]:
 [probe.split_type] ANTI-DRIFT: valores no manifesto mas AUSENTES na fonte
   src/modules/bank/bank-split.types.ts: ...BANK_SPLIT_TYPES_PROBE
```

**Uma referência TS no campo `values` quebra o parser do guard** — o spread é lido como o literal `'...SYMBOL'`. Isto é **fato material provado**, não opinião de forma (ver D3).

---

## D1 — REJEIÇÃO DAS OPÇÕES A E C

### Opção A — REJEITADA

**Proibido criar:** exceção no guard · entrada em `PARALLEL_ALLOWLIST` · waiver · supressão · DT para **tolerar** a duplicação · limiar especial para SPE · comentário de justificativa no lugar da correção.

**Fundamento:** o guard encontrou uma **duplicação real do mesmo vocabulário**; **não se cria exceção para um true-positive**. O manifesto nasceu para impedir vocabulários paralelos como os agora encontrados (lição C1/R2); criar allowlist para essa cópia repetiria o problema que o guard existe para eliminar. Abrir DT para algo **tecnicamente corrigível** preservaria o hash, mas **não preservaria a coerência do sistema**.

### Opção C — REJEITADA

**Proibido adiar** o registro do manifesto para depois da FISCAL-4E.

**Fundamento:** a DECISION-0179 exige **CHECK + tipo + manifesto + nomenclatura + guard** como **conjunto governado** (D5/D21); omitir o manifesto deixaria D5/D21 incompletas e impediria um **selo íntegro** da 4e.

### Opção B — RATIFICADA, como frente pré-requisito SEPARADA

Eliminar a duplicação **antes** de retomar a 4e, canonicalizando **primeiro os seis valores atuais** e só depois estendendo para `tax_reserve`.

---

## D2 — FONTE CANÔNICA ÚNICA

Promulga-se **uma única fonte canônica** do vocabulário atual de split type, **no domínio Bank**, no arquivo vivo que já governa `BankSplitType` (`src/modules/bank/bank-split.types.ts` — caminho confirmado de 1ª mão).

Forma conceitual:

```ts
export const BANK_SPLIT_TYPES = [
  'fee',
  'regional_fund',
  'reserve',
  'escrow',
  'revenue_share',
  'referral',
] as const;

export type BankSplitType = (typeof BANK_SPLIT_TYPES)[number];
```

O tipo passa a ser **derivado** do array de valores — a union literal deixa de ser declaração independente. **A ordem dos seis valores é a viva, preservada literalmente.**

**Proibido:** segundo enum · segundo array · segundo registry · tipo paralelo em Services · tipo paralelo em Integration · cópia no manifesto como verdade independente · vocabulário local em DTO/schema.

**Regra:**

```text
um vocabulário → um símbolo de valor → um tipo derivado → consumidores por referência
```

---

## D3 — MANIFESTO: REFERÊNCIA POR DECLARAÇÃO + VERIFICAÇÃO ANTI-DRIFT

O material pré-requisito deverá registrar `bank_splits.split_type` em `src/core/governance/governed-vocabularies.manifest.ts` com os **seis valores atuais**, `sourceFile` = a fonte canônica (D2) e `symbol` = **`BANK_SPLIT_TYPES`**.

**Forma promulgada (a única materialmente possível — fato 7):** a **referência à fonte canônica** materializa-se pelos campos **`sourceFile` + `symbol`**, e os `values` são uma **projeção verificada** que o guard confronta com a fonte viva a cada execução (ANTI-DRIFT).

**Fundamento — por que isto NÃO é "segunda verdade" nem "duplicação tolerada":**

1. **Referência TS é materialmente impossível:** provado (fato 7) que `values: [...BANK_SPLIT_TYPES]` **quebra o parser textual do guard**, que extrai literais por regex. Não é preferência de estilo: é o mecanismo real do guard.
2. **Ela seria, ademais, inversão de camada:** o manifesto vive em `core/governance/` e não importa nada hoje; importar de `modules/bank/` inverteria a direção `core → modules`.
3. **A arquitetura do manifesto é, por desenho, projeção-verificada:** os 28 vocabulários vivos (incluindo os do pilar `money`) funcionam assim. O que impede a "segunda verdade" **não é a ausência de literais — é o ANTI-DRIFT**, que morde no instante em que manifesto e fonte divergem. Duplicação **tolerada** é a que ninguém confere; esta é **conferida e fail-closed**.

**Proibido:** alterar o parser do guard para aceitar spread · registrar valores sem `symbol`/`sourceFile` · registrar valores que a fonte não contenha · manter no manifesto valor removido da fonte.

O guard `audit-governed-vocabulary-manifest.mjs` deve permanecer **semanticamente intacto**: sem allowlist nova · sem redução de limiar · sem exceção por arquivo · sem exclusão de Services · sem exclusão de Bank Integration.

> **Ressalva registrada para a auditoria Yala:** o `GO DECISION` indicava como *forma preferencial* "manifesto → referência a `BANK_SPLIT_TYPES`", com STOP se a arquitetura não permitisse referência **por ciclo ou violação de camadas**. A execução provou um **terceiro impedimento, não previsto no GO e literalmente fora da sua condição de STOP**: o **parser textual do próprio guard**. Como a condição literal de STOP não se realizou e a forma preferencial se provou materialmente impossível, promulga-se a forma acima — **explicitamente declarada, provada e submetida à Yala**, jamais silenciosa.

---

## D4 — CONSUMIDORES

O material deverá substituir as uniões inline em `service-payment-execution.service.ts` e `bank-integration.service.ts` por **import/referência ao símbolo canônico**.

Uso **somente tipológico** → `import type { BankSplitType } from '...'` (**`import type` obrigatório**, para não introduzir mudança de runtime desnecessária).

Havendo validação **runtime**, usar exclusivamente `BANK_SPLIT_TYPES` ou helper derivado da mesma fonte.

**Proibido:** union inline · `as BankSplitType` sem validação · lista copiada · array local · enum local · schema local com os mesmos tokens · fallback de string livre.

---

## D5 — REABERTURA ESTREITA DOS SELOS

Autoriza-se **futuramente** (material próprio) uma reabertura técnica **estreita** de `src/modules/services/service-payment-execution.service.ts`, **exclusivamente** para:

- adicionar o import tipológico canônico;
- substituir a union inline por `BankSplitType`;
- preservar **toda** lógica, fluxo, cálculo, caller e comportamento.

Nenhuma outra alteração nesse arquivo é autorizada. A mudança deve ser:

```text
byte-diferente · semanticamente equivalente · runtime-equivalente · financeiramente neutra
```

Exige-se prova de que o **JavaScript emitido** da região funcional permanece equivalente, descontadas diferenças de source map/metadados não executáveis. (Nota material: `import type` é **apagado na emissão**; a substituição de uma union de tipo por um alias de tipo **não emite runtime** — a prova deve confirmá-lo, não presumi-lo.)

Autoriza-se igualmente `src/modules/bank/bank-integration.service.ts`, **exclusivamente** para remover as uniões inline (linhas 237 e 354) e usar a fonte canônica.

**Nenhuma alteração de:** split calculation · amount · bps · destino · lock · transaction · ledger · idempotência · policy · fiscal · regional fund · caller · firewall.

---

## D6 — GUARDS E PINS

O material deverá reconciliar **conscientemente** e **de forma indivisível no mesmo commit**:

| Guard | Ação | Fundamento (1ª mão) |
|---|---|---|
| `scripts/audit-fiscal-economic-policy-composition.mjs` (4D-2) | **Repin do hash de SPE** na trava `B1` | é o **único** que pina SPE por sha256 |
| `scripts/audit-bank-city-curitiba-foundation.mjs` (B-CITY-1) | **Nenhuma alteração esperada** | **não pina hash**; assere SPE por conteúdo (R1–R9), que a mudança tipológica não toca |

Se, contra o previsto, o guard B-CITY-1 precisar mudar, seu novo hash deverá ser repinado na trava `B1` do guard 4D-2 (que pina `GUARD_BCITY = d359f18db345137e91d06db1276475250f97e18c1bd4498ad5fab2cbc60387f9`), **no mesmo commit material**.

**Permitido somente:** atualizar o hash esperado de SPE · provar que a mudança é exclusivamente tipológica · novo pin indivisível no mesmo commit · mutations que provem que **alterações funcionais continuam mordendo**.

**Proibido:** remover o pin · enfraquecer a proteção · transformar hash exato em regex frouxa · excluir SPE da proteção · permitir alterações funcionais futuras · alterar outros hashes sem causa · abrir B-CITY-1 além da mudança tipológica.

O histórico dos hashes anteriores permanece **no cartório** (append-only). Após material e auditoria, **B-CITY-1 e FISCAL 4D-2 serão re-seladas quanto aos novos hashes**, **sem reabrir suas decisões econômicas**.

---

## D7 — NENHUMA MUDANÇA FINANCEIRA

A canonicalização é **estritamente tipológica e de governança**. Estado financeiro obrigatório, antes e depois:

```text
bank_accounts: inalterado (16)
bank_transactions: 0 · bank_splits: 0 · bank_ledger: 0
saldo Curitiba: 0 · Δbank = 0
```

**Proibido:** migration · CHECK DB · DDL · DML de negócio · criação de split/account · mudança de `BankTransactionService` · ativação de sink · alteração de firewall · novo caller · `tax_reserve` · `fiscal_reserve` · treasury source fiscal.

**O CHECK de sete valores pertence à retomada da 4e, não ao pré-requisito.**

---

## D8 — SEIS AGORA, SETE NA 4E

O pré-requisito governa **somente**: `fee · regional_fund · reserve · escrow · revenue_share · referral`.

**Não introduzir `tax_reserve` nesta frente.**

Após o pré-requisito material estar **selado**, a retomada da FISCAL-4E fará apenas a **extensão governada**:

```text
BANK_SPLIT_TYPES: 6 → 7        novo valor: tax_reserve
```

Na retomada 4e: a manifestação ocorre por **extensão da fonte canônica**; os consumidores **já estarão referenciando o símbolo**; o guard anti-paralelo deve **permanecer verde** (com 7 valores o limiar sobe para 6, e nenhum arquivo consumidor voltará a listar valores); o CHECK DB de sete valores poderá ser criado; **nenhuma nova união inline será necessária**.

---

## D9 — RUNNER-NEUTRAL

O pré-requisito é **runner-neutral**. Baseline: **185** (confirmado de 1ª mão).

Provas deverão usar os guards vivos existentes: `audit-governed-vocabulary-manifest` · guard B-CITY-1 · guard FISCAL 4D-2 · typecheck · testes existentes · mutation harness delimitado.

**Não criar novo comando top-level no runner.** Se um novo comando top-level se provar indispensável → **STOP · RETORNAR AO GATE**.

**Fundamento:** a DECISION-0179 (D19) já **reserva `185 → 186`** para o guard material da FISCAL-4E. O pré-requisito **não pode consumir essa posição**.

---

## D10 — MUTATIONS FUTURAS (o material deverá provar que MORDEM)

1. reintroduzir a union inline em SPE;
2. reintroduzir a union inline em `bank-integration`;
3. copiar os seis valores em novo arquivo sem referência;
4. criar allowlist para SPE;
5. reduzir o limiar do guard;
6. remover valor da fonte canônica;
7. adicionar sétimo valor não autorizado;
8. alterar lógica de SPE junto com o import;
9. alterar cálculo de Bank Integration;
10. atualizar hash sem atualizar o arquivo;
11. atualizar arquivo sem atualizar o hash;
12. remover pin B-CITY;
13. remover pin 4d-2;
14. usar cast cego (`as BankSplitType` sem validação);
15. criar tipo paralelo em Services.

**Controles benignos (não podem morder):** `import type` canônico · uso do tuple canônico no manifesto · comentário contendo tokens · documentação narrativa sem declaração tipológica.

Exigir **resíduo-zero byte-a-byte** após as mutations.

---

## D11 — PROVAS DE EQUIVALÊNCIA

O material deverá provar: typecheck **0** · runner **185** verde · guard do manifesto verde · guard B-CITY verde · guard 4D-2 verde · zero reachability nova · zero caller novo · firewall OFF · **zero diff funcional** em SPE · **zero diff funcional** em Bank Integration · zero Bank write · `Δbank=0` · hashes novos pinados **no mesmo commit** · hashes antigos preservados no cartório · manifesto com os seis valores por `symbol`+`sourceFile` sob ANTI-DRIFT · nomenclatura com os seis valores · **nenhuma união inline residual**.

A prova de equivalência deverá comparar **antes × depois** para: funções exportadas · parâmetros · retorno · call graph · emitted runtime · comportamento financeiro · erros · side effects.

---

## D12 — ESCOPO MATERIAL FUTURO

Após o selo desta DECISION **e** GO material próprio, o envelope poderá alterar **somente** o conjunto mínimo, conceitualmente:

```text
src/modules/bank/bank-split.types.ts
src/modules/services/service-payment-execution.service.ts
src/modules/bank/bank-integration.service.ts
src/core/governance/governed-vocabularies.manifest.ts
docs/01_normative/07_NOMENCLATURA_CANONICA.md
scripts/audit-fiscal-economic-policy-composition.mjs   (repin B1)
mutations/testes delimitados
```

O **inventário exato deve ser fechado antes do material** (incluindo eventuais consumidores adicionais que o material venha a descobrir de 1ª mão).

**Nenhum arquivo fiscal 4e · nenhuma migration · nenhum DB · nenhuma conta · nenhum caller.**

Se **outro** arquivo protegido precisar ser alterado → **STOP · RETORNAR AO GATE**.

---

## D13 — SEQUÊNCIA INSTITUCIONAL

```text
1. DECISION docs-only do pré-requisito        ← ESTE ATO
2. auditoria Yala da DECISION
3. selo docs-only da DECISION
4. GO material do pré-requisito
5. material de canonicalização dos seis valores
6. auditoria Yala do material
7. selo do pré-requisito e dos novos hashes
8. GO RETOMAR MATERIAL FISCAL-4E
9. retomada 4e: extensão 6 → 7 com tax_reserve
```

**Nenhuma etapa autoriza automaticamente a seguinte.**

O `GO MATERIAL FISCAL-4E` anterior fica **SUSPENSO · NÃO REVOGADO · NÃO EXECUTÁVEL**. A retomada exigirá gatilho humano literal: **`GO RETOMAR MATERIAL FISCAL-4E`**.

---

## D14 — FRONTEIRAS

```text
MATERIAL FISCAL-4E: NÃO INICIADO      BANK: INTACTO       Δbank = 0
FIREWALL: OFF                          CALLER MONETÁRIO: ZERO
```

**Manter OPEN:** `DT-INVOICING-HARDCODED-TAX-RATE` · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` (**não governa a reserva fiscal**).

**Manter:** `B-CITY-2` **BLOQUEADA**.

**Não criar nova DT para a duplicação** — a opção escolhida é **eliminá-la**, não tolerá-la.

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; nenhuma canonicalização de tipo cria saldo/transaction/split (Lei 5; SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).
- **Autoridade não emerge de estrutura**: o vocabulário tem UMA fonte; manifesto/nomenclatura/guard são projeção e prova, nunca verdade (PROHIBITED_STRUCTURES).
- **Não se cria exceção para true-positive**: o guard que pega vocabulário paralelo permanece íntegro (lição C1/R2).
- Selos anteriores preservados na **semântica**; reabertura apenas **tipológica**, provada e re-selada (DECISION-0177/0178/0179).
- Ativação econômica só por PORTA governada; sink firewall permanece fail-closed OFF.

---

**STATUS: DECISION-0180 PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL PRÉ-REQUISITO NÃO INICIADO · FISCAL-4E SUSPENSA · AGUARDA UMA ÚNICA AUDITORIA YALA.**

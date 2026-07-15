# DECISION-0181 — Governed Vocabulary Source and Derived Reference Contract: contrato entre fonte de vocabulário (`const as const`), tipo derivado, manifesto e guard anti-paralelo, destravando a canonicalização do `BankSplitType`

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL NÃO INICIADO · FISCAL-4E SUSPENSA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** F-GOVERNED-VOCABULARY-DERIVED-TYPE-REFERENCE-CONTRACT
**Base:** `rescue-structural @ a399c98b31502a0da666ba1bd67948049cd6c3ac` (DECISION-0180 selada + errata cartorial validada read-only)
**Insumo:** GO MATERIAL BANK-SPLIT-TYPE CANONICALIZATION PREREQUISITE → **STOP CORRETO da executora** ao provar de 1ª mão, com o guard real, uma colisão entre a forma mandada pela DECISION-0180 (D3 `symbol=BANK_SPLIT_TYPES` × D4 consumidores usam `BankSplitType`) e o mecanismo textual do guard anti-paralelo a 6 valores. Clayton ratificou **R2 endurecida + R3**, rejeitou **R1**, em frente própria docs-only.

**Deriva explicitamente de:** DECISION-0180 (D2 fonte canônica única; D3 manifesto por `sourceFile`+`symbol` sob ANTI-DRIFT; D4 consumidores por `import type`; D6 repin único da SPE no 4D-2; D8 seis agora/sete na 4e; D9 runner-neutral 185/186 reservada; D11 provas de equivalência; D12 escopo material futuro — "inventário exato fechado antes do material, incluindo consumidores adicionais descobertos de 1ª mão") · DECISION-0179 (D5/D19/D21) · F-GOVERNED-VOCABULARY-MANIFEST (lição C1/R2 — vocabulário paralelo) · LEI DE COERÊNCIA §8 (linguagem única: vocabulário define valores válidos) · PROHIBITED_STRUCTURES ("autoridade não emerge de estrutura") · SSOT_EXCLUSIVE_BANK_RULE · 00_AGENT_PROTOCOL §2.2/§2.3.2.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** GOVERNANÇA DE VOCABULÁRIO · NOMENCLATURA · FINANCEIRO (vocabulário do split; **nenhum** saldo/tx/split real) · POLICY/CONTEXTO · PERSISTÊNCIA · AUDITORIA · FISCAL (somente pela dependência futura da 4e).

**Documentos lidos e suficientes (1ª mão):** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 SSOT financeiro; Lei 7 semântica), `SSOT_REGISTRY_UNIFICARD.md` (§5.5 Bank Split), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira; §8 linguagem única), `PROHIBITED_STRUCTURES.md`, `CORE_IMUTAVEL.md`, `07_NOMENCLATURA_CANONICA.md` (§4.55), `DECISION_0180_*`, cartório `REMEDIATION_DT_LOG.md` + `dividatecnica.md`. **Código lido de 1ª mão:** `bank-split.types.ts`, `service-payment-execution.service.ts`, `bank-integration.service.ts`, `bank-split-engine.service.ts`, `governed-vocabularies.manifest.ts`, `audit-governed-vocabulary-manifest.mjs`, `audit-fiscal-economic-policy-composition.mjs`, `audit-bank-city-curitiba-foundation.mjs`, `run-regression-guards.mjs`. **Suficiência:** a frente é **de governança de vocabulário** (contrato fonte×tipo derivado×manifesto×guard×consumidor), sem DB, sem migration e sem dinheiro; o conjunto cobre a fronteira financeira (o intocável), a casa da correção (o manifesto/guard de vocabulário) e a colisão provada no código vivo.

**Precedência aplicada:** Constituição > Leis Operacionais > SSOT Registry > Ontologia > demais normas > Decisions > Cartório > Código > Conveniência.

**Pilar afetado:** GOVERNANÇA DE VOCABULÁRIO / NOMENCLATURA. Nenhum saldo, transaction ou split real é criado ou tocado.

**SSOT financeiro:** `bank_ledger` / UnifyBank. **Autoridade legítima do dinheiro:** domínio Bank (SSOT_REGISTRY §5.2-5.5; SSOT_EXCLUSIVE_BANK_RULE). Este contrato **não cria** dinheiro/saldo/transaction/split — não toca o SSOT financeiro.

**Declarados NÃO-SSOT:** `BANK_SPLIT_TYPES` (vocabulário governado — fonte de VALOR, nunca autoridade financeira) · `BankSplitType` (tipo **derivado**, projeção tipológica, não porta valores por autoridade própria) · `governed-vocabularies.manifest.ts` (registro/projeção governada, nunca fonte runtime) · guards (prova, não verdade) · `07_NOMENCLATURA_CANONICA.md` (nomenclatura, não autoridade de valor) · cartório (estado operacional).

---

## FATOS DA COLISÃO (fundamento probatório, provado de 1ª mão com o guard real, 2026-07-15)

Sob o `GO MATERIAL BANK-SPLIT-TYPE CANONICALIZATION PREREQUISITE`, a executora executou os passos tipológicos e registrou `bank_splits.split_type` no manifesto (`symbol=BANK_SPLIT_TYPES`, 6 valores). O guard real acusou **GATE FAIL**:

```text
GATE FAIL [governed-vocabulary-manifest]: entradas=29 failures=2
 ❌ [bank_splits.split_type] ANTI-PARALELO: 5/6 valores reaparecem em
    src/modules/bank/bank-split-engine.service.ts SEM referenciar BANK_SPLIT_TYPES
 ❌ [bank_splits.split_type] ANTI-PARALELO: 5/6 valores reaparecem em
    src/modules/services/service-payment-execution.service.ts SEM referenciar BANK_SPLIT_TYPES
```

**Causa-raiz (mecânica exata do guard, `audit-governed-vocabulary-manifest.mjs`):**

1. **Limiar anti-paralelo = (n−1).** Com 6 valores, o limiar é **5**.
2. **O legitimador é textual:** `importsCanon = new RegExp(e.symbol).test(code)` com `e.symbol = 'BANK_SPLIT_TYPES'`. Só perdoa a coocorrência de valores em arquivos que contenham **essa string exata** (o **const**).
3. **A DECISION-0180 D4 manda os consumidores usarem `import type { BankSplitType }`** — o **tipo derivado**, cuja grafia **não contém** a string `BANK_SPLIT_TYPES`.
4. **Dois arquivos do Bank usam legitimamente ≥5 dos 6 valores como literais escalares** de lógica de split (percentuais/destinos), **não** como declaração paralela de vocabulário:
   - `service-payment-execution.service.ts` → 5/6 (`fee · regional_fund · reserve · escrow · revenue_share`);
   - `bank-split-engine.service.ts` → 5/6 (`fee · regional_fund · reserve · revenue_share · referral`).
5. **Consequência:** a 6 valores o guard morde AMBOS, embora ambos já referenciem o **tipo** canônico `BankSplitType` e os literais sejam **uso escalar benigno** (o "controle benigno" que o próprio guard nunca quis morder).

**Fato de escopo novo:** `bank-split-engine.service.ts` é um **terceiro** arquivo Bank materialmente relevante ao registro — **fora do inventário selado da 0180** (não é um dos 4 sites de union inline). Já importa `BankSplitType`; usa 5 valores escalares em lógica real de split. É **alcançado pelo guard**, mas **não** contém declaração paralela.

**Diagnóstico institucional:** a premissa da DECISION-0180 D8 ("os consumidores já estarão referenciando o símbolo; o guard anti-paralelo permanece verde") é **materialmente falsa a 6 valores**, porque o guard reconhece o **const** (`BANK_SPLIT_TYPES`) e a D4 faz os consumidores referenciarem o **tipo derivado** (`BankSplitType`). A 7 valores (4e) o limiar subiria para 6 e mascararia o defeito — a 6 ele morde. **A executora parou corretamente antes de commitar material** (nenhum commit; árvore revertida à base).

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only**. Promulga a **forma institucional** do contrato entre fonte de vocabulário governado, tipo derivado, manifesto e guard, e **não autoriza material**, que exige `GO MATERIAL` próprio após o selo Yala desta DECISION.

**Não governa e não autoriza:** código · TypeScript · manifesto · guard · nomenclatura · hash/pin · migration · DDL · DML · Bank write · material FISCAL-4E · `tax_reserve` · CHECK de split type · conta fiscal · transaction · split · ledger · caller monetário · firewall · rota · worker · frontend.

---

## D1 — REJEIÇÃO DA OPÇÃO R1

**R1 — REJEITADA.** Proposta rejeitada: tornar o manifesto `symbol: 'BankSplitType'` (o tipo derivado) para o guard reconhecer os consumidores.

**Fundamento:**

- `BankSplitType` é **tipo derivado** (`(typeof BANK_SPLIT_TYPES)[number]`) — **não possui os valores por autoridade própria**; é projeção.
- O campo que identifica a **fonte** dos valores deve continuar apontando para o **const** `BANK_SPLIT_TYPES` (quem porta os valores como `as const`).
- Usar o tipo derivado como *source symbol* **embaralharia fonte e projeção** — exatamente o que a governança de vocabulário existe para evitar (PROHIBITED_STRUCTURES: "autoridade não emerge de estrutura"; a fonte é o const, o tipo é derivação).

**Forma preservada:** `source symbol = BANK_SPLIT_TYPES` · `derived type = BankSplitType`. A solução **não** é confundir os dois — é o manifesto/guard passarem a **distinguir** os dois papéis (R2 endurecida).

---

## D2 — R2 ENDURECIDA — RATIFICADA: CONTRATO DE PAPÉIS

O contrato do manifesto/guard deve distinguir explicitamente **quatro papéis** de uma entrada de vocabulário governado:

```text
sourceFile          — arquivo canônico onde o vocabulário é definido
sourceSymbol        — símbolo que PORTA os valores por autoridade (o const `as const`)
derivedTypeSymbol   — símbolo do tipo DERIVADO aceito como referência nos consumidores
values              — projeção governada e verificável dos valores (anti-drift)
```

Os **nomes finais dos campos** podem seguir a convenção viva do manifesto, mas os **papéis** devem permanecer explícitos e separados. `sourceSymbol` identifica **quem possui** os valores; `derivedTypeSymbol` identifica **a projeção tipológica** que legitima um consumidor.

---

## D3 — R3 — RATIFICADA: INVENTÁRIO REAL DE CONSUMIDORES

O inventário real, descoberto de 1ª mão, distingue **duas classes**:

**(a) Declarações paralelas (unions inline a eliminar) — 4 sites / 2 arquivos:**

| Arquivo | Sites |
|---|---|
| `service-payment-execution.service.ts` | `ResolvedSplitDestination.splitType` · `LocalSplitRecipient.splitType?` |
| `bank-integration.service.ts` | `splitRecipients[].splitType?` · `splitLines[].splitType?` |

**(b) Consumidores relevantes para o guard — 3 arquivos:** os dois acima **mais** `bank-split-engine.service.ts`.

**`bank-split-engine.service.ts`:** não contém union paralela; **já consome `BankSplitType`**; usa **5 valores escalares** em lógica legítima de split; é alcançado pelo guard; **deve constar no inventário e na auditoria**; **não deve ter sua lógica econômica alterada** — só poderá ser tocado se estritamente necessário para tornar a referência tipológica direta e canônica.

**A distinção "declarações paralelas (4/2)" × "consumidores relevantes para o guard (3)" deve permanecer explícita** no manifesto/auditoria e no cartório.

---

## D4 — CONTRATO CANÔNICO

```text
BANK_SPLIT_TYPES  →  fonte única dos valores (const `as const`)
BankSplitType     →  tipo EXCLUSIVAMENTE derivado do tuple
manifesto         →  registro / projeção governada (não runtime, não segunda autoridade)
guard             →  prova de coerência (anti-drift) + prova estrutural de referência (anti-paralelo)
consumidor        →  referencia o TIPO DERIVADO canônico (import type)
```

Forma futura da fonte (materializada só sob GO material próprio):

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

Vocabulário desta frente: `fee · regional_fund · reserve · escrow · revenue_share · referral`. **`tax_reserve` permanece FORA** (extensão 6→7 = FISCAL-4E).

---

## D5 — EVOLUÇÃO DO MANIFESTO

A futura entrada de `bank_splits.split_type` deve conter conceitualmente:

```text
sourceFile:        (caminho de bank-split.types.ts, relativo a backend/)
sourceSymbol:      BANK_SPLIT_TYPES
derivedTypeSymbol: BankSplitType
values:            fee · regional_fund · reserve · escrow · revenue_share · referral
```

**Regras:**

1. `sourceSymbol` identifica **quem possui** os valores (o const).
2. `derivedTypeSymbol` identifica **a projeção tipológica** aceita nos consumidores (o tipo).
3. `values` permanece **projeção governada**, não autoridade runtime.
4. O manifesto **não importa** o módulo Bank (`core/governance` não depende de `modules/bank`).
5. O manifesto **não vira runtime**.
6. **Nenhuma segunda lista decisória** é criada.
7. O contrato deve ser **retrocompatível** com as demais entradas do manifesto.
8. Entradas **sem** tipo derivado (as 28 atuais) podem continuar **sem** `derivedTypeSymbol` (campo opcional).
9. A mudança **não pode** exigir novo comando top-level no runner (185 fixo).

A obrigação futura da 4e permanece **separada**: ANTI-DRIFT atual `manifesto ⊆ fonte`; na extensão 6→7, `manifesto = fonte` (bidirecional, fail-closed). **Não resolver essa igualdade nesta frente.**

---

## D6 — CONTRATO DO GUARD (ENDURECEDOR, NÃO PERMISSIVO)

A futura mudança do guard deve ser **semanticamente endurecedora**. O guard deve distinguir três situações:

### A — Declaração paralela de vocabulário (CONTINUA PROIBIDA, MORDE)

union literal concorrente · enum · tuple · array · Set · schema · objeto-registry · lista de validação · segundo tipo · fallback com o vocabulário completo · cópia em terceiro arquivo.

### B — Referência canônica ao tipo derivado (LEGITIMA)

Um consumidor só é legitimado quando houver **prova estrutural** de:

1. **import real** do `derivedTypeSymbol`;
2. origem no `sourceFile` canônico;
3. uso real em **posição tipológica**;
4. ausência de declaração paralela no mesmo arquivo;
5. ausência de alias/wrapper que esconda a origem, salvo autorização explícita.

Preferência: `import type { BankSplitType } from '.../bank-split.types';`

### C — Uso escalar legítimo de valores (NÃO É DECLARAÇÃO PARALELA, NÃO MORDE por si)

Exemplos legítimos: `splitType: 'fee'` · `case 'regional_fund'` · `value ?? 'revenue_share'`. **A simples coocorrência de cinco valores escalares em lógica distribuída não pode ser classificada automaticamente como segunda fonte.** É exatamente o falso-positivo que motivou esta DECISION.

---

## D7 — ANTI-BYPASS OBRIGATÓRIO

O guard **não** pode legitimar um arquivo apenas porque contém a string `BankSplitType`. **Não legitimam** o arquivo:

comentário · string · template string · regex · nome de variável · propriedade · import **não usado** · alias falso · declaração local homônima · namespace falso · re-export intermediário não governado · cast · `as BankSplitType` · type assertion · wrapper local.

**Também deve MORDER** (importar o tipo não perdoa uma segunda declaração):

```ts
import type { BankSplitType } from '.../bank-split.types';

type Local =
  | 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'revenue_share' | 'referral';
```

Ou seja: a legitimação (D6-B) exige prova **estrutural** de referência **E** ausência de declaração paralela (D6-A) no mesmo arquivo. As duas condições são conjuntas.

---

## D8 — ESCOPO MATERIAL FUTURO (envelope consolidado ÚNICO, só após selo + GO próprio)

Após o selo desta DECISION **e** `GO MATERIAL` próprio, **um único envelope consolidado** (contrato do guard + canonicalização do bank split) poderá alterar **somente**, conceitualmente:

```text
backend/src/modules/bank/bank-split.types.ts
backend/src/modules/services/service-payment-execution.service.ts
backend/src/modules/bank/bank-integration.service.ts
backend/src/modules/bank/bank-split-engine.service.ts        (só se necessário p/ normalizar a referência tipológica)
backend/src/core/governance/governed-vocabularies.manifest.ts
backend/scripts/audit-governed-vocabulary-manifest.mjs        (endurecimento do contrato)
docs/01_normative/07_NOMENCLATURA_CANONICA.md                 (§4.55: platform → escrow)
backend/scripts/audit-fiscal-economic-policy-composition.mjs  (SOMENTE o repin da SPE)
mutations/testes existentes ou estritamente delimitados
```

O envelope futuro deverá: **1)** criar `BANK_SPLIT_TYPES`; **2)** derivar `BankSplitType`; **3)** remover as 4 unions inline; **4)** manter usos escalares legítimos; **5)** registrar `sourceSymbol`+`derivedTypeSymbol`+`values` no manifesto; **6)** endurecer o guard (D6/D7); **7)** registrar `bank_splits.split_type`; **8)** reconciliar §4.55; **9)** remover `platform` como split type; **10)** adicionar `escrow`; **11)** atualizar o **único** pin da SPE no 4D-2; **12)** manter B-CITY byte-intacto; **13)** manter runner **185**; **14)** provar runtime equivalence; **15)** manter Bank intacto; **16)** manter `Δbank=0`.

O **inventário exato** deve ser fechado antes do material. Outro arquivo protegido → **STOP · RETORNAR AO GATE**.

---

## D9 — PROIBIÇÕES DO MATERIAL FUTURO

allowlist por arquivo · exceção para SPE · exceção para Bank Split Engine · redução do limiar · **regex de mera presença textual** como legitimador · import runtime **artificial** de `BANK_SPLIT_TYPES` · remover literais escalares legítimos · mudar cálculo/split/bps/destino/prioridade/policy · novo SSOT · segunda fonte · migration · DDL · DML persistente · `tax_reserve` · FISCAL-4E · conta fiscal · transaction · ledger · saldo · caller · rota · worker · frontend · firewall ON.

---

## D10 — MUTATIONS FUTURAS OBRIGATÓRIAS (o material deverá provar que MORDEM / que NÃO mordem)

**Devem MORDER:** (1) comentário contendo `BankSplitType`; (2) string contendo `BankSplitType`; (3) import não usado; (4) alias do import; (5) declaração local homônima; (6) cast `as BankSplitType`; (7) re-export intermediário; (8) union paralela no mesmo arquivo que importa o tipo; (9) enum paralelo; (10) tuple paralelo; (11) array paralelo; (12) Set paralelo; (13) schema paralelo; (14) cópia em terceiro arquivo; (15) `sourceFile` incorreto; (16) `sourceSymbol` incorreto; (17) `derivedTypeSymbol` incorreto; (18) derived type não derivado do tuple; (19) tipo derivado de segunda lista; (22) reintrodução das 4 unions; (23) allowlist; (24) redução de limiar; (25) alteração de qualquer das 28 entradas existentes; (26) novo comando 186; (27) alteração indevida de B-CITY; (28) alteração funcional da SPE; (29) alteração funcional da Bank Integration; (30) alteração funcional do Bank Split Engine.

**NÃO podem morder (controles benignos):** (20) usos escalares legítimos; (21) `bank-split-engine` por valores escalares; `import type` direto; uso tipológico real; usos escalares individuais; `targetType='platform'` fora de split type; comentário documental; entrada sem `derivedTypeSymbol` para vocabulários antigos.

Exigir **resíduo-zero byte-a-byte** após as mutations (cópia/sandbox ou restauração exata).

---

## D11 — RUNNER E GUARDS

**Runner = 185.** Novo comando top-level **proibido**. Posição **186 RESERVADA à FISCAL-4E** (D19/0179). A implementação deve **evoluir o guard existente** `audit-governed-vocabulary-manifest.mjs` — **não** criar segundo guard concorrente para o mesmo contrato. Guard **B-CITY byte-intacto**. Guard fiscal **4D-2 somente repin da SPE**. Qualquer necessidade de novo guard top-level → **STOP · NOVO GATE**.

---

## D12 — PROCESSO FUTURO

```text
1. DECISION-0181 docs-only                                   ← ESTE ATO
2. auditoria Yala read-only
3. selo final docs-only
4. GO material explícito da nova frente
5. material consolidado: guard contract + bank split canonicalization
6. cartório pré-auditoria
7. auditoria Yala material
8. selo material
9. novo GO RETOMAR MATERIAL FISCAL-4E
10. somente então extensão 6→7 (tax_reserve)
```

**Nenhuma etapa autoriza automaticamente a seguinte.** O `GO MATERIAL BANK-SPLIT-TYPE CANONICALIZATION PREREQUISITE` anterior fica **SUSPENSO · NÃO REVOGADO · NÃO EXECUTÁVEL** — e **não volta a valer automaticamente** após esta DECISION. O gatilho material futuro é o literal:

```text
GO MATERIAL GOVERNED VOCABULARY DERIVED REFERENCE CONTRACT AND RESUME BANK-SPLIT-TYPE CANONICALIZATION
```

---

## D13 — FRONTEIRAS PRESERVADAS

```text
DECISION-0180: SELADA · byte-intacta       FISCAL-4E: SUSPENSA
tax_reserve: FORA                          firewall: OFF
caller monetário: ZERO                     Bank: INTACTO        Δbank = 0
```

**Manter OPEN:** `DT-INVOICING-HARDCODED-TAX-RATE` · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` (**não governa a reserva fiscal**). **Manter:** `B-CITY-2` **BLOQUEADA**.

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; nenhum contrato de vocabulário cria saldo/transaction/split (Lei 5; SSOT_REGISTRY §5.5; SSOT_EXCLUSIVE_BANK_RULE).
- **Autoridade não emerge de estrutura**: o vocabulário tem UMA fonte (o const); o tipo é derivação; manifesto/guard são projeção e prova (PROHIBITED_STRUCTURES).
- **Não se cria exceção para true-positive nem se cega o guard para falso-positivo**: a solução é o guard **provar referência estrutural** e **distinguir uso escalar**, não allowlist nem regex frouxa (lição C1/R2 preservada e endurecida).
- Selos anteriores preservados: DECISION-0180 byte-intacta; B-CITY-1/4D-2/4D-1 intocados.
- Ativação econômica só por PORTA governada; sink firewall permanece fail-closed OFF.

---

**STATUS: DECISION-0181 PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL NÃO INICIADO · FISCAL-4E SUSPENSA · AGUARDA UMA ÚNICA AUDITORIA YALA.**

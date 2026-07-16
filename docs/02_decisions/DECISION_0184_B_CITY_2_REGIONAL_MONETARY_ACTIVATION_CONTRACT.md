# DECISION-0184 — B-CITY-2 · Curitiba Regional Monetary Activation Contract: composição regional sobre `commission_distributable`, continuação residual, matriz zero-bucket, snapshot/policy-version uniformes, authority/admin de policy regional, PORTA financeira separada e transparência sem poder — tornando DECIDÍVEL o futuro material B-CITY-2 (Curitiba-first, interno e dormente)

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL B-CITY-2 NÃO INICIADO · ATIVAÇÃO MONETÁRIA BLOQUEADA (PORTA SEPARADA) · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-16
**Frente:** B-CITY-2 · ATIVAÇÃO MONETÁRIA BANK CITY CURITIBA
**Base:** `rescue-structural @ 0b513c265` (selo final FISCAL-4E; DECISION-0165/0166/0177/0178/0179/0182/0183 seladas)
**Origem:** GATE B-CITY-2 (read-only, 2026-07-16) → **Veredito B** — substrato técnico SUFICIENTE, mas a materialização exige uma única DECISION institucional: a DECISION-0182 selou a allowlist sobre `commission_distributable` **VAZIA** e determinou que qualquer ampliação (inclusive `regional_fund`) **exige nova DECISION**. Clayton ratifica o Veredito B e concede `GO DECISION B-CITY-2`.

**Deriva explicitamente de:** DECISION-0165 (pipeline financeiro canônico único `economic_policy_engine` → `createTransactionWithExplicitSplitLines`; `Σsplits==amount`; D6 sem retarget retroativo) · DECISION-0166 (D0 origem regional = jurisdição cadastral do **comprador**, `regional_origin_basis='payer_identity_residence'`; D3 `regional_fund_accounts` por FK; D5 snapshot imutável + `policy_version_id`) · DECISION-0177 (B-CITY-1: conta municipal system pré-provisionada, lookup-only; **D2** origem = `payerActorId` via `resolveActorTerritory(..., 'ACTOR_RESIDENCE')`, nunca vendedor/profile/CEP; **D8** snapshot uniforme; F2 B-CITY-2 BLOQUEADA; linha regional futura `line_type='regional_fund'`/`applies_to='commission_distributable'`, gross/net proibidos) · DECISION-0178 (`applies_to` 5/3/2; `commission_distributable` gravável) · DECISION-0179 (`commission_gross = tax_reserve + commission_distributable`; reversal full-only; `existingClient`) · DECISION-0182 (allowlist `line_type × commission_distributable` VAZIA; ampliação exige nova DECISION) · DECISION-0183 (matriz zero-bucket: bucket=0 não materializa linha física) · SSOT_EXCLUSIVE_BANK_RULE · LEI DE COERÊNCIA §4.6-4.7 · 08_AUTORIDADE_CANONICA · PROHIBITED_STRUCTURES.

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FINANCEIRO/LEDGER · POLICY/CONTEXTO ECONÔMICO · AUTHORITY · TERRITÓRIO/ADDRESS · FISCAL (fronteira) · EVENTO/AUDITORIA · IDEMPOTÊNCIA/REVERSAL · NOMENCLATURA. **Nenhum** saldo/tx/split/policy/grant real — docs-only.

**PILAR:** MONEY. **SSOT FINANCEIRO:** `bank_ledger`/UnifyBank. **SSOT TERRITORIAL:** IDs canônicos country/state/city/neighborhood. **SSOT ADDRESS:** `addresses` + `address_assignments`. **SSOT ACTOR:** `actors`. **SSOT AUTHORITY:** `actor_capability_grants` + capability exata. **SSOT POLICY:** `economic_policies` + `economic_policy_lines`. **SSOT FISCAL:** `actor_fiscal_profiles` + `tax_types`/`tax_rules` (evidência em `fiscal_provision_events`/logs).

**Precedência:** Constituição > Leis Operacionais > SSOT Registry > Ontologia > normas aplicáveis > decisões seladas > cartório > código > conveniência.

**Declarado:** perfil NÃO decide residência financeira · category/N1/N2 NÃO decide território · frontend NÃO decide policy/taxa/destino/autoridade · cartório registra estado, não substitui código/SSOT · autoridade não emerge de estrutura.

**Esta DECISION NÃO cria** dinheiro/saldo/transaction/split/policy/grant/conta/PORTA — não toca o SSOT financeiro. **Declarados NÃO-SSOT:** allowlist (projeção de vocabulário governado) · contratos de composição/continuação/snapshot (transformação de forma) · cartório (estado operacional).

---

## D0 — PREMISSAS SELADAS (não reabertas)

`FISCAL-4D` **selada** · `FISCAL-4E` **selada** (byte-intacta; não alterada por esta DECISION) · `B-CITY-1` **preservada** · `ACTOR_RESIDENCE` = fonte territorial canônica · **CONTA CURITIBA** pré-provisionada (`system`, `actor_id NULL`, `account_type='credit'`, saldo 0, lookup-only) · SINK único no Bank · REVERSAL full-only/atômica/sem recomputação · FIREWALL default OFF · CALLER zero.

---

## D0-ESCOPO

Esta DECISION é **docs-only**. Torna **decidível** o futuro material B-CITY-2 **Curitiba-first**, interno e dormente. **NÃO autoriza material** (exige GO próprio) nem ativação (exige PORTA posterior separada). **NÃO abrange** outra cidade, bairro/N5 ou escala nacional. **NÃO altera/reescreve** DECISION-0182 nem qualquer decisão selada — **complementa** por extensão governada posterior.

---

## D1 — AMPLIAÇÃO CONSCIENTE DA ALLOWLIST (extensão da DECISION-0182)

Exclusivamente para o **envelope B-CITY-2**, a matriz `line_type × commission_distributable → materializável_no_Bank` deixa de ser vazia **apenas** em:

```text
line_type = 'regional_fund'  ·  applies_to = 'commission_distributable'  →  PERMITIDO (B-CITY-2)
```

Permanecem **NÃO** sobre `commission_distributable` nesta frente: `revenue_share · platform_fee · reserve · referral · group_allocation · channel_commission · custom`. A DECISION-0182 **não é alterada**; `regional_fund` **não** vira linha fiscal; a permissão **não** vale para a FISCAL-4E isolada (que segue com allowlist vazia); nenhuma outra combinação é autorizada. Ampliação futura (outra cidade/line_type) exige **nova DECISION**.

---

## D2 — COMPOSIÇÃO REGIONAL E CONTINUAÇÃO RESIDUAL

Conservação vinculante (inteiros, sem float):

```text
commission_gross          = tax_reserve + commission_distributable        (FISCAL-4E, selado)
commission_distributable  = regional_fund + regional_residual             (B-CITY-2)
```

`tax_reserve` segue para a conta fiscal interna (`fiscal_reserve`, FISCAL-4E). `regional_fund` vai para a conta municipal **system** de Curitiba. **`regional_residual` é conceito econômico DESCRITIVO — a CONTINUAÇÃO da linha original de `commission_distributable`, NÃO necessariamente novo `line_type`.** Preserva: target account · split_type original · owner_type · titularidade do Actor (quando houver) · tenant · currency · finalidade · semântica econômica · source line identity. **A única mudança é `amount: commission_distributable → regional_residual`.**

**Proibido:** reescolher destino · trocar `platform_fees ↔ platform_revenue` · primeira conta compatível · fallback · auto-provision · nova `economic_policy_line` residual · novo split_type residual sem decisão futura · regional como cobrança adicional ao comprador.

---

## D3 — SOURCE LINE EXPLÍCITA (fail-closed)

A linha de origem (`commission_distributable`) é identificada **explicitamente** no contrato interno. **Proibido inferir** por posição · primeiro match · split_type isolado · account_type · nome · saldo · owner · destino · valor aproximado. **Fail-closed** para: source ausente · duplicada · tenant divergente · currency divergente · amount divergente · destination incompatível · policy version divergente · snapshot divergente — **antes de qualquer write**.

---

## D4 — MATRIZ ZERO-BUCKET REGIONAL (espelho DECISION-0183)

```text
dist>0 · regional>0 · residual>0   →  1 linha regional_fund + 1 linha residual
dist>0 · regional=0                →  SOMENTE residual (= commission_distributable); resolver Curitiba NÃO invocado; conta NÃO exigida
dist>0 · regional=residual → resid=0 →  SOMENTE regional_fund; NÃO cria linha residual zero
dist=0                             →  NENHUMA linha regional/residual; policy regional não cria valor sobre base zero; resolver NÃO invocado; conta NÃO exigida
```

Bucket de valor zero **não vira linha física** (splits/ledger exigem `amount>0` — CHECK físico). O estado zero permanece **auditável** no evento/identidade regional futura. **Proibido:** split zero · ledger zero · sentinela · clamp · negativo · `regional_fund > commission_distributable` · centavo descartado.

---

## D5 — ARREDONDAMENTO E CONSERVAÇÃO

Apenas **inteiros em centavos**. Percentual armazenado em **vocabulário governado** (ex.: `bps`), conforme o modelo vivo. Selado:

```text
0 <= regional_fund <= commission_distributable
regional_residual = commission_distributable - regional_fund
commission_distributable = regional_fund + regional_residual
Σ(splits finais) = bank_transaction.amount
```

A regra de **arredondamento vem da policy/regra governada aplicável**, nunca de default oculto. **Proibido:** float · `Math.round` local não governado · compensação posterior · centavo órfão · ajuste silencioso no último split · percentual hardcoded.

---

## D6 — TERRITORIAL SUBJECT (Actor exato, selado)

O sujeito territorial da operação é o **Actor COMPRADOR (payer)**, `payerActorId` — **cravado por DECISION-0177 D2** (`regional_origin_basis='payer_identity_residence'`, DECISION-0166 D0). Fluxo obrigatório:

```text
payerActorId (comprador)
  → resolveActorTerritory(tenantId, payerActorId, 'ACTOR_RESIDENCE')
  → address canônico → city canônica → Curitiba
  → regional_fund_accounts (FK) → conta municipal system
```

**Cravado:** a origem é o **comprador, nunca o vendedor**; residência **vigente no instante da operação**. **Proibido:** profile · tipo PF/PJ como decisão territorial · seller/provider por inferência · primeiro endereço · endereço comercial · CEP · string de cidade · tenant como território · neighborhood · N1/N2/category. Comprador sem residência actor-scoped → `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE` → a operação falha **antes de qualquer write** (fail-closed, preserva DECISION-0177 D2). *(A escolha do Actor NÃO ficou aberta — está selada; não houve invenção.)*

---

## D7 — SNAPSHOT TERRITORIAL UNIFORME (contrato DECISION-0177 D8)

```text
SEM linha regional materializada  →  jurisdiction_snapshot = NULL em TODAS as linhas finais  (= comportamento FISCAL-4E selado)
COM linha regional materializada  →  o ORQUESTRADOR B-CITY-2, DEPOIS da FISCAL-4E e ANTES do sink, aplica o MESMO
                                     jurisdiction_snapshot (só IDs canônicos + basis governado) a TODO o conjunto final
```

O snapshot é **transacional/auditável**; **não** transforma `tax_reserve` em regional fund; **não** altera destino/titularidade/base fiscal/evento fiscal; **não exige modificar internamente a FISCAL-4E selada** (que corretamente produz `null` quando não há linha regional). **Proibido** snapshots diferentes dentro da mesma transação. *(Isto resolve, sem romper selo, a aparente tensão FISCAL-4E `null` × B-CITY-1 uniforme: são as duas metades do MESMO contrato D8.)*

---

## D8 — POLICY VERSION UNIFORME

Quando a policy regional for aplicada: `policy_version_id = economic_policies.id` da versão resolvida. **Todas** as linhas finais carregam a **mesma** versão. A versão deve ser **ativa · vigente · tenant-scoped · territorialmente compatível · imutável · resolvida UMA vez · persistida antes do Bank write**. Mesmo com resultado regional arredondado a zero, a evidência de qual policy foi aplicada (ou de que nenhuma incidiu) fica persistida. **Nenhuma policy posterior altera/reinterpreta transação antiga.** Reversal reutiliza a versão original — **proibido reavaliar policy no reversal**.

---

## D9 — IDENTIDADE E IDEMPOTÊNCIA REGIONAL

O **fingerprint fiscal-econômico da FISCAL-4E permanece BYTE-INTACTO e semanticamente intocado** — dados regionais **NÃO** entram nele. A B-CITY-2 terá **identidade econômica regional própria** (ou identidade final de composição), incluindo deterministicamente: tenant · referência externa · `fiscal_provision_event_id` · source line identity · `commission_distributable` · `regional_fund` · `regional_residual` · policy version · canonical city snapshot · regional account destination · residual destination · currency · snapshot version. Selado:

```text
mesma identidade externa + mesmo estado regional     →  idempotente
mesma identidade externa + estado regional diferente →  PAYLOAD MISMATCH (fail-closed)
```

Retry **não pode** selecionar policy/cidade/conta nova, recalcular sobre outro endereço, nem mudar o destino residual. (Contrato semântico; nome físico de coluna decidido no material.)

---

## D10 — AUTHORITY DE POLICY ADMIN

Policy regional **não** pode ser governada por login · role textual · `admin=true` · usuário sem Actor · profile · job · migration · frontend · fundador implícito. Ações governadas (criar draft · adicionar linhas · validar · ativar · deprecar · substituir versão · encerrar vigência) exigem **cumulativamente**: **Actor explícito · `canRepresentActor(...)` · tenant explícito · capability EXATA · `actor_capability_grant` vigente · trilha append-only**. Reutilizar capability canônica existente se semanticamente adequada; senão, o material definirá nomes exatos (alinhados à nomenclatura viva) para **(a) lifecycle da policy regional** e **(b) ativação/desativação da PORTA monetária** — **as duas autoridades NÃO podem ser fundidas por conveniência**.

---

## D11 — DT-REGION-FUND-DELEGATION-MODEL-PENDING (fechamento parcial)

Fechado **somente para Curitiba v1**: policy e PORTA governadas por **Actor institucional autorizado**; residentes **não** recebem authority financeira; representantes territoriais **não** recebem authority automática; pertencimento à cidade/Social **não** concede grant; transparência **não** concede movimentação. **Mantida ABERTA** para: delegação territorial coletiva futura · governança popular futura · provisionamento de novas cidades · autoridade municipal externa · modelo nacional.

```text
DT-REGION-FUND-DELEGATION-MODEL-PENDING: RESOLVIDA PARA POLICY ADMIN E PORTA CURITIBA V1 · AINDA ABERTA PARA DELEGAÇÃO TERRITORIAL FUTURA
```

(Não declarada globalmente encerrada.)

---

## D12 — PORTA FINANCEIRA B-CITY-2 (separada de policy e de firewall técnico)

Movimentação regional só ocorre quando **TODAS** verdadeiras (simultâneas): material B-CITY-2 selado · policy regional ativa e vigente · policy version resolvida · Actor autorizador válido · capability de PORTA válida · grant vigente · Curitiba canônica resolvida · conta Curitiba lookup-only válida · **sink firewall explicitamente habilitado** · registro auditável de abertura vigente. **Nenhuma condição isolada abre dinheiro.** Proibido PORTA como simples env flag. O registro futuro de abertura conterá: tenant · city · policy version · Actor autorizador · capability/grant · `effective_from` · `effective_until` opcional · motivo · idempotency key · `created_at` · encerramento/depreciação auditável. Firewall segue **default OFF**.

```text
policy ativa SEM PORTA   →  ZERO MOVIMENTAÇÃO
PORTA SEM policy válida   →  FAIL-CLOSED
Fechar a PORTA            →  bloqueia NOVAS movimentações; NUNCA bloqueia reversals de fatos anteriores
```

---

## D13 — CONTA CURITIBA (ratificada, intocada)

`owner_type=system` · `actor_id=NULL` · `account_type='credit'` · saldo 0 · uso = regional fund municipal de Curitiba · provisionamento prévio e governado · money path **lookup-only**. **Não exige novo account_type nesta fase**; **não confundir com `fiscal_reserve`**. **Proibido:** criação durante transação · fallback para outra conta · conta de Actor residente · saldo da população · conta de bairro · conta nacional · provisioning de nova cidade na B-CITY-2. `actor_id` NULL **não** impede split/read-back/reversal (provado na FISCAL-4E).

---

## D14 — REVERSAL (full-only, sem recomputação)

Lê os splits **persistidos**; target-account-first; suporta conta system `actor_id=NULL`; reutiliza snapshot/policy version/amounts/source identity **originais**; mesma transação DONA via `existingClient`; preserva F1–F4; idempotente; **funciona com PORTA fechada**. **Proibido:** recalcular policy/território · consultar endereço/saldo atual · escolher conta nova · partial reversal · remittance. Matriz: `regional+residual → reverte ambas` · `regional=0 → só residual` · `residual=0 → só regional` · `dist=0 → nenhuma linha regional a reverter`.

---

## D15 — TRANSPARÊNCIA ≠ PODER

`consultar saldo/extrato ≠ movimentar dinheiro`. Transparência futura: read-only · read model derivado do Bank · sem segundo ledger · sem transfer/saque/aprovação · sem alterar policy · sem conceder grant · sem inferir autoridade por residência. **Morador/representante/organização local/Social NÃO recebem poder financeiro por localização.** Transparência **não bloqueia** o material B-CITY-2 e pode ser frente separada.

---

## D16 — DORMÊNCIA MATERIAL FUTURA

Mesmo após material futuro selado: **caller ZERO · firewall OFF · PORTA FECHADA** até ato separado de ativação. O material B-CITY-2 nasce **interno e dormente**; nenhuma policy real ou conta é criada pelo código material.

---

## D17 — CURITIBA-FIRST

Schema futuro pode ser estruturalmente genérico **só quando necessário**, mas a elegibilidade operacional inicial é: cidade = **Curitiba canônica**; outras cidades = **FAIL-CLOSED**; neighborhood = FORA; nacional = FORA. Sem expansão automática. Nova cidade exige provisioning governado + authority própria + mapping + policy + PORTA + **GATE e GO separados**.

---

## D18 — PROIBIÇÕES EXPLÍCITAS

gross/net como base regional · `tax_reserve` como base regional · percentual hardcoded · regional como buyer charge/imposto/remittance · auto-provision · profile como residência · neighborhood/N5 · nacional · frontend decisório · segunda policy engine · segundo sink · segundo ledger · recomputação no reversal · policy ativa abrindo dinheiro automaticamente · firewall abrindo dinheiro sozinho · Actor implícito · capability implícita · moradores movimentando fundo por residência.

---

## D19 — FUTURO ENVELOPE MATERIAL (registro; não autorizado aqui)

Um futuro `GO MATERIAL B-CITY-2` deverá produzir **um único envelope consolidado, sem microfatias**: orquestrador pós-FISCAL-4E · policy regional real/versionada · resolução única · composição regional · snapshot uniforme · policy version uniforme · identidade/idempotência · lookup da conta Curitiba · conservação · reversal · guard próprio · mutations · E2E efêmero · dormência · **um commit material · um cartório · uma auditoria Yala**. **Esta DECISION NÃO autoriza esse material.**

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; esta DECISION não cria saldo/transaction/split/policy/grant/conta/PORTA (Lei 5; SSOT_REGISTRY §5; SSOT_EXCLUSIVE_BANK_RULE).
- `commission_gross = tax_reserve + commission_distributable` (0179) e `commission_distributable = regional_fund + regional_residual` (B-CITY-2) — conservação exata, sem centavo criado/descartado.
- **FISCAL-4E byte-intacta** (fingerprint/composição/migration não alterados); snapshot resolvido pelo orquestrador B-CITY-2 (D8), não por modificação da 4E.
- Autoridade **não emerge de estrutura**; residência é do **comprador** via ACTOR_RESIDENCE (nunca profile/vendedor); PORTA/firewall separados; ativação só por PORTA governada.
- Curitiba-first; B-CITY-2 permanece dormente; regional_fund não é linha fiscal; DECISION-0182 preservada (allowlist só ampliada por esta extensão governada).

---

**STATUS: DECISION-0184 PROMULGADA DOCS-ONLY · NÃO SELADA · MATERIAL B-CITY-2 NÃO INICIADO · ATIVAÇÃO BLOQUEADA (PORTA SEPARADA) · AGUARDA UMA ÚNICA AUDITORIA YALA. Zero material, policy, grant, PORTA, conta ou movimentação.**

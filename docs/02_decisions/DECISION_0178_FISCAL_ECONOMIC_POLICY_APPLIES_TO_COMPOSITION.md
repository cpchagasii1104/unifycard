# DECISION-0178 — Fiscal Economic Policy `applies_to` and Composition: vocabulário físico de `economic_policy_lines.applies_to`, legados read-only, composição fiscal × policy e fronteira 4d-2 × 4e

**Status:** DECIDIDA POR CLAYTON · DOCS-ONLY · NÃO SELADA · MATERIAL 4D-2 NÃO INICIADO · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-15
**Frente:** F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION · Fase Fiscal · Ato DECISION FISCAL-4D-2
**Base:** `rescue-structural @ 39f439489` (FISCAL 4D-1 + 4D-1-R seladas)
**Insumo:** GATE FISCAL-4D-2-0 (read-only consolidado, **Veredito B**, 2026-07-15 — ratificado por Clayton com sete precisões vinculantes)

**Deriva explicitamente de:** DECISION-0166 (base = comissão UnifiCard D1; cascata fiscal D7; Lei do Contador D9; **vocabulário `applies_to` futuro D9.5.12** = `gross_transaction`/`commission_gross`/`commission_distributable`; `tax_reserve` como `line_type` futuro D9.5.13; catálogo fiscal fail-closed D9.6; **trava de execução D9.7** — cada fatia da Fase 4 exige GO próprio) · DECISION-0167 (motor de provisão fiscal; **§5 bases de cálculo**; §12 sequência 4d-1→4d-2→4e→4f; 4d-2 = "materializar `applies_to` fiscal invertendo CONSCIENTEMENTE o guard 4c-3") · DECISION-0177 (linha regional municipal futura `applies_to='commission_distributable'`; B-CITY-2 bloqueada) · DECISION-0047 (origem do Economic Policy Engine e da semântica legada `gross`/`net`, preservada apenas em comentário de migration — ver D3) · pipeline canônico DECISION-0165 (`economic_policy_engine` DECIDE → Bank EXECUTA → splits/ledger PERSISTEM) · SSOT Bank/ledger (SSOT_REGISTRY §5; LEI DE COERÊNCIA §4.6-4.7) · 00_AGENT_PROTOCOL §2.2/§2.3.2 · PROHIBITED_STRUCTURES (autoridade não emerge de estrutura; mini-core clandestino proibido).

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** FISCAL · FINANCEIRO · POLICY/CONTEXTO · SEMÂNTICA · NOMENCLATURA · AUTHORITY · AUDITORIA · PERSISTÊNCIA.

**Documentos lidos e suficientes:** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 4 — estrutura prevalece / ENUM não reduz; Lei 5 — SSOT financeiro; Lei 7 — governança semântica), `SSOT_REGISTRY_UNIFICARD.md` (§5.5 Split; §5.16 Authority), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6-4.7 fronteira financeira; §7 composição sistêmica), `CORE_IMUTAVEL.md`, `PROHIBITED_STRUCTURES.md` (mini-core clandestino), `SSOT_EXCLUSIVE_BANK_RULE.md`, `07_NOMENCLATURA_CANONICA.md` (mudança de vocabulário governado = nova DECISION), DECISION-0166, DECISION-0167, DECISION-0177, e o cartório `REMEDIATION_DT_LOG.md` (selos 4d-1/4d-1-R).

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > normas de domínio > decisions > cartório > código > conveniência.

**SSOTs e casas aplicáveis:**

| Verdade | Casa soberana |
|---|---|
| Perfil fiscal | `actor_fiscal_profiles` (casa 4b) |
| Catálogo fiscal | `tax_types` + `tax_rules` (casa 4c) |
| Cálculo fiscal | `modules/fiscal-provision` (motor 4d-1, read-only) |
| Trilha fiscal | `fiscal_provision_logs` (append-only, classe LOG) |
| Policy econômica | `economic_policies` + `economic_policy_lines` |
| **Versão canônica da policy** | **`economic_policies.id`** (cada versão é uma LINHA; imutabilidade por trigger) |
| Dinheiro | `bank_ledger` / UnifyBank |

**Declaração dura — NÃO existe a tabela `economic_policy_versions`.** "Versão de policy" = a linha em `economic_policies` (unicidade `(tenant_id, policy_code, version)`; `bank_splits.policy_version_id` é FK → `economic_policies`). Qualquer implementador que procure uma tabela `economic_policy_versions` está errado.

**Declarados NÃO-SSOT:** `applies_to` local hardcoded · guard · comentário de migration · frontend · invoice · fixture · `fiscal_provision_logs` como policy · policy evaluation como dinheiro · o futuro orquestrador como autoridade. A avaliação de policy NÃO é dinheiro; só o Bank define dinheiro (Lei 5, SSOT_REGISTRY §5).

---

## D0 — ESCOPO DESTA DECISION

Esta DECISION é **docs-only** e governa **somente** a forma institucional futura da extensão de `economic_policy_lines.applies_to` e da composição fiscal × policy. Ela **ratifica escolhas**; **não autoriza material 4d-2**, que exige GO próprio de Clayton (D9.7) após o selo Yala desta DECISION.

**Não governa e não autoriza:** código · migration · DDL · DML · alteração de `applies_to` · alteração de default · alteração de repository · alteração de guard · alteração de manifesto · alteração de `07_NOMENCLATURA_CANONICA.md` · criação do orquestrador · ligação de caller · 4e · Bank · policy regional · policy admin · PORTA · B-CITY-2 · invoicing · frontend · perfil · conexões · endereço · Social · bairro/N5 · nacional.

---

## FATOS MATERIAIS APURADOS PELO GATE (fundamento probatório)

Estado atual, provado read-only pelo GATE FISCAL-4D-2-0 sobre `unificard_dev`:

- `economic_policy_lines.applies_to` — CHECK atual: **`gross | net`**; DB DEFAULT atual: **`gross`**; fallback atual do writer `economic-policy.repository.ts`: **`gross`**.
- **75 linhas** com `applies_to='gross'`; **0 linhas** com `net`; distribuídas em **45 `economic_policies`, TODAS `deprecated`**; **0 `active`, 0 `draft`**.
- As 75 linhas estão **congeladas** pela proteção canônica de lifecycle (trigger `economic_policy_lines_freeze`: qualquer INSERT/UPDATE/DELETE de linha cujo pai é `active` OU `deprecated` é bloqueado). Não são policies vivas.
- **Consequência material:** remover `gross` do CHECK futuro é **incompatível** com o histórico congelado — um CHECK sem `gross` não validaria as 75 linhas imutáveis. Manter `gross` no CHECK é obrigação estrutural, não preferência.
- O engine legado (`calculatePolicySplits`) **nunca ramificou matematicamente por `applies_to`**: aplica `bps` sobre o único `amountCents` fornecido pelo caller, ignorando o rótulo. `net` nunca teve implementação nem dado. A semântica original (`gross` = `amount_cents` bruto; `net` = `amount_cents − Σ` fees prévios) sobrevive apenas no comentário da migration `20260530561000_create_economic_policy_lines.sql` (DECISION-0047, sem arquivo de decisão próprio).

---

## D1 — VOCABULÁRIO FÍSICO DE `applies_to`

O CHECK físico futuro de `economic_policy_lines.applies_to` comportará **cinco valores**:

```text
gross
net
gross_transaction
commission_gross
commission_distributable
```

**Classificação vinculante:**

- **VALORES CANÔNICOS GRAVÁVEIS:** `gross_transaction` · `commission_gross` · `commission_distributable`.
- **VALORES LEGADOS READ-ONLY:** `gross` · `net`.

Fixa-se explicitamente:

- o CHECK físico comportará os cinco valores;
- o CHECK sozinho **não** distingue linha histórica de nova gravação;
- a trava dos **três únicos valores graváveis** pertence a **writer + tipos + manifesto + guard**, nunca ao CHECK isolado;
- novos INSERT/UPDATE **não** podem gravar `gross|net`;
- `gross|net` **não** são aliases dos três novos;
- `gross|net` **não** podem ser escolhidos em nova policy, nova versão ou nova linha;
- **nenhuma ativação nova** pode depender de `gross|net`.

**Proibido:** alias silencioso · fallback · reinterpretação · conversão automática · novo uso dos legados · expansão para valores adicionais sem nova DECISION.

---

## D2 — DEFAULT E FALLBACK LEGADOS (REMOÇÃO INDIVISÍVEL)

O material 4d-2 deverá remover **conjuntamente e de forma indivisível**:

1. o `DEFAULT 'gross'` da coluna `economic_policy_lines.applies_to`;
2. o fallback `'gross'` do writer `economic-policy.repository.ts`.

A remoção é **indivisível**: remover só um dos dois é violação (remover o DEFAULT do banco sem remover o fallback do repository apenas transfere o legado silencioso para o código; remover o fallback sem remover o DEFAULT deixa o banco decidir a base).

Após a mudança:

- `applies_to` deverá ser **intenção explícita** do caller institucional;
- ausência deverá **falhar fechado**;
- o writer **não** poderá selecionar uma base por conveniência;
- o repository **não** poderá semear legado;
- o DB **não** poderá decidir a base por default.

**Proibido:** tornar `applies_to` nullable · criar outro default.

---

## D3 — HISTÓRICO `gross`/`net`

A verdade histórica legítima é **exclusivamente** o que já foi materializado/snapshotado em `economic_policy_resolution_logs`, `bank_splits` e demais snapshots canônicos já existentes.

Registra-se com honestidade: o engine legado **aplicava o `amount` fornecido pelo caller sem implementar matemática distinta por `gross`/`net`**. Não afirmar que houve ramificação matemática histórica por `applies_to`.

**Consequências:**

- nenhuma rederivação histórica;
- nenhum backfill matemático;
- nenhum UPDATE das 75 linhas;
- nenhum recálculo de split histórico;
- **nenhum leitor futuro** pode reinterpretar `net` como `commission_distributable`;
- **nenhum leitor futuro** pode reinterpretar `gross` automaticamente como `gross_transaction`.

**Escolha consciente (Lei 4 — proibição de redução de vocabulário físico):** `net` **permanece no CHECK** apesar de possuir **0 linhas**, por forward-only e para não reduzir o vocabulário físico legado. Permanece **legado read-only, não gravável**.

---

## D4 — VOCABULÁRIO CANÔNICO NOVO (DEFINIÇÕES)

- **`gross_transaction`** — valor bruto governado da operação econômica antes das deduções da composição fiscal/policy. A forma exata da origem vem do **envelope econômico do caller**, nunca de inferência da policy.
- **`commission_gross`** — comissão bruta da plataforma, recebida como **fato econômico governado**, a **mesma base** entregue ao `fiscal-provision` 4d-1. O policy engine **não** recalcula platform fee.
- **`commission_distributable`** — `commission_gross − tax_reserve`, derivada **exclusivamente** do resultado fiscal 4d-1.

Os três valores são: **distintos · não aliases · explícitos · em centavos · parte do mesmo contexto econômico imutável**.

---

## D5 — `tax_reserve` FORA DE `applies_to`

**`tax_reserve` NÃO é valor de `applies_to`.**

Fundamento: é provisão/obrigação fiscal; será destino financeiro específico em 4e; não é base genérica de distribuição; não entra por simetria nominal; não pode ser usada por referral, regional fund, group contribution ou distribuição comum (é `line_type` futuro por D9.5.13, não base).

Fixa-se: `tax_reserve` = resultado fiscal em 4d-1; materialização financeira = **exclusivamente 4e**.

Esta DECISION **não** cria: `line_type` físico `tax_reserve` · conta · split · ledger · destino tributário.

---

## D6 — ORQUESTRADOR LEGÍTIMO

Casa futura promulgada: **`FiscalEconomicPolicyCompositionService`**.

**Natureza:** serviço interno · pré-financeiro · evaluation/read-only · não-SSOT · sem Bank · sem autoridade própria.

**Responsabilidade futura:**

```text
receber fatos econômicos governados
→ chamar fiscal-provision UMA única vez
→ construir EconomicPolicyEvaluationContext imutável
→ chamar economic policy engine
→ devolver avaliação read-only
```

**Proibido:** `fiscal-provision` chamando policy engine · policy engine chamando `fiscal-provision` · policy engine lendo `tax_rules` · policy engine escolhendo rounding · policy engine recalculando `tax_reserve` · orquestrador acessando Bank.

O orquestrador **compõe autoridades existentes**; ele **não** se torna SSOT (PROHIBITED_STRUCTURES — autoridade não emerge de estrutura; pasta/caller/conveniência não viram autoridade; em conflito, prevalece a camada mais restritiva).

---

## D7 — FRONTEIRA 4D-2 × 4E

**4d-2** deverá criar e provar **somente**: vocabulário · contratos · migration · writer explícito · policy engine por bases · orquestrador evaluation/read-only · contexto imutável · guards · mutations · E2E sob rollback · **zero Bank**.

Fixa-se: em 4d-2, `FiscalEconomicPolicyCompositionService` **NÃO** será ligado a nenhum caller monetário vivo. Particularmente, **não religar em 4d-2**: `service-payment-execution` · `payment-execution` · checkout financeiro · qualquer pipeline que escreva Bank. **Religar caller vivo em 4d-2 é violação de fase** (expande reachability — proibido pelo GATE).

**4e** será responsável por: religar caminhos monetários · consumir a composição selada · `tax_reserve` financeiro · destino/conta fiscal · bank transaction · bank splits · bank ledger · atomicidade · reversal · E2E monetário.

---

## D8 — IDENTIDADE DA POLICY VERSION E CONTEXTO UNIFORME

**Policy version canônica = `economic_policies.id`.** Não existe `economic_policy_versions`.

Contrato futuro **`EconomicPolicyEvaluationContext`** (imutável), com no mínimo:

```text
economicPolicyId
fiscalProvisionIdentity / fiscalSnapshot
fiscalCalculationVersion
countryId
stateId
cityId
neighborhoodId (quando aplicável)
occurredAt
effectiveAt
grossTransactionCents
commissionGrossCents
taxReserveCents
commissionDistributableCents
fiscalStatus
currency
```

Todas as linhas da **mesma avaliação** devem compartilhar: o mesmo `economic_policies.id` · a mesma identidade/snapshot fiscal · a mesma jurisdição · os mesmos tempos · as mesmas três bases · a mesma moeda · a mesma `calculation_version`.

**Reversal futuro não poderá recomputar** com policy, regra fiscal ou território atual — reutiliza o snapshot original (espelha a doutrina `policy_version_id`/`jurisdiction_snapshot` de `bank_splits`).

---

## D9 — `commission_distributable` NEGATIVO

Para `commission_distributable < 0`:

- **Evaluation/preview:** preservar o valor negativo · preservar warning · **não** aplicar clamp · **não** substituir por zero · **não** omitir. (O motor 4d-1 já emite `commission_distributable_negative`; a avaliação preserva.)
- **Policy monetária:** **falhar fechado** antes de qualquer alocação, com erro governado **`COMMISSION_DISTRIBUTABLE_NEGATIVE`**. Nenhuma linha monetária poderá ser materializada.

**Proibido** fallback para `gross` · `net` · `gross_transaction` · `commission_gross` · zero.

---

## D10 — `commission_distributable` ZERO

Para `commission_distributable = 0`:

- resultado fiscal **válido**;
- evaluation read-only **válida**;
- linhas calculadas como zero **podem permanecer** no snapshot;
- zero **não é** missing; zero **não é** erro de infraestrutura; zero **não dispara** fallback;
- **4e não deverá criar** `bank_split` ou ledger entry de valor zero.

A regra de omissão/materialização pertence a 4e; a avaliação preserva a verdade zero.

---

## D11 — MISSING E INFRAESTRUTURA

- `fiscal_config_missing` obrigatório: **fail-closed** — preservar o erro governado do motor 4d-1 **`FISCAL_CONFIG_MISSING_MANDATORY`** (422, D9.6.18).
- Erro de infraestrutura: **propaga**.

**Proibido:** converter infra em missing · converter missing em zero · usar `gross/net` como fallback · usar `commission_gross` como `distributable` · executar policy monetária sem provisão fiscal válida.

---

## D12 — MIGRATION FUTURA 4D-2

O material 4d-2 exige **uma migration forward-only única** (ou envelope equivalente claramente justificado). Deverá:

1. remover o `DEFAULT 'gross'`;
2. substituir **conscientemente** o CHECK;
3. aceitar fisicamente os cinco valores;
4. preservar as 75 linhas congeladas;
5. **não** alterar nenhuma linha;
6. **não** executar backfill;
7. **não** reinterpretar legado;
8. **validar imediatamente** (zero `NOT VALID`);
9. manter `NOT NULL`;
10. **não** criar tabela nova.

Forma futura esperada do CHECK: `gross · net · gross_transaction · commission_gross · commission_distributable`. **Não escrever a migration nesta execução.**

---

## D13 — WRITER E ANTI-REVIVAL

O writer futuro deverá aceitar **somente** `gross_transaction` · `commission_gross` · `commission_distributable`. Proibido writer novo gravar `gross|net`. Remover o fallback local.

Exigir **guard anti-revival** que morda: INSERT novo com `gross` · INSERT novo com `net` · UPDATE para `gross` · UPDATE para `net` · fallback · default · alias · hardcode frontend · caller sem valor explícito.

**O CHECK preserva o histórico; writer + guard governam novas gravações.**

---

## D14 — RECONCILIAÇÃO CONSCIENTE DOS GUARDS

Três responsabilidades exatas para o material 4d-2:

**A. `audit-fiscal-tax-catalog` (guard 4c-3):** inverter conscientemente (a) a trava anti-extensão de `applies_to` (as asserções que hoje mordem `commission_gross|commission_distributable|gross_transaction` em `applies_to`) e (b) a asserção do CHECK literal `('gross','net')`. **Preservar:** anti-hardcode · anti-seed · catálogo sem cálculo · `tax_reserve` fora · vocabulário fechado · zero Bank.

**B. `audit-fiscal-provision-engine`:** inverter conscientemente a trava B4 (que hoje falha qualquer migration pós-`20260714220000` que toque `applies_to`) para permitir **somente** a migration autorizada 4d-2; **atualizar o hash pinado do guard 4c-3 na MESMA fatia** (o guard pina o sha256 do 4c-3; mudar o 4c-3 muda seu hash → o pin quebra se não atualizado). A alteração do 4c-3 e a atualização do hash pinado são **indivisíveis**. Preservar todas as demais famílias do motor (F/C/P/A/B/O/R) e impedir alteração fiscal oportunista.

**C. `audit-bank-city-curitiba-foundation` (B-CITY-1, SELADA):** permanece **byte-intacto**. O novo token/vocabulário (em especial `commission_distributable`) **não** deverá entrar nos dois arquivos protegidos `economic-policy-engine.service.ts` e `service-payment-execution.service.ts` quando isso quebrar a proteção B-CITY-1 (A2/A3). A implementação deverá manter o vocabulário novo em **types governados**, no **arquivo novo do orquestrador** e nas **casas explicitamente autorizadas**. **Se a execução provar impossibilidade material dessa preservação → STOP e retornar ao GATE; não alterar B-CITY-1 silenciosamente.**

---

## D15 — REGISTRO DO VOCABULÁRIO

O material 4d-2 deverá registrar `applies_to` em `governed-vocabularies.manifest.ts` e criar seção própria em `07_NOMENCLATURA_CANONICA.md`. A seção deverá distinguir:

- **valores físicos:** 5;
- **valores graváveis canônicos:** 3;
- **valores legados read-only:** 2.

O manifesto e a nomenclatura **não** podem tratar os cinco valores como igualmente graváveis. **Esta DECISION é o respaldo institucional** exigido para a evolução do vocabulário (07_NOMENCLATURA: "mudança neste vocabulário = nova DECISION"). **Não alterar manifesto ou nomenclatura nesta execução docs-only.**

---

## D16 — POLICY REGIONAL E B-CITY-2

Contrato futuro fixado: **linha regional municipal futura `applies_to = commission_distributable`** (reafirma DECISION-0177).

4d-2 **não** cria: policy regional · percentual · cap · destino · conta · split · ledger · transparência · fundo de bairro · activation · PORTA.

**B-CITY-2 continua bloqueada** por: 4d-2 selada + 4e selada + policy admin/authority + PORTA + novo GATE + novo GO.

---

## D17 — POLICY ADMIN E AUTHORITY

- 4d-2 pode evoluir vocabulário e evaluation engine **sem** superfície administrativa;
- **nenhuma** policy real será criada ou ativada;
- criação/versionamento/ativação/depreciação futura exigem **authority própria** (SSOT_REGISTRY §5.16; LEI §4.9);
- produto, rota, frontend ou Actor implícito **não** criam poder;
- policy admin permanece **fora**.

`DT-REGION-FUND-DELEGATION-MODEL-PENDING` **não** é resolvida aqui — permanece **OPEN**.

---

## D18 — INVOICING

`DT-INVOICING-HARDCODED-TAX-RATE` permanece **OPEN · frente própria**. O invoicing: não fornece base para policy · não fornece taxa fiscal · não substitui `fiscal-provision` · não é corrigido em 4d-2 · não vira caller do orquestrador nessa fatia. Convergência futura (DECISION-0167 §10) em frente própria.

---

## ENVELOPE MATERIAL FUTURO 4D-2 (registrado; NÃO autorizado)

Escopo futuro elegível **somente após** DECISION selada pela Yala **+** GO material explícito de Clayton. O envelope futuro deverá consolidar: migration · CHECK de 5 valores · remoção do default · remoção do fallback repository · tipos compartilhados · manifesto · nomenclatura · writer com 3 valores · policy base selection · `EconomicPolicyEvaluationContext` · `FiscalEconomicPolicyCompositionService` read-only · guards reconciliados · mutations · E2E rollback · **zero caller monetário vivo · zero Bank**. **Nenhuma autorização automática deste envelope.**

---

## FRONTEIRAS ABSOLUTAS DESTA DECISION

`tax_reserve` fora de `applies_to` · 4d-2 zero Bank · 4e não aberta · policy regional não criada · policy admin não aberta · PORTA não aberta · B-CITY-2 bloqueada · `DT-INVOICING-HARDCODED-TAX-RATE` OPEN · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` OPEN.

**Preservados e intactos:** 4d-1 · 4d-1-R · `fiscal-provision` · `fiscal_provision_logs` · `rounding_mode` · Bank · B-CITY-1 · frontend · perfil · conexões · endereço · Social · bairro/N5 · nacional.

---

## INVARIANTES QUE ESTA DECISION PRESERVA

- Dinheiro **sempre** no Bank; policy evaluation é DECISÃO/read model, nunca dinheiro (Lei 5; SSOT_REGISTRY §5; LEI §4.6-4.7).
- UM pipeline (`economic_policy_engine` DECIDE → Bank EXECUTA → splits/ledger PERSISTEM); o motor fiscal é ESTÁGIO composto, nunca serviço avulso chamado por vertical (DECISION-0167 §2).
- Vocabulário governado só muda por DECISION (07_NOMENCLATURA); CHECK físico ≠ vocabulário gravável (writer+guard enforçam os 3).
- Histórico congelado é imutável; verdade histórica = snapshot já materializado, nunca rederivação.
- Configuração fiscal é do CONTRIBUINTE/CONTADOR, versionada e imutável-quando-ativa (Lei do Contador D9).

---

**STATUS: DECISION-0178 PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA. Não autoriza material 4d-2 (D9.7 exige GO próprio).**

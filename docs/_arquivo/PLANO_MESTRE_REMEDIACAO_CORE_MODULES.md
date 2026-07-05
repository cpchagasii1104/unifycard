# PLANO-MESTRE — Remediação Core ↔ Modules

**Data:** 2026-05-05
**Branch:** `rescue-structural`
**Escopo:** Roteiro multi-sessões para resolver acoplamento core ↔ modules e dívidas estruturais relacionadas.
**Status:** Documento estratégico. Não é executável. Cada Sessão tem plano próprio.
**Princípio:** **Direção, não detalhamento.** Foco em **ordem + dependências + decisões**.

---

## 1. OBJETIVO FINAL

Estado-alvo do sistema ao final do roteiro:

1. `validate-core-purity.mjs` retorna `modules_import=0` (ou limiar aceitável documentado)
2. `validate-core-purity.mjs` em modo **error** (não mais log) — bloqueia regressão futura
3. Wrappers LEGACY removidos (`account.service.ts`, `transaction.service.ts`)
4. Cluster B (UnifyBank) classificado como facade autorizada com allowlist explícita OU refatorado para core puro
5. Cluster C (Events) com fronteira clara `core/events ↔ modules/events`
6. C66 resolvido: `concept_id` é UUID em todo o fluxo
7. Rotas 501 decididas (implementadas via ports ou removidas)
8. Working tree limpo entre cada sessão
9. Normativos institucionalmente íntegros (sem deletados sem rastro)

**Não é objetivo:** zero acoplamento absoluto. Acoplamentos legítimos via ports/adapters são esperados.

---

## 2. FRENTES DE TRABALHO

```
Frente 0 — Preparação                    [Sessão 1]
Frente 1 — Remediação Wrappers           [Sessões 2, 8-10]
Frente 2 — Decisões de Produto           [Sessão 20]
Frente 3 — Migração de Callers           [Sessões 3-7]
Frente 4 — Hardening dos Gates           [Sessão 22]
Frente 5 — Cluster B (UnifyBank)         [Sessões 11-14]
Frente 6 — Cluster C (Events)            [Sessões 15-19]
Frente 7 — Débito Build/Deploy           [Sessão 21]
Frente 8 — Integridade Normativa         [paralela, conforme A.3 revelar]
Frente 9 — Débitos pendentes de RFC      [pós-22, agendamento livre]
```

---

## 3. ROTEIRO DE SESSÕES (ordem obrigatória)

### Sessão 1 — Triagem do Working Tree
**Estado de entrada:** working tree com 1549 itens sujos
**Saída:** working tree limpo OU resíduos classificados; débitos formais abertos
**Bloqueia:** todas as próximas sessões
**Plano detalhado:** `PLANO_SESSAO_2026-05-05_working-tree_v4.md`
**Decisões dependentes:** nenhuma

### Sessão 2 — C66: concept_id slug→UUID  ✅ **FECHADA (2026-05-06)**
**Estado de entrada:** working tree limpo, C66 documentado
**Saída efetiva:** `bankTransactionService` resolve slug→UUID nas 4 funções com `concept_id` (linhas 234, 940, 1218, 1469); fail-closed em 0 ou >1 match; gate CI `validate:concept-id-uuid-shape` operacional com baseline congelado de 29 slugs / 47 ocorrências.
**Decisão final D1:** Caminho **C+B híbrido** (DECISION-0018) — C agora (Bank resolve), B na Frente 3 (callers migram individualmente).
**Realocação CORE_PURITY:** helper movido de `core/economy/` para `modules/concept-resolution/` (DECISION-0019), zero drift sobre baseline `1278/68/319/891`.
**Pré-requisito tratado:** `'split-payment'` seedado via migration `20260530515000` em `financeiro-payment`.
**Commits da sessão:** `88f04b56` (seed) · `cff078e9` (helper inicial em core, descartado) · `59bde5a1` (integração no Bank) · `96576c42` (modulo concept-resolution + helper financeiro) · `eb7c7157` (refactor Opção B) · `ad58268a` (gate CI) · `c9a54d93` (DECISIONS-0018+0019)
**Bloqueava:** Sessões 3-10 (toda a Frente 1 e 3) — **agora desbloqueadas.**

### Sessões 3-7 — Frente 3: Migração dos 4 Callers
**Estado de entrada:** C66 fechado
**Saída:** cada caller migrado para Bank port (escrita) ou ReadPort (leitura) — não passa mais pelo wrapper
**Sequência obrigatória (1 caller por sessão):**

| Sessão | Caller | Operação | Destino provável |
|---|---|---|---|
| 3 | `distribution.service.ts` | escrita (4 transferências) | Bank service explícito |
| 4 | `split.service.ts` | escrita (2 splits) | Bank service explícito |
| 5 | `social-work-payment.service.ts` | escrita (1 pagamento) | Bank service explícito |
| 6 | `test-currency.service.ts` | escrita (emissão teste) | Bank service explícito + RFC concept `test-currency-emission` |
| 7 | Sessão de validação E2E + revisão dos 4 commits | — | — |

**Bloqueia:** Sessões 8-10 (Frente 1)

**Decisões dependentes por caller:**
- Cada caller exige análise: leitura ou escrita? Lógica de negócio a extrair? Concept registrado?
- Em caso de dúvida sobre ports adequados, abrir RFC

### Sessões 8-10 — Frente 1: Remoção dos Wrappers
**Estado de entrada:** os 4 callers da Frente 3 não usam mais o wrapper
**Saída:** `transaction.service.ts` deletado; `account.service.ts` decidido (deletado ou marcado como deprecated stub)

| Sessão | Alvo | Ação |
|---|---|---|
| 8 | `transaction.service.ts` | Deletar — sem callers |
| 9 | `account.service.ts` callers | Mapear todos os callers (estimativa: 10+ arquivos) |
| 10 | `account.service.ts` | Deletar OU marcar como deprecated stub conforme decisão sobre `BankAccountPort` |

**Bloqueia:** finalização do Cluster A (modules_import baixa significativamente)

**🔴 DECISÕES OBRIGATÓRIAS (Clayton):**
- **Decisão D1:** `BankAccountPort` ganha `getAccountById` e `searchAccounts`, ou esses métodos viram 501?
- Sem essa decisão, Sessão 10 fica bloqueada

### Sessões 11-14 — Frente 5: Cluster B (UnifyBank)
**Estado de entrada:** Cluster A finalizado (Sessões 8-10)
**Saída:** 6 arquivos do `core/unifybank/` classificados e remediados

**🔴 DECISÃO OBRIGATÓRIA (Clayton) — antes de Sessão 11:**
- **Decisão D2:** `core/unifybank/` é **facade autorizada** (camada de orquestração financeira) ou **core puro** (não pode importar de modules)?
  - Se facade: criar allowlist explícita em `validate-core-purity.mjs`
  - Se core puro: refatorar para ports

**Sequência (depende de D2):**
- Se facade: Sessão 11 cria allowlist; Sessões 12-13 documentam exceções; Sessão 14 ajusta gate
- Se core puro: Sessões 11-14 fazem 1-2 arquivos por sessão, criando ports onde necessário

### Sessões 15-19 — Frente 6: Cluster C (Events)
**Estado de entrada:** Cluster A e B finalizados
**Saída:** acoplamento `core/events ↔ modules/events` resolvido em uma das direções

**🔴 DECISÃO OBRIGATÓRIA (Clayton) — antes de Sessão 15:**
- **Decisão D3:** Onde fica a fronteira?
  - Opção α: `core/events` é puro (eventos de domínio); `modules/events` é produto (eventos de mercado/calendário). `modules` não importa `core`.
  - Opção β: `modules/events` é fachada de produto; `core/events` é canônico; `core` não importa `modules`.
  - Opção γ: separar em `core/events-bus` (infra) + `core/events-domain` (regras) + `modules/events` (produto)

**Arquivos identificados:**
- `event-economy.service.ts:7` (chama bankTransactionService direto)
- `event-payment-execution.service.ts:10` (chama bankTransactionService direto)
- `register-handlers.ts:29` (acopla core/events a marketplace)
- `event-spec-to-rfq.mapper.ts:7` (type-only para modules/events)

### Sessão 20 — Frente 2: Decisão das Rotas 501
**Estado de entrada:** Frentes 1, 5, 6 finalizadas

**🔴 DECISÃO OBRIGATÓRIA (Clayton):**
- **Decisão D4:** `GET /economy/transactions/event/:eventId` — produto vivo ou legado?
- **Decisão D5:** `GET /economy/transactions/account/:accountId` — produto vivo ou legado?

**Saída conforme decisão:**
- Vivos → ampliar `BankTransactionReadPort` para aceitar `eventId` e `accountId`; implementar
- Legado → remover rotas; atualizar comentários em `transaction.routes.ts:18`

### Sessão 21 — Frente 7: DT-build-alias
**Estado de entrada:** independente (pode ser executada em paralelo a partir de Sessão 2)
**Saída:** `pnpm build` emite `dist/` sem aliases literais; `pnpm start` funcional; regra de bloqueio #9 do v4 removida

**Procedimento:**
- Restaurar linha em script `build`: `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json`
- Validar `dist/` limpo (zero `@core/*` ou `@modules/*` literais)
- Commit isolado em `package.json` (apenas script build)

**Decisões dependentes:** nenhuma
**Pode antecipar para qualquer momento após Sessão 1**

### Sessão 22 — Frente 4: Hardening dos Gates
**Estado de entrada:** Frentes 1, 5, 6 completas; `modules_import` próximo de 0
**Saída:** `validate-core-purity` em modo **error** (bloqueia CI)

**🔴 DECISÃO OBRIGATÓRIA (Clayton):**
- **Decisão D6:** qual o limiar aceitável de `modules_import`?
  - 0 (zero acoplamento, todas violações remediadas)
  - N (pequeno número documentado em allowlist — UnifyBank facade, Events bus, etc.)

**Procedimento:**
- Promover gate de log → warning (Sessão 22a)
- Validar 1-2 semanas de operação sem regressão
- Promover warning → error (Sessão 22b)

### Sessões pós-22 — Frente 9: Débitos pendentes de RFC
**Agendamento livre, ordem por prioridade de produto:**

- **C36** — 67 tabelas com `status` genérico (RFC necessário antes)
- **C37** — gate de nomenclatura sem validação de schema (RFC necessário antes)
- **Domínios duplicados** — `core/reporting` vs `modules/reports`, `core/notify` vs `modules/system-notifications`
- **DT-tsc** — verificar se 12 erros TS pré-existentes ainda existem após Frente 1

---

## 4. FRENTE PARALELA — Integridade Normativa

**Status:** depende do que A.3 do v4 revelar
**Acionamento:** se A.3 confirmar que os 13 normativos deletados não foram consolidados em outro lugar OU se houver normativos modificados sem rastro de sessão

**Ações possíveis:**
1. Restaurar normativos deletados sem justificativa (`git restore` antes do delete)
2. Auditar referências cruzadas: cada normativo deletado é citado em outros arquivos?
3. Criar gate `validate:normative-integrity` que cruza referências entre `docs/01_normative/` e `docs/02_decisions/`
4. Estabelecer regra: deletar normativo exige RFC explícito + atualização de referências

**Sessões estimadas:** 2-4, paralelas a Sessões 2-10

---

## 5. RESUMO DAS 6 DECISÕES OBRIGATÓRIAS DO CLAYTON

| # | Decisão | Bloqueia | Sessão |
|---|---|---|---|
| **D1** | `BankAccountPort` ampliado vs `account.service.ts` 501 | Sessão 10 | Cluster A finalização |
| **D2** | `core/unifybank/` facade autorizada vs core puro | Sessão 11 | Cluster B inteiro |
| **D3** | Fronteira `core/events ↔ modules/events` (α/β/γ) | Sessão 15 | Cluster C inteiro |
| **D4** | Rota `/economy/transactions/event/:eventId` produto vs legado | Sessão 20 | Frente 2 |
| **D5** | Rota `/economy/transactions/account/:accountId` produto vs legado | Sessão 20 | Frente 2 |
| **D6** | Limiar aceitável de `modules_import` | Sessão 22 | Hardening |

**Nenhuma dessas decisões pode ser tomada por mim ou por outras AIs.** São decisões de produto/arquitetura que pertencem a Clayton.

---

## 6. DEPENDÊNCIAS ENTRE FRENTES (grafo)

```
Sessão 1 (Triagem)
    ↓
Sessão 2 (C66)──────────────────────────┐
    ↓                                    │
Sessões 3-7 (Frente 3 — 4 callers)      │
    ↓                                    │
Sessões 8-10 (Frente 1 — wrappers)──────┤
    ↓                                    │
    ├─→ Decisão D1 → Sessão 10           │
    │                                    │
    ↓                                    ↓
Sessões 11-14 (Cluster B)         Sessão 21 (DT-build-alias)
    ↑ Decisão D2                  [paralelo, após Sessão 1]
    ↓
Sessões 15-19 (Cluster C)
    ↑ Decisão D3
    ↓
Sessão 20 (Rotas 501)
    ↑ Decisões D4, D5
    ↓
Sessão 22 (Hardening)
    ↑ Decisão D6

Pós-22: C36, C37, domínios duplicados, DT-tsc (ordem livre)

Frente 8 (Integridade Normativa) — paralela conforme demanda
```

---

## 7. ESTIMATIVA HONESTA

**Total estimado:** 22 sessões + frentes paralelas (Frente 8)

**Cenário otimista:** 19 sessões (se Decisões D1-D6 chegarem cedo, sem retrabalho)
**Cenário pessimista:** 29 sessões (se A.2/A.3 revelarem novos débitos críticos, ou se algum cluster precisar de RFC adicional)

**Não-fatores ignorados nesta estimativa:**
- Bugs descobertos durante remediação (cada bug pode ser 1 sessão extra)
- Mudanças de produto que invalidem decisões já tomadas
- Aparecimento de novos débitos durante A.2/A.3 (bem possível)

---

## 8. PRINCÍPIOS GUIA (não negociáveis ao longo das 22 sessões)

1. **Uma sessão = um escopo declarado.** Sem misturar frentes.
2. **Working tree limpo entre sessões.** Cada sessão começa e termina com `git status` declarado.
3. **Uma alteração → build → 4 gates → commit → próxima.** Sem batch.
4. **Decisões arquiteturais são pré-condição, não consequência.** Sessões bloqueadas por decisão pendente NÃO começam.
5. **Reversibilidade preservada.** Cada sessão produz commits cirúrgicos que podem ser revertidos individualmente.
6. **Evidência sobre intenção.** Antes de qualquer remediação, confirmar no código real (não em SRC_FULL desatualizado).
7. **Fail-closed.** Gates retornam erro real, não silenciam.
8. **Antes do primeiro usuário, toda concessão a legado é suspeita.** (DECISION-0020)

---

## 9. O QUE ESTE PLANO NÃO FAZ

- **Não é cronograma.** Sessões podem ser agendadas em qualquer ritmo.
- **Não é contrato.** Decisões D1-D6 podem ser revistas se contexto mudar.
- **Não é detalhamento técnico.** Cada sessão tem (ou terá) plano próprio com prompts cirúrgicos.
- **Não cobre features novas.** Apenas remediação estrutural.
- **Não substitui RFCs.** Decisões arquiteturais grandes (D2, D3, D6) podem virar RFCs próprios.

---

## 10. PRÓXIMO PASSO

Sessões 1 e 2 fechadas. Frente 3 (Sessões 3-7 — migração dos 4 callers) está agora desbloqueada.

**Próxima sessão recomendada:** Sessão 3 — `distribution.service.ts` (escrita, 4 transferências). Caller mais simples da Frente 3, bom para validar o padrão de migração antes de aplicar nos demais.

**Decisões formais ainda pendentes (futuras sessões):**
- D1 (Sessão 10): `BankAccountPort` ganha `getAccountById` e `searchAccounts` ou esses métodos viram 501?
- D2 (Sessão 11): `core/unifybank/` é facade autorizada ou core puro?
- D3 (Sessão 15): fronteira `core/events ↔ modules/events` (3 opções α/β/γ)
- D4 (Sessão 20): `GET /economy/transactions/event/:eventId` — produto vivo ou legado?
- D5 (Sessão 20): `GET /economy/transactions/account/:accountId` — produto vivo ou legado?
- D6 (Sessão 22): hardening dos gates após remediação

---

## 11. CHECKPOINTS DE EXECUÇÃO

Histórico append-only de fechamentos de sessão. Cada entrada cita commits e decisões formais.

### Checkpoint Sessão 1 — Triagem do Working Tree (fechada antes de 2026-05-06)
- ~25 commits + restore + delete físico (ver `STATUS_EXECUCAO_GLOBAL.md` 2026-05-05)
- Working tree reduzido de 1549 → 1124 itens (~27% limpos)
- Saída: triagem parcial; débitos abertos preservados como DTs nominais

### Checkpoint Sessão 2 — C66: concept_id slug→UUID (fechada 2026-05-06)
- 7 commits: `88f04b56`, `cff078e9`, `59bde5a1`, `96576c42`, `eb7c7157`, `ad58268a`, `c9a54d93`
- Decisões formais: DECISION-0018 (C+B híbrido), DECISION-0019 (Opção B realocação)
- Build verde · 5 gates verdes · CORE_PURITY drift = 0 (mantém `1278/68/319/891`)
- Objetivo final #6 ("C66 resolvido: `concept_id` é UUID em todo o fluxo") **atingido em runtime**: Bank resolve slug→UUID fail-closed antes de qualquer INSERT; gate `validate:concept-id-uuid-shape` impede expansão geográfica ou quantitativa de slugs literais.

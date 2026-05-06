# PROPOSTA MATERIAL — LOTE 1 (primeiro write candidato)

> Execução autorizada com responsável de bootstrap temporário.  
> Substituição obrigatória por responsável real em fase posterior.

> **Detalhamento (norma):** o convidante em §1 como `system_bootstrap_actor` desbloqueia **só** a fase operacional em **staging** e a rastreabilidade mínima do lote. **Não** dispensa convite/claim nem identidade real nos PASSOs 1–5; **não** constitui titularidade civil definitiva; **não** é bypass de identity (sem CPF/user fictício, sem Grupo C).

**Estado:** **pronta para execução em staging** — bootstrap temporário documentado; **nenhuma** operação na base foi executada **por este commit de documento**.  
**Ambiente alvo (execução controlada):** **staging** (recomendado); dev (`unificard_dev`) apenas se explicitamente o mesmo controlo; **nunca** produção sem PROPOSTA e janela própria.

**Base normativa:**

- `docs/02_decisions/RFC_OPTION_A_PERSON_TO_USER_ACTIVATION.md`
- `docs/02_decisions/ACTIVATION_FLOW_PRE_LOTE1.md`
- `PLANO_IDENTITY_RECONCILIATION.md`
- `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md`
- `PLANO_BASE_MODULO.md` — §6.5, §GLOBAL BLOCK, §STATE_TRANSITION_RULES

**Escopo do lote:** tenant `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5` — **4** actores com `bank_transaction` (sub-fila crítica).

---

## 1. Tabela actor por actor (campos ⟨convidante⟩ / ⟨destinatário⟩: bootstrap temporário — substituir antes de produção)

| actor_id | tenant_id | Criticidade | Quem convida / autoriza | Destinatário esperado (email/pessoa) | Pré-condição mínima | Risco específico |
|----------|-----------|-------------|-------------------------|--------------------------------------|---------------------|------------------|
| `ec75df56-5bb8-4afd-b945-5729ec0282a0` | `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5` | **ALTA** (tx bancária) | `system_bootstrap_actor` | `pendente_definicao_real` | Convite ou claim definido; titular identificado sem heurística de nome | Movimento já existente no Bank — ordem de vínculo não pode corromper ledger |
| `c9fca56e-9a2f-4841-b762-e6271dafe188` | idem | **ALTA** | `system_bootstrap_actor` | `pendente_definicao_real` | idem | idem |
| `3e6e0ea1-871d-4f71-b357-4717e822b68f` | idem | **ALTA** | `system_bootstrap_actor` | `pendente_definicao_real` | idem | idem |
| `5d0f2c4a-855e-498e-aea2-b383eb46da70` | idem | **ALTA** | `system_bootstrap_actor` | `pendente_definicao_real` | idem | idem |

**Nota:** `system_bootstrap_actor` **não** substitui decisão humana de produto/compliance sobre titularidade; **não** dispensa convite/claim e identidade real nos PASSOs 1–5. `pendente_definicao_real` obriga actualização da tabela antes de comunicação externa ou de assinar “titular resolvido” fora de staging.

---

## 2. PROPOSTA única — objetivo

**Objetivo:** para cada um dos 4 actores, estabelecer cadeia canónica `users` → `global_user_id` → `identities` → `actors.user_id` / `actors.global_user_id`, sem CPF sintético, sem user automático, sem Grupo C.

**Ordem global (nunca inverter):** convite/claim → **user real** → **identity real (Batch1 / serviço)** → `users.global_user_id` → **Batch2** → precheck.

---

## 3. Ordem exata de execução (após aprovação)

### PASSO 1 — Convite / claim

- Emitir convite (ou abrir fluxo de claim) **por actor** com token de vínculo ao `actor_id` quando o produto suportar.
- Registar em log: data, executor, canal, id do convite (se aplicável).

### PASSO 2 — Criação de `users` real

- Destinatário completa registo; `users` com email verificado no **mesmo** `tenant_id` do lote.
- **Proibido:** script que INSERT `users` sem processo de verificação.

### PASSO 3 — Criação / validação de identity real

- Garantir `global_users` + `identities` com `tax_id` / `tax_id_type` válidos (dados reais, KYC conforme política).
- Referência runbook: **CP-3 / Batch 1** — `pnpm run identity:batch1:create-identities` **apenas** quando alinhado ao script e ao estado dos dados (ler saída; não forçar).

### PASSO 4 — Vínculo `users.global_user_id`

- Confirmar que `users.global_user_id` aponta para o GU das `identities` (query read-only ou resultado do Batch1).

### PASSO 5 — Batch2 / vínculo `actors.global_user_id` e `actors.user_id`

- **CP-4:** `pnpm run identity:batch2:link-actors` (ou `UPDATE` documentado com `WHERE tenant_id` + `id` do actor, **um** actor por comando se necessário).
- Exit code **2** = ainda unresolved — parar e triagem; **1** = erro — não continuar (runbook).

### PASSO 6 — Logs obrigatórios

- Entrada neste ficheiro ou `IDENTITY-ACTIVATION-<DATA>.md`: convite, aceite, identity, vínculo, comandos executados (sem colar segredos).
- Se tocar `actors`: linha CP-5 só se houver alteração a `is_identity_required` (neste lote **não** é esperado).

### PASSO 7 — Precheck final

- Na raiz ou `backend/`: `pnpm run identity:precheck:a1-a4`
- Colar output no log; **A4 > 0** → STOP (dedup).
- Opcional: `npm run validate:system-state` conforme trilho.

---

## 4. Checklist de segurança (pré-execução)

- [ ] **Sem CPF sintético** — apenas documento real em `identities`.
- [ ] **Sem user automático** — registo/convite com verificação.
- [ ] **Sem alteração fora do tenant** `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5` neste lote (salvo PROPOSTA explícita).
- [ ] **Sem** `is_identity_required = false` (Grupo C) para estes actores neste lote.
- [ ] **Bootstrap:** aceite que §1 usa `system_bootstrap_actor` / `pendente_definicao_real` **só** para desbloqueio operacional em staging; substituição por valores reais antes de produção ou comunicação oficial.
- [ ] **§6.5** e **A4 = 0** confirmados antes do lote material.
- [ ] **§GLOBAL BLOCK** / **§STATE_TRANSITION_RULES:** só alterar estado global com evidência SQL colada após A1–A4 = 0 no alvo.

---

## 5. Rollback “mental” (sem apagar histórico)

| Situação | Acção |
|----------|--------|
| Convite não aceite / timeout | Actor permanece sem `user_id`; documentar; **não** inventar user; reenviar convite ou escalar titular. |
| Identity falha (KYC, documento) | **Não** avançar para Batch2; corrigir dados em `identities` / processo; actor continua elegível A2 até resolvido. |
| Batch2 não vincula / exit ≠ 0 | Parar; runbook CP-4; triagem manual; **não** repetir batch2 às cegas sem corrigir `users`/FK. |
| Regressão A1/A4 após write | STOP; não marcar §GLOBAL BLOCK INATIVO; abrir PROPOSTA de correção / dedup. |

**Regra:** não apagar `bank_*` nem apagar trilho de transação para “desfazer” vínculo; correções são **novos** passos normados.

---

## 6. Checklist final — pronto para aprovação humana

- [ ] RFC + `ACTIVATION_FLOW_PRE_LOTE1` aceites como decisão de sistema.
- [x] Tabela §1 com convidante/destinatário **preenchidos** para execução controlada: `system_bootstrap_actor` / `pendente_definicao_real` (ver nota de topo).
- [ ] Revisor nomeado (nome + data).
- [ ] Janela de execução e rollback acordados.
- [ ] **Só então:** executar PASSOs 1–7 na ordem (staging; sem bypass de identity; sem CPF/user fictício).

---

## 7. Referência rápida — comandos (não executar até aprovação)

```bash
pnpm run identity:precheck:a1-a4
pnpm run identity:batch1:create-identities   # se aplicável ao estado pós-user
pnpm run identity:batch2:link-actors
pnpm run identity:precheck:a1-a4
```

---

**Próxima evidência (após PASSOs 1–7 + trilho financeiro com `USE_BANK_REGIONAL_FUND=true`):** colar output cru das queries em `docs/03_execution_log/MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md` §5–6 (`bank_transactions`, `bank_ledger` por `transaction_id`, contagem debit/credit); critério **GO** = 2 linhas ledger (1 débito + 1 crédito), idempotência sem duplicar, saldo coerente.

---

*Fim da PROPOSTA MATERIAL — documento **pronto para execução** em staging após checklist §6 (revisor + janela); execução = responsabilidade do executor; bootstrap **não** dispensa norma de identidade real nos passos materiais.*

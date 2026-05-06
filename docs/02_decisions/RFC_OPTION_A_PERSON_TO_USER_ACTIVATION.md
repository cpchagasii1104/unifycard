# RFC — Opção A refinada: eliminar «person sem dono» (sem identidade falsa)

**Estado:** PROPOSTA — nenhuma escrita em BD foi executada para este RFC.  
**Ambiente de diagnóstico:** dev (`unificard_dev`), leitura em 2026-04-16.  
**Normas:** `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8.7 (ontologia `user`/`page` vs legado `person`), `ACTOR_TRACEABILITY_CONTRACT.md`, `PLANO_IDENTITY_RECONCILIATION.md`, runbook CP-5.

---

## 1. Diagnóstico final (315 actores)

**Universo:** `actor_type IN ('user','person','actor_human')` AND `global_user_id IS NULL` AND `is_identity_required = true` AND `user_id IS NULL` AND (`external_id` vazio).

**Total:** **315** actores em **78** `tenant_id` distintos.

### 1.1 Prioridade (definição deste RFC)

| Prioridade | Regra |
|------------|--------|
| **ALTA** | `tem_bank_account` OU `tem_bank_transaction` |
| **MÉDIA** | Sem financeiro nas condições acima, mas `orders` OU `events` OU `payment_intents` OU `unifycard_transactions` |
| **BAIXA** | Sem qualquer dos sinais acima |

### 1.2 Distribuição

| Prioridade | Quantidade |
|------------|------------|
| ALTA | 102 |
| MÉDIA | 30 |
| BAIXA | 183 |

**Dentro de ALTA:** tratar primeiro (sub-fila manual) os actores com **`tem_bank_transaction = true`** (impacto ledger) antes dos que só têm conta sem movimento — query ad hoc antes de cada lote.

### 1.3 Artefacto de dados

Ficheiro CSV com uma linha por actor (315 linhas de dados + cabeçalho):

`backend/artifacts/rfc-person-without-user-315.csv`

Colunas: `actor_id`, `tenant_id`, `created_at`, `tem_bank_account`, `tem_bank_transaction`, `tem_orders`, `tem_events`, `prioridade`.

---

## 2. Fluxo de ativação (alvo)

Objetivo: cada actor humano operacional passar a ter **cadeia resolvível** `users` → `global_user_id` → `identities` (quando a norma exigir documento) → `actors.global_user_id`, **sem** emails nem CPF inventados.

1. **Actor existente** (`person` sem `user_id`) permanece até existir dono ou migração explícita.
2. **Utilizador real:** registo / convite / SSO gera `users` com email verificado (ou política B2B equivalente).
3. **Identidade civil:** `global_users` + `identities` com `tax_id` válido e processo KYC conforme produto — **proibido** sintético.
4. **Vínculo:** `actors.user_id` → `users.id` (e `actor_type` convergir para `user` quando a política o mandar), depois `actors.global_user_id` via pipeline Batch2 após `users.global_user_id` preenchido.
5. **Duplicidade:** validar `(tenant_id, email)` único em `users` antes de INSERT; para merge de actors, PROPOSTA com anti-join a duplicados.

**Estado intermédio normado (opcional de produto):** `pendente_de_dono` (metadado ou tabela de workflow) — **não** altera `is_identity_required` sem CP-5; apenas bloqueia ou avisa em rotas críticas conforme desenho de API.

---

## 3. Estratégia por lote

| Lote | Conteúdo | Critério |
|------|------------|----------|
| **Lote 0** | 2 `users` com `global_user_id IS NULL` + 1 actor **TIPO 1** (`user_id` preenchido, actor sem GU) | Pipeline identity + Batch2 — ver auditoria anterior |
| **Lote 1** | Subconjunto **ALTA** com `tem_bank_transaction = true` | PROPOSTA por tenant; precheck A1–A4 antes/depois |
| **Lote 2** | Resto **ALTA** (só conta, sem tx) | Idem |
| **Lote 3** | **MÉDIA** | Idem |
| **Lote 4** | **BAIXA** | Onboarding em massa só com política explícita (ex. tenants de teste) |

Cada lote: **PROPOSTA** escrita → revisão humana → execução mínima → log em `docs/03_execution_log/` + linha CP-5 se tocar em `actors`.

---

## 4. Regras formais propostas (sistema)

1. **Novos fluxos:** não criar `actor_type = 'person'` sem `user_id` quando o fluxo representar utilizador humano da app — preferir `ensureUserActor` após `users` (§4.8.7).
2. **Acções críticas** (definir lista: pagamento, publicação legal, etc.): exigir `users.global_user_id` resolvido e actor `user` coerente, ou falhar com erro normado.
3. **Actors legados sem dono:** estado **pendente de ativação** até vínculo; não usar ausência de dados como prova de «não pessoa».
4. **Migração em massa:** apenas com RFC aprovado e sem CPF fictício.

---

## 5. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Criação em massa de `users` falsos | Apenas convite/registo real; tenants de teste com PROPOSTA isolada |
| Duplicar `users` por email | UNIQUE `(tenant_id, email)` + verificação pré-INSERT |
| Quebrar ledger ao mudar actor | Lotes começam por subconjunto com tx; dry-run + backup em staging |
| Baixar A2 com `is_identity_required = false` sem prova | Proibido pelo modelo conservador; só CP-5 Grupo C com evidência estrutural |

---

## 6. Próximo passo operacional

1. Aprovar este RFC (ou ajustar prioridades ALTA/MÉDIA).  
2. Executar **Lote 0** com scripts já existentes (identity + batch2).  
3. Gerar PROPOSTA por tenant para **Lote 1** usando o CSV.

**Preparação LOTE 1 (ALTA, read-only):** `docs/03_execution_log/LOTE_1_PREP_ALTA_2026-04-16.md` — sub-filas **22** com transação / **80** só conta; LOTE mínimo **4** actores (tenant com mais transações).

**Gate antes do primeiro write (fluxo convite/claim):** `docs/02_decisions/ACTIVATION_FLOW_PRE_LOTE1.md` — define como nasce o `users` e a ordem Batch1 → Batch2; **sem** auto-create.

---

*Fim do RFC — apenas documentação e leitura de dados; nenhuma alteração de schema ou dados foi aplicada ao criar este ficheiro.*

# PLANO_IDENTITY_RECONCILIATION.md

Status: PASS — ENCERRADO
Fase atual: ENCERRADO
Resultado: A1=A2=A3=A4=0 confirmados. §GLOBAL BLOCK inativo.
Scripts criados e validados. Gates CI verdes.
Última execução: 2026-04-19
**Runbook passo-a-passo:** `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md` (checkpoints CP-0…CP-7).  
**Norma:** `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`, `PLANO_BASE_MODULO.md` §6.5, §IDENTITY_INVARIANT, §RESPONSABILIDADE_CIVIL, **§STATE_TRANSITION_RULES**.

**Actualização 2026-04-15:** métrica **A2** = actores humanos **elegíveis** (`is_identity_required = true`, migration `20260529120000_actors_is_identity_required.sql`); scripts `identity:precheck:a1-a4`, `identity:batch1:create-identities`, `identity:batch2:link-actors`, `identity:cp5:export-a2`; CP-5 template Grupo C no runbook.

**Actualização 2026-04-17 (Gate 0 infra):** sem ligação PostgreSQL válida ao alvo (**`DB_OK`** — ver `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md`, secção Gate 0), o pré-voo §2.1 **não corre** → **A1–A4 indeterminados** → **sem evidência → sem transição de estado** (§STATE_TRANSITION_RULES). Não interpretar CP-5 nem A4 sem output real do precheck.

**Actualização 2026-04-17 (CP-5 / CSV):** o campo **`batch2_hint`** existe **apenas** no CSV do export (`identity:cp5:export-a2`), **não** na tabela `actors`. **Proibido** `WHERE batch2_hint` em `actors` (erro `42703`). SQL read-only para triagem Grupo C com critério **`no_genesis_user`** está no **runbook** como CTE `joined`/`hinted` + `CASE` **espelhando** o `if/else` de `identity-cp5-export-a2-candidates.ts` — não usar atalhos sem PROPOSTA que provem equivalência semântica. Evidência: `docs/03_execution_log/IDENTITY-CP5-GRUPO-C-READONLY-2026-04-17.md`.

**Actualização 2026-04-14 (CP-5 / FASE S):** antes de predicar sobre `actors`, confirmar colunas no **DDL real** (FASE S). Tratar `batch2_hint` como coluna de BD é violação estrutural, não só erro de sintaxe. O único critério normado para `no_genesis_user` em SQL é o **espelho** do export (joins + `CASE` no runbook); predicados simplificados (`user_id IS NULL` + `NOT EXISTS` em `users` sem o grafo completo) **não** são equivalentes garantidos ao hint.

**Critério de desbloqueio:** contagens = 0 nas queries de §STATE_TRANSITION_RULES + evidência colada + actualização de `STATUS_EXECUCAO_GLOBAL.md`.

---

## 1. Problema (alvo)

| Sintoma | Verificação típica |
|---------|-------------------|
| `global_users` sem `identities` | Anti-join por `global_user_id` |
| Actores humanos **elegíveis** sem `global_user_id` | A2 — ver §2.1 (`is_identity_required` + tipos humanos) |
| Writer social cria `user` sem GU | `actor.repository.ts` — `INSERT` sem `global_user_id` |

---

## 2. Pré-voo (read-only — sempre primeiro)

Executar no **ambiente alvo** (nomear: dev / staging / prod). Colar output no log de execução.

### 2.1 Contagens base

**Norma A2 (obrigatória):** nem todo `actor` humano no sentido de `actor_type` deve ter `global_user_id`. Contam-se apenas linhas em que **`is_identity_required = true`**: pessoa física identificável / responsabilidade rastreável no modelo (login, responsável documentado, etc.). Actores técnicos, placeholders, legado sem identidade real → **`is_identity_required = false`** após decisão em CP-5 (com registo em log/PROPOSTA quando aplicável). **Não** usar heurística automática (email/nome) para inferir vínculo.

Coluna: `actors.is_identity_required` (BOOLEAN NOT NULL, default **true** — migration `20260529120000_actors_is_identity_required.sql`). Até CP-5 marcar excepções, A2 coincide com a métrica antiga.

```sql
-- A1 — global_users sem identities
SELECT COUNT(*)::bigint AS gu_sem_identities
FROM global_users g
WHERE NOT EXISTS (
  SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id
);

-- A2 — actors humanos ELEGÍVEIS sem global_user_id
SELECT COUNT(*)::bigint AS human_sem_gu
FROM actors
WHERE actor_type IN ('user', 'person', 'actor_human')
  AND global_user_id IS NULL
  AND is_identity_required = true;

-- A3 — actors com GU mas sem identity (deve ser 0 se FK existir)
SELECT COUNT(*)::bigint AS actor_gu_sem_identity
FROM actors a
WHERE a.global_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM identities i WHERE i.global_user_id = a.global_user_id
  );

-- A4 — duas ou mais identities com o mesmo tax_id (bug silencioso; bloquear batch até resolver)
SELECT tax_id, COUNT(*)::bigint AS n
FROM identities
GROUP BY tax_id
HAVING COUNT(*) > 1;
```

Se **A4** devolver linhas → **PARAR** reconciliação em massa até **PROPOSTA** de deduplicação (critério produto/legal/histórico): ver **`PLANO_DEDUPLICACAO_TAX_ID.md`**.

### 2.2 Amostras para triagem (LIMIT 20)

```sql
-- B1 — GU sem identity (para inspeccionar cpf sintético vs real)
SELECT g.global_user_id, left(g.cpf, 24) AS cpf_prefix
FROM global_users g
WHERE NOT EXISTS (SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id)
LIMIT 20;

-- B2 — human elegível sem GU: há user_id?
SELECT a.id, a.tenant_id, a.actor_type, a.user_id, a.external_id, a.is_identity_required
FROM actors a
WHERE a.actor_type IN ('user', 'person', 'actor_human')
  AND a.global_user_id IS NULL
  AND a.is_identity_required = true
LIMIT 20;
```

---

## 3. Ordem de ataque (obrigatória)

**Nunca** aplicar CHECK/FK de invariante **antes** de os dados passarem nas queries A1 = 0 e **A2 = 0** (métrica A2 = actores **elegíveis** sem GU, §2.1; salvo EMPTY puro).

| Fase | O quê | Bloqueia se falhar |
|------|--------|---------------------|
| **0** | Backup / snapshot do alvo (LIVE obrigatório) + correr **A4** (se linhas > 0 → parar e corrigir) | A4 |
| **1** | Backfill **`identities`** para cada `global_users` orfão | A1 |
| **2** | Ligar **`actors`** a `global_user_id` onde houver evidência (`users`, etc.) — script batch 2 | A2 elegíveis (subconjunto) |
| **3** | Triagem **manual** (CP-5) + Grupo C (`is_identity_required = false` com registo) | A2 elegíveis restante |
| **4** | Alterar **código** (`findOrCreateUserActor` + chamadas a `ensureCanonicalActorChain` onde aplicável) | Novos INSERTs |
| **5** | Migrations **DDL** (FK, CHECK, NOT NULL) — último | Deploy |

**Gargalo típico após batches 1–2:** restam actores **elegíveis** (A2) sem vínculo seguro — **CP-5**, triagem humana (Grupos A/B/C). Não é falha de script: é **decisão de produto**. Método operacional: `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md` (CP-5, *Método rápido*).

**Antes de cada novo lote de escrita em `actors`:** reexecutar pré-voo **A1–A4** (`identity:precheck:a1-a4`). Se **A4 > 0**, **parar** e `PLANO_DEDUPLICACAO_TAX_ID.md` — não assumir A4 = 0 por execução anterior.

---

## 4. Batch 1 — `identities` a partir de `global_users`

### 4.1 Preferido (menos deriva vs código)

**Script no repo:** `pnpm run identity:batch1:create-identities` (`backend/scripts/identity-batch1-create-identities.ts`) — usa `ensureIdentityRowForGlobalUserId` / `ensureCanonicalActorChain`.

Job ou script **TypeScript** alternativo: para cada `global_user_id` em B1, invocar a mesma lógica que `IdentityService` (tax_id derivado de `cpf` ou padding a partir do UUID — ver `identity.service.ts`). Assim o backfill **não diverge** do runtime.

Pseudo-fluxo:

```text
FOR cada row em (query B1 sem LIMIT):
  await ensureIdentityRowForGlobalUser(global_user_id)
  logar global_user_id + OK/erro
COMMIT por lote (ex.: 50–100 linhas) ou transaccional única em staging
```

### 4.2 Alternativa (SQL pura — só se revisado por quem conhece `tax_id` CHECK)

`identities` exige `tax_id` com comprimento 11 para `cpf`. Espelhar a regra TypeScript em SQL é sensível a `syn:...` e CNPJ (14) — **se existir CNPJ em `global_users.cpf`**, esta via SQL deve ser estendida ou usar só o caminho 4.1.

Template **apenas para CPF numérico 11** (exemplo; validar no alvo):

```sql
-- EXEMPLO — NÃO executar sem revisão + APROVADO
-- INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
-- SELECT g.global_user_id,
--        lpad(regexp_replace(g.cpf, '\D', '', 'g'), 11, '0'),  -- ou truncar se > 11: política explícita
--        'cpf', 'pending', 'none'
-- FROM global_users g
-- WHERE NOT EXISTS (SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id)
--   AND length(regexp_replace(g.cpf, '\D', '', 'g')) = 11;
```

### 4.3 Pós-batch 1

Re-correr **A1**. Deve ser **0** antes da fase 2.

---

## 5. Batch 2 — `actors` com `user_id` → `users.global_user_id`

**Script canónico (evidência `users` / genesis; só `is_identity_required = true`):** `pnpm run identity:batch2:link-actors` (ver `backend/scripts/identity-batch2-link-actors.ts`). Exit **2** = `unresolved` → **CP-5**.

Onde existir vínculo directo (exemplo SQL legado — preferir o script):

```sql
-- EXEMPLO — NÃO executar sem APROVADO + backup
-- UPDATE actors a
-- SET global_user_id = u.global_user_id, updated_at = now()
-- FROM users u
-- WHERE a.user_id = u.id
--   AND a.tenant_id = u.tenant_id
--   AND a.actor_type = 'user'
--   AND a.global_user_id IS NULL
--   AND a.is_identity_required = true
--   AND u.global_user_id IS NOT NULL;
```

Re-correr **A2**. O restante → **CP-5** (triagem Grupo A/B/C; Grupo **C** → `is_identity_required = false` com registo no runbook, sem inventar GU).

---

## 6. Batch 3 (opcional) — alinhar `actor_type` ao modelo genesis

Se a política for “actor humano canónico = `actor_human` com `id = users.id`”, isso é **mudança de produto**, não só SQL. Tratar em PROPOSTA separada; não misturar com batch 1–2 sem decisão.

---

## 7. Código (após dados estáveis)

1. **`ActorRepository.findOrCreateUserActor`**: após criar/resolver `user`, garantir `global_user_id` (via `users` + `ensureIdentityRowForGlobalUser` ou chamada a `ensureCanonicalActorChain` conforme política).  
2. Proibir novos INSERTs de actor humano sem passo de identity quando a norma exigir.  
3. Testes de integração mínimos: registo + primeiro `ensureUserActor` → linhas `identities` + `actors` coerentes.

---

## 8. Migrations (fase final)

Só após **A1 = 0**, **A2 = 0** (A2 = só `is_identity_required = true`; ou excepção documentada em §A com lista fechada de IDs e política de elegibilidade):

- FK `global_users.global_user_id` → `identities(global_user_id)` **ou** trigger equivalente.  
- `CHECK` em `actors` para tipos humanos + `global_user_id NOT NULL` (tipos exactos por PROPOSTA).

---

## 9. Validação final (evidência para §STATE_TRANSITION_RULES)

Re-executar **A1, A2, A3, A4** (A4 deve devolver **0 linhas**); colar outputs em:

- `docs/03_execution_log/IDENTITY-RECONCILE-⟨YYYYMMDD⟩.md`, e/ou  
- `STATUS_EXECUCAO_GLOBAL.md` (nota datada).

Só então:

```text
§GLOBAL BLOCK: ATIVO → INATIVO
```

---

## 10. Rollback mental (sem ilusão)

| Situação | Acção |
|----------|--------|
| **Antes de qualquer escrita** | `pg_dump` / snapshot / replica de staging |
| **Batch 1 mal aplicado** | Se só INSERT em `identities` e **nenhum** novo fluxo dependeu: `DELETE` das linhas inseridas **só** se lista de `global_user_id` estiver no log do batch; se já existirem FKs de `actors`, **não** apagar à sorte — restaurar backup |
| **Batch 2 UPDATE actors** | Guardar CSV pré-update (`id`, `global_user_id` antigo); `UPDATE ...` reverso só se valores antigos existirem |
| **LIVE** | Janela curta + rollback = **restaurar backup** se invariante quebrar; não contar com “DELETE mágico” em produção |

**Regra:** em LIVE, preferir **uma** transaccão bem testada em staging com **mesmo** volume aproximado.

---

## 11. Opções (recap)

| Opção | Quando |
|-------|--------|
| **A — Forte** | Staging/PARTIAL; backfill completo + DDL no fim |
| **B — Faseada** | LIVE ou medo de colisão: batch 1 por fatias + pausa + A1; depois batch 2 |

**Recomendação:** **B** em LIVE; **A** aceitável em EMPTY/PARTIAL com backup.

---

## 12. Risco (resumo)

- `tax_id` duplicado entre duas identities (improvável com CPF real; possível com sintético) → **obrigatório** correr **A4** no pré-voo e após batch 1; se >0, não avançar até decisão.  
- `UPDATE actors` errado multi-tenant → **sempre** `WHERE tenant_id = ...` alinhado a `users.tenant_id`.  
- Tempo de lock em tabelas grandes → batches + `COMMIT` intermédios.

---

## 13. Checklist de encerramento

```text
□ CP-5 concluído para os elegíveis em aberto (classificação A/B/C + registos Grupo C) ou política documentada
□ A1 = 0 e A2 = 0 (elegíveis; ou excepções listadas e aprovadas + `is_identity_required` alinhado)
□ A3 = 0
□ A4 = 0 linhas (sem tax_id duplicado em identities)
□ Código writer alinhado (fase 7)
□ DDL aplicado só se aprovado (fase 8)
□ Evidência colada + STATUS_EXECUCAO_GLOBAL + §STATE_TRANSITION_RULES cumpridos
```

---

*Documento de plano — SQL aqui é modelo para revisão; execução só após APROVADO explícito.*

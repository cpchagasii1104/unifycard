# RUNBOOK OPS — RLS-RUNTIME-LIVE (virar o runtime de `postgres` → `unificard_app`)

> ✅ **EXECUTADO / RLS-live DEV PASS — 2026-06-24 (ato OPS Clayton; carimbo Clayton).** Runtime=`unificard_app` · `row_security=on` · NOSUPERUSER/NOBYPASSRLS · RLS+FORCE financeiro OK · bank_* isolado por tenant · backend subiu (`localhost:3000`) · workers money-write E observability DESLIGADOS default-off · gates pós-virada OK. (1ª tentativa do dia falhou por credencial — `$AdminDsn` com placeholder não preenchido → admin auth FATAL → backup vazio + ALTER ROLE não executou + §6 auth-fail; corrigida e re-rodada.) **Dinheiro/payout/PORTA-1/bucket D seguem HOLD.** Resíduo: religar worker cross-tenant exige tenant-loop (DECISION-0149) + RLS em payment_intents/governance_funding_commitments. Segredo manipulado em terminal → manter fora do chat; rotacionar se exposto. Este runbook continua docs-only.


**Frente:** F-RLS-RUNTIME-LIVE-OPS-CHECKLIST-FINAL · **Tipo:** runbook operacional (docs-only — este arquivo NÃO executa nada) · **Data:** 2026-06-23 · **Branch:** `rescue-structural`
**Pré-condição de engenharia:** ✅ FECHADA. baseline RLS tenant-context = 0 · cross-tenant via tenant-loop (DECISION-0149) · 3 workers observability default-off · payout-worker HOLD · `unificard_infra` sem LOGIN/pool. **[[DT-RLS-RUNTIME-TENANT-CONTEXT-BASELINE]] CLOSED (engenharia).**
**O que este runbook faz:** entrega o procedimento copiável para OPS/Clayton **virar a chave** com prova de RLS real e rollback. **Quem executa:** OPS/Clayton (NÃO a executora; a IA não aplica role/env/repoint).
**Dinheiro real continua HOLD.** Virar RLS-live **não** autoriza payout/PORTA-1/recovery — é só blindagem de isolamento por tenant.

> ⚠️ Placeholders entre `<...>`. Substituir pelo ambiente-alvo. **Senha NUNCA em git** — usar secret manager. **Migrations/seed/admin NUNCA com `unificard_app`** — usar a conexão administrativa (`<ADMIN_DSN>`).

---

## 0. Variáveis do procedimento (preencher antes)
```bash
ADMIN_DSN="postgresql://<admin_user>:<senha>@<host>:<port>/<db>"   # conexão ADMIN (migrations/preflight/provas) — superuser ou dono do schema
APP_DSN_NEW="postgresql://unificard_app:<senha_app>@<host>:<port>/<db>"  # nova DATABASE_URL do runtime (via secret manager)
TARGET_DB="<db>"
```

## 1. PRÉ-CHECKS OBRIGATÓRIOS (rodar com `ADMIN_DSN`; todos devem passar)
```sql
-- 1.1 unificard_app existe e está SEM superuser/bypass (LOGIN pode estar OFF ainda — será ligado no passo 3)
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='unificard_app';
--   esperado: rolsuper=f  rolbypassrls=f   (rolcanlogin=f ANTES do passo 3; t DEPOIS)

-- 1.2 unificard_infra NÃO ganhou LOGIN/pool (DECISION-0149 — não é chave-mestra ativa)
SELECT rolname, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='unificard_infra';
--   esperado: rolbypassrls=f  rolcanlogin=f

-- 1.3 RLS + FORCE ativos nas tabelas sensíveis (amostra das críticas financeiras)
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
 WHERE relkind='r' AND relname IN
  ('bank_ledger','bank_splits','bank_transactions','bank_accounts','actors',
   'actor_wallet_payout_requests','actor_wallet_recovery_obligations',
   'financial_approval_policies','financial_approval_authorities','approval_requests',
   'service_payment_executions','b2b_payment_intents')
 ORDER BY relname;
--   esperado: relrowsecurity=t E relforcerowsecurity=t em TODAS

-- 1.4 nenhuma tabela com RLS habilitado mas FORCE faltando (FORCE garante que o DONO também obedece)
SELECT relname FROM pg_class
 WHERE relkind='r' AND relrowsecurity AND NOT relforcerowsecurity ORDER BY relname;
--   esperado: 0 linhas

-- 1.5 unificard_app tem GRANT de DML nas tabelas (senão repoint sobe e quebra com permission denied)
SELECT count(*) AS tabelas_sem_grant
  FROM information_schema.tables t
 WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
   AND NOT has_table_privilege('unificard_app', format('%I.%I', t.table_schema, t.table_name), 'SELECT');
--   esperado: 0 (ajustar GRANTs com ADMIN antes de virar, se >0)
```
```bash
# 1.6 guard de engenharia = baseline 0 + workers gated (rodar no repo)
node C:/unificard/backend/scripts/audit-rls-tenant-context.mjs
#   esperado: "GATE OK [rls-tenant-context] — BASELINE = 0 ... "

# 1.7 workers financeiros default-off (flags NÃO podem estar setadas no ambiente do app)
#   conferir que ENABLE_PAYOUT_WORKER / ENABLE_FINANCIAL_METRICS_WORKER /
#   ENABLE_RISK_ANALYSIS_WORKER / ENABLE_FINANCIAL_ALERT_WORKER NÃO estão = 'true'

# 1.8 app AINDA está em postgres/admin ANTES da virada (confirmar DATABASE_URL atual aponta p/ admin)
```

## 2. BACKUP / SNAPSHOT (antes de qualquer mudança)
```bash
TS=$(date +%Y%m%d_%H%M%S)                       # timestamp do backup
pg_dump "$ADMIN_DSN" -Fc -f "rls_golive_${TARGET_DB}_${TS}.dump"
sha256sum "rls_golive_${TARGET_DB}_${TS}.dump" | tee "rls_golive_${TARGET_DB}_${TS}.sha256"
#   REGISTRAR: caminho do dump · TS · hash sha256 · (snapshot de volume/PITR se houver)
```

## 3. CREDENCIAL — dar LOGIN à `unificard_app` (com `ADMIN_DSN`)
```sql
-- senha via secret manager; NUNCA commitar. Trocar <senha_app> pelo segredo.
ALTER ROLE unificard_app WITH LOGIN PASSWORD '<senha_app>';
-- conferir:
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='unificard_app';
--   esperado: rolcanlogin=t · rolsuper=f · rolbypassrls=f
```
- ❌ **NÃO** criar `DATABASE_INFRA_URL`. ❌ **NÃO** dar LOGIN a `unificard_infra`. ❌ senha só no secret manager.

## 4. SEPARAÇÃO DE CONEXÕES (invariante permanente)
- **runtime do app** → `unificard_app` (`APP_DSN_NEW`).
- **migrations / seed / preflight / provas SQL / admin** → `ADMIN_DSN` (conexão administrativa separada).
- **NUNCA** rodar migrations com `unificard_app` (NOBYPASSRLS quebraria DDL/seed cross-tenant). O runner de migration deve continuar usando a conexão admin.

## 5. REPOINT + RESTART
```bash
# 5.1 trocar a DATABASE_URL do runtime para APP_DSN_NEW (via secret manager / env do deploy)
#     DATABASE_URL = $APP_DSN_NEW
# 5.2 restart do app
# 5.3 observar o boot: o preflight db-role-rls-preflight.ts roda no startup e FAIL-CLOSE
#     se o runtime tiver BYPASSRLS/superuser. Boot limpo = role correta.
```

## 6. PROVAS PÓS-VIRADA (rodar; todas devem bater)
```sql
-- 6.1 identidade da conexão do app (rodar via uma rota de diag OU psql com APP_DSN_NEW)
SELECT current_user, session_user;                 -- esperado: unificard_app / unificard_app
SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user;  -- esperado: f

-- 6.2 SEM tenant setado, tabela RLS retorna 0 (apagão proposital — prova que FORCE morde)
SELECT count(*) FROM actors;                        -- esperado: 0  (app.current_tenant não setado)

-- 6.3 COM tenant setado, retorna linhas só do tenant (prova tenant-context)
SELECT set_config('app.current_tenant', '<TENANT_A>', true);
SELECT count(*) FROM actors;                        -- esperado: > 0 (linhas do TENANT_A)

-- 6.4 cross-tenant NÃO vaza: setado TENANT_A, contar linhas de TENANT_B = 0
SELECT set_config('app.current_tenant', '<TENANT_A>', true);
SELECT count(*) FROM actors WHERE tenant_id = '<TENANT_B>';  -- esperado: 0

-- 6.5 INSERT cross-tenant bloqueado (gravar p/ outro tenant que não o de contexto → erro/0)
SELECT set_config('app.current_tenant', '<TENANT_A>', true);
-- INSERT ... (tenant_id='<TENANT_B>') → esperado: erro de policy / new row violates RLS
```
```bash
# 6.6 prova ephemeral de isolamento já existente no repo (roda SET ROLE + ROLLBACK, não persiste)
pnpm --dir C:/unificard/backend run validate:db-role-rls-hardening
#   esperado: PASS (isolamento por tenant provado sob a role app)

# 6.7 smoke do app: uma rota tenant-scoped retorna dados; uma rota sem contexto não vaza
# 6.8 e2e mínimo de leitura via runQueryWithTenant (fluxo real do app) → linhas corretas
```

## 7. CRITÉRIOS DE ABORT (qualquer um → executar ROLLBACK §8)
- app não sobe / crashloop no boot;
- `db-role-rls-preflight` falha (runtime com bypass/superuser);
- query tenant-scoped retorna 0 **indevidamente** (contexto setado mas sem linhas) → grant/policy errado;
- erro de `permission denied` (GRANT faltando);
- erro de policy inesperado em fluxo legítimo;
- worker financeiro inicia indevidamente (flag vazou ON);
- qualquer fluxo tenta mover dinheiro (deve estar HOLD).

## 8. ROLLBACK (reversível, sem desligar RLS)
```bash
# 8.1 repoint DATABASE_URL de volta para a conexão ADMIN anterior (ADMIN_DSN)
#     DATABASE_URL = <DSN admin anterior>
# 8.2 restart do app
# 8.3 confirmar app sobe normalmente
```
- ✅ **MANTER RLS ON + FORCE no schema** — rollback é só do runtime-role, NÃO do RLS.
- ❌ **NÃO** rodar `DISABLE ROW LEVEL SECURITY` / `NO FORCE` — desligar RLS exige DECISION própria.
- (opcional, se preciso isolar credencial) `ALTER ROLE unificard_app WITH NOLOGIN;`
- registrar **incidente**: sintoma, prova que falhou, decisão de rollback, TS.

## 9. PÓS-CHECK / EVIDÊNCIAS A SALVAR (OPS arquiva)
- saída de **§1** (pré-checks) · **§6** (todas as provas) · log de boot com preflight PASS.
- backup: caminho + TS + hash (§2).
- `git rev-parse HEAD` do app no momento da virada.
- confirmação: **dinheiro real continua HOLD** · **PORTA-1 NÃO executada** · workers default-off.
- atualizar STATUS/cartório operacional com o resultado (PASS/ABORT) e TS.

---

## Evidências mínimas que OPS deve devolver (resumo)
```
[ ] §1.1–1.8 pré-checks: todos PASS (colar saídas)
[ ] §2 backup: caminho + TS + sha256
[ ] §3 ALTER ROLE LOGIN: rolcanlogin=t / super=f / bypass=f
[ ] §6.1 current_user=unificard_app · bypass=f
[ ] §6.2 sem-tenant = 0 linhas
[ ] §6.3 com-tenant = linhas do tenant
[ ] §6.4/6.5 cross-tenant read/insert = 0/bloqueado
[ ] §6.6 validate:db-role-rls-hardening PASS
[ ] §6.7/6.8 smoke + e2e tenant-scoped PASS
[ ] dinheiro HOLD confirmado · PORTA-1 não executada
```

**Próximo (somente após este runbook executado e provado):** PORTA-1 payout approval policy (decisão soberana de Clayton, com IA-DINHEIRO). Este runbook **não** abre PORTA-1.

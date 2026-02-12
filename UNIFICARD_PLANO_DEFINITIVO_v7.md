# UNIFICARD — PLANO DEFINITIVO DE EXECUÇÃO
## Rebase Constitucional + Execução Completa

**Versão:** 7.0 DEFINITIVO  
**Data:** 2026-02-11  
**Tipo:** REBASE CONSTITUCIONAL (não incremental)  
**Status:** FASE 3 CONCLUÍDA · LEI 2 ATIVA · FORWARD-ONLY IMPOSTO

---

### STATUS REAL DO REBASE — CONSOLIDADO (ATÉ FASE 3)

- Separação normativa concluída:
  Constituição, Leis Operacionais e SSOT Registry isolados em docs/01_normative/.
  UNIFICARD_PLANO_DEFINITIVO_v7.md deixou de conter blocos normativos duplicados.
  Hierarquia normativa consolidada.

- FASE 0 concluída:
  313 migrations arquivadas em backend/migrations_archive/.
  MIGRATIONS_ARCHIVE_MANIFEST.md criado com SHA256.
  backend/migrations/ zerado.

- FASE 1 concluída:
  5 migrations Genesis criadas (0001–0005).
  Correção aplicada no RAISE EXCEPTION em 0003_bank_core.sql.
  Auditoria estrutural validada.

- FASE 2 concluída:
  Banco recriado 3x.
  pg_dump --schema-only executado.
  Hash determinístico confirmado:

  D1A5EB95354884275E3406A464D7DB5F5EEF2C200C4A0B4615E55B268ECC24CF

- Commit consolidado:
  bee2d606460d4c800c1b106677d74a97d96910b2

- FASE 3 concluída:
  0006_forward_only_lock.sql criada e aplicada.
  schema_version ativa com versão 6.
  Trigger enforce_forward_only ativa.
  Forward-only imposto tecnicamente.

---

# DECISÕES ARQUITETURAIS (FECHADAS — IMUTÁVEIS)

| # | Decisão | Resolução | Justificativa |
|---|---------|-----------|---------------|
| 1 | 312 migrations existentes | **ARQUIVAR** em `backend/migrations_archive/` | Preservar histórico sem executar |
| 2 | Novo Genesis | **5 arquivos estruturados** | Modular, auditável, manutenível |
| 3 | Data de corte | **IMEDIATA** — momento do Genesis | Sem ambiguidade temporal |
| 4 | Lei 2 (Forward-Only) | **ATIVADA após tag GENESIS_CONSTITUCIONAL_v1** | Proteção constitucional |

---

# ÍNDICE DE EXECUÇÃO

| Fase | Nome | Tipo | Tag Resultante |
|------|------|------|----------------|
| 0 | Arquivamento + Governança | Preparação | PRE_GENESIS_ARCHIVE |
| 1 | Genesis Constitucional | Database | GENESIS_CREATED |
| 2 | Prova de Determinismo | Validação | GENESIS_VERIFIED |
| 3 | Fechamento Constitucional | Marco | GENESIS_CONSTITUCIONAL_v1 |
| 4 | CI Anti-Regressão | Automação | SSOT_GUARDIAN_ACTIVE |
| 5 | Backend Core Services | Código | BACKEND_CORE_CREATED |
| 6 | Backend Kill Switch | Código | BACKEND_KILL_SWITCH |
| 7 | Backend Modules | Código | BACKEND_MODULES_COMPLETE |
| 8 | Frontend | Código | FRONTEND_COMPLETE |
| 9 | Limpeza de Legado | Código | LEGACY_CLEANED |
| 10 | Falsificações (Gates) | Validação | GATES_PASSED |
| 11 | Testes de Quebra | Validação | BREAK_TESTS_PASSED |
| 12 | Declaração Final | Marco | REBASE_COMPLETE |

**Estimativa Total:** 5-7 dias

---

---

# SEÇÃO I — REFERÊNCIA CONSTITUCIONAL

A Constituição oficial está em:
docs/01_normative/CONSTITUICAO_UNIFICARD.md

## Este plano NÃO contém normas permanentes.

---

---

# SEÇÃO II — REFERÊNCIA ÀS LEIS OPERACIONAIS

As Leis Operacionais oficiais estão em:
docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md
------------------------------------------------

---

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO III — POLÍTICAS DE EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════════════

## 3.1 Política de Commits

```
Formato: [REBASE-XX] Descrição curta

Exemplos:
[REBASE-00] Arquivamento de migrations históricas
[REBASE-01] Genesis Constitucional
[REBASE-03] Fechamento Constitucional
```

---

## 3.2 Política de Tags

```
Tags de Marco (obrigatórias):
PRE_GENESIS_ARCHIVE
GENESIS_CREATED
GENESIS_VERIFIED
GENESIS_CONSTITUCIONAL_v1  ← Lei 2 ativada aqui
SSOT_GUARDIAN_ACTIVE
BACKEND_CORE_CREATED
BACKEND_KILL_SWITCH
BACKEND_MODULES_COMPLETE
FRONTEND_COMPLETE
LEGACY_CLEANED
GATES_PASSED
BREAK_TESTS_PASSED
REBASE_COMPLETE  ← Tag final
```

---

## 3.3 Política de Rollback

Se uma fase falhar:

1. **Não continuar** para próxima fase
2. **Reverter** ao último commit estável
3. **Documentar** falha em docs/03_execution_log/
4. **Corrigir** causa raiz
5. **Reexecutar** fase inteira

---

## 3.4 Política de Build

**Antes de fechar qualquer fase que edita código:**

```powershell
cd backend && pnpm build
cd frontend && pnpm build
```

Se falhar, fase não pode ser commitada.


---

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO IV — FASES DE EXECUÇÃO (ORDEM ABSOLUTA)
# ═══════════════════════════════════════════════════════════════════════════

```
ORDEM: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

PROIBIDO PULAR FASES.
PROIBIDO EXECUTAR EM PARALELO.
PROIBIDO VOLTAR PARA FASE ANTERIOR SEM ROLLBACK FORMAL.
```

---

# ═══════════════════════════════════════════════════════════════════════════
# BLOCO INSTITUCIONAL DE PRÉ-EXECUÇÃO OBRIGATÓRIA
# ═══════════════════════════════════════════════════════════════════════════

> **OBRIGATÓRIO:** Este bloco deve ser executado ANTES de qualquer fase de execução.

## Runner Institucional Único

**Caminho oficial:** `UNIFICARD_PLANO_DEFINITIVO_v7.md`

Este documento é a única fonte de verdade para execução do rebase constitucional. Qualquer desvio ou execução paralela é proibida.

## Regra de Banco Vazio (Query Obrigatória)

**ANTES de qualquer execução de migration:**

```sql
-- Verificar que o banco está vazio (apenas tabelas do sistema)
SELECT 
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE 'information_schema%') as user_tables
FROM information_schema.tables
WHERE table_schema = 'public';

-- Se user_tables > 0, ABORTAR e recriar banco
-- Comando obrigatório:
-- dropdb -h localhost -U postgres unificard_dev
-- createdb -h localhost -U postgres -E UTF8 unificard_dev
```

**Critério PASS:** `user_tables = 0`  
**Critério FAIL:** `user_tables > 0` → ABORTAR execução

## Regra de Verificação de Tabelas Proibidas (Query Obrigatória)

**ANTES de qualquer edição de código ou migration:**

```sql
-- Listar tabelas proibidas que não devem existir
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'accounts', 'transactions', 'ledger', 'ledger_entries',
    'payment_splits', 'payment_intent_splits', 'event_split_declarative',
    'ledger_referral_splits', 'event_revenue_split',
    'payment_transactions', 'escrow_transactions', 'group_transactions',
    'payout_transactions', 'social_ledger'
  );

-- Se qualquer resultado retornado, ABORTAR
```

**Critério PASS:** Query retorna 0 linhas  
**Critério FAIL:** Query retorna > 0 linhas → ABORTAR execução

## Regra de Verificação de Arquivos Antes de Editar/Remover

**ANTES de editar ou remover qualquer arquivo:**

```powershell
# Verificar existência e hash do arquivo
$filePath = "caminho/do/arquivo"
if (Test-Path $filePath) {
  $hash = (Get-FileHash $filePath -Algorithm SHA256).Hash
  Write-Host "Arquivo existe. Hash: $hash"
  # Registrar hash antes da edição
} else {
  Write-Error "Arquivo não existe - ABORTAR"
  exit 1
}
```

**Critério PASS:** Arquivo existe e hash registrado  
**Critério FAIL:** Arquivo não existe → ABORTAR execução

## Regra de Criação de Diretórios Antes de Criar Arquivos

**ANTES de criar qualquer arquivo:**

```powershell
# Verificar/criar diretório pai
$dirPath = Split-Path -Parent "caminho/do/arquivo"
if (-not (Test-Path $dirPath)) {
  New-Item -ItemType Directory -Path $dirPath -Force
  Write-Host "Diretório criado: $dirPath"
}
```

**Critério PASS:** Diretório existe ou foi criado  
**Critério FAIL:** Falha ao criar diretório → ABORTAR execução

## Regra de Validação de Migrations Antes de Commit

**ANTES de commitar qualquer migration:**

```powershell
# Validar sintaxe SQL
$migrationFiles = Get-ChildItem -Path "backend/migrations/*.sql" -Recurse
foreach ($file in $migrationFiles) {
  # Verificar que não contém estruturas proibidas
  $content = Get-Content $file -Raw
  if ($content -match "CREATE TABLE.*accounts|CREATE TABLE.*transactions|CREATE TABLE.*ledger") {
    Write-Error "Migration contém estrutura proibida: $($file.Name)"
    exit 1
  }
}
```

**Critério PASS:** Nenhuma estrutura proibida encontrada  
**Critério FAIL:** Estrutura proibida encontrada → ABORTAR commit

## Regra de Validação de Build (Exit Code 0)

**ANTES de fechar qualquer fase que edita código:**

```powershell
cd backend
pnpm build
if ($LASTEXITCODE -ne 0) {
  Write-Error "Build falhou - ABORTAR"
  exit 1
}

cd ../frontend
pnpm build
if ($LASTEXITCODE -ne 0) {
  Write-Error "Build falhou - ABORTAR"
  exit 1
}
```

**Critério PASS:** `exit code = 0`  
**Critério FAIL:** `exit code != 0` → ABORTAR fase

## Regra de Validação de Testes (Se Existirem)

**ANTES de fechar qualquer fase que edita código:**

```powershell
cd backend
if (Test-Path "package.json" -and (Get-Content "package.json" | Select-String "test")) {
  pnpm test
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Testes falharam - ABORTAR"
    exit 1
  }
}
```

**Critério PASS:** Testes passam ou não existem  
**Critério FAIL:** Testes falham → ABORTAR fase

## Regra de Unificação de Paths Docs (Padrão Único)

**Padrão obrigatório para todos os documentos:**

```
docs/
├── 01_normative/     # Documentos normativos e constitucionais
├── 02_execution/     # Logs e rastreamento de execução
├── 03_architecture/ # Decisões arquiteturais
└── 04_audit/         # Auditoria, provas e validações
```

**Critério PASS:** Todos os documentos seguem o padrão  
**Critério FAIL:** Documento fora do padrão → ABORTAR criação

---

# ═══════════════════════════════════════════════════════════════════════════
# SCAN AUTOMÁTICO DE DERIVA FINANCEIRA
# ═══════════════════════════════════════════════════════════════════════════

> **OBRIGATÓRIO:** Executar ANTES de qualquer fase que edita código ou banco.

## Query SQL para Listar Tabelas Proibidas

```sql
-- Scan completo de deriva financeira
SELECT 
  'TABELA_PROIBIDA' as tipo,
  table_name as nome,
  'VIOLAÇÃO SSOT' as motivo
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    -- Ledgers paralelos
    table_name LIKE '%ledger%' AND table_name NOT IN ('bank_ledger', 'coverage_audit_log')
    OR
    -- Splits paralelos
    table_name LIKE '%split%' AND table_name != 'bank_splits'
    OR
    -- Tabelas financeiras legacy
    table_name IN ('accounts', 'transactions', 'ledger', 'ledger_entries')
    OR
    -- Splits concorrentes
    table_name IN (
      'payment_splits', 'payment_intent_splits', 'event_split_declarative',
      'ledger_referral_splits', 'event_revenue_split'
    )
    OR
    -- Transações paralelas
    table_name IN (
      'payment_transactions', 'escrow_transactions', 'group_transactions',
      'payout_transactions', 'social_ledger'
    )
  );

-- Se qualquer resultado, ABORTAR HARD
```

## Grep Obrigatório no Backend

```powershell
# Scan de código para estruturas proibidas
$violations = @()

# Verificar criação de tabelas proibidas
$violations += grep -rn "CREATE TABLE.*accounts" backend/src --include="*.ts" | Select-String -Pattern "accounts" -NotMatch "bank_accounts"
$violations += grep -rn "CREATE TABLE.*transactions" backend/src --include="*.ts" | Select-String -Pattern "transactions" -NotMatch "bank_transactions"
$violations += grep -rn "CREATE TABLE.*ledger" backend/src --include="*.ts" | Select-String -Pattern "ledger" -NotMatch "bank_ledger"
$violations += grep -rn "CREATE TABLE.*split" backend/src --include="*.ts" | Select-String -Pattern "split" -NotMatch "bank_splits"

# Verificar saldos fora do bank
$violations += grep -rn "\.balance" backend/src --include="*.ts" | Select-String -Pattern "bank_" -NotMatch

# Verificar referências a estruturas proibidas
$violations += grep -rn "payment_splits|ledger_referral_splits|event_split_declarative" backend/src --include="*.ts"

if ($violations.Count -gt 0) {
  Write-Error "❌ DERIVA FINANCEIRA DETECTADA - ABORTAR HARD"
  $violations | ForEach-Object { Write-Host $_ }
  exit 1
}

Write-Host "✅ Scan de deriva financeira: PASS"
```

## Abort Hard se Qualquer Ocorrência Encontrada

**Critério PASS:** 
- Query SQL retorna 0 linhas
- Grep retorna 0 ocorrências

**Critério FAIL:** 
- Query SQL retorna > 0 linhas → **ABORTAR HARD**
- Grep retorna > 0 ocorrências → **ABORTAR HARD**

**Ação obrigatória em caso de FAIL:**
1. Interromper execução imediatamente
2. Documentar violação em `docs/04_audit/DERIVA_FINANCEIRA_DETECTADA.md`
3. Não prosseguir para próxima fase
4. Requerer correção antes de continuar

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 0: ARQUIVAMENTO + GOVERNANÇA
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] UNIFICARD_PLANO_DEFINITIVO_v7.md (seção completa)
- [ ] BLOCO INSTITUCIONAL DE PRÉ-EXECUÇÃO OBRIGATÓRIA (acima)
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA (acima)

### Pré-condições
- [ ] Banco de dados recriado do zero (query de banco vazio executada)
- [ ] Scan de deriva financeira executado (PASS)
- [ ] Nenhuma tabela proibida detectada
- [ ] Build do backend/frontend passando (se aplicável)

### Critério PASS
- Banco vazio confirmado
- Scan de deriva financeira: 0 violações
- Todas as pré-condições atendidas

### Critério FAIL
- Banco não vazio → ABORTAR
- Deriva financeira detectada → ABORTAR HARD
- Pré-condições não atendidas → ABORTAR

### Objetivo
Arquivar histórico e criar lock normativo antes de qualquer código.

### Objetivo
Arquivar histórico e criar lock normativo antes de qualquer código.

### 0.1 Arquivar Migrations Existentes

```powershell
# Criar pasta de arquivo
mkdir backend/migrations_archive

# Mover todas as 312 migrations
mv backend/migrations/*.sql backend/migrations_archive/

# Verificar
ls backend/migrations_archive/ | Measure-Object -Line
# Deve retornar: 312
```

### 0.2 Criar Manifest de Arquivamento

```
criar: docs/04_audit/MIGRATIONS_ARCHIVE_MANIFEST.md
```

Conteúdo obrigatório:
```markdown
# MANIFEST DE ARQUIVAMENTO

**Data:** 2026-02-XX
**Total de arquivos:** 312
**Localização:** backend/migrations_archive/

## Lista Completa
| # | Arquivo | Hash SHA256 |
|---|---------|-------------|
| 001 | 0000_schema_migrations.sql | [hash] |
| 002 | 0001_schema_genesis_ssot.sql | [hash] |
... (todos os 312)

## Motivo
Rebase Constitucional - histórico preservado, não será executado.
```

### 0.3 Criar Documentos Normativos

```
criar: docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md
criar: docs/01_normative/SSOT_CONTRACT.md
criar: docs/01_normative/SSOT_REGISTRY.md
criar: docs/01_normative/PROHIBITED_STRUCTURES.md
criar: docs/01_normative/BANK_SEMANTICS.md
criar: docs/01_normative/OPERATING_MODE.md
```

### 0.4 Editar Protocolo de Agente

```
editar: docs/01_normative/00_AGENT_PROTOCOL.md
  → adicionar seção de leitura obrigatória
  → referenciar este documento como fonte única
```

### 0.5 Criar Estrutura de Auditoria

```
criar: docs/04_audit/WRITE_SURFACE_BASELINE.md
criar: docs/04_audit/FALSIFICATION_LOG.md
criar: docs/04_audit/GATES.md
criar: docs/04_audit/IMPACT_MATRIX.md
criar: docs/04_audit/PREFLIGHT_REPORT.md
```

### Checklist FASE 0

- [x] Pasta `migrations_archive/` criada
- [x] 312 arquivos movidos
- [x] MIGRATIONS_ARCHIVE_MANIFEST.md criado com hashes
- [x] 6 documentos normativos criados
- [x] 00_AGENT_PROTOCOL.md editado
- [x] 5 documentos de auditoria criados
- [x] Commit: `[REBASE-00] Arquivamento e Governança`
- [x] Tag: `PRE_GENESIS_ARCHIVE`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 1: GENESIS CONSTITUCIONAL
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 0 completa e tag PRE_GENESIS_ARCHIVE criada
- [ ] BLOCO INSTITUCIONAL DE PRÉ-EXECUÇÃO OBRIGATÓRIA
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA executado

### Pré-condições
- [ ] FASE 0 concluída com sucesso
- [ ] Banco de dados recriado do zero
- [ ] Scan de deriva financeira: PASS
- [ ] Pasta backend/migrations/ vazia (exceto migrations arquivadas)

### Critério PASS
- Banco vazio confirmado
- Nenhuma migration existente em backend/migrations/
- Scan de deriva financeira: 0 violações

### Critério FAIL
- Banco não vazio → ABORTAR
- Migrations existentes em backend/migrations/ → ABORTAR
- Deriva financeira detectada → ABORTAR HARD

### Objetivo
Criar o novo banco de dados do zero com 5 migrations estruturadas.

### Estrutura do Genesis

```
backend/migrations/
├── 0001_extensions.sql
├── 0002_identity.sql
├── 0003_bank_core.sql
├── 0004_marketplace.sql
└── 0005_events.sql
```

---

### 0001_extensions.sql

```sql
-- ============================================================
-- GENESIS 0001: EXTENSÕES
-- ============================================================
-- Rebase Constitucional UnifiCard
-- Data: 2026-02-11
-- MODO: Constitucional Rígido (sem IF NOT EXISTS)

CREATE EXTENSION "uuid-ossp";
CREATE EXTENSION "pgcrypto";
```

---

### 0002_identity.sql

```sql
-- ============================================================
-- GENESIS 0002: IDENTITY
-- ============================================================
-- SSOT: actors (actor_id)
-- MODO: Constitucional Rígido

BEGIN;

-- Tenants (multi-tenancy)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actors (SSOT de identidade econômica)
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('person', 'company', 'system')),
  external_id TEXT,
  display_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  kyc_verified_at TIMESTAMPTZ,
  kyc_limit_cents BIGINT DEFAULT 500000, -- 5000 BRL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, external_id)
);

CREATE INDEX idx_actors_tenant ON actors(tenant_id);
CREATE INDEX idx_actors_cpf_cnpj ON actors(cpf_cnpj);

-- ATL (Anti-Terrorism/Laundering)
CREATE TABLE atl_blocked_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL UNIQUE REFERENCES actors(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_reason TEXT NOT NULL,
  blocked_by UUID
);

CREATE INDEX idx_atl_blocked_actor ON atl_blocked_actors(actor_id);

COMMIT;
```

---

### 0003_bank_core.sql

```sql
-- ============================================================
-- GENESIS 0003: BANK CORE (SSOT FINANCEIRO)
-- ============================================================
-- SSOT: bank_accounts, bank_transactions, bank_ledger, bank_splits
-- MODO: Constitucional Rígido

BEGIN;

-- ============================================================
-- ENUMs
-- ============================================================

CREATE TYPE credit_status AS ENUM ('active', 'inactive', 'expired', 'orphan');

CREATE TYPE transfer_purpose AS ENUM (
  'donation', 'reallocation', 'refund', 'split', 'execution',
  'settlement', 'expiration', 'initial_credit', 'group_allocation',
  'escrow_hold', 'escrow_release'
);

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

-- Bank Accounts (SSOT de conta)
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID REFERENCES actors(id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('actor', 'system', 'escrow')),
  owner_id TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'credit',
  credit_status credit_status DEFAULT 'active',
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  inactive_since TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, owner_type, owner_id)
);

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_actor ON bank_accounts(actor_id);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(credit_status);

-- Bank Transactions (SSOT de transação)
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  purpose transfer_purpose NOT NULL,
  justification TEXT,
  requires_justification BOOLEAN DEFAULT true,
  reference_type TEXT,
  reference_id UUID,
  internal_completed_at TIMESTAMPTZ,
  external_settled_at TIMESTAMPTZ,
  external_partner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_actor ON bank_transactions(actor_id);
CREATE INDEX idx_bank_transactions_account ON bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_purpose ON bank_transactions(purpose);
CREATE INDEX idx_bank_transactions_created ON bank_transactions(created_at);

-- Bank Ledger (SSOT de saldo)
CREATE TABLE bank_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_id UUID REFERENCES bank_transactions(id),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  purpose transfer_purpose,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_ledger_account ON bank_ledger(account_id);
CREATE INDEX idx_bank_ledger_transaction ON bank_ledger(transaction_id);
CREATE INDEX idx_bank_ledger_created ON bank_ledger(created_at);

-- Bank Splits (SSOT de split)
CREATE TABLE bank_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
  source_actor_id UUID NOT NULL REFERENCES actors(id),
  target_actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  split_type TEXT NOT NULL,
  percentage NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_splits_transaction ON bank_splits(transaction_id);
CREATE INDEX idx_bank_splits_source ON bank_splits(source_actor_id);
CREATE INDEX idx_bank_splits_target ON bank_splits(target_actor_id);

-- ============================================================
-- VIEW: System Coverage (Lastro)
-- ============================================================

CREATE OR REPLACE VIEW system_coverage AS
SELECT 
  t.id as tenant_id,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type = 'system'
  ), 0) as execution_capacity_cents,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type != 'system'
  ), 0) as total_credits_cents
FROM tenants t;

-- ============================================================
-- TRIGGER: Coverage Check (80% max)
-- ============================================================

CREATE OR REPLACE FUNCTION check_coverage_before_credit()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage NUMERIC;
  v_owner_type TEXT;
  v_capacity BIGINT;
  v_credits BIGINT;
BEGIN
  IF NEW.direction != 'credit' THEN RETURN NEW; END IF;
  
  SELECT ba.owner_type INTO v_owner_type FROM bank_accounts ba WHERE ba.id = NEW.account_id;
  IF v_owner_type = 'system' THEN RETURN NEW; END IF;
  
  SELECT execution_capacity_cents, total_credits_cents INTO v_capacity, v_credits
  FROM system_coverage WHERE tenant_id = NEW.tenant_id;
  
  IF v_capacity > 0 THEN
    v_coverage := (v_credits::NUMERIC / v_capacity::NUMERIC) * 100;
  ELSE
    v_coverage := 100;
  END IF;
  
  IF v_coverage >= 80 THEN
    RAISE EXCEPTION 'COVERAGE_EXCEEDED: %% cobertura', ROUND(v_coverage, 2) USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_coverage
  BEFORE INSERT ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION check_coverage_before_credit();

-- ============================================================
-- TRIGGER: ATL Check
-- ============================================================

CREATE OR REPLACE FUNCTION check_atl_before_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM atl_blocked_actors WHERE actor_id = NEW.actor_id) THEN
    RAISE EXCEPTION 'ATL_BLOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_atl
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION check_atl_before_transaction();

-- ============================================================
-- TRIGGER: Purpose Validation
-- ============================================================

CREATE OR REPLACE FUNCTION validate_transfer_purpose()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.purpose IS NULL THEN
    RAISE EXCEPTION 'MISSING_PURPOSE' USING ERRCODE = 'P0001';
  END IF;
  
  IF NEW.requires_justification = true 
     AND NEW.purpose IN ('reallocation', 'refund', 'execution')
     AND (NEW.justification IS NULL OR LENGTH(TRIM(NEW.justification)) < 10) THEN
    RAISE EXCEPTION 'MISSING_JUSTIFICATION' USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_purpose
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION validate_transfer_purpose();

-- ============================================================
-- TRIGGER: Update Activity
-- ============================================================

CREATE OR REPLACE FUNCTION update_account_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bank_accounts 
  SET last_activity_at = now(), inactive_since = NULL, credit_status = 'active'
  WHERE id = NEW.account_id AND owner_type != 'system';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_activity
  AFTER INSERT ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION update_account_activity();

-- ============================================================
-- TABELAS AUXILIARES
-- ============================================================

-- Execution Fund Rules
CREATE TABLE execution_fund_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  max_percentage_of_reserve INTEGER NOT NULL DEFAULT 20,
  allowed_uses TEXT[] NOT NULL DEFAULT ARRAY['execution', 'stabilization', 'collective_impact'],
  prohibited_uses TEXT[] NOT NULL DEFAULT ARRAY['distribution', 'profit', 'operations'],
  requires_committee_approval_above_cents BIGINT DEFAULT 1000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution Fund Movements
CREATE TABLE execution_fund_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('credit_expiration', 'orphan_recovery', 'execution', 'stabilization')),
  amount_cents BIGINT NOT NULL,
  source_account_id UUID REFERENCES bank_accounts(id),
  source_description TEXT,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_fund_movements_tenant ON execution_fund_movements(tenant_id);

-- Coverage Audit Log
CREATE TABLE coverage_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  coverage_pct NUMERIC(5,2) NOT NULL,
  execution_capacity_cents BIGINT NOT NULL,
  total_credits_cents BIGINT NOT NULL,
  operation_blocked BOOLEAN DEFAULT false
);

CREATE INDEX idx_coverage_audit_tenant ON coverage_audit_log(tenant_id);

-- ============================================================
-- FUNCTIONS AUXILIARES
-- ============================================================

-- Mark Inactive Accounts (12 months)
CREATE OR REPLACE FUNCTION mark_inactive_accounts() RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'inactive', inactive_since = now()
  WHERE credit_status = 'active'
    AND owner_type != 'system'
    AND last_activity_at < now() - interval '12 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Expire Old Credits (24 months total)
CREATE OR REPLACE FUNCTION expire_old_credits() RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'expired', expires_at = now()
  WHERE credit_status = 'inactive'
    AND inactive_since < now() - interval '12 months'
    AND owner_type != 'system';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

---

### 0004_marketplace.sql

```sql
-- ============================================================
-- GENESIS 0004: MARKETPLACE
-- ============================================================
-- Domínio: payments, orders, intents (pré-financeiro)
-- MODO: Constitucional Rígido

BEGIN;

-- Payment Intents (pré-financeiro, NÃO decide dinheiro)
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  intent_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_intents_tenant ON payment_intents(tenant_id);
CREATE INDEX idx_payment_intents_actor ON payment_intents(actor_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  buyer_actor_id UUID NOT NULL REFERENCES actors(id),
  seller_actor_id UUID NOT NULL REFERENCES actors(id),
  total_cents BIGINT NOT NULL CHECK (total_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_actor_id);
CREATE INDEX idx_orders_seller ON orders(seller_actor_id);

-- UnifyCard Transactions (log operacional, NÃO decide saldo)
CREATE TABLE unifycard_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  external_id TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('capture', 'authorization', 'settlement', 'void')),
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  external_partner TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unifycard_tenant ON unifycard_transactions(tenant_id);
CREATE INDEX idx_unifycard_bank_tx ON unifycard_transactions(bank_transaction_id);

COMMIT;
```

---

### 0005_events.sql

```sql
-- ============================================================
-- GENESIS 0005: EVENTS & RISK
-- ============================================================
-- MODO: Constitucional Rígido

BEGIN;

-- ============================================================
-- AI CONSTITUTIONAL LIMITS
-- ============================================================

CREATE TABLE ai_constitutional_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  limit_type TEXT NOT NULL UNIQUE CHECK (limit_type IN (
    'operations_per_hour', 'operations_per_day', 'blast_radius_pct',
    'max_amount_per_operation_cents', 'max_total_amount_per_hour_cents'
  )),
  limit_value BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  kill_switch_activated_at TIMESTAMPTZ,
  kill_switch_activated_by TEXT,
  kill_switch_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Limites padrão
INSERT INTO ai_constitutional_limits (limit_type, limit_value) VALUES
  ('operations_per_hour', 100),
  ('operations_per_day', 1000),
  ('blast_radius_pct', 1),
  ('max_amount_per_operation_cents', 100000),
  ('max_total_amount_per_hour_cents', 1000000);

-- AI Operations Log
CREATE TABLE ai_operations_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ai_instance_id TEXT NOT NULL,
  ai_model TEXT,
  operation_type TEXT NOT NULL,
  affected_actors_count INTEGER DEFAULT 0,
  amount_cents BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_operations_instance ON ai_operations_log(ai_instance_id);
CREATE INDEX idx_ai_operations_created ON ai_operations_log(created_at);

-- ============================================================
-- EVASION PATTERNS (Fragmentation Detection)
-- ============================================================

CREATE TYPE evasion_pattern_type AS ENUM (
  'fragmentation', 'persona_rotation', 'cluster_suspicious',
  'automation_abuse', 'chain_delegation', 'timing_manipulation'
);

CREATE TABLE evasion_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  pattern_type evasion_pattern_type NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL,
  confidence_score NUMERIC(3,2),
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  false_positive BOOLEAN DEFAULT false
);

CREATE INDEX idx_evasion_patterns_actor ON evasion_patterns(actor_id);
CREATE INDEX idx_evasion_patterns_type ON evasion_patterns(pattern_type);

-- Fragmentation Detection Function
CREATE OR REPLACE FUNCTION detect_fragmentation(
  p_actor_id UUID,
  p_window_hours INTEGER DEFAULT 24,
  p_threshold_count INTEGER DEFAULT 10,
  p_small_amount_threshold_cents INTEGER DEFAULT 10000
) RETURNS TABLE(is_suspicious BOOLEAN, transaction_count INTEGER, total_amount_cents BIGINT, evidence JSONB) AS $$
DECLARE
  v_count INTEGER;
  v_total BIGINT;
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM actors WHERE id = p_actor_id;
  
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_count, v_total
  FROM bank_transactions bt
  JOIN bank_accounts ba ON ba.id = bt.account_id
  WHERE ba.actor_id = p_actor_id
    AND bt.created_at > now() - (p_window_hours || ' hours')::interval
    AND bt.amount_cents < p_small_amount_threshold_cents;
  
  IF v_count >= p_threshold_count THEN
    INSERT INTO evasion_patterns (tenant_id, actor_id, pattern_type, evidence, confidence_score)
    VALUES (v_tenant_id, p_actor_id, 'fragmentation',
      jsonb_build_object('count', v_count, 'total_cents', v_total),
      LEAST(v_count::NUMERIC / (p_threshold_count * 2), 1.0));
    
    RETURN QUERY SELECT true, v_count, v_total, jsonb_build_object('pattern', 'fragmentation', 'count', v_count);
  ELSE
    RETURN QUERY SELECT false, v_count, v_total, NULL::JSONB;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

---

### Checklist FASE 1

- [x] 0001_extensions.sql criado
- [x] 0002_identity.sql criado
- [x] 0003_bank_core.sql criado
- [x] 0004_marketplace.sql criado
- [x] 0005_events.sql criado
- [x] Commit: `[REBASE-01] Genesis Constitucional`
- [x] Tag: `GENESIS_CREATED`


---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 2: PROVA DE DETERMINISMO
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 1 completa e tag GENESIS_CREATED criada
- [ ] 5 migrations do Genesis criadas e validadas
- [ ] BLOCO INSTITUCIONAL DE PRÉ-EXECUÇÃO OBRIGATÓRIA

### Pré-condições
- [ ] FASE 1 concluída com sucesso
- [ ] 5 migrations do Genesis existem em backend/migrations/
- [ ] Banco de dados pode ser recriado do zero
- [ ] Ferramentas de hash disponíveis (Get-FileHash)

### Critério PASS
- Todas as 5 migrations existem
- Banco pode ser recriado
- Ferramentas de validação disponíveis

### Critério FAIL
- Migrations faltando → ABORTAR
- Banco não pode ser recriado → ABORTAR
- Ferramentas não disponíveis → ABORTAR

### Objetivo
Provar que o Genesis é 100% determinístico executando 3x com hash idêntico.

### Procedimento

```powershell
# 3 execuções independentes
foreach ($i in 1..3) {
  # Recriar banco do zero
  dropdb -h localhost -U postgres unificard_dev
  createdb -h localhost -U postgres -E UTF8 unificard_dev
  
  # Executar Genesis
  psql -h localhost -U postgres -d unificard_dev -f backend/migrations/0001_extensions.sql
  psql -h localhost -U postgres -d unificard_dev -f backend/migrations/0002_identity.sql
  psql -h localhost -U postgres -d unificard_dev -f backend/migrations/0003_bank_core.sql
  psql -h localhost -U postgres -d unificard_dev -f backend/migrations/0004_marketplace.sql
  psql -h localhost -U postgres -d unificard_dev -f backend/migrations/0005_events.sql
  
  # Dump do schema
  pg_dump --schema-only -h localhost -U postgres unificard_dev > "schema_$i.sql"
}

# Validar hashes
$h1 = (Get-FileHash schema_1.sql -Algorithm SHA256).Hash
$h2 = (Get-FileHash schema_2.sql -Algorithm SHA256).Hash
$h3 = (Get-FileHash schema_3.sql -Algorithm SHA256).Hash

Write-Host "Hash 1: $h1"
Write-Host "Hash 2: $h2"
Write-Host "Hash 3: $h3"

if ($h1 -eq $h2 -and $h2 -eq $h3) {
  Write-Host "✅ PASS: Hashes idênticos" -ForegroundColor Green
  Write-Host "Hash final: $h1"
} else {
  Write-Error "❌ FAIL: Hashes divergentes - ABORTAR"
  exit 1
}
```

### Criar Prova de Determinismo

```
criar: docs/04_audit/GENESIS_DETERMINISM_PROOF.md
```

Conteúdo obrigatório:
```markdown
# PROVA DE DETERMINISMO

**Data:** 2026-02-XX
**Responsável:** [nome]

## Execuções

| # | Comando | Resultado | Hash |
|---|---------|-----------|------|
| 1 | Genesis completo | SUCCESS | [hash] |
| 2 | Genesis completo | SUCCESS | [hash] |
| 3 | Genesis completo | SUCCESS | [hash] |

## Veredito
**PASS** - Hashes idênticos em 3 execuções independentes.

## Hash Final
`[hash SHA256]`
```

### Checklist FASE 2

- [x] 3 execuções realizadas
- [x] Hashes idênticos confirmados
- [x] GENESIS_DETERMINISM_PROOF.md criado
- [x] Commit: `[REBASE-02] Prova de Determinismo`
- [x] Tag: `GENESIS_VERIFIED`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 3: FECHAMENTO CONSTITUCIONAL
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 2 completa e tag GENESIS_VERIFIED criada
- [ ] GENESIS_DETERMINISM_PROOF.md criado e validado
- [ ] Lei 2 (Forward-Only) compreendida

### Pré-condições
- [ ] FASE 2 concluída com sucesso
- [ ] Prova de determinismo documentada
- [ ] Hashes idênticos confirmados em 3 execuções

### Critério PASS
- Prova de determinismo: PASS
- Hashes idênticos confirmados
- Documentação completa

### Critério FAIL
- Prova de determinismo: FAIL → ABORTAR
- Hashes divergentes → ABORTAR
- Documentação incompleta → ABORTAR

### Objetivo
Criar marco formal que ativa a Lei 2 (Forward-Only).

### 3.1 Criar Declaração de Fechamento

```
criar: docs/04_audit/REBASE_CLOSURE_DECLARATION.md
```

Conteúdo obrigatório:
```markdown
# DECLARAÇÃO DE FECHAMENTO DO REBASE CONSTITUCIONAL

**Data:** 2026-02-XX
**Responsável:** [nome]

## Genesis Constitucional

| Arquivo | Hash SHA256 |
|---------|-------------|
| 0001_extensions.sql | [hash] |
| 0002_identity.sql | [hash] |
| 0003_bank_core.sql | [hash] |
| 0004_marketplace.sql | [hash] |
| 0005_events.sql | [hash] |

## Schema Final
- **Hash:** [hash do pg_dump]
- **Verificado 3x:** ✅

## Migrations Arquivadas
- **Total:** 312 arquivos
- **Localização:** backend/migrations_archive/
- **Manifest:** docs/04_audit/MIGRATIONS_ARCHIVE_MANIFEST.md

## ATIVAÇÃO DA LEI 2

A partir desta declaração:

1. **Lei 2 (Forward-Only) está em VIGOR PERMANENTE**
2. Nenhuma migration do Genesis (0001-0005) pode ser alterada
3. Correções apenas via novas migrations (0006+)
4. Qualquer edição em 0001-0005 = VIOLAÇÃO CONSTITUCIONAL

## Assinatura
- [x] Arquiteto: _______________
- [x] Data: _______________
```

### 3.2 Criar Tag de Fechamento

```bash
git add .
git commit -m "[REBASE-03] Fechamento Constitucional"
git tag -a GENESIS_CONSTITUCIONAL_v1 -m "Lei 2 ativada - Genesis imutável"
git push origin GENESIS_CONSTITUCIONAL_v1
```

### Checklist FASE 3

- [x] REBASE_CLOSURE_DECLARATION.md criado e assinado
- [x] Commit: `[REBASE-03] Fechamento Constitucional`
- [x] Tag: `GENESIS_CONSTITUCIONAL_v1`
- [x] **Lei 2 está ATIVADA a partir deste momento**

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 4: CI ANTI-REGRESSÃO
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 3 completa e tag GENESIS_CONSTITUCIONAL_v1 criada
- [ ] Lei 2 (Forward-Only) ATIVADA
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 3 concluída com sucesso
- [ ] Tag GENESIS_CONSTITUCIONAL_v1 existe
- [ ] Lei 2 em vigor
- [ ] Repositório Git configurado

### Critério PASS
- Tag GENESIS_CONSTITUCIONAL_v1 confirmada
- Lei 2 ativada
- Git configurado

### Critério FAIL
- Tag não existe → ABORTAR
- Lei 2 não ativada → ABORTAR
- Git não configurado → ABORTAR

### Objetivo
Criar guardião automatizado que impede violações do SSOT.

### 4.1 Criar Workflow de CI

```
criar: .github/workflows/ssot-guardian.yml
```

```yaml
name: SSOT Guardian

on:
  push:
    paths:
      - 'backend/migrations/**'
      - 'backend/src/**'
  pull_request:
    paths:
      - 'backend/migrations/**'
      - 'backend/src/**'

jobs:
  ssot-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Check Genesis Integrity
        run: |
          echo "Verificando integridade do Genesis..."
          for f in 0001 0002 0003 0004 0005; do
            if git diff origin/main -- "backend/migrations/${f}_*.sql" | grep -q '^[-+]'; then
              echo "❌ FAIL: Genesis migration alterada: ${f}"
              echo "VIOLAÇÃO DA LEI 2 (Forward-Only)"
              exit 1
            fi
          done
          echo "✅ Genesis íntegro"
          
      - name: Check Parallel Ledger
        run: |
          echo "Detectando ledger paralelo..."
          if grep -rn "CREATE TABLE.*ledger" backend/src --include="*.ts" | grep -v "bank_ledger"; then
            echo "❌ FAIL: Ledger paralelo detectado"
            echo "VIOLAÇÃO DA LEI 5 (SSOT Absoluto)"
            exit 1
          fi
          echo "✅ Nenhum ledger paralelo"
          
      - name: Check Parallel Split
        run: |
          echo "Detectando split paralelo..."
          if grep -rn "CREATE TABLE.*split" backend/src --include="*.ts" | grep -v "bank_splits"; then
            echo "❌ FAIL: Split paralelo detectado"
            echo "VIOLAÇÃO DA LEI 5 (SSOT Absoluto)"
            exit 1
          fi
          echo "✅ Nenhum split paralelo"
          
      - name: Check Balance Outside Bank
        run: |
          echo "Detectando saldo fora do bank..."
          VIOLATIONS=$(grep -rn "\.balance" backend/src --include="*.ts" | grep -v "bank_" | grep -v "test" | grep -v ".spec." | grep -v "checkBalance" || true)
          if [ -n "$VIOLATIONS" ]; then
            echo "⚠️ WARNING: Possível saldo fora do bank:"
            echo "$VIOLATIONS"
          fi
          echo "✅ Verificação de saldo concluída"

      - name: Check Prohibited Structures
        run: |
          echo "Verificando estruturas proibidas..."
          PROHIBITED="accounts\.balance|ledger_entries|payment_splits|event_split_declarative"
          if grep -rEn "$PROHIBITED" backend/src --include="*.ts" | grep -v "test" | grep -v ".spec."; then
            echo "❌ FAIL: Estrutura proibida encontrada"
            exit 1
          fi
          echo "✅ Nenhuma estrutura proibida"
```

### 4.2 Criar Query de Validação SSOT

```
criar: backend/scripts/ssot-validation.sql
```

```sql
-- ============================================================
-- SSOT VALIDATION QUERY
-- Executar para provar integridade do SSOT
-- ============================================================

-- 1. Nenhum ledger paralelo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name LIKE '%ledger%' 
      AND table_name NOT IN ('bank_ledger', 'coverage_audit_log')
  ) THEN
    RAISE EXCEPTION 'FAIL: Ledger paralelo existe';
  END IF;
END $$;

-- 2. Nenhum split paralelo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name LIKE '%split%' 
      AND table_name != 'bank_splits'
  ) THEN
    RAISE EXCEPTION 'FAIL: Split paralelo existe';
  END IF;
END $$;

-- 3. Todas as transações têm purpose
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bank_transactions WHERE purpose IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: Transação sem purpose';
  END IF;
END $$;

-- 4. Coverage dentro do limite
DO $$
DECLARE
  v_max_coverage NUMERIC;
BEGIN
  SELECT MAX(
    CASE WHEN execution_capacity_cents > 0 
    THEN (total_credits_cents::NUMERIC / execution_capacity_cents::NUMERIC) * 100
    ELSE 0 END
  ) INTO v_max_coverage
  FROM system_coverage;
  
  IF v_max_coverage >= 80 THEN
    RAISE EXCEPTION 'FAIL: Coverage acima de 80%%: %', v_max_coverage;
  END IF;
END $$;

-- Se chegou aqui, SSOT está íntegro
SELECT 'PASS: SSOT verified' AS result;
```

### Checklist FASE 4

- [ ] .github/workflows/ssot-guardian.yml criado
- [ ] ssot-validation.sql criado
- [ ] Commit: `[REBASE-04] CI Anti-Regressão`
- [ ] Tag: `SSOT_GUARDIAN_ACTIVE`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 5: BACKEND CORE SERVICES
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 4 completa e tag SSOT_GUARDIAN_ACTIVE criada
- [ ] CI Anti-Regressão ativo
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 4 concluída com sucesso
- [ ] CI workflow criado e funcional
- [ ] Scan de deriva financeira: PASS
- [ ] Build do backend passando

### Critério PASS
- CI ativo e funcional
- Scan: 0 violações
- Build: exit code 0

### Critério FAIL
- CI não funcional → ABORTAR
- Scan detectou violações → ABORTAR HARD
- Build falhou → ABORTAR

### Objetivo
Criar os services do UnifyBank que implementam as regras constitucionais.

### Arquivos a Criar

```
criar: backend/src/core/unifybank/coverage.service.ts
  → Implementa view system_coverage
  → Valida limite de 80%
  → Registra em coverage_audit_log

criar: backend/src/core/unifybank/credit-expiration.service.ts
  → Implementa mark_inactive_accounts()
  → Implementa expire_old_credits()
  → Agenda jobs para execução

criar: backend/src/core/unifybank/execution-fund.service.ts
  → Gerencia execution_fund_rules
  → Registra movements
  → Valida aprovações

criar: backend/src/core/unifybank/ledger-adapter.service.ts
  → OBRIGATÓRIO: decorar com @internal @deprecated
  → Adapter para código legado
  → Redireciona para bank_ledger

criar: backend/src/core/authorization/kyc-gate.middleware.ts
  → Valida kyc_status antes de transação
  → Valida kyc_limit_cents
  → Bloqueia se limite excedido

criar: backend/src/core/authorization/atl-gate.middleware.ts
  → Consulta atl_blocked_actors
  → Bloqueia atores restritos
  → Registra tentativas bloqueadas

criar: backend/src/core/ai/ai-constitutional-limits.service.ts
  → Valida limites antes de operação IA
  → Implementa kill switch
  → Registra em ai_operations_log

criar: backend/src/core/risk/fragmentation-detector.service.ts
  → Wrapper para detect_fragmentation()
  → Registra em evasion_patterns
  → Expõe API para consulta
```

### Checklist FASE 5

- [ ] coverage.service.ts criado
- [ ] credit-expiration.service.ts criado
- [ ] execution-fund.service.ts criado
- [ ] ledger-adapter.service.ts criado (com @deprecated)
- [ ] kyc-gate.middleware.ts criado
- [ ] atl-gate.middleware.ts criado
- [ ] ai-constitutional-limits.service.ts criado
- [ ] fragmentation-detector.service.ts criado
- [ ] Build passou: `pnpm build`
- [ ] Commit: `[REBASE-05] Backend Core Services`
- [ ] Tag: `BACKEND_CORE_CREATED`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 6: BACKEND KILL SWITCH
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 5 completa e tag BACKEND_CORE_CREATED criada
- [ ] Core services criados e funcionais
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 5 concluída com sucesso
- [ ] Core services existem e compilam
- [ ] Scan de deriva financeira: PASS
- [ ] Arquivos a editar identificados

### Critério PASS
- Core services funcionais
- Scan: 0 violações
- Arquivos identificados

### Critério FAIL
- Core services não funcionam → ABORTAR
- Scan detectou violações → ABORTAR HARD
- Arquivos não identificados → ABORTAR

### Objetivo
Editar services existentes para usar o SSOT e bloquear caminhos proibidos.

### Arquivos a Editar

```
editar: backend/src/modules/bank/bank-transaction.service.ts
  → settledAt = NOW() → internal_completed_at = NOW()
  → adicionar markExternallySettled(externalPartner, externalSettledAt)
  → usar purpose obrigatório

editar: backend/src/core/unifybank/bank-p2p-transfer.service.ts
  → adicionar checkATL() antes de transferir
  → adicionar checkKycLimit() antes de transferir
  → exigir purpose + justification

editar: backend/src/core/unifybank/donation.service.ts
  → adicionar checkATL() 
  → adicionar checkKycLimit()
  → registrar purpose = 'donation'

editar: backend/src/scripts/seed-initial-balance.ts
  → verificar lastro (system_coverage) antes de emitir
  → bloquear se coverage >= 80%
```

### DECISÃO CONSTITUCIONAL — SOCIAL LEDGER (ENFORCED)

Lei aplicável: **Lei 5 — SSOT Absoluto**

Se existir `backend/src/modules/social/social-ledger.service.ts`:
- Este arquivo constitui ledger paralelo
- É **PROIBIDO** pela Constituição

Ação obrigatória:
```
remover: backend/src/modules/social/social-ledger.service.ts

criar: backend/src/modules/social/social-economy.adapter.ts
  → Consulta bank_ledger (não armazena saldo)
  → Não cria lançamentos próprios
  → Apenas read-model

editar: backend/src/modules/social/impact.service.ts
  → Usar social-economy.adapter.ts

editar: backend/src/modules/loyalty/loyalty.repository.ts
  → Remover qualquer referência a saldo local

editar: backend/src/modules/cultural/cultural-event.service.ts
  → Usar bank_transactions para pagamentos
```

### Checklist FASE 6

- [ ] bank-transaction.service.ts editado
- [ ] bank-p2p-transfer.service.ts editado
- [ ] donation.service.ts editado
- [ ] seed-initial-balance.ts editado
- [ ] social-ledger.service.ts REMOVIDO (se existir)
- [ ] social-economy.adapter.ts criado
- [ ] impact.service.ts editado
- [ ] loyalty.repository.ts editado
- [ ] cultural-event.service.ts editado
- [ ] Build passou: `pnpm build`
- [ ] Commit: `[REBASE-06] Backend Kill Switch`
- [ ] Tag: `BACKEND_KILL_SWITCH`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 7: BACKEND MODULES
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 6 completa e tag BACKEND_KILL_SWITCH criada
- [ ] Kill switch implementado
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 6 concluída com sucesso
- [ ] Kill switch ativo
- [ ] Scan de deriva financeira: PASS
- [ ] Lista de módulos a atualizar identificada

### Critério PASS
- Kill switch funcional
- Scan: 0 violações
- Módulos identificados

### Critério FAIL
- Kill switch não funcional → ABORTAR
- Scan detectou violações → ABORTAR HARD
- Módulos não identificados → ABORTAR

### Objetivo
Atualizar todos os módulos para usar exclusivamente o SSOT.

### Core Economy (Kill Switch)

```
editar: backend/src/core/economy/accounts/account.service.ts
  → Redirecionar para bank_accounts
  → Marcar métodos antigos como @deprecated

editar: backend/src/core/economy/transactions/transaction.service.ts
  → Redirecionar para bank_transactions
  → Marcar métodos antigos como @deprecated

editar: backend/src/core/economy/referral-split.service.ts
  → Usar bank_splits exclusivamente

editar: backend/src/core/economy/escrow.service.ts
  → Usar bank_accounts com owner_type = 'escrow'

editar: backend/src/core/economy/fund/fund.service.ts
editar: backend/src/core/economy/fund/fund-admin.service.ts
editar: backend/src/core/economy/fund/fund-dashboard.service.ts
editar: backend/src/core/economy/fund/fund-visibility.service.ts
editar: backend/src/core/economy/fund/fund-weekly-report.service.ts
  → Todos usando bank_* como fonte
```

### Marketplace

```
editar: backend/src/modules/marketplace/payment-transaction.service.ts
editar: backend/src/modules/marketplace/payment-split.service.ts
editar: backend/src/modules/marketplace/payout-transaction.service.ts
editar: backend/src/modules/marketplace/settlement.service.ts
editar: backend/src/modules/marketplace/unifycard.service.ts
editar: backend/src/modules/marketplace/region-account.service.ts
editar: backend/src/modules/marketplace/accounts-payable.service.ts
editar: backend/src/modules/marketplace/accounts-receivable.service.ts
  → Usar bank_transactions para estado final
  → UnifyCard apenas log operacional
```

### Services e Escrow

```
editar: backend/src/modules/services/service-payment-request.repository.ts
editar: backend/src/modules/services/service-payment-execution.repository.ts
editar: backend/src/modules/escrow/escrow.repository.ts
  → Âncora em bank_transaction_id
```

### Events

```
editar: backend/src/core/events/event-payment-execution.service.ts
editar: backend/src/core/events/event-refund-chargeback.service.ts
editar: backend/src/core/events/event-split-declarative.service.ts
editar: backend/src/core/events/event-economy.service.ts
editar: backend/src/core/events/responsibility.service.ts
  → Todos com âncora em bank_transaction_id
```

### Reports e Identity

```
editar: backend/src/modules/reports/financial-summary.service.ts
editar: backend/src/modules/reports/real-margin.service.ts
editar: backend/src/modules/groups/group-balance.service.ts
editar: backend/src/modules/groups/group-transaction.service.ts
editar: backend/src/modules/identity/actor-reputation.service.ts
editar: backend/src/modules/identity/actor-score-penalty.service.ts
editar: backend/src/modules/identity/identity-mapper.service.ts
editar: backend/src/shared/utils/financial-utils.ts
  → Consultar bank_ledger para saldos
  → Usar actors como SSOT de identidade
```

### Checklist FASE 7

- [ ] 9 arquivos core/economy editados
- [ ] 8 arquivos marketplace editados
- [ ] 3 arquivos services/escrow editados
- [ ] 5 arquivos events editados
- [ ] 8 arquivos reports/identity editados
- [ ] Build passou: `pnpm build`
- [ ] Commit: `[REBASE-07] Backend Modules`
- [ ] Tag: `BACKEND_MODULES_COMPLETE`


---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 8: FRONTEND
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 7 completa e tag BACKEND_MODULES_COMPLETE criada
- [ ] Backend modules atualizados
- [ ] Regra de validação de build

### Pré-condições
- [ ] FASE 7 concluída com sucesso
- [ ] Backend build: exit code 0
- [ ] Arquivos frontend identificados
- [ ] Mapeamento de renomeações definido

### Critério PASS
- Backend build: PASS
- Arquivos identificados
- Mapeamento definido

### Critério FAIL
- Backend build: FAIL → ABORTAR
- Arquivos não identificados → ABORTAR
- Mapeamento não definido → ABORTAR

### Objetivo
Renomear componentes e rotas para não parecer banco.

### Renomeações

```
renomear: frontend/src/pages/WalletPage.tsx → CreditHistoryPage.tsx
renomear: frontend/src/components/Wallet.tsx → CreditStatement.tsx
renomear: frontend/src/components/layout/BankLayout.tsx → EconomyLayout.tsx
renomear: frontend/src/components/mfibank/ → credit/
```

### Edições de Rotas

```
editar: frontend/src/App.tsx
  → /wallet → /creditos
  → /extrato → /historico
  → /bank → /economia
```

### Substituição de Termos

Em todos os arquivos frontend:
- "Wallet" → "Créditos"
- "Bank" → "Economia"
- "Balance" → "Saldo disponível"
- "Transaction" → "Movimentação"
- "Transfer" → "Transferência de créditos"

### Checklist FASE 8

- [ ] Arquivos renomeados
- [ ] App.tsx editado com novas rotas
- [ ] Termos substituídos em todos os arquivos
- [ ] Build passou: `cd frontend && pnpm build`
- [ ] Commit: `[REBASE-08] Frontend`
- [ ] Tag: `FRONTEND_COMPLETE`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 9: LIMPEZA DE LEGADO
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 8 completa e tag FRONTEND_COMPLETE criada
- [ ] Regra de verificação de arquivos antes de remover
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 8 concluída com sucesso
- [ ] Frontend build: exit code 0
- [ ] Pré-checagem de dependências executada
- [ ] Scan de deriva financeira: PASS

### Critério PASS
- Frontend build: PASS
- Pré-checagem: sem dependências
- Scan: 0 violações

### Critério FAIL
- Frontend build: FAIL → ABORTAR
- Dependências encontradas → ABORTAR
- Scan detectou violações → ABORTAR HARD

### Objetivo
Remover código legado e deprecar adapters.

### Pré-checagem Obrigatória

```powershell
cd backend

# Confirmar que não há dependências antes de remover
rg "core/economy/account\.service" src
rg "core/economy/transaction\.service" src
rg "new AccountService|AccountService" src
rg "new TransactionService|TransactionService" src
```

**Se qualquer ocorrência aparecer → corrigir referências ANTES de remover.**

### Arquivos a Remover

```
remover: backend/src/core/economy/account.service.ts
remover: backend/src/core/economy/transaction.service.ts
```

### Arquivos a Deprecar

```
deprecar: backend/src/core/economy/ledger/ledger.service.ts
  → adicionar @deprecated no topo
  → adicionar comentário: "Use UnifyBank. Este arquivo será removido em v2.0"

deprecar: backend/src/modules/ledger/ledger.repository.ts
  → adicionar @deprecated no topo
  → adicionar comentário: "Use bank_ledger. Este arquivo será removido em v2.0"
```

### Checklist FASE 9

- [ ] Pré-checagem executada (sem dependências)
- [ ] account.service.ts removido
- [ ] transaction.service.ts removido
- [ ] ledger.service.ts deprecado
- [ ] ledger.repository.ts deprecado
- [ ] Build passou: `pnpm build`
- [ ] Commit: `[REBASE-09] Limpeza de Legado`
- [ ] Tag: `LEGACY_CLEANED`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 10: FALSIFICAÇÕES (GATES)
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 9 completa e tag LEGACY_CLEANED criada
- [ ] Lista de 10 testes de falsificação
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 9 concluída com sucesso
- [ ] Legado removido
- [ ] Build: exit code 0
- [ ] Scan de deriva financeira: PASS

### Critério PASS
- Legado limpo
- Build: PASS
- Scan: 0 violações

### Critério FAIL
- Legado não limpo → ABORTAR
- Build: FAIL → ABORTAR
- Scan detectou violações → ABORTAR HARD

### Objetivo
Executar 10 testes de falsificação para provar integridade do SSOT.

### Testes Obrigatórios

| # | Pergunta | Resposta Esperada |
|---|----------|-------------------|
| 1 | Consigo escrever saldo fora do bank_ledger? | **NÃO** |
| 2 | Consigo marcar algo como pago fora do Bank? | **NÃO** |
| 3 | Consigo criar split fora de bank_splits? | **NÃO** |
| 4 | Consigo criar refund sem bank_transaction_id? | **NÃO** |
| 5 | Consigo obter dois saldos diferentes para o mesmo ator? | **NÃO** |
| 6 | Consigo decidir fluxo por leitura de relatório? | **NÃO** |
| 7 | Consigo usar SETTLED do UnifyCard como verdade? | **NÃO** |
| 8 | Consigo movimentar com dois IDs do mesmo ator? | **NÃO** |
| 9 | Consigo reativar tabela proibida? | **NÃO** |
| 10 | Consigo subir sistema sem Bank e funcionar? | **NÃO** |

### Criar Documento de Falsificação

```
criar: docs/04_audit/FALSIFICATION_LOG_FINAL.md
```

Conteúdo obrigatório:
```markdown
# LOG DE FALSIFICAÇÃO

**Data:** 2026-02-XX
**Responsável:** [nome]
**Modo:** FALSIFICADOR (obrigado a tentar quebrar)

## Testes Executados

### Teste 1: Escrever saldo fora do bank_ledger
- **Tentativa:** [descrever o que tentou]
- **Resultado:** BLOQUEADO/FALHOU
- **Evidência:** [screenshot/log]

### Teste 2: Marcar pago fora do Bank
...

(repetir para todos os 10 testes)

## Veredito Final
- Testes executados: 10
- Testes com resposta NÃO: 10
- **STATUS: PASS**
```

### Checklist FASE 10

- [ ] 10 testes executados
- [ ] Todos retornaram NÃO
- [ ] FALSIFICATION_LOG_FINAL.md criado
- [ ] Commit: `[REBASE-10] Falsificações (Gates)`
- [ ] Tag: `GATES_PASSED`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 11: TESTES DE QUEBRA
# ═══════════════════════════════════════════════════════════════════════════

## PRÉ-EXECUÇÃO DA FASE

### Leituras Obrigatórias
- [ ] FASE 10 completa e tag GATES_PASSED criada
- [ ] FALSIFICATION_LOG_FINAL.md criado
- [ ] SCAN AUTOMÁTICO DE DERIVA FINANCEIRA

### Pré-condições
- [ ] FASE 10 concluída com sucesso
- [ ] 10 testes de falsificação: PASS
- [ ] Build: exit code 0
- [ ] Scan de deriva financeira: PASS

### Critério PASS
- Falsificações: 10/10 PASS
- Build: PASS
- Scan: 0 violações

### Critério FAIL
- Falsificações: < 10 PASS → ABORTAR
- Build: FAIL → ABORTAR
- Scan detectou violações → ABORTAR HARD

### Objetivo
Executar testes específicos de quebra para validar blindagens.

### Testes a Criar e Executar

```
criar: docs/04_audit/TESTE_QUEBRA_LASTRO.md
  → Tentar emitir crédito com coverage >= 80%
  → Deve FALHAR com COVERAGE_EXCEEDED

criar: docs/04_audit/TESTE_QUEBRA_KYC.md
  → Tentar transação acima do kyc_limit_cents
  → Deve FALHAR com KYC_LIMIT_EXCEEDED

criar: docs/04_audit/TESTE_QUEBRA_ATL.md
  → Tentar transação com ator bloqueado
  → Deve FALHAR com ATL_BLOCKED

criar: docs/04_audit/TESTE_QUEBRA_SETTLEMENT.md
  → Tentar marcar settled sem parceiro externo
  → Deve FALHAR ou usar internal_completed_at

criar: docs/04_audit/TESTE_QUEBRA_LEDGER_PARALELO.md
  → Tentar criar tabela com "ledger" no nome
  → CI deve FALHAR
```

### Checklist FASE 11

- [ ] 5 testes de quebra criados
- [ ] 5 testes de quebra executados
- [ ] Todos falharam conforme esperado
- [ ] Commit: `[REBASE-11] Testes de Quebra`
- [ ] Tag: `BREAK_TESTS_PASSED`

---

# ═══════════════════════════════════════════════════════════════════════════
## FASE 12: DECLARAÇÃO FINAL
# ═══════════════════════════════════════════════════════════════════════════

### Objetivo
Criar declaração final e tag de fechamento.

### Criar State of the System

```
criar: docs/04_audit/STATE_OF_THE_SYSTEM_2026_02.md
```

Conteúdo obrigatório:
```markdown
# STATE OF THE SYSTEM

**Data:** 2026-02-XX
**Versão:** Genesis Constitucional v1

## Rebase Executado
- [x] 312 migrations arquivadas
- [x] 5 migrations Genesis criadas
- [x] Schema determinístico verificado 3x
- [x] Lei 2 (Forward-Only) ativada

## SSOT Confirmado
- [x] Única fonte de saldo: bank_ledger
- [x] Única fonte de transação: bank_transactions
- [x] Única fonte de split: bank_splits
- [x] Nenhum ledger paralelo
- [x] CI anti-regressão ativo

## Gates Passados
- [x] Gate 0: Baseline congelado
- [x] Gate 1: SSOT Registry
- [x] Gate 2: Exclusão estrutural
- [x] Gate 3: Escrita zero fora do SSOT
- [x] Gate 4: Âncora única
- [x] Gate 5: Split soberano
- [x] Gate 6: Identidade canônica
- [x] Gate 7: Reset final
- [x] Gate 8: Rastreabilidade
- [x] Gate 9: Falsificação 10/10
- [x] Gate 10: Testes de quebra 5/5

## Tags de Marco
1. PRE_GENESIS_ARCHIVE
2. GENESIS_CREATED
3. GENESIS_VERIFIED
4. GENESIS_CONSTITUCIONAL_v1 ← Lei 2 ativada
5. SSOT_GUARDIAN_ACTIVE
6. BACKEND_CORE_CREATED
7. BACKEND_KILL_SWITCH
8. BACKEND_MODULES_COMPLETE
9. FRONTEND_COMPLETE
10. LEGACY_CLEANED
11. GATES_PASSED
12. BREAK_TESTS_PASSED
13. REBASE_COMPLETE ← Tag final

## Próximos Passos
- Novas features via migrations 0006+
- Lei 2 em vigor permanente
- Qualquer violação = CI falha

## Assinatura
- [x] Arquiteto: _______________
- [x] Data: _______________

---

FIM DO REBASE CONSTITUCIONAL
NÃO HÁ MAIS DÍVIDA HISTÓRICA
```

### Criar Tag Final

```bash
git add .
git commit -m "[REBASE-12] Declaração Final"
git tag -a REBASE_COMPLETE -m "Rebase Constitucional finalizado"
git push origin REBASE_COMPLETE
```

### Checklist FASE 12

- [ ] STATE_OF_THE_SYSTEM_2026_02.md criado e assinado
- [ ] Commit: `[REBASE-12] Declaração Final`
- [ ] Tag: `REBASE_COMPLETE`
- [ ] **REBASE CONSTITUCIONAL CONCLUÍDO**

---

---

# SEÇÃO V — REFERÊNCIA AO SSOT REGISTRY

O SSOT Registry oficial está em:
docs/01_normative/SSOT_REGISTRY_UNIFICARD.md
--------------------------------------------

| docs/04_audit/ |
| 11 | TESTE_QUEBRA_LASTRO.md | docs/04_audit/ |
| 11 | TESTE_QUEBRA_KYC.md | docs/04_audit/ |
| 11 | TESTE_QUEBRA_ATL.md | docs/04_audit/ |
| 11 | TESTE_QUEBRA_SETTLEMENT.md | docs/04_audit/ |
| 11 | TESTE_QUEBRA_LEDGER_PARALELO.md | docs/04_audit/ |
| 12 | STATE_OF_THE_SYSTEM_2026_02.md | docs/04_audit/ |

---

## Documentos Obsoletos (mover para docs/99_archive/)

- docs/PLANO_MESTRE_CORRECAO_UNIFICARD.md (v1.0)
- Qualquer PLANO_MESTRE_v4*.md
- UNIFICARD_PLANO_UNICO_v5.md
- Prompts avulsos de eixo arquitetural
- Anti-Retrabalho standalone

---

# ═══════════════════════════════════════════════════════════════════════════
# DISPOSIÇÃO FINAL
# ═══════════════════════════════════════════════════════════════════════════

## Este documento SUBSTITUI e UNIFICA:

1. ✅ Constituição Viva do UnifiCard v1.0
2. ✅ PLANO MESTRE DE CORREÇÃO v1.0
3. ✅ PLANO MESTRE CONSOLIDADO v4.1
4. ✅ PLANO ÚNICO DE EXECUÇÃO v5.0
5. ✅ PLANO DE REBASE CONSTITUCIONAL v6.0
6. ✅ Prompt de Inicialização — Eixo Arquitetural
7. ✅ Anti-Retrabalho e Trilho de Correção Estrutural

---

## Vigência

- **A partir de:** 2026-02-11
- **Versão:** 7.0 DEFINITIVO
- **Status:** CANÔNICO · ÚNICO · EXECUTÁVEL
- **Tipo:** REBASE CONSTITUCIONAL

---

## Regra de Atualização

Qualquer alteração neste documento:
1. Deve ser justificada
2. Deve ser versionada
3. Deve ser comunicada
4. Deve atualizar a data e versão
5. **Não pode alterar a Seção I (Constituição)**

---

## Fluxo de Execução Resumido

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 0: Arquivamento + Governança                          │
│  ├── Arquivar 312 migrations                                │
│  └── Criar documentos normativos                            │
│  → Tag: PRE_GENESIS_ARCHIVE                                 │
├─────────────────────────────────────────────────────────────┤
│  FASE 1: Genesis Constitucional                             │
│  └── Criar 5 migrations estruturadas                        │
│  → Tag: GENESIS_CREATED                                     │
├─────────────────────────────────────────────────────────────┤
│  FASE 2: Prova de Determinismo                              │
│  └── 3 execuções com hash idêntico                          │
│  → Tag: GENESIS_VERIFIED                                    │
├─────────────────────────────────────────────────────────────┤
│  FASE 3: Fechamento Constitucional                          │
│  └── Lei 2 ativada                                          │
│  → Tag: GENESIS_CONSTITUCIONAL_v1                           │
├─────────────────────────────────────────────────────────────┤
│  FASE 4: CI Anti-Regressão                                  │
│  └── Workflow guardião ativo                                │
│  → Tag: SSOT_GUARDIAN_ACTIVE                                │
├─────────────────────────────────────────────────────────────┤
│  FASE 5-7: Backend                                          │
│  ├── Core services                                          │
│  ├── Kill switch                                            │
│  └── Modules                                                │
│  → Tags: BACKEND_*                                          │
├─────────────────────────────────────────────────────────────┤
│  FASE 8-9: Frontend + Limpeza                               │
│  ├── Renomeações                                            │
│  └── Remoção de legado                                      │
│  → Tags: FRONTEND_COMPLETE, LEGACY_CLEANED                  │
├─────────────────────────────────────────────────────────────┤
│  FASE 10-11: Validação                                      │
│  ├── 10 testes de falsificação                              │
│  └── 5 testes de quebra                                     │
│  → Tags: GATES_PASSED, BREAK_TESTS_PASSED                   │
├─────────────────────────────────────────────────────────────┤
│  FASE 12: Declaração Final                                  │
│  └── State of the System assinado                           │
│  → Tag: REBASE_COMPLETE                                     │
└─────────────────────────────────────────────────────────────┘
```

---

**FIM DO DOCUMENTO**

---

UNIFICARD PLANO DEFINITIVO DE EXECUÇÃO v7.0
Rebase Constitucional + Execução Completa
Documento canônico para orientação de IAs (Cursor/ChatGPT)
Data: 2026-02-11

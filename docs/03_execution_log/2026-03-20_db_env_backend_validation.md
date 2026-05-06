# Log de execução — validação DB + backend

**Data:** 2026-03-20  
**Modo:** EXECUTOR  
**Objetivo:** Corrigir/validar ambiente PostgreSQL e backend operacional.

## Ações

1. Leitura de `docs/01_normative/00_AGENT_PROTOCOL.md` (bootstrap).
2. Verificação de `backend/.env`: `DATABASE_URL` no formato `postgresql://postgres:***@localhost:5432/unificard_dev`.
3. Serviço `postgresql-x64-17`: **Running**; `psql` em `C:\Program Files\PostgreSQL\17\bin\psql.exe`.
4. `pnpm migrate` em `backend/`: **SUCESSO** — conexão estabelecida, 63 migrations já registradas.
5. Backend: `REDIS_ENABLED=false`, `PORT=3001`, `pnpm dev` — **servidor iniciado sem erro de DB**.
6. Validação HTTP:
   - `GET /health` → **200**
   - `GET /internal/financial/health` → **500** (`LEDGER_DRIFT_DETECTED` em dados de reconciliação, não falha de conexão).

## Arquivos alterados

- Nenhum (apenas validação; sem mudança de código ou migrations).

## Status

- Conexão DB: **SUCESSO**
- Boot backend: **SUCESSO**
- Financial health 200: **FALHA** (comportamento atual com drift de ledger no banco dev)
- Logs: avisos/eventos de reconciliação + `DeprecationWarning` pg — não “limpos” no sentido estrito

## Observação

Erro **28P01** não reproduzido neste ambiente com o `.env` atual; credenciais e host/porta estão coerentes com PostgreSQL local.

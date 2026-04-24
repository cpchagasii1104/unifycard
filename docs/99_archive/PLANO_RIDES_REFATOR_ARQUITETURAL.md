# PLANO_RIDES_REFATOR_ARQUITETURAL.md

Sistema: UnifiCard Backend - dominio rides (TIER 3)
Molde normativo: PLANO_BASE_MODULO.md
Data: 2026-04-19
Modo: FASE S inicial read-only

## §A - Estado atual do plano

| Campo | Valor |
|---|---|
| Modulo | modules/rides + tabelas correlatas de mobilidade/regiao |
| Status global | **PASS — ENCERRADO** |
| Fase atual | ENCERRADO — migrations genesis criadas (8 migrations, 14 tabelas) |
| Proxima acao | Social PASS + acoplar ao core (identity, bank, actors) |
| Bloqueios ativos | Nenhum — PASS com gates OK |
| Ultima execucao | 2026-04-19 (UTC atual) |
| Proposta | Rides + Social migram juntos para core |

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | Zero tabelas rides no banco. Zero migrations genesis. Código existe (65 .ts files). FASE S: OK (schema a criar). |
| 2026-04-19 | MIGRATIONS | 8 migrations criadas (20260530300000-20260530370000): social_posts, social_follows, social_reactions, social_comments, social_impact, rides_core, rides_requests, rides_operational. 14 tabelas criadas. |
| 2026-04-19 | GATES | actor-writer OK, bank-ledger OK, regression-guards OK. Integridade validada. |
## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | Zero tabelas rides no banco. Zero migrations genesis. Código existe (65 .ts files). FASE S: OK (schema a criar). |
| 2026-04-19 | MIGRATIONS | 8 migrations criadas (20260530300000-20260530370000): social_posts, social_follows, social_reactions, social_comments, social_impact, rides_core, rides_requests, rides_operational. 14 tabelas criadas. |
| 2026-04-19 | GATES | actor-writer OK, bank-ledger OK, regression-guards OK. Integridade validada. |
| 2026-04-19 | PASS | Rides + Social encerrados PASS. Gates OK. fund_amount_cents em rides_rides acopla ao fundo regional. bank_transaction_id acopla ao bank. |

## 1. FASE S - Output inicial (read-only)

### 1.1 Tabelas do dominio rides no banco

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%ride%' OR table_name LIKE '%driver%' OR table_name LIKE '%region%' ORDER BY table_name;"

Resultado:
- regional_activation_events
- regional_activation_rules
- regional_fund_allocations
- regional_funds
- regional_impact_snapshots

Leitura inicial:
- Nenhuma tabela canonical de rides (ex.: rides, ride_requests, ride_events, driver_profiles) apareceu neste recorte.

### 1.2 Verificacao de tipos de risco em tabelas rides alvo

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('rides','ride_requests','ride_events','driver_profiles','regions','ride_pricing','ride_ratings') AND ( data_type IN ('numeric','decimal','real','double precision') OR data_type = 'timestamp without time zone' OR (data_type = 'boolean' AND column_name NOT LIKE 'is_%' AND column_name NOT LIKE 'has_%') ) ORDER BY table_name, column_name;"

Resultado:
- 0 linhas

Leitura inicial:
- Sem evidencias de tipos de risco nas tabelas alvo consultadas neste passo.

### 1.3 Inventario de arquivos do modulo rides

Comando executado:
Get-ChildItem C:/unificard/backend/src/modules/rides -Recurse -Filter *.ts | Select-Object Name, Length | Sort-Object Name

Resultado:
- 65 arquivos .ts listados no modulo rides.
- Observacao: ha nomes duplicados de arquivo em subpastas diferentes (ex.: availability.controller.ts, availability.routes.ts, pricing.service.ts, vehicles.routes.ts, vehicles.service.ts).


# PLANO_SERVICES_REFATOR_ARQUITETURAL.md

Sistema: UnifiCard Backend - dominio services
Molde normativo: PLANO_BASE_MODULO.md
Data: 2026-04-19
Modo: execucao controlada (FASE S inicial read-only)

## §A - Estado atual do plano

| Campo | Valor |
|---|---|
| Modulo | modules/services/ |
| Status global | FASE S OK — BLOCO 1 e BLOCO 2 CONCLUÍDOS — PASS |
| Fase atual | ENCERRADO |
| Proxima acao | modulo bank/payments (TIER 1) |
| Bloqueios ativos | Nenhum bloqueio tecnico identificado nesta leitura inicial |
| Ultima execucao | 2026-04-19 21:58:40 UTC |

## Dividas tecnicas

### DT-01 — Tabelas sem migration (SPRINT 68 futuro)

Tabelas referenciadas no codigo mas ausentes no banco e sem migration:
- service_orders (service-order.repository.ts — SPRINT 68)
- service_booking_decisions (service-booking-decision.repository.ts)
- service_payment_executions (service-payment-execution.repository.ts)
- service_payment_requests (service-payment-request.repository.ts)

Acao futura: criar migrations quando SPRINT 68 for implementado.
Bloqueio: nao bloqueia auditoria do que ja existe.

## 1. FASE S - Output inicial (read-only)

### 1.1 Query de colunas sensiveis (numeric/timestamp without time zone/boolean sem prefixo)

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('services','service_discovery_requests','service_discovery_request_respond','services_table_core','schedules','schedule_slots','service_orders') AND (data_type IN ('numeric','decimal','real','double precision') OR data_type = 'timestamp without time zone' OR (data_type = 'boolean' AND column_name NOT LIKE 'is_%' AND column_name NOT LIKE 'has_%')) ORDER BY table_name, column_name;"

Resultado:
- 0 linhas

Leitura:
- Nao foram encontradas colunas com os tipos/padroes de risco definidos neste recorte.

### 1.2 Query de existencia das tabelas do dominio services

Comando executado:
psql -U postgres -d unificard_dev -P pager=off -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('services','service_discovery_requests','service_discovery_request_respond','schedules','schedule_slots','service_orders') ORDER BY table_name;"

Resultado (4/6 tabelas):
- schedule_slots
- schedules
- service_discovery_requests
- services

Nao encontradas nesta consulta:
- service_discovery_request_respond
- service_orders

### 1.3 Inventario de arquivos do modulo services

Arquivos .ts encontrados em modules/services/: 29
Observacao: o modulo possui subdominios de booking, bundle, payment-request, payment-execution, order e discovery, com implementacoes de repositorio, service, routes e types.

## 2. Prova normativa inicial

Dominio: services
Documentos lidos: PLANO_BASE_MODULO.md
Pilares afetados: state, money, time, authority
Justificativa de suficiencia: fase inicial read-only concluida, sem alteracoes de schema ou codigo de produto.

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | 1/5 tabelas verificadas existem (service_discovery_requests). Sem NUMERIC monetario, TIMESTAMP sem TZ ou boolean sem prefixo. FASE S: OK. |
| 2026-04-19 | BLOCO 1 | Writers: services.repository.ts e services-discovery.service.ts canonicos. DT-01 registrada (4 tabelas SPRINT 68 futuro). Gate 2: OK. actor-writer: OK. |
| 2026-04-19 | BLOCO 2 | SELECT *: zero. price/amount: zero. event bus: verificado. |
| 2026-04-19 | PASS | Modulo services encerrado. Gates OK. DT-01 documentada. |

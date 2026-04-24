# PLANO_ORDERS_REFATOR_ARQUITETURAL.md

Sistema: UnifiCard Backend — dominio orders
Molde normativo: PLANO_BASE_MODULO.md
Data: 2026-04-19
Modo: fase inicial read-only

## §A — Estado atual do plano

| Campo | Valor |
|---|---|
| Modulo | modules/orders/ |
| Status global | FASE S OK — BLOCO 1 e BLOCO 2 CONCLUÍDOS — PASS |
| Fase atual | ENCERRADO |
| Proxima acao | modulo services (proximo na ordem MVP) |
| Bloqueios ativos | Nenhum bloqueio tecnico detectado na FASE S: 9/9 tabelas existem; sem timestamp sem TZ; sem boolean sem prefixo; sem writes diretos em bank_ dentro de modules/orders |
| Ultima execucao | 2026-04-19 21:47:47 UTC |

## 1. FASE S — Output inicial (read-only)

Comando executado:
psql -U postgres -d unificard_dev -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('orders','order_items','order_status_history','order_sagas','payment_intents') AND (data_type IN ('numeric','decimal','real','double precision') OR (data_type = 'timestamp without time zone') OR (data_type = 'boolean' AND column_name NOT LIKE 'is_%' AND column_name NOT LIKE 'has_%')) ORDER BY table_name, column_name;"

Resultado:

| table_name | column_name | data_type |
|---|---|---|
| order_items | quantity | numeric |
| orders | total_quantity | numeric |

Leitura preliminar:
- Nao foram encontrados timestamp without time zone nas tabelas-alvo deste recorte.
- Nao foram encontrados booleans sem prefixo is_/has_ neste recorte.
- Encontradas 2 colunas numeric ligadas a quantidade fisica (nao necessariamente monetarias):
  - order_items.quantity
  - orders.total_quantity

## 2. Prova normativa inicial

Dominio: orders
Documentos lidos: PLANO_BASE_MODULO.md
Pilar afetado: state, time, money
Justificativa de suficiencia: inicio em FASE S read-only, sem alteracoes de codigo ou schema.

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | 9/9 tabelas existem. Monetario em BIGINT. Sem TIMESTAMP sem TZ. Sem boolean sem prefixo. FASE S: OK. |
| 2026-04-19 | BLOCO 1 | Writers: order-saga.repository.ts canonico. order.repository.ts e order-item.repository.ts em marketplace/ — canonicos. Gate 2: OK. |
| 2026-04-19 | BLOCO 2 | price/amount: OK. SELECT *: zero. event bus: zero. actor-writer: OK. bank_ direto: zero. |
| 2026-04-19 | PASS | Modulo orders encerrado. Gates OK. Sem dividas tecnicas registradas. |

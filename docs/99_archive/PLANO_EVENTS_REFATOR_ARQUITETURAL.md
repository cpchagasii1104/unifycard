# PLANO_EVENTS_REFATOR_ARQUITETURAL.md

Versao: 1.1
Data: 2026-04-20
Status: PASS — ENCERRADO

---

## §A - Estado Atual

Fase atual: ENCERRADO
Ultima execucao: 2026-04-20 UTC
Status global: PASS — FASE S OK, 9 tabelas genesis criadas, gates OK
Proxima acao: groups + trust + live-chat

Escopo desta fase:
- Inspecao read-only do banco para tabelas do dominio events.
- Verificacao de colunas potencialmente fora da nomenclatura canonic a (numeric/timestamp sem TZ/boolean sem prefixo) nas tabelas events alvo.
- Mapeamento inicial de arquivos TypeScript do modulo events.
- Gate 2 local no modulo events para detectar writes diretos em bank_.

Resultado objetivo:
- Tabelas encontradas por padrao de dominio events/tickets/rfq/checkin/attendance: 22.
- Anomalias de tipo/nomenclatura nas tabelas events alvo consultadas: 0 linhas.
- Top 20 arquivos .ts do modulo events mapeados por tamanho.
- Gate 2 (INSERT INTO bank_ / UPDATE bank_ em modulo events, excluindo testes): NO_MATCHES.

Conclusao da FASE S inicial:
- Sem bloqueador estrutural imediato no modulo events para avancar ao proximo passo de auditoria de writers/readers.
- Nao houve alteracao de codigo nesta fase.

---

## Evidencias desta fase

1. Inventario de tabelas retornou 22 entradas, incluindo:
- events
- event_tickets
- event_attendees
- event_organizers
- event_staff
- event_rsvp
- event_metrics
- event_specs
- event_outbox

2. Query de validacao de tipos/nomenclatura em tabelas events alvo:
- Resultado: 0 rows

3. Gate 2 local no modulo events:
- Resultado: NO_MATCHES

---

## Proximo passo sugerido

- FASE S.1: mapear writers/readers do modulo events por arquivo e fronteira de dominio.
- FASE S.2: validar contratos de campos monetarios e booleans em DTOs/entidades do modulo events.

---

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-20 | FASE S | 22 tabelas events existem. 9 faltavam. NUMERIC/TIMESTAMP/bool: 0 problemas. Gate 2: OK. |
| 2026-04-20 | BLOCO 1 | actor-writer: ensureUserActor canonico. bankIntegrationService.processEventTicketPayment. SELECT *: 2 ocorrencias em occupancy (tabelas novas). Gates OK. |
| 2026-04-20 | PASS | Modulo events encerrado. 246 migrations. Gates OK. |

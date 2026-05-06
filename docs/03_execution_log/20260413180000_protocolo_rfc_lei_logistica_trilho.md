# Execution log — Correcção de trilho: Lei de Logística (normativa → RFC)

**ID:** `20260413180000_protocolo_rfc_lei_logistica_trilho`  
**Data:** 2026-04-13  
**Modo:** EXECUTOR (correcção documental **fora** de violação adicional de norma: apenas `02_decisions`, `03_execution_log`, neutralização explícita em `01_normative`)

## Contexto

Foi criado `docs/01_normative/LEI_LOGISTICA_UNIFICARD.md` com texto de lei em **MODO EXECUTOR**, o que **não** é conforme a `docs/01_normative/00_AGENT_PROTOCOL.md` (EXECUTOR não altera documentos normativos em `docs/01_normative/`).

## Acções realizadas

1. **Criado** `docs/02_decisions/RFC_LEI_LOGISTICA_UNIFICARD.md` com o **mesmo corpo normativo** do texto produzido, mais:
   - aviso no topo de que **não substitui** normativa vigente até aprovação humana;
   - **STATUS:** `RASCUNHO`;
   - metadados de **proposta normativa**;
   - histórico actualizado com a correcção de trilho.
2. **Substituído** `docs/01_normative/LEI_LOGISTICA_UNIFICARD.md` por **stub** que explica a reversão e aponta para o RFC e para este log.
3. **Registo** neste ficheiro em `docs/03_execution_log/`.

## Resultado

| Artefacto | Estado |
|-----------|--------|
| `docs/02_decisions/RFC_LEI_LOGISTICA_UNIFICARD.md` | **Proposta** — única versão de trabalho do texto |
| `docs/01_normative/LEI_LOGISTICA_UNIFICARD.md` | **Stub** — sem vigência; não é lei |
| Código (`backend/`) | **Sem alterações** |

## Próximo passo (humano / institucional)

- Revisão do RFC; após aprovação, **promover** o texto para `docs/01_normative/` por trilho que respeite o protocolo (não via EXECUTOR sobre norma).
- Só então: P1 técnico (orchestrator, `DeliveryOrder`, rides ↔ `TransportLeg`) com GATE por PR.

# REGIME DE OBSERVAÇÃO PÓS-MVP

## Status
APROVADO • CANÔNICO • VINCULANTE

## Contexto

Este documento define o regime de observação inicial após abertura controlada do MVP.

---

## PERÍODO INICIAL DE OBSERVAÇÃO

**Período obrigatório:** 30 dias corridos a partir da abertura do MVP.

Durante este período:
- Observação ativa é obrigatória
- Falhas críticas podem reverter o MVP
- Rollback é permitido sem exceção

---

## FALHAS CRÍTICAS

Falhas críticas que podem reverter o MVP:
- Vazamento de dados entre tenants
- Perda de dados de usuários
- Indisponibilidade prolongada do sistema
- Violação de segurança crítica
- Corrupção de dados financeiros

**Regra binária:** Se ocorrer falha crítica → MVP pode ser revertido imediatamente.

---

## REVERSÃO DO MVP

Reversão do MVP:
- É permitida a qualquer momento
- Não requer justificativa formal
- Não requer processo de aprovação
- É decisão técnica e operacional

---

## DOCUMENTOS CANÔNICOS CITADOS

- `docs/02_decisions/DECISAO_GO_LIVE_MVP_CONTROLADO.md`
- `docs/03_technical/CHECKLIST_GO_LIVE_MVP.md`

---

**Status:** CANÔNICO • IMUTÁVEL • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Data de criação:** 2026-01-22




# RFC — C52: Consolidação de `payment_intents` (dual-writer)

**Status:** DECISION_PENDING  
**Prioridade:** HIGH — CORRUPTOR  
**Branch:** rescue-structural  
**Data:** 2026-04-23  

---

## 1. Problema

A tabela `payment_intents` possui dois escritores com contratos incompatíveis,
operando em domínios distintos sem isolamento físico ou semântico.

Qualquer consumer que filtre por `status` vê apenas metade dos registros.
Qualquer join por `order_id` ou `reference_id` falha silenciosamente para
registros do writer oposto.

---

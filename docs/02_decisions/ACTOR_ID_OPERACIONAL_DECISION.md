# DECISÃO: actor_id como chave operacional canônica

**Data:** 2026-04-19
**Status:** VIGENTE
**Referência normativa:** LEI_DE_COERENCIA_SISTEMICA §4.8, CORE_IDENTITY_AND_ACTORS_CONTRACT

## Decisão

actor_id é a chave operacional canônica em todos os domínios do sistema.
global_user_id é a chave de identidade civil/KYC — não é chave operacional.

## Regras

- orders.buyer_actor_id: usa actor_id ✅
- bank_transactions.actor_id: usa actor_id ✅
- payment_intents.actor_id: usa actor_id ✅
- event_staff.responsible_actor_id: usa actor_id ✅ (canônico)
- event_staff.global_user_id: coluna legada com COMMENT — descontinuar

## Proibido

- Usar global_user_id como chave de relacionamento operacional
- Criar FK para global_users em tabelas de domínio operacional
- Inferir actor_id a partir de global_user_id sem passar pelo identity service

## Código morto / legado

- event_staff.global_user_id: presente com COMMENT de legado — remover quando
  events.service.ts for auditado (ver PLANO_ACTOR_WRITER_ENFORCEMENT Sessão 2)
- accounts_payable: feature SPRINT 70, não operacional hoje

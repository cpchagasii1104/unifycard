# Gate de Migration — 300_add_actor_rbac_functions

## Escopo
Avaliar e aprovar migration de RBAC V2 baseada em actor_id,
conforme RBAC_V2_CONTRACT.md.

## Artefato sob avaliação
- backend/migrations/300_add_actor_rbac_functions.sql

## Natureza da mudança
- Introdução de funções SECURITY DEFINER
- Encapsulamento de RBAC por actor_id
- Sem alteração de schema
- Sem impacto em dados existentes

## Riscos avaliados
- Acoplamento transitório actor → user (conhecido e documentado)
- Exposição indevida mitigada via SECURITY DEFINER
- Dependência de índices existentes (verificado)

## Decisão
PENDENTE

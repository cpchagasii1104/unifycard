# Core Principles — Categories & SSOT

## Introdução
Este documento define princípios INVIOLÁVEIS do core. Qualquer violação requer ADR novo.

## Princípio 1 — Single Source of Truth (SSOT)
- Uma única tabela de categorias
- Uma única forma canônica de leitura

## Princípio 2 — Contexto é Obrigatório
- Nenhuma categoria é lida sem contexto
- Context define domínio semântico

## Princípio 3 — Tenant é Soberania
- Tenant define país, permissões e visão
- Usuário nunca controla countryCode

## Princípio 4 — Proibição de Múltiplas Raízes
- Não criar trees paralelas
- Não criar categories_x

## Princípio 5 — Enforcement Mecânico
- Guards antes da query
- Testes quebram build
- Observabilidade ativa

## Princípio 6 — Extensão, Não Mutação
- Governo, cooperativismo, marketplace são extensões
- Core não é alterado para casos específicos

## Regra Final
Se um PR viola qualquer princípio, ele deve ser rejeitado.



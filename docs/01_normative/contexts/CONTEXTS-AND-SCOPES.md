# Contexts and Scopes — Canonical Governance Model

## Objetivo
- Definir todos os contexts oficiais do sistema
- Definir como tenants interagem com contexts

## Lista Canônica de Contexts
- professional
- interest
- learning
- health
- education
- company
- economy
- person
- government
- infrastructure

## Regras de Context
- Cada categoria pertence a exatamente UM context
- Context nunca é opcional
- Context define domínio semântico, não hierarquia

## Modelo de Permissões
- Permissões possíveis:
  - read
  - write
  - admin
- Permissões são definidas por:
  (tenant, context)

## Exemplos Conceituais (não técnicos)
- Governo:
  - admin em government, infrastructure
  - read em professional, company
- Empresa:
  - admin em company
  - read em professional
- Pessoa física:
  - write em person
  - read em professional

## Proibições
- Tenant não cria context novo
- Tenant não altera definição de context
- Context não cruza domínios
- Não existe context genérico

## Governança
- Novo context exige ADR
- Mudança de regra exige ADR



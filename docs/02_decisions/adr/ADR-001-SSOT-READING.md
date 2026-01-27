# ADR-001: SSOT de Leitura para Categorias

## Status
APROVADO

## Contexto
- Existe uma única tabela `categories`
- Existia SSOT de armazenamento, mas NÃO de leitura
- Context opcional gerava árvores divergentes
- Bug real: "categoria aparece em um lugar e some em outro"

## Decisão
- Context é OBRIGATÓRIO em qualquer leitura
- TenantId é OBRIGATÓRIO
- CountryCode vem do tenant, nunca do request
- Método canônico único: getCategoriesForTenant(tenantId, context)

## Enforcement
- Guard no repository ANTES da query
- Guard no service
- Guard no endpoint HTTP

## Alternativas rejeitadas
- Context default
- Múltiplas raízes
- Documentação sem enforcement

## Consequências
- Impossível gerar árvores divergentes
- Breaking change suave via deprecation

## Critério de sucesso
- `npm run test:ssot` passa 100%
- Nenhuma query executa sem context



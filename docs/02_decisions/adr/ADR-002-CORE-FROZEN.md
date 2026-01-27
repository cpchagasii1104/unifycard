# ADR-002: Core de Categorias Congelado (Frozen Core)

## Status
APROVADO

## Contexto
- O core de categorias foi blindado na Fase 1
- SSOT de leitura é garantido mecanicamente
- Guards, testes e observabilidade estão ativos

## Decisão
- O core de categorias está oficialmente FROZEN
- Nenhuma mudança estrutural é permitida sem novo ADR

## Proibições explícitas
- Criar múltiplas árvores
- Criar roots por domínio
- Tornar context opcional
- Ler categorias fora do método canônico

## Mudanças permitidas
- Extensão por novos contexts
- Extensão por permissões de tenant
- Nunca por mutação do core

## Governança
- Qualquer PR que toque categories exige review arquitetural
- Checklist institucional obrigatório

## Consequência
- Core torna-se infraestrutura de longo prazo (10–50 anos)

## Critério de cumprimento
- Testes SSOT continuam passando
- Observabilidade ativa sem violações críticas



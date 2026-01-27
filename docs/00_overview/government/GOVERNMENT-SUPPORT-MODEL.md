# Government Support Model — Extension Over Core

## Objetivo
- Definir como o sistema suporta governo
- Sem alterar o core congelado

## Princípio Central
- Governo é um tenant soberano
- Governo NÃO possui árvore própria
- Governo possui visão soberana da árvore comum

## Novos Contexts
- government
- infrastructure
- person

## Permissões
- Criar modelo de permissões por tenant
- Permissões possíveis: read, write, admin
- Governo:
  - admin em government, infrastructure
  - read em professional, company
- Mercado:
  - nunca escreve em government

## Isolamento
- Escrita governamental isolada por contexto
- Leitura cruzada controlada

## O que é PROIBIDO
- Criar árvore governamental paralela
- Duplicar categorias
- Quebrar SSOT
- Criar exceções fora de context

## Impacto no Sistema
- Absorção futura possível
- Interoperabilidade pública
- Sem refatoração estrutural



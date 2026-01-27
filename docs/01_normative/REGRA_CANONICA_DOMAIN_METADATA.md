# REGRA CANÔNICA — DOMAIN METADATA

## Status
NORMATIVO • CANÔNICO • VINCULANTE

## Contexto

Este documento estabelece as regras canônicas para uso de `domain` como metadata no ecossistema UnifiCard, definindo sua responsabilidade, relação com `context` e categorias, e regras obrigatórias de uso.

---

## DEFINIÇÃO

`domain` é um atributo de metadata que representa a intenção de uso ou o domínio operacional de uma categoria. `domain` é metadata explícita, não um eixo estrutural do sistema. Serve para distinguir diferentes intenções de uso quando múltiplos domínios compartilham o mesmo `context` semântico.

---

## RESPONSABILIDADE

1. **`domain` é responsável por:**
   - Identificar a intenção de uso de uma categoria (ex: marketplace, services, profile, events)
   - Permitir que múltiplos domínios operacionais compartilhem o mesmo `context` semântico
   - Filtrar categorias por domínio operacional sem fragmentar a ontologia semântica

2. **`domain` NÃO é responsável por:**
   - Definir a ontologia semântica (responsabilidade de `context`)
   - Estruturar a hierarquia de categorias
   - Substituir `context` como eixo estrutural
   - Ser inferido silenciosamente ou assumido por padrão

---

## RELAÇÃO COM CONTEXT

1. **`context` define a ontologia semântica:**
   - `context` é o eixo estrutural que define o que uma categoria representa semanticamente
   - `context` é obrigatório e não pode ter fallback ou default

2. **`domain` define a intenção de uso:**
   - `domain` é metadata que identifica como uma categoria é usada operacionalmente
   - `domain` é obrigatório quando múltiplos domínios compartilham o mesmo `context`
   - `domain` é opcional quando há apenas um domínio operacional para um `context`

3. **Regra de coexistência:**
   - Uma categoria pode ter `context: 'professional'` e `domain: 'marketplace'`
   - Uma categoria pode ter `context: 'professional'` e `domain: 'services'`
   - Ambos compartilham a mesma ontologia semântica (`professional`) mas têm intenções de uso distintas

---

## RELAÇÃO COM CATEGORIAS

1. **Categoria e `context`:**
   - Toda categoria DEVE ter um `context` explícito e obrigatório
   - `context` define a ontologia semântica da categoria

2. **Categoria e `domain`:**
   - Categoria pode ter `domain` como metadata quando necessário
   - `domain` é obrigatório quando múltiplos domínios operacionais compartilham o mesmo `context`
   - `domain` é opcional quando há apenas um domínio operacional para um `context`

3. **Hierarquia:**
   - A hierarquia de categorias é definida por `context`, não por `domain`
   - `domain` é metadata de filtragem e intenção de uso, não estrutura hierárquica

---

## REGRAS OBRIGATÓRIAS

1. **Uso obrigatório de `domain`:**
   - Quando múltiplos domínios operacionais compartilham o mesmo `context`
   - Quando a intenção de uso precisa ser distinguida explicitamente
   - Quando filtragem por domínio operacional é necessária

2. **Explicitude obrigatória:**
   - `domain` DEVE ser fornecido explicitamente quando obrigatório
   - `domain` NÃO pode ser inferido silenciosamente
   - `domain` NÃO pode ser assumido por padrão ou fallback

3. **Metadata explícita:**
   - `domain` DEVE ser armazenado como metadata explícita
   - `domain` NÃO é parte do schema estrutural de categorias
   - `domain` é consultável e filtrável, mas não define hierarquia

---

## REGRAS PROIBIDAS

1. **É PROIBIDO:**
   - Inferir `domain` silenciosamente a partir de contexto de execução
   - Usar `domain` como fallback ou default quando não fornecido
   - Criar novos `context` para resolver problemas que devem ser resolvidos com `domain`
   - Usar `domain` como eixo estrutural ou hierárquico
   - Assumir `domain` por padrão sem declaração explícita

2. **É PROIBIDO usar `domain` para:**
   - Substituir `context` como definidor de ontologia semântica
   - Estruturar hierarquia de categorias
   - Criar fragmentação semântica desnecessária

---

## VIOLAÇÃO E CONSEQUÊNCIA

1. **Violação de Regras Obrigatórias:**
   - Uso de `domain` sem declaração explícita quando obrigatório
   - Inferência silenciosa de `domain`
   - Uso de fallback ou default para `domain`

2. **Violação de Regras Proibidas:**
   - Uso de `domain` como eixo estrutural
   - Criação de novo `context` quando `domain` deveria ser usado
   - Assunção de `domain` por padrão

3. **Consequência:**
   - Violação constitui desvio arquitetural grave
   - Código que viola estas regras deve ser corrigido antes de merge
   - Decisões que violam estas regras são nulas

---

**Data de criação:** 2026-01-22
**Status:** NORMATIVO • CANÔNICO • VINCULANTE




# AUTORIDADE — AUDITORIA CORE

**Status:** EM AUDITORIA (MODO GUARDIÃ)  
**Eixo:** AUTORIDADE / IDENTIDADE / PERMISSÃO  
**Data:** 2026-02-06

---

## 1. OBJETIVO DO EIXO

Mapear e tornar explícito **como autoridade é representada, inferida e aplicada**
no sistema UnifiCard, sem alterar código.

Este eixo trata exclusivamente de:

- identidade  
- ator  
- permissão  
- contexto de ação  

⚠️ Este documento **NÃO propõe correções**.  
Ele estabelece o **mapa de verdade** necessário para decisões futuras.

---

## 2. PRINCÍPIO-MÃE

> Autoridade mal definida não quebra build.  
> Ela quebra governança, segurança e auditoria.

Um sistema só é confiável quando é possível responder, sem ambiguidade:

- quem executou a ação  
- em nome de quem  
- com qual permissão  
- com base em qual prova  

---

## 3. VOCABULÁRIO DE AUTORIDADE ENCONTRADO

### 3.1 Identificadores detectados (Autoridade como DADO)

Foram encontrados, coexistindo no sistema:

- `req.user.id`
- `req.user.userId`
- `req.user.globalUserId`
- `actorId`
- `ownerUserId`
- `ownerActorId`
- `createdByUserId`
- `actingUserId`
- `fromUserId`

**Observação:**

Não existe contrato explícito que defina  
**qual destes representa o ator canônico da ação**.

---

### 3.2 Identidade como objeto (padrão estruturalmente perigoso)

Uso recorrente de:

- `req.user.id`
- `user.id`
- `actor.id`

Sem garantia explícita de:

- tipo  
- domínio  
- papel semântico  

⚠️ Identidade inferida por estrutura de objeto é considerada **AMBÍGUA**.

---

## 4. PADRÕES DE AUTORIDADE DETECTADOS

### 4.1 Autoridade como DADO

Exemplos observados:

```ts
const userId = req.user.id;
const actorId = actionContext.actingUserId;
Problemas identificados:

múltiplos IDs coexistem

não há regra clara de precedência

não há distinção formal entre:

usuário

ator econômico

executor técnico

4.2 Autoridade como REGRA
Foram detectados mecanismos formais como:

requirePermission(...)

requireRole(...)

RBAC aplicado em partes do sistema

Porém:

o RBAC assume req.user.id como identidade verdadeira

não valida se este ID representa o ator correto da ação

⚠️ Regra correta aplicada sobre identidade ambígua não é segura.

4.3 Autoridade como CONTEXTO / IO
Fontes de autoridade implícita identificadas:

JWT

req.user

req.tenant

req.actionContext

Problema recorrente:

permissões implícitas (“se chegou aqui, pode”)

ausência de prova explícita de delegação ou escopo

5. PADRÕES CRÍTICOS — ZONA VERMELHA
5.1 Fallback de identidade
Foram encontrados padrões como:

req.user.globalUserId || req.user.id
req.user.userId || req.user.id
actionContext?.actingUserId || req.user.id
Implicações diretas:

o sistema não sabe quem é o ator

escolhe o ID disponível

prossegue com autorização

🚨 Este padrão elimina rastreabilidade
e invalida auditoria posterior.

5.2 Alias consciente de identidade
No auth.plugin.ts foi identificado:

Criação deliberada de alias id para compatibilidade
com endpoints legados que utilizam req.user.id.

Isso confirma que:

o sistema reconhece inconsistência

a resolveu por adaptação, não por contrato

6. CLASSIFICAÇÃO CANÔNICA DO ESTADO ATUAL
Dimensão	Estado
Identidade	❌ Ambígua
Ator	⚠️ Parcialmente modelado
Permissão (RBAC)	⚠️ Localmente correta
Contexto de ação	❌ Inferido
Auditoria posterior	❌ Inviável com garantia
7. INVARIANTES VIOLADAS
As seguintes invariantes não estão garantidas no sistema atual:

Identidade ≠ Ator

Autoridade ≠ Presença

Permissão exige ator explícito

Ação deve ter autor rastreável

Fallback de identidade é proibido

8. ESCOPO DESTA AUDITORIA
Incluído
backend/src (core e modules)

middlewares

plugins de auth e RBAC

rotas dependentes de req.user

Excluído
frontend

decisões de UX

qualquer refactor ou correção

9. STATUS FINAL DO EIXO
Eixo AUTORIDADE: EM AUDITORIA

Código: INTOCÁVEL

Execução: BLOQUEADA

Próxima fase: Definição de contratos canônicos de autoridade

10. REGRA DE CONTINUIDADE
Nenhuma evolução estrutural (EV2, M2, novos domínios)
pode ser iniciada enquanto:

este eixo não estiver formalmente fechado

contratos de autoridade não forem definidos

fallbacks de identidade não forem eliminados por design

FIM DO DOCUMENTO
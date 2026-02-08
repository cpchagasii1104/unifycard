# AUTHORITY V2 — EXTENDED PRE-EXECUTION REPORT

## STATUS
PRE-EXECUÇÃO · ESCOPO CONGELADO · OBRIGATÓRIO  
Eixo: AUTORIDADE V2  
Modo: GUARDA DE ESCOPO (SEM EXECUÇÃO)  
Data: 2026-02-06

---

## 1. FINALIDADE

Este documento congela o **ESCOPO FINAL E TOTAL**
da execução corretiva do Eixo **AUTORIDADE V2**.

A partir deste artefato:
- nenhuma violação fora deste escopo será aceita como “descoberta tardia”
- nenhuma execução poderá alegar ambiguidade de perímetro
- o Gate de Autoridade V2 só poderá ser fechado ou mantido bloqueado
  com base **exclusiva** neste escopo

Este documento **não propõe correções**.
Ele **define o território definitivo da execução**.

---

## 2. CONTEXTO

A reauditoria final da IA Guardiã demonstrou que:
- o relatório pré-execução original não capturou todas as violações
- existem usos residuais e estruturais de modelos legados de autoridade
- o Gate não pode ser fechado legitimamente sem escopo ampliado

Portanto, este documento substitui qualquer relatório prévio
como **fonte única de verdade para a execução final**.

---

## 3. ESCOPO FINAL DE VIOLAÇÕES (CONGELADO)

A execução corretiva DEVE eliminar **TODAS** as ocorrências
das categorias abaixo, em **TODO o código do sistema**:

### 3.1 Dependência de Identidade Técnica

É considerada violação estrutural qualquer:

- uso direto ou indireto de `user_id` em decisões de autoridade
- JOINs no RBAC Service baseados em `user_id`
- lookups de permissão ancorados em usuário

📌 **RBAC V2 deve decidir exclusivamente por:**
`actorId + intent + scope`

---

### 3.2 Campos Legados de Autoridade

É considerada violação qualquer ocorrência de:

- `actingUserId`
- `actingActorId`

Em qualquer camada:
- handlers
- services
- guards
- plugins
- logging

---

### 3.3 Uso de `req.user.*` para Autoridade

É considerada violação qualquer:

- leitura de `req.user`
- leitura de `req.user.id`
- leitura de `req.user.userId`

Quando utilizada para:
- decidir permissão
- inferir ator
- aplicar fallback de autoridade

---

### 3.4 Fallbacks de Autoridade

É considerada violação qualquer padrão do tipo:

- `A || B`
- `x ?? y`

Quando aplicado a:
- actorId
- campos de ActionContext
- identidade ou autoridade

📌 ActionContext é obrigatório e **não admite fallback**.

---

## 4. DECLARAÇÃO DE ESCOPO

Este documento declara formalmente que:

> **Este é o ESCOPO FINAL E TOTAL  
> da execução corretiva do Eixo AUTORIDADE V2.**

Nenhuma violação fora das categorias acima
poderá ser adicionada posteriormente
sem reabrir governança e invalidar o Gate.

---

## 5. RELAÇÃO COM EXECUÇÃO

A próxima fase autorizada é:

- Execução mecânica total
- Escopo fechado por este documento
- Log obrigatório de execução
- Uma única reauditoria final

Sem novos relatórios intermediários.

---

## 6. REGRA DE GOVERNANÇA

Qualquer execução que:
- ignore este escopo
- ultrapasse este escopo
- tente reinterpretar este escopo

é considerada **inválida por definição**.

---

## 7. CONCLUSÃO

O escopo da execução final do Eixo AUTORIDADE V2
está **formalmente congelado** por este documento.

A partir daqui:
- a execução é objetiva
- a auditoria é binária
- o Gate é legítimo

---

FIM DO DOCUMENTO

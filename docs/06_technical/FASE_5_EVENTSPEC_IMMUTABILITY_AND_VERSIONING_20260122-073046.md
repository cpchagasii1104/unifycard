# FASE 5 — EVENTSPEC · IMUTABILIDADE, VERSIONAMENTO E RELAÇÃO COM EVENTDECLARATION

**Arquivo:** FASE_5_EVENTSPEC_IMMUTABILITY_AND_VERSIONING.md  
**Fase:** FASE 5 — Event Creation  
**Status:** ATIVO  
**Autoridade:** GOVERNANÇA DE DADOS · CORE  
**Caráter:** CONTRATUAL · CLARIFICATÓRIO · NÃO EXECUTÁVEL  

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento clarifica formalmente:

1. Quando o EventSpec é considerado imutável  
2. Como funciona o versionamento de EventSpec  
3. A relação institucional entre EventSpec e EventDeclaration  

Ele existe para **eliminar ambiguidades**, conforme exigido pela IA Guardiã.

---

## 2. DEFINIÇÃO CANÔNICA DE EVENTSPEC

Conforme definido em:

- MATRIZ_FONTES_DE_VERDADE.md (linhas 28–30)
- EVENT_DOMAIN_MINIMUM_CONTRACT.md (linhas 41–46)

> EventSpec é um **snapshot declarativo de intenção humana**.

A imutabilidade do EventSpec refere-se ao **snapshot fechado**, não ao processo de construção do rascunho.

---

## 3. EVENTSPEC EM CONSTRUÇÃO VS EVENTSPEC FECHADO

### 3.1 EventSpec em construção (FASE 5)

Durante a FASE 5:

- O Event está em `lifecycle_stage = INTENT_DRAFT`
- O EventSpec existe como **snapshot em construção**
- Atualizações incrementais são permitidas

Essas atualizações:
- NÃO criam novos EventSpec
- NÃO representam versões históricas
- NÃO violam a definição de snapshot

Esse estado é denominado:

> **EventSpec em construção**

---

### 3.2 Evento de fechamento do EventSpec

O EventSpec torna-se **FECHADO** quando ocorre a ação humana explícita:

> **“Salvar planejamento”**

E o backend confirma a persistência final.

A partir desse momento:
- o snapshot é considerado completo
- o EventSpec torna-se imutável
- não são permitidas edições silenciosas

---

### 3.3 Compatibilidade com a MATRIZ DE FONTES DE VERDADE

A MATRIZ define EventSpec como snapshot imutável **no momento de seu fechamento**.

O período de construção incremental **não viola** essa definição,
pois o snapshot ainda não foi selado.

---

## 4. VERSIONAMENTO DE EVENTSPEC (APPEND-ONLY)

### 4.1 Princípio de versionamento

Após o fechamento:

- qualquer alteração futura:
  - NÃO modifica o EventSpec fechado
  - exige a criação de um **NOVO EventSpec**
  - com novo `spec_id`

O histórico de EventSpec é:
- **append-only**
- auditável
- não destrutivo

Conforme MATRIZ_FONTES_DE_VERDADE.md (linhas 37–38).

---

### 4.2 Relação Event ↔ EventSpec

- Um Event pode possuir:
  - múltiplos EventSpec ao longo do tempo
- Apenas **um EventSpec** é considerado:
  - o **ativo** em um dado momento
- A ativação de um novo EventSpec:
  - desativa o anterior
  - sem apagá-lo

---

## 5. RELAÇÃO EVENTSPEC ↔ EVENTDECLARATION

Conforme EVENT_DOMAIN_MINIMUM_CONTRACT.md (linhas 169–178):

- EventSpec e EventDeclaration são **entidades distintas**
- Possuem propósitos diferentes

### 5.1 EventSpec

- Snapshot do questionário
- Linguagem livre / contextual
- Não governado por vocabulário fechado
- Não executável
- Criado e fechado na FASE 5

---

### 5.2 EventDeclaration

- Parte do aggregate Event
- Linguagem estruturada
- Vocabulário fechado
- Governada por contratos
- Executável em fases futuras

---

### 5.3 Regra dura de separação

Durante a FASE 5:

- Nenhum EventDeclaration é criado
- Nenhum EventDeclaration é alterado
- Nenhuma derivação automática ocorre

A eventual criação de EventDeclaration:
- ocorre em fase futura
- é explícita
- é governada
- pode usar EventSpec fechado como insumo
- **não é inferida automaticamente**

---

## 6. REGRA FINAL INSTITUCIONAL

> EventSpec é construído.
> EventSpec é fechado.
> EventSpec é imutável.
>
> Mudança gera novo snapshot.
>
> EventDeclaration é outra entidade,
> em outra fase,
> sob outra governança.

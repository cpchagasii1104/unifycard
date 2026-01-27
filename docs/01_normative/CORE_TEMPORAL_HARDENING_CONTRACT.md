Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# CORE_TEMPORAL_HARDENING_CONTRACT

## STATUS
CANONICAL · BINDING · CORE

Este documento define o **HARDENING INSTITUCIONAL DO CORE TEMPORAL** do UnifiCard.
Seu conteúdo é **obrigatório**, **não-opcional** e **bloqueante**.

Ele complementa e operacionaliza:
- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md
- CHECK_DUPLICIDADE_OBRIGATORIO.md
- Decision_Safety_and_Containment_Contract.md

---

## PRINCÍPIO FUNDAMENTAL

No UnifiCard, **o tempo é um Core**.

Core:
- não se improvisa
- não se adapta
- não aceita exceções
- não se flexibiliza por conveniência técnica, comercial ou operacional

Qualquer violação ao Core Temporal é uma **violação institucional**.

---

## DEFINIÇÃO FORMAL

A **Agenda Universal (Unified Availability)** é a **ÚNICA fonte de verdade temporal** do sistema.

Tempo, data, horário, disponibilidade, conflitos e bookings:
- **SÓ EXISTEM** através da Agenda Universal
- **NÃO PODEM** ser duplicados
- **NÃO PODEM** ser inferidos
- **NÃO PODEM** ser decididos localmente

---

## CHECKLIST CANÔNICO DE HARDENING TEMPORAL

### Quando aplicar

Este checklist é **obrigatório** sempre que:
- um novo módulo for criado
- um módulo tocar tempo, data, agenda, disponibilidade ou booking
- uma migration criar campos temporais
- um service propor lógica de agenda
- uma API expor endpoints temporais
- uma IA ou humano propor alteração relacionada a tempo

---

### CHECKLIST OBRIGATÓRIO

#### 1. CONEXÃO COM A AGENDA UNIVERSAL

Pergunta obrigatória:

> “Como isso se conecta à Agenda Universal (Unified Availability)?”

Exigências:
- Método específico do unifiedAvailabilityService identificado
- Fluxo documentado
- Referência explícita a availability ou booking

Sem resposta → **BLOQUEADO**

---

#### 2. VERIFICAÇÃO DE DUPLICAÇÃO

Obrigatório verificar:
- tabelas existentes
- services existentes
- migrations existentes
- documentos canônicos existentes

Se algo similar existir → **BLOQUEADO**

---

#### 3. VERIFICAÇÃO DE CORE PARALELO

É proibido criar:
- agenda do evento
- agenda do profissional
- agenda do serviço
- agenda da empresa
- scheduler do módulo X
- calendário próprio
- timeline paralela

Se criar qualquer um → **BLOQUEADO**

---

#### 4. VERDADE TEMPORAL

É proibido:
- armazenar start_date / end_date / datetime como verdade
- resolver conflitos localmente
- bloquear agenda fora da Agenda Universal
- criar booking fora de Unified Availability
- decidir disponibilidade real

Se ocorrer qualquer item → **BLOQUEADO**

---

#### 5. CLASSIFICAÇÃO OBRIGATÓRIA

Toda estrutura temporal deve ser classificada como:
- INPUT declarativo
- READ-MODEL
- VERDADE TEMPORAL (exclusivo da Agenda Universal)

Sem classificação → **BLOQUEADO**

---

#### 6. DOCUMENTAÇÃO CANÔNICA

Obrigatório citar:
- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md
- CHECK_DUPLICIDADE_OBRIGATORIO.md

Sem citação explícita → **BLOQUEADO**

---

## PADRÕES PROIBIDOS

É terminantemente proibido:

- criar agendas paralelas
- criar bookings próprios
- resolver conflitos localmente
- armazenar tempo como verdade fora do Core
- criar exceções temporais
- justificar mudanças por conveniência técnica
- criar "só neste caso"

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

---

## PADRÕES PERMITIDOS

É permitido apenas:

### INPUT DECLARATIVO
- intenção de horário
- preferência
- recorrência teórica
- horário de funcionamento
- estado operacional (ex: online/offline)

INPUT:
- não bloqueia agenda
- não resolve conflito
- não cria booking
- não decide disponibilidade

---

### READ-MODEL
- visualização derivada
- projeção de agenda
- exibição em UI

READ-MODEL:
- deriva da Agenda Universal
- nunca é fonte de verdade

---

### VERDADE TEMPORAL
- exclusiva da Agenda Universal
- availability
- booking
- conflito
- bloqueio de agenda

Nenhuma outra estrutura pode assumir este papel.

---

## GATE TEMPORAL INSTITUCIONAL

Antes de qualquer execução envolvendo tempo, TODAS as perguntas abaixo devem ser respondidas:

1. Como isso se conecta à Agenda Universal?
2. Isso cria agenda própria?
3. Isso armazena tempo como verdade?
4. Isso resolve conflito localmente?
5. Isso cria booking fora do Core?
6. Está classificado como INPUT, READ-MODEL ou VERDADE?
7. Qual documento canônico autoriza isso?

Qualquer resposta ausente → **BLOQUEADO**

---

## BLOQUEIO AUTOMÁTICO

A IA Guardiã deve responder **BLOQUEADO**, sem exceção, quando:

- houver agenda paralela
- houver booking fora do Core
- houver exceção temporal
- houver tentativa de "atalho"
- houver ausência de resposta ao Gate Temporal

Ambiente local **não é exceção**.

---

## AUTORIDADE

Este contrato tem autoridade:
- CANÔNICA
- OPERACIONAL
- BLOQUEANTE

Ele deve ser usado como base obrigatória para:
- validação da IA Guardiã
- revisão humana
- auditoria institucional
- prevenção de regressão

---

## ENCERRAMENTO

O Core Temporal do UnifiCard está **HARDENED**.

Qualquer mudança futura:
- exige alteração explícita deste contrato
- exige decisão institucional
- exige auditoria formal

Sem isso, a resposta é sempre a mesma:

**BLOQUEADO.**




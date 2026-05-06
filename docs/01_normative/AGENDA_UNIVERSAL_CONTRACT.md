Status: CORE
Domain: Temporal
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Name: Agenda Universal (Temporal Core)

# Contrato Canônico — Agenda Universal (Core Temporal) do UnifiCard

Este documento define o **CORE TEMPORAL** do UnifiCard.

Autoridade: **NÍVEL 1 (CORE / LEI DO SISTEMA)**  
Se qualquer proposta conflitar com este contrato → **RECUSAR**.

---

## 1) Definição

**Agenda Universal** é o único mecanismo canônico do sistema para:

- tempo
- datas
- horários
- disponibilidade
- conflitos de agenda
- janelas e duração
- recorrência
- confirmação de presença / RSVP com efeito temporal
- bloqueios temporais para serviços, profissionais, locais e eventos
- sincronização com calendários externos (quando existir)

**Regra:** tempo no UnifiCard tem **UMA fonte conceitual**: Agenda Universal.

---

## 2) Regra de Ouro (Inquebrável)

> **Se algo toca tempo, data, agenda ou disponibilidade, assume-se Agenda Universal até prova canônica em contrário.**

Sem prova canônica explícita → **BLOQUEAR**.

---

## 3) Proibição de Core Paralelo

É terminantemente proibido criar:

- “agenda do evento”
- “calendário de serviços”
- “disponibilidade do profissional”
- “horário do local”
- “scheduler do módulo X”
- “timeline paralela”
- qualquer outro mecanismo que vire **fonte de verdade** temporal fora da Agenda Universal

Você pode ter **camadas derivadas** (read-models, projeções, caches), mas:

- não podem virar fonte de verdade
- não podem “corrigir” a agenda
- não podem decidir conflitos
- não podem criar bloqueios sem ação explícita

---

## 4) O que pode existir fora do Core (permitido)

Permitido fora da Agenda Universal, desde que seja **derivado e não-decisório**:

### 1. Read-models / projeções
- exibição em UI
- listagens por período
- “agenda do evento” como **VISÃO**, não como verdade

### 2. Arquivos e integrações
- gerar `.ics` para download (ação explícita)
- integrações externas (Google/Apple) sempre por consentimento

### 3. Metadados
- preferências de timezone
- templates de duração
- configurações de exibição

---

## 5) Conexão com Eventos, Profissionais e Serviços

### Eventos
- Evento pode coletar `datetime_start` e `datetime_end`
- Isso **não cria uma agenda paralela**
- O evento **deve ser capaz** de gerar ou registrar um bloqueio/slot na Agenda Universal **quando esse módulo estiver ativo**

### Profissionais e empresas (CNPJ)
- Disponibilidade de profissional, local ou equipe é **Agenda Universal**
- Matching de disponibilidade (se existir) **consulta** Agenda Universal (não inventa)

### RSVP
- RSVP é intenção / estado do usuário
- Qualquer efeito temporal (ex: “adicionar ao calendário”) é **sempre explícito**
- Gera apenas artefato derivado (`.ics`) ou registro na Agenda Universal quando aplicável

---

## 6) Decisão Safety aplicada ao tempo

### Proibido
- conflitos resolvidos automaticamente por heurística
- “melhor horário” decidido pelo sistema
- bloqueio de agenda sem clique humano ou regra canônica explícita
- “otimização” temporal baseada em métricas

### Permitido
- sugestões (não vinculantes) de horários
- alertas de conflito (informativos)
- simulações **sem executar**

---

## 6.1) Nota de Separação de Domínio (Evento × Agenda)

O Evento:

- **declara** janelas temporais desejadas
- **consulta** disponibilidade em modo read-only
- **não cria**
- **não registra**
- **não bloqueia** slots na Agenda Universal

Qualquer criação de bloqueio ou slot ocorre:

- por ação explícita do usuário
- via **Módulo de Agenda Universal**
- fora do domínio de Evento

Esta separação é **obrigatória** e **não pode ser flexibilizada**.

---

## 7) Checklist mínimo para qualquer mudança temporal

Antes de implementar qualquer coisa que toque tempo, a IA (ou humano) deve:

- citar este contrato
- provar que não cria core paralelo
- mapear o fluxo temporal atual (código / banco / docs)
- garantir compatibilidade com a Agenda Universal

Sem isso → **proposta inválida**.

---

## 8) Frase Canônica Final

No UnifiCard:

> **Tempo é Core.  
> Core não tem “jeitinho”.**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- CORE_TEMPORAL_CONTRACT.md
- CORE_TEMPORAL_HARDENING_CONTRACT.md
- GAPS_PROCESSADO_CANONICO.md
- HARDENING_CYCLE_CLOSURE.md
- PROCESSAMENTO_GAPS_CANONICO.md
<!-- AUTO-GENERATED-END -->
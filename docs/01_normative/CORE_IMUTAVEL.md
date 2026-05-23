# CORE IMUTÁVEL — UNIFICARD

Status: CORE  
Autoridade: MÁXIMA  
Escopo: Infraestrutura Fundamental do Sistema  
Aplicação: Código, banco, serviços, IAs e decisões humanas  

---

## DEFINIÇÃO

Este documento define o **CORE IMUTÁVEL do UnifiCard**.

O CORE é o conjunto de estruturas **únicas, não duplicáveis, não reinterpretáveis
e não substituíveis** que sustentam todo o sistema.

### DECISION-0021 — Jurisdição, não pasta

Para evitar ambiguidade institucional, "CORE" neste documento significa **jurisdição sobre verdade compartilhada**, não apenas localização física em `backend/src/core` ou em qualquer diretório chamado `/core`.

Uma verdade é core quando sua divergência entre módulos criaria realidade paralela. A soberania dessa verdade exige writer autorizado, enforcement e impossibilidade de contradição por consumidores. Essa soberania pode ser implementada fora de `/core` quando declarada por SSOT, lei ou contrato canônico.

Exemplo normativo: `bank_ledger` reside no domínio Bank e continua soberano sobre saldo/ledger financeiro. Sua autoridade vem do SSOT, não da pasta.

❗ O CORE:

- NÃO evolui por versões
- NÃO possui alternativas
- NÃO aceita especializações locais
- NÃO pode ser contornado
- NÃO pode ser duplicado
- NÃO pode ser flexibilizado por conveniência técnica, comercial ou operacional

Todo o restante do sistema **SE CONECTA** ao CORE.  
Nada o replica. Nada o substitui. Nada opera em paralelo.

### Remissão — trilho de operação para IAs

Para **ordem de leitura obrigatória**, **validação antes de alteração estrutural** e **proibição de duplicar ou paralelizar o CORE** no trabalho automatizado, ver `docs/01_normative/00_AGENT_PROTOCOL.md` (secções 2.3.1 a 2.3.7). Este documento define **o que** é imutável; o protocolo define **como** agentes devem respeitá-lo sem criar estrutura paralela.

---

## ELEMENTOS DO CORE IMUTÁVEL

Os seguintes sistemas existem **UMA ÚNICA VEZ** em todo o UnifiCard:

1. **AGENDA UNIVERSAL (CORE TEMPORAL ABSOLUTO)**
**Documentos canônicos aplicáveis a este contrato**

Este contrato é subordinado e alinhado aos seguintes documentos canônicos:

- `CORE_IMUTAVEL.md` (linhas 41–43)  
  > Define que Evento é entidade do Core Imutável e que “evento NÃO é agenda”.

- `CORE_VS_MODULOS_CONTRACT.md` (linhas 141–145)  
  > Define Eventos como módulo que depende de Agenda Universal, Actors e Publication Engine, sem controlar esses domínios.

- `MATRIZ_FONTES_DE_VERDADE.md` (linhas 28–30)  
  > Define `EventSpec` como snapshot imutável declarativo que não decide nada.

2. **SISTEMA DE ACTORS**
   - user
   - page
   - company
   - system
3. **SISTEMA DE EVENTOS**
   - evento é entidade
   - evento NÃO é agenda
4. **SISTEMA DE IDENTIDADE E PERMISSÕES**
5. **SISTEMA DE PUBLICAÇÃO CANÔNICA**
6. **SISTEMA DE AUDITORIA (APPEND-ONLY)**
7. **SISTEMA DE OBSERVABILIDADE PASSIVA**

❗ Criar qualquer estrutura paralela a um item acima
é considerado **DUPLICAÇÃO INSTITUCIONAL**.

---

# CORE TEMPORAL — AGENDA UNIVERSAL

## DEFINIÇÃO ABSOLUTA

A **AGENDA UNIVERSAL** é a **ÚNICA fonte de verdade temporal** do UnifiCard.

Ela é o **CORE TEMPORAL ABSOLUTO** do sistema.

Tempo, data, horário, disponibilidade, recorrência e conflito temporal
**SÓ EXISTEM** através da Agenda Universal.

Não há exceções.
Não há representações alternativas.
Não há “atalhos técnicos”.

---

## O QUE A AGENDA UNIVERSAL É

A Agenda Universal:

- centraliza **todo o tempo do sistema**
- controla disponibilidade
- resolve conflitos temporais
- gerencia slots e janelas de tempo
- garante consistência global
- atua como referência única e obrigatória

Ela **não pertence a nenhuma entidade**.

Ela:
- não é do evento
- não é do profissional
- não é do serviço
- não é da empresa
- não é do contrato
- não é do RFQ

Ela é **do sistema**.

---

## O QUE A AGENDA UNIVERSAL NÃO É

A Agenda Universal **NÃO É**:

- calendário do evento
- agenda do profissional
- agenda do fornecedor
- agenda do serviço
- agenda do local
- agenda do contrato
- agenda do RFQ
- agenda “especial”
- exceção temporária
- workaround técnico
- solução local “só para este caso”

---

## REGRA ABSOLUTA DE REFERÊNCIA TEMPORAL

Qualquer entidade que envolva tempo:

- evento
- profissional
- serviço
- empresa
- RFQ
- reserva
- contrato
- convite
- pagamento
- agenda comercial
- agenda operacional
- matching
- compatibilidade

➡️ **NÃO armazena tempo como verdade**
➡️ **NÃO decide tempo**
➡️ **NÃO resolve conflitos**
➡️ **NÃO infere disponibilidade**

Essas entidades **APENAS REFERENCIAM**
slots, janelas ou registros da **Agenda Universal**.

---

## CONEXÕES OBRIGATÓRIAS COM O CORE TEMPORAL

- Evento → referencia slots da Agenda Universal
- Profissional → referencia slots da Agenda Universal
- Serviço → referencia slots da Agenda Universal
- Empresa → referencia slots da Agenda Universal
- RFQ → referencia janelas temporais da Agenda Universal
- Reserva → cria vínculo explícito com slot da Agenda Universal
- Matching → consulta disponibilidade **APENAS** via Agenda Universal

❗ Nenhum módulo pode simular, copiar ou reconstruir tempo localmente.

---

## VIOLAÇÕES AUTOMÁTICAS (BLOQUEIO TOTAL)

Qualquer proposta que crie:

- agenda do evento
- agenda do profissional
- agenda do fornecedor
- agenda do serviço
- calendário próprio
- disponibilidade local
- campo `start_date`, `end_date`, `datetime` ou similar
  como **verdade autoritativa fora da Agenda Universal**
- exceção temporal
- regra especial de data
- lógica “só neste caso”

É **AUTOMATICAMENTE INVÁLIDA**.

Sem mitigação.  
Sem exceção.  
Sem justificativa técnica aceitável.

---

## PRECEDÊNCIA ABSOLUTA

Este documento prevalece sobre:

- documentação técnica
- decisões de produto
- decisões de negócio
- pressões comerciais
- otimizações de performance
- sugestões de IA
- conveniências de implementação

Se algo conflitar com este CORE:

➡️ elimina-se a proposta  
➡️ **NUNCA** o CORE

---

## REGRA OBRIGATÓRIA PARA IAs E HUMANOS

Antes de criar, alterar ou sugerir qualquer coisa que envolva:

- data
- horário
- disponibilidade
- agendamento
- recorrência
- conflito temporal
- agenda
- calendário

É **OBRIGATÓRIO** responder explicitamente:

> **“Como isso se conecta à Agenda Universal existente?”**

Se não houver resposta clara, direta e verificável:

❌ **A implementação é PROIBIDA**

---

## FRASE CANÔNICA FINAL

> **No UnifiCard, o tempo não é interpretado,  
> não é duplicado e não é negociado.  
> Ele é centralizado, referenciado e respeitado.**

---

## BLOCO DE CONSISTÊNCIA SEMÂNTICA (CORE)

### SEPARAÇÃO DE CAMADAS

- **CONCEPT**: SSOT semântico do sistema.
- **CATEGORY (`categories`)**: árvore operacional de navegação (TREE).
- **N1_NODES (`n1_nodes`)**: navegação global governada.
- **PROFILE**: read model de consumo (não-SSOT).

### REGRA DE IDENTIDADE SEMÂNTICA

- Identidade semântica não pode ser duplicada fora de CONCEPT.
- `slug`, `category_id`, nome e labels são artefatos técnicos/de navegação, não identidade.
- Conexões entre módulos que exigem significado de domínio devem ancorar em CONCEPT.

### USO DE CATEGORIES

- Há uma única árvore operacional em `categories`.
- Os módulos podem recortar por `scope` e contexto, sem criar árvores paralelas.
- `categories` não substitui CONCEPT e não define semântica.

### PERFIL PROFISSIONAL — ESTADO ATUAL

- Consome `categories` com `scope = 'professional'`.
- Skills válidas no estado atual: `level <= 2`.
- `concept_id` obrigatório para categorias usadas no fluxo.
- Regime de validação estrita: sem fallback silencioso e sem retorno parcial.

### ANTI-PATTERNS (PROIBIDO)

- Criar nova árvore para perfil.
- Tratar `n1_nodes` como árvore operacional.
- Usar `slug` como identidade semântica.
- Duplicar significado sem passar por CONCEPT.
- Criar SSOT paralelo.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md
- CORE_VS_MODULOS_CONTRACT.md
- MATRIZ_FONTES_DE_VERDADE.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- AGENDA_UNIVERSAL_CONTRACT.md
- CAPACIDADES_ACTOR_CONTRATO.md
- CONGELAMENTO_BASE_UNIFICARD.md
- CONTRACTS.md
- CONTRATO_FEED_MATCHING_UNIFICARD.md
- CONTRATO_GRUPOS_V1.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_CATEGORY_CONTRACT.md
- CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
- CORE_FINANCIAL_CONTRACT.md
- CORE_IDENTITY_AND_ACTORS_CONTRACT.md
- CORE_IMUTAVEL.md
- CORE_OBSERVABILITY_CONTRACT.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md
- CORE_TEMPORAL_CONTRACT.md
- CORE_TEMPORAL_HARDENING_CONTRACT.md
- CORE_VS_MODULOS_CONTRACT.md
- DECLARACAO_PRONTIDAO_INSTITUCIONAL_UNIFICARD.md
- DOCUMENTO_INSTITUCIONAL_CANONICO.md
- EFFECTS_ACTOR_CONTRATO.md
- EMPRESA_NASCIMENTO_CANONICO.md
- Eventos_Canonicos_de_Formacao_UnifiCard.md
- FASE_6_1_CONTRATO_UX_ECONOMICA.md
- GAPS_PROCESSADO_CANONICO.md
- GLOSSARIO_CANONICO.md
- GOVERNANCA_CANONICA.md
- GOVERNANCA_CANONICA_v1.md
- GOVERNANCA_E_VISAO_CANONICA_UNIFICARD.md
- GOVERNANCA_INICIAL.md
- GO_LIVE_PRODUCAO_UNIFICARD.md
- HARDENING_CYCLE_CLOSURE.md
- IDENTITY_CORE_CONTRACT.md
- INTENTS_ACTOR_CONTRATO.md
- LEGADO_TEMPORAL_MIGRATION_PLAN.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- MAPA_CANONICO_PERMISSIONS_v1.md
- MATRIZ_FONTES_DE_VERDADE.md
- Marketplace_Atributos_Canonicos.md
- PF_PRESTADOR_CANONICO.md
- POLITICA_ATIVACAO_ECONOMICA_UNIFICARD.md
- PROCESSAMENTO_GAPS_CANONICO.md
- PROCESSO_OFICIAL_EVOLUCAO_UNIFICARD.md
- READ_MODELS_CONTRATO.md
- SERVICE_CANONICO.md
- USER_PROFILE_CONTRACT.md
- contrato_canonico_de_limites_tecnicos_irreversiveis_unifi_card.md
- groups-create-contract.md
- operational_commitment_minimum_contract.md
<!-- AUTO-GENERATED-END -->

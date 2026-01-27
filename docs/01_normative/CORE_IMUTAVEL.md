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

❗ O CORE:

- NÃO evolui por versões
- NÃO possui alternativas
- NÃO aceita especializações locais
- NÃO pode ser contornado
- NÃO pode ser duplicado
- NÃO pode ser flexibilizado por conveniência técnica, comercial ou operacional

Todo o restante do sistema **SE CONECTA** ao CORE.  
Nada o replica. Nada o substitui. Nada opera em paralelo.

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

# MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA

> Documento operacional completo consolidando TODAS as decisões, vereditos, limites e próximos passos discutidos.
> Este documento serve como **fonte única de alinhamento** para frontend, backend, UX, produto e futuras IAs.

---

## STATUS E CLASSIFICAÇÃO

Tipo: GUIDELINE OPERACIONAL (NÃO-CANÔNICO)  
Autoridade: OPERACIONAL (subordinado a documentos canônicos)  
Nível Hierárquico: GUIDELINE (abaixo de NÍVEL 1 — CORE)  
Escopo: Consolidação de decisões já autorizadas e referência prática

Este documento:
- Consolida decisões já autorizadas pela IA Guardiã
- Serve como referência operacional prática
- NÃO cria novas regras de Core
- NÃO altera documentos canônicos
- Subordina-se integralmente a todos os documentos de NÍVEL 1 (CORE)

Documentos canônicos que autorizam este guideline:
- AGENDA_UNIVERSAL_CONTRACT.md
- CORE_IMUTAVEL.md
- Decision_Safety_and_Containment_Contract.md
- Category_System_Contract_UnifiCard.md
- PADRAO_FRONTEND_CANONICO.md

---

## 1. CONTEXTO E PROBLEMA ORIGINAL

O UnifiCard precisava resolver, simultaneamente:

- Agenda profissional com múltiplos intervalos
- UX estável (sem piscar, sem travar, sem estados órfãos)
- Validação de horário sem impedir digitação por teclado
- Reutilização de UX temporal em TODO o sistema
- Convivência entre vida profissional, lazer e estudo
- Sem quebrar o Core Temporal
- Sem criar agendas paralelas
- Sem decisões automáticas ocultas

Durante a evolução do sistema, surgiram:
- Bugs severos de UX
- Conflitos entre frontend e backend
- Escritas duplicadas de agenda
- Uso indevido de metadata como verdade temporal
- Tabelas legadas coexistindo com o Core canônico

Este documento consolida a **solução definitiva**.

---

## 2. PRINCÍPIO FUNDAMENTAL (NÃO NEGOCIÁVEL)

### 2.1 Tempo é Core

- Existe **UMA ÚNICA Agenda Universal**
- A verdade temporal vive **exclusivamente** nela
- Nenhuma outra estrutura pode decidir tempo

Referências:
- AGENDA_UNIVERSAL_CONTRACT.md
- CORE_IMUTAVEL.md

---

## 3. ERROS IDENTIFICADOS E CORRIGIDOS

### 3.1 UX quebrada (frontend)

Problemas:
- Botão "+ horário" piscava
- Formulários abriam e fechavam sozinhos
- Não era possível remover horários
- Tab travava o usuário
- Digitação via teclado era penalizada

Correções:
- Estado único `editingDay`
- Função central `closeEditing()`
- Guard para impedir múltiplas edições simultâneas
- Separação de estado `draft` vs `confirmado`

---

### 3.2 Violação de Core Temporal

Problemas graves identificados:

- Frontend salvava horários em `availability.metadata.schedule`
- Backend salvava horários em `workers.availability`
- Duas fontes para o mesmo conceito
- Trigger de sobreposição quebrando requests

Correção institucional:

- `workers.availability` permanece **INPUT DECLARATIVO**
- `availability` (Unified Availability) é a **única verdade temporal**
- Frontend NÃO salva schedule em metadata como verdade

---

## 4. PADRÃO DE UX TEMPORAL CANÔNICO (FRONTEND)

### 4.1 Decisão institucional

Foi AUTORIZADO criar um padrão reutilizável de UX temporal, com limites absolutos.

Este padrão:
- NÃO cria verdade temporal
- NÃO bloqueia agenda
- NÃO resolve conflitos
- NÃO cria bookings

É apenas:
- INPUT declarativo
- Validação de formato
- Orientação ao usuário

---

### 4.2 Estrutura oficial criada

```
frontend/src/
  components/temporal/
    TimeRangePicker.tsx
    DatePicker.tsx
    ScheduleInput.tsx
  hooks/temporal/
    useTimeRange.ts
    useTemporalValidation.ts
  utils/temporal/
    validateTimeRange.ts
    formatTime.ts
```

Todos os arquivos possuem comentário canônico obrigatório.

---

### 4.3 Regras de UX obrigatórias

Durante digitação:
- Estados inválidos temporários PERMITIDOS
- Teclado 100% funcional
- Nenhum bloqueio

Validação ocorre apenas:
- onBlur
- onConfirm (✓)

Nunca:
- Prender usuário
- Forçar fechamento
- Exigir uso exclusivo do mouse

---

## 5. EXTENSÃO SEMÂNTICA DA AGENDA UNIVERSAL

### 5.1 Problema humano identificado

O usuário é uma pessoa só, mas possui:
- Trabalho
- Lazer
- Estudo

Esses contextos:
- Podem coexistir
- Não podem criar agendas paralelas

---

### 5.2 Veredito da IA Guardiã

AUTORIZADO — com limites absolutos.

Solução:
- Usar **metadata descritiva** por intervalo
- SEM alterar a verdade temporal

---

### 5.3 Estrutura autorizada de metadata

```json
{
  "context": "WORK" | "LEISURE" | "STUDY" | null,
  "notes": "string opcional",
  "tags": ["string[]"]
}
```

Regras:
- Contexto é opcional
- Contexto NÃO decide comportamento
- Contexto NÃO bloqueia agenda

---

## 6. O QUE É PROIBIDO (ABSOLUTO)

É EXPRESSAMENTE PROIBIDO:

- Criar agenda paralela
- Usar contexto para decidir regras
- Bloquear trabalho por lazer automaticamente
- Resolver conflitos automaticamente
- Usar metadata como policy
- Usar metadata para acesso, preço ou ranking

Qualquer tentativa disso exige:
- Revisão do Core
- Nova auditoria institucional

---

## 7. UX DO PERFIL (NÚCLEO)

### 7.1 Onde o seletor de contexto aparece

- APENAS na tela de definição da Agenda Universal do usuário
- Antes do botão X (remover intervalo)

Exemplo:
- [WORK] 09:00–12:00
- [LEISURE] 12:00–13:00
- [WORK] 13:00–18:00

---

### 7.2 Onde NÃO aparece

- Criação de eventos
- Criação de serviços
- Páginas de booking

Nessas telas:
- Data e hora simples
- Contexto implícito pela página

---

## 8. FLUXOS DE CONFIGURAÇÃO DE AGENDA DO USUÁRIO (RECORRENTE × CALENDÁRIO)

### 8.1 Dois fluxos de UX

Existem DOIS fluxos de UX para configuração de agenda:

1. **Fluxo Recorrente** (ex: "todas as segundas")
2. **Fluxo por Calendário** (data específica)

Ambos são:
- APENAS atalhos de UX
- Geram INPUT DECLARATIVO
- Escrevem na MESMA Agenda Universal

### 8.2 Regra institucional

- Duas segundas-feiras diferentes PODEM ter horários diferentes
- Não existe "semana padrão" como verdade temporal
- Template recorrente NÃO é verdade temporal
- Verdade temporal = registros individuais na Agenda Universal

### 8.3 Limites absolutos

- Template recorrente é apenas INPUT declarativo
- Cada dia gera registro individual com start/end datetime
- Sobrescrita por calendário exige ação explícita do usuário
- Nenhuma sobrescrita automática ou heurística
- Cada registro deve ser auditável
- Metadata.source deve registrar origem ('recurring' | 'calendar')
- Contexto (trabalho/lazer/estudo) é APENAS descritivo
- Contexto NÃO decide, NÃO bloqueia, NÃO resolve conflitos

### 8.4 Frase canônica

> "UX pode ter atalhos.  
> Core não pode ter exceções."

---

## 9. BOTÃO "DISPONÍVEL AGORA"

### 9.1 Natureza correta

- Estado EFÊMERO
- Só vale para o presente
- NÃO altera agenda futura

Comparável a:
- Uber Online / Offline

---

### 9.2 O que ele NÃO faz

- Não sobrescreve agenda
- Não cria disponibilidade futura
- Não altera contextos existentes

---

## 10. EMPRESA E FUNCIONÁRIOS (FUTURO)

- Empresa NÃO tem agenda própria como verdade
- Funcionários possuem agendas individuais
- Empresa orquestra via Unified Availability

Qualquer mudança aqui:
- Exige nova auditoria

---

## 11. DOCUMENTAÇÃO E GOVERNANÇA

### 11.1 Status dos documentos

- PADRÃO DE UX TEMPORAL: AUTORIZADO
- EXTENSÃO SEMÂNTICA: AUTORIZADA
- CORE TEMPORAL: INTACTO

---

### 11.2 Próximos documentos recomendados

- Guideline operacional de metadata (este documento)
- Registro no INDEX_INSTITUCIONAL.md

---

## 12. CHECKLIST FINAL (OBRIGATÓRIO)

Antes de qualquer implementação:

- [ ] Não cria verdade temporal
- [ ] Não cria agenda paralela
- [ ] Não usa metadata para decidir
- [ ] Não bloqueia automaticamente
- [ ] UX não prende o usuário
- [ ] Teclado funciona 100%
- [ ] Estado draft separado do confirmado

Falhou em qualquer item → BLOQUEAR.

---

## 13. DECLARAÇÃO FINAL

> No UnifiCard:  
> Tempo é Core.  
> Contexto é descritivo.  
> UX orienta, não decide.  
> A decisão final é sempre humana.

Este documento consolida decisões já tomadas e deve ser tratado como
referência operacional prática para o tema Agenda + UX Temporal.

⚠️ IMPORTANTE:
- Este documento é um GUIDELINE OPERACIONAL, não canônico
- Em caso de conflito, documentos canônicos sempre prevalecem
- Este documento não cria novas regras, apenas consolida decisões autorizadas

---

## 14. REFERÊNCIAS CANÔNICAS

Este guideline consolida decisões autorizadas pelos seguintes documentos:

### Core Temporal
- AGENDA_UNIVERSAL_CONTRACT.md (NÍVEL 1 — CORE)
- CORE_IMUTAVEL.md (NÍVEL 1 — CORE)

### Decisão e Contenção
- Decision_Safety_and_Containment_Contract.md (NÍVEL 1 — CORE)
- Category_System_Contract_UnifiCard.md (NÍVEL 1 — CORE)

### Frontend e UX
- PADRAO_FRONTEND_CANONICO.md (NÍVEL 2 — GOVERNANÇA)

### Guidelines Relacionadas
- guideline_metadata_contexto_agenda_universal.md (GUIDELINE OPERACIONAL)

⚠️ Em caso de conflito, documentos de NÍVEL 1 sempre prevalecem.


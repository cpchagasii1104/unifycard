# CHECKLIST INSTITUCIONAL DE CI/CODE REVIEW — PREVENÇÃO DE REGRESSÃO TEMPORAL

## STATUS E CLASSIFICAÇÃO

Tipo: CHECKLIST OPERACIONAL (NÃO-CANÔNICO)  
Autoridade: OPERACIONAL (subordinado a documentos canônicos)  
Uso: CI / Code Review / PR Gate  
Escopo: Prevenção de regressão temporal

Este checklist:
- Consolida verificações já autorizadas
- NÃO cria regras novas
- NÃO altera Core
- NÃO reinterpreta contratos
- BLOQUEIA PRs em caso de violação

---

## CLASSIFICAÇÃO

**Tipo:** CHECKLIST OPERACIONAL (NÃO-CANÔNICO)  
**Autoridade:** OPERACIONAL (subordinado a documentos canônicos)  
**Uso:** CI/Code Review / PR Gate  
**Escopo:** Prevenção de regressão temporal

---

### GRUPO 1: CORE PARALELO TEMPORAL

**Base Canônica:** `AGENDA_UNIVERSAL_CONTRACT.md` seção 3, `CORE_IMUTAVEL.md` seção "CORE TEMPORAL"

#### 1.1 Verificação de Agenda Paralela

- [ ] **PASS:** Nenhuma nova tabela criada para armazenar tempo/data/agenda como verdade
- [ ] **PASS:** Nenhum service criado que resolve conflitos temporais localmente
- [ ] **PASS:** Nenhum campo `start_datetime`/`end_datetime` criado fora da tabela `availability`
- [ ] **PASS:** Nenhuma lógica de "agenda do evento", "agenda do profissional", "agenda do serviço" como verdade
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 1.2 Verificação de Referência à Agenda Universal

- [ ] **PASS:** Todo código que toca tempo referencia explicitamente `unifiedAvailabilityService` ou `availability` table
- [ ] **PASS:** Nenhum código cria slots temporais sem passar pela Agenda Universal
- [ ] **PASS:** Nenhum código resolve conflitos temporais sem consultar Agenda Universal
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

### GRUPO 2: METADATA COMO DECISÃO

**Base Canônica:** `guideline_metadata_contexto_agenda_universal.md`, `Category_System_Contract_UnifiCard.md`

#### 2.1 Verificação de Uso de Metadata

- [ ] **PASS:** Nenhum código usa `metadata.context` para decidir comportamento
- [ ] **PASS:** Nenhum código usa `metadata.context` para bloquear agenda automaticamente
- [ ] **PASS:** Nenhum código usa `metadata.context` para resolver conflitos
- [ ] **PASS:** Nenhum código usa `metadata.context` para alterar `start_datetime`/`end_datetime`
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 2.2 Verificação de Categoria como Decisão

- [ ] **PASS:** Nenhum código usa categoria para decidir comportamento temporal
- [ ] **PASS:** Nenhum código usa categoria para bloquear agenda
- [ ] **PASS:** Nenhum código usa categoria para resolver conflitos
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

### GRUPO 3: AUTORIDADE TEMPORAL NO FRONTEND

**Base Canônica:** `PADRAO_FRONTEND_CANONICO.md` seção 2, `MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA.md` seção 4

#### 3.1 Verificação de Frontend como Fonte de Verdade

- [ ] **PASS:** Nenhum componente frontend persiste tempo como verdade (apenas INPUT declarativo)
- [ ] **PASS:** Nenhum componente frontend resolve conflitos temporais
- [ ] **PASS:** Nenhum componente frontend bloqueia agenda automaticamente
- [ ] **PASS:** Nenhum componente frontend cria bookings diretamente
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 3.2 Verificação de Componentes Temporais

- [ ] **PASS:** Componentes temporais usam padrão canônico (`components/temporal/`, `hooks/temporal/`, `utils/temporal/`)
- [ ] **PASS:** Nenhum date/time picker ad-hoc criado por tela
- [ ] **PASS:** Todos os componentes temporais possuem comentário canônico obrigatório
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

### GRUPO 4: REGRAS DE UX TEMPORAL

**Base Canônica:** `PADRAO_FRONTEND_CANONICO.md` seção 4, `MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA.md` seção 4.3

#### 4.1 Verificação de Validação Agressiva

- [ ] **PASS:** Nenhuma validação bloqueia digitação durante `onChange`
- [ ] **PASS:** Nenhuma validação trava foco do usuário
- [ ] **PASS:** Validação ocorre apenas em `onBlur` ou `onConfirm`
- [ ] **PASS:** Estados inválidos temporários são permitidos durante digitação
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 4.2 Verificação de Funcionalidade via Teclado

- [ ] **PASS:** Todos os campos temporais são 100% funcionais via teclado
- [ ] **PASS:** Tab / Shift+Tab sempre funcionais
- [ ] **PASS:** Nenhum campo exige uso exclusivo do mouse
- [ ] **PASS:** Usuário nunca fica preso em estado morto
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 4.3 Verificação de Separação Draft vs Confirmado

- [ ] **PASS:** Estado `draft` é separado de estado `confirmado`
- [ ] **PASS:** Decisão só ocorre na confirmação explícita (✓ / Salvar / Confirmar)
- [ ] **PASS:** Antes da confirmação, apenas orientação (sem decisão)
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

### GRUPO 5: DECISÕES AUTOMÁTICAS TEMPORAIS

**Base Canônica:** `Decision_Safety_and_Containment_Contract.md`, `AGENDA_UNIVERSAL_CONTRACT.md` seção 6

#### 5.1 Verificação de Decisões Automáticas

- [ ] **PASS:** Nenhum código resolve conflitos automaticamente por heurística
- [ ] **PASS:** Nenhum código escolhe "melhor horário" como decisão
- [ ] **PASS:** Nenhum código bloqueia agenda sem clique humano ou regra canônica explícita
- [ ] **PASS:** Nenhum código otimiza temporalmente baseado em métricas
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

#### 5.2 Verificação de Sugestões vs Decisões

- [ ] **PASS:** Sugestões de horários são não vinculantes
- [ ] **PASS:** Alertas de conflito são informativos (não bloqueiam)
- [ ] **PASS:** Simulações não executam ações
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

### GRUPO 6: PERSISTÊNCIA TEMPORAL

**Base Canônica:** `AGENDA_UNIVERSAL_CONTRACT.md` seção 3, `MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA.md` seção 3.2

#### 6.1 Verificação de Fonte de Verdade Temporal

- [ ] **PASS:** Toda persistência temporal ocorre via tabela `availability` (Unified Availability)
- [ ] **PASS:** Nenhum código salva horários em `availability.metadata.schedule` como verdade
- [ ] **PASS:** `workers.availability` permanece apenas INPUT DECLARATIVO (não verdade temporal)
- [ ] **PASS:** Nenhum código cria verdade temporal fora da Agenda Universal
- [ ] **FAIL:** Se qualquer item acima for violado → **BLOQUEAR PR**

---

## POSICIONAMENTO INSTITUCIONAL

### Classificação

**Tipo:** CHECKLIST OPERACIONAL (NÃO-CANÔNICO)  
**Autoridade:** OPERACIONAL (subordinado a documentos canônicos)  
**Nível Hierárquico:** OPERACIONAL (abaixo de NÍVEL 1 — CORE)

### Onde este checklist vive

1. CI/CD Pipeline
   - Gate obrigatório antes de merge
   - Execução automática em PRs
   - Bloqueio automático se qualquer item falhar

2. PR Template
   - Checklist obrigatório no template de PR
   - Verificação manual antes de aprovar PR
   - Referência para revisores

3. Documentação
   - Registrado como guideline operacional
   - Referenciado em `INDEX_INSTITUCIONAL.md` (se aplicável)
   - Mantido junto com outros checklists operacionais

### Integração com documentos existentes

Este checklist consolida verificações já estabelecidas em:
- `AGENDA_UNIVERSAL_CONTRACT.md` seção 7
- `CORE_TEMPORAL_HARDENING_CONTRACT.md` seção "CHECKLIST CANÔNICO"
- `PADRAO_FRONTEND_CANONICO.md` seção 7
- `guideline_metadata_contexto_agenda_universal.md` seção "CHECKLIST DE CONFORMIDADE"
- `MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA.md` seção 11

Não substitui esses documentos, apenas consolida verificações para uso operacional.

---

## DECLARAÇÃO FINAL

> No UnifiCard, checklists previnem regressão.  
> Checklists não criam Core.  
> Checklists verificam conformidade.  
> Checklist de CI/Code Review autorizado.  
> Prevenção de regressão temporal garantida.



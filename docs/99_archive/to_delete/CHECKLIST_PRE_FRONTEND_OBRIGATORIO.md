# CHECKLIST PRÉ-FRONTEND OBRIGATÓRIO
**Data:** 2026-01-20  
**Autoridade:** GATE INSTITUCIONAL  
**Aplicação:** ANTES de criar qualquer página, componente ou rota no frontend  
**Status:** BLOQUEANTE

---

## 🔴 REGRA ABSOLUTA

> **Nenhuma UI pode ser criada sem passar por este checklist.  
> Se qualquer item falhar → BLOQUEAR até correção.**

---

## 📋 CHECKLIST OBRIGATÓRIO

### 1. VERIFICAÇÃO DE DUPLICAÇÃO

#### 1.1 Já existe UI similar?
- [ ] Verificar se já existe página/componente que resolve o mesmo problema
- [ ] Verificar se Feed pode ser HUB suficiente (Golden Path)
- [ ] Verificar se Social Inbox pode resolver (comunicação)

**Se SIM → REUTILIZAR ou EXTENDER, não criar novo**

**Documento de Referência:**
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`

---

### 2. CLASSIFICAÇÃO CANÔNICA

#### 2.1 Qual categoria este módulo pertence?
- [ ] **UI de Usuário Final** → Verificar Lista 1 de `CLASSIFICACAO_UI_MODULOS_CANONICA.md`
- [ ] **UI Admin/Institucional** → Verificar Lista 2 de `CLASSIFICACAO_UI_MODULOS_CANONICA.md`
- [ ] **Sem UI (Infraestrutura)** → **BLOQUEAR IMEDIATAMENTE**

**Se for Infraestrutura → ❌ BLOQUEADO**

**Documento de Referência:**
- `CLASSIFICACAO_UI_MODULOS_CANONICA.md`
- `CORE_VS_MODULOS_CONTRACT.md`

---

### 3. VERIFICAÇÃO DE CORE

#### 3.1 Toca Core Imutável?
- [ ] Agenda Universal → Verificar se não cria agenda paralela
- [ ] Sistema de Actors → Verificar se não cria identidade alternativa
- [ ] Sistema de Decisão → Verificar se não decide automaticamente
- [ ] Sistema de Permissões → Verificar se não cria permissão ad-hoc

**Se tocar Core → Verificar se CONECTA, não DUPLICA**

**Documento de Referência:**
- `CORE_IMUTAVEL.md`
- `AGENDA_UNIVERSAL_CONTRACT.md`
- `IDENTITY_CORE_CONTRACT.md`
- `DECISION_CORE_CONTRACT.md`

---

### 4. VERIFICAÇÃO DE GOLDEN PATH

#### 4.1 Respeita Golden Path?
- [ ] Feed é HUB de descoberta? (não menu direto)
- [ ] Não quebra fluxo crítico?
- [ ] Não cria menu inflation?

**Se violar Golden Path → ❌ BLOQUEADO**

**Documento de Referência:**
- `GOLDEN_PATH.md`

---

### 5. VERIFICAÇÃO DE PERMISSÕES

#### 5.1 Requer permissão canônica?
- [ ] Verificar se permissão existe em `MAPA_CANONICO_PERMISSIONS_v1.md`
- [ ] Verificar se usa `authorization.service.canActAs()`
- [ ] Verificar se não cria permissão ad-hoc

**Se permissão não existe → ❌ BLOQUEADO até adicionar ao mapa canônico**

**Documento de Referência:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`
- `DECISION_CORE_CONTRACT.md`

---

### 6. VERIFICAÇÃO DE DECISÃO

#### 6.1 A UI decide algo automaticamente?
- [ ] Não decide por score
- [ ] Não decide por categoria
- [ ] Não decide por heurística
- [ ] Não executa ação sem clique explícito

**Se decide automaticamente → ❌ BLOQUEADO**

**Documento de Referência:**
- `DECISION_CORE_CONTRACT.md`
- `Decision_Safety_and_Containment_Contract.md`

---

### 7. VERIFICAÇÃO DE TEMPORAL

#### 7.1 Toca tempo, data ou disponibilidade?
- [ ] Usa Agenda Universal como fonte de verdade?
- [ ] Não cria agenda paralela?
- [ ] Input é declarativo (não decisório)?

**Se cria agenda paralela → ❌ BLOQUEADO**

**Documento de Referência:**
- `AGENDA_UNIVERSAL_CONTRACT.md`
- `CORE_IMUTAVEL.md`

---

### 8. VERIFICAÇÃO DE IDENTIDADE

#### 8.1 Usa Actors corretamente?
- [ ] Actor é explícito (não inferido)?
- [ ] Não cria identidade alternativa?
- [ ] Usa `useActiveActor()` ou `x-acting-actor-id`?

**Se infere actor → ❌ BLOQUEADO**

**Documento de Referência:**
- `IDENTITY_CORE_CONTRACT.md`

---

### 9. VERIFICAÇÃO DE AUTORIZAÇÃO

#### 9.1 Verifica permissão corretamente?
- [ ] Usa `authorization.service.canActAs()`?
- [ ] Não verifica permissão localmente?
- [ ] Não contorna sistema de permissões?

**Se verifica localmente → ❌ BLOQUEADO**

**Documento de Referência:**
- `DECISION_CORE_CONTRACT.md`
- `DECISION_CORE_HARDENING_CONTRACT.md`

---

### 10. VERIFICAÇÃO DE MENU

#### 10.1 Onde aparece no menu?
- [ ] Feed como HUB? (preferencial)
- [ ] Menu lateral? (apenas se necessário)
- [ ] Não cria menu inflation?

**Se violar Golden Path (menu inflation) → ❌ BLOQUEADO**

**Documento de Referência:**
- `GOLDEN_PATH.md`

---

## ✅ APROVAÇÃO FINAL

### Todos os itens acima devem estar ✅

**Se algum item estiver ❌ → BLOQUEAR até correção**

**Aprovação requer:**
1. ✅ Todos os checkboxes marcados
2. ✅ Documentos canônicos citados
3. ✅ Decisão humana explícita (se necessário)
4. ✅ Permissão canônica (se necessário)

---

## 📝 TEMPLATE DE APROVAÇÃO

```markdown
## APROVAÇÃO DE UI: [NOME DO MÓDULO]

**Data:** [DATA]
**Solicitante:** [NOME]
**Módulo:** [NOME DO MÓDULO]

### Verificações:
- [x] Duplicação: [RESULTADO]
- [x] Classificação: [CATEGORIA]
- [x] Core: [RESULTADO]
- [x] Golden Path: [RESULTADO]
- [x] Permissões: [PERMISSÃO CANÔNICA]
- [x] Decisão: [RESULTADO]
- [x] Temporal: [RESULTADO]
- [x] Identidade: [RESULTADO]
- [x] Autorização: [RESULTADO]
- [x] Menu: [RESULTADO]

### Documentos Citados:
- [LISTA DE DOCUMENTOS]

### Status: ✅ APROVADO / ❌ BLOQUEADO

### Observações:
[OBSERVAÇÕES]
```

---

## 🔴 REGRAS BLOQUEANTES (NUNCA PERMITIR)

### ❌ NUNCA criar UI para:
- policy-engine
- risk-command-center (sem permissão admin)
- observability (sem permissão admin)
- instrumentation
- orchestrator
- rbac
- authorization

### ❌ NUNCA criar menu para:
- Módulos que podem ser descobertos via Feed
- Infraestrutura
- Core interno

### ❌ NUNCA decidir automaticamente:
- Por score
- Por categoria
- Por heurística
- Sem clique explícito

---

**Gerado por:** IA Executora do UnifiCard  
**Baseado em:** Regras Canônicas de `/treinamento`  
**Status:** ✅ GATE OBRIGATÓRIO


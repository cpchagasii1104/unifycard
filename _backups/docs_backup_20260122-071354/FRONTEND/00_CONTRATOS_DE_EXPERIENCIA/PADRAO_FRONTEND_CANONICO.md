# PADRÃO CANÔNICO DE FRONTEND — UNIFICARD

## STATUS
CANÔNICO · OBRIGATÓRIO · VINCULANTE

---

## 1. OBJETIVO

Este documento define **padrões obrigatórios de frontend** para todo o sistema UnifiCard.

Finalidade:
- Evitar retrabalho
- Garantir consistência institucional
- Impedir UX divergente entre telas
- Acelerar desenvolvimento em um projeto de grande escala

**Frontend NÃO decide. Frontend coleta, exibe e orienta.**

---

## 2. PRINCÍPIO FUNDAMENTAL

> Frontend é CAMADA DERIVADA. Nunca é fonte de verdade.

Regras absolutas:
- Frontend **NÃO cria verdade**
- Frontend **NÃO decide regras de negócio**
- Frontend **NÃO resolve conflitos**
- Frontend **NÃO bloqueia fluxos institucionais**

---

## 3. COMPONENTES CANÔNICOS REUTILIZÁVEIS (OBRIGATÓRIOS)

### 3.1 UX Temporal (Data / Hora)

Todos os fluxos que lidam com tempo **DEVEM** usar o padrão canônico:

```
components/temporal/
  TimeRangePicker
  DatePicker
  ScheduleInput
hooks/temporal/
  useTimeRange
  useTemporalValidation
utils/temporal/
  validateTimeRange
  formatTime
```

❌ Proibido criar date/time picker ad-hoc por tela.

---

### 3.2 Formulários

Regras obrigatórias:
- 100% funcional via teclado
- Tab / Shift+Tab sempre funcionais
- Erros **orientam**, não bloqueiam
- Validação forte apenas na confirmação explícita

---

### 3.3 Mensagens e Feedback

Tipos permitidos:
- Informativo (hint)
- Aviso (warning)
- Erro bloqueante **somente na confirmação**

❌ Proibido bloquear digitação
❌ Proibido travar foco

---

## 4. PADRÕES DE UX OBRIGATÓRIOS

### 4.1 Estados inválidos temporários

Permitido:
- Campos vazios durante edição
- Valores inconsistentes durante digitação

Obrigatório:
- Usuário sempre consegue corrigir
- Nunca fica preso em estado morto

---

### 4.2 Confirmação explícita

Decisão só ocorre quando:
- Usuário clica em ✓ / Salvar / Confirmar

Antes disso:
- Apenas orientação
- Nenhuma decisão

---

## 5. PROIBIÇÕES ABSOLUTAS

❌ Criar lógica de negócio no frontend
❌ Criar validação que imite backend
❌ Criar múltiplos padrões de UX para o mesmo problema
❌ Criar exceções por tela
❌ Criar "só aqui funciona diferente"

---

## 6. COMENTÁRIO CANÔNICO OBRIGATÓRIO

Todo componente reutilizável **DEVE** conter:

```ts
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
```

---

## 7. CHECKLIST DE CONFORMIDADE

Antes de subir qualquer tela:
- [ ] Usa componentes canônicos existentes?
- [ ] Evita duplicação de lógica?
- [ ] Funciona via teclado?
- [ ] Não cria verdade?
- [ ] Não decide?
- [ ] Não bloqueia antes da confirmação?

Se qualquer resposta for **não**, a implementação **DEVE SER BLOQUEADA**.

---

## 8. INTEGRAÇÃO COM GOVERNANÇA

Este documento se subordina a:
- AGENDA_UNIVERSAL_CONTRACT.md
- CORE_IMUTAVEL.md
- USER_PROFILE_CONTRACT.md

Conflito com qualquer um deles ⇒ **frontend está errado**.

---

## 9. DECLARAÇÃO FINAL

> No UnifiCard, frontend não improvisa.
> Frontend escala porque obedece padrão.
> Padrão economiza tempo.
> Exceção custa caro.

Este documento é **lei institucional de frontend**.

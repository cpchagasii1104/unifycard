# AUDITORIA DE CONTRATO — Time Windows (ETAPA 3)
## Data: 2026-01-21
## Contexto: Erro "Erro interno ao definir janelas de tempo" no Passo 4

---

## 1) ESTADOS QUE O FLUXO PERMITE

### Frontend (Step3TimeWindows.tsx + EventCreationGuidedFlow.tsx)

**Estados permitidos no frontend:**
- Evento em status `draft` (criado na ETAPA 1)
- `desired_time_windows`: Array de janelas com:
  - `start_datetime`: string ISO (ex: "2026-02-06T12:00:00.000Z")
  - `end_datetime`: string ISO
  - `timezone`: string opcional (ex: "America/Sao_Paulo")
- `flexibility_level`: 'strict' | 'flexible' | 'very_flexible' | null
- `timezone`: string opcional (default: 'America/Sao_Paulo')

**Validações do frontend:**
- ✅ Input completo (formato datetime-local completo)
- ✅ Data válida (não NaN)
- ✅ Janela consistente (end > start)
- ✅ Para aniversários: bloqueia datas no passado
- ✅ Para outros eventos: aviso não bloqueante para datas no passado

**Chamada ao backend:**
```typescript
await setTimeWindows(data.event_id, {
  desired_time_windows: data.desired_time_windows, // Array de janelas
  flexibility_level: data.flexibility_level || undefined,
  timezone: 'America/Sao_Paulo',
});
```

---

## 2) ESTADOS QUE O BACKEND ACEITA

### Backend (event.routes.ts + event-creation.orchestrator.ts)

**Schema de validação (Fastify):**
- `desired_time_windows`: Array obrigatório
  - `start_datetime`: string, format: 'date-time' (ISO 8601)
  - `end_datetime`: string, format: 'date-time' (ISO 8601)
  - `timezone`: string | null (opcional)
- `flexibility_level`: 'strict' | 'flexible' | 'very_flexible' | null
- `timezone`: string | null (opcional)

**Comportamento do backend:**

**CENÁRIO A: Evento em status `declared` ou `published`**
- ✅ Chama `eventService.declareEvent()` com time windows
- ✅ Valida time windows (forma: start < end, datas válidas)
- ✅ Persiste em `events.metadata.declaration.desired_time_windows`
- ✅ Retorna evento atualizado

**CENÁRIO B: Evento em status `draft`** ⚠️ **PROBLEMA CRÍTICO**
- ❌ **NÃO salva time windows**
- ❌ **NÃO persiste em metadata**
- ❌ **Apenas retorna o evento sem modificação**
- ❌ **NÃO lança erro**
- ❌ **Frontend acha que salvou, mas não salvou**

**Código problemático (orchestrator.ts:198-200):**
```typescript
// Se draft, apenas atualizar metadata (sem transição de status)
// Por enquanto, retornar evento (time windows serão salvos na próxima declare)
return event; // ⚠️ RETORNA SEM SALVAR
```

---

## 3) ESTADOS INVÁLIDOS POSSÍVEIS

### 3.1 Estado Inválido #1: Draft com Time Windows Não Persistidos
**Descrição:**
- Frontend tem `desired_time_windows` no estado local
- Backend não tem esses dados em `events.metadata.declaration`
- Usuário acha que salvou, mas dados não foram persistidos

**Como ocorre:**
1. Usuário cria evento (status = `draft`)
2. Usuário adiciona time windows no frontend
3. Frontend chama `POST /events/:id/v2/time-windows`
4. Backend retorna 200 OK, mas **não salva nada**
5. Frontend mostra "Janelas de tempo salvas" (mentira)
6. Dados ficam apenas no estado React, não no banco

**Impacto:**
- Se usuário recarregar página, time windows desaparecem
- Se usuário tentar declarar evento depois, time windows podem não estar disponíveis
- Dados podem ser perdidos

### 3.2 Estado Inválido #2: Time Windows em Draft Sem Declaration
**Descrição:**
- `setTimeWindows` em draft não cria/salva declaration
- Time windows só são salvos quando evento é declarado
- Mas `declareEvent` exige `event_aspects` (obrigatório)
- Se usuário não declarou antes, pode perder time windows

**Como ocorre:**
1. Usuário cria draft
2. Usuário adiciona time windows (não salva no backend)
3. Usuário tenta declarar evento
4. `declareEvent` exige `event_aspects` (obrigatório)
5. Se `event_aspects` não foi fornecido, erro
6. Time windows podem ser perdidos

### 3.3 Estado Inválido #3: Evento Declarado Sem event_aspects ⚠️ **CAUSA DO ERRO 500**
**Descrição:**
- Se evento está `declared` mas `event.declaration.event_aspects` é `[]` ou `undefined`
- `setTimeWindows` tenta recriar declaration com `event_aspects: []`
- Chama `declareEvent` com `event_aspects: []`
- `declareEvent` lança `BadRequestError`: "event_aspects é obrigatório"
- Erro pode ser capturado como 500 se não for tratado corretamente

**Como ocorre:**
1. Evento está em status `declared` (mas declaration pode estar incompleta)
2. `event.declaration?.event_aspects || []` retorna `[]` (array vazio)
3. `setTimeWindows` chama `declareEvent` com `event_aspects: []`
4. `declareEvent` valida: `if (!declarationInput.event_aspects || declarationInput.event_aspects.length === 0)`
5. Lança `BadRequestError` (deveria ser 400, mas pode virar 500 se houver problema no tratamento)
6. Frontend recebe "Erro interno ao definir janelas de tempo"

**Código problemático (orchestrator.ts:187):**
```typescript
event_aspects: event.declaration?.event_aspects || [], // ⚠️ Pode ser [] vazio
```

**Código que rejeita (event.service.ts:541-545):**
```typescript
if (!declarationInput.event_aspects || declarationInput.event_aspects.length === 0) {
  throw new BadRequestError(
    'event_aspects é obrigatório e deve vir do vocabulário fechado.'
  );
}
```

---

## 4) VALIDAÇÕES SILENCIOSAS

### 4.1 Validação Silenciosa #1: Status do Evento
**Problema:**
- Backend não valida se evento está em status adequado
- Backend não avisa que time windows não foram salvos em draft
- Backend retorna 200 OK mesmo sem salvar

**Código:**
```typescript
// orchestrator.ts:198-200
// Se draft, apenas atualizar metadata (sem transição de status)
// Por enquanto, retornar evento (time windows serão salvos na próxima declare)
return event; // ⚠️ SEM ERRO, SEM AVISO, SEM SALVAR
```

### 4.2 Validação Silenciosa #2: Time Windows Vazios
**Problema:**
- Backend aceita `desired_time_windows: []` (array vazio)
- Frontend valida que há pelo menos uma janela antes de chamar
- Mas se backend receber array vazio, não valida

**Código:**
```typescript
// event.service.ts:573-574
if (declarationInput.desired_time_windows !== undefined) {
  // Array pode ser vazio (permitido)
  normalizedTimeWindows = [];
```

### 4.3 Validação Silenciosa #3: Timezone Opcional
**Problema:**
- Frontend sempre envia `timezone: 'America/Sao_Paulo'`
- Backend aceita `timezone: null` ou `undefined`
- Mas se timezone for string vazia, backend valida e rejeita
- Frontend não valida timezone antes de enviar

---

## 5) DEPENDÊNCIAS IMPLÍCITAS

### 5.1 Dependência Implícita #1: Evento Deve Estar Declarado
**Problema:**
- Frontend assume que `setTimeWindows` sempre salva
- Backend só salva se evento estiver `declared` ou `published`
- Frontend não sabe disso

**Contrato quebrado:**
- Frontend: "Salvar time windows" → sempre salva
- Backend: "Salvar time windows" → só salva se `declared`/`published`

### 5.2 Dependência Implícita #2: EventDeclaration Deve Existir
**Problema:**
- `setTimeWindows` em draft não cria declaration
- `declareEvent` exige `event_aspects` (obrigatório)
- Se usuário tentar declarar sem `event_aspects`, erro
- Time windows podem ser perdidos

### 5.3 Dependência Implícita #3: Ordem das Etapas
**Problema:**
- ETAPA 1: Cria draft (status = `draft`)
- ETAPA 2: Declara evento (status = `declared`) → **exige `event_aspects`**
- ETAPA 3: Define time windows → **só salva se `declared`**

**Fluxo atual:**
- ETAPA 1: Cria draft
- ETAPA 3: Tenta salvar time windows → **não salva (draft)**
- ETAPA 2: Declara evento → **pode não ter time windows**

**Fluxo esperado (canônico):**
- ETAPA 1: Cria draft
- ETAPA 2: Declara evento (com `event_aspects`)
- ETAPA 3: Define time windows (agora salva porque está `declared`)

---

## 6) RESPOSTAS EXPLÍCITAS

### 6.1 "Este fluxo permite algum estado que não pode ser salvo?"
**RESPOSTA: SIM**

**Estados que não podem ser salvos:**
1. **Time windows em evento `draft`**
   - Frontend permite adicionar time windows
   - Backend não salva em draft
   - Estado fica apenas no frontend (React state)
   - Perdido ao recarregar página

2. **Time windows sem `event_aspects`**
   - Se usuário tentar declarar evento sem `event_aspects`
   - `declareEvent` falha (erro 400)
   - Time windows não são salvos

### 6.2 "A UI pode gerar dados que o backend rejeita?"
**RESPOSTA: SIM**

**Dados que o backend pode rejeitar:**
1. **Time windows com datas inválidas**
   - Frontend valida formato, mas backend valida novamente
   - Se frontend enviar data inválida (ex: NaN), backend rejeita

2. **Time windows com `end <= start`**
   - Frontend valida `end > start`
   - Mas se houver race condition ou bug, backend rejeita

3. **Time windows sem `start_datetime` ou `end_datetime`**
   - Frontend valida campos obrigatórios
   - Mas se houver bug, backend rejeita (erro 400)

4. **Timezone string vazia**
   - Frontend sempre envia `'America/Sao_Paulo'`
   - Mas se enviar `''`, backend rejeita (erro 400)

---

## 7) CONTRATOS QUEBRADOS

### 7.1 Contrato Quebrado #1: Persistência de Time Windows em Draft
**Contrato esperado:**
- `setTimeWindows` deve salvar time windows independente do status
- Ou deve lançar erro se não puder salvar

**Contrato real:**
- `setTimeWindows` em draft **não salva** e **não lança erro**
- Retorna 200 OK sem modificar nada

**Violação:**
- EVENT_DOMAIN_MINIMUM_CONTRACT: "Evento pode coletar `datetime_start/datetime_end` ou janelas desejadas"
- Mas não especifica quando/time windows devem ser persistidos

### 7.2 Contrato Quebrado #2: Ordem das Etapas
**Contrato esperado:**
- ETAPA 2: Declara evento (com `event_aspects`)
- ETAPA 3: Define time windows (salva porque está `declared`)

**Contrato real:**
- ETAPA 1: Cria draft
- ETAPA 3: Tenta salvar time windows → **não salva (draft)**
- ETAPA 2: Declara evento → **pode não ter time windows**

**Violação:**
- FASE 5.0: "Regras Semânticas Obrigatórias" não especifica ordem
- Mas backend exige `declared` para salvar time windows

### 7.3 Contrato Quebrado #3: Feedback ao Usuário
**Contrato esperado:**
- Se operação não salva, usuário deve ser avisado
- Se operação falha silenciosamente, é bug

**Contrato real:**
- Backend retorna 200 OK sem salvar
- Frontend mostra "Janelas de tempo salvas" (mentira)
- Usuário acha que salvou, mas não salvou

**Violação:**
- UX não deve mentir para o usuário
- Backend não deve retornar sucesso sem executar ação

---

## 8) PONTOS DE RISCO

### 8.1 Risco Crítico #1: Perda de Dados
**Descrição:**
- Time windows adicionados em draft não são salvos
- Se usuário recarregar página, dados são perdidos
- Se usuário fechar navegador, dados são perdidos

**Probabilidade:** ALTA
**Impacto:** ALTO
**Severidade:** CRÍTICA

### 8.2 Risco Crítico #2: Estado Inconsistente
**Descrição:**
- Frontend acha que salvou, backend não tem dados
- Estado do frontend não corresponde ao estado do backend
- Pode causar bugs difíceis de debugar

**Probabilidade:** ALTA
**Impacto:** MÉDIO
**Severidade:** ALTA

### 8.3 Risco Médio #3: Ordem das Etapas
**Descrição:**
- Se usuário pular ETAPA 2 (declarar evento)
- E tentar salvar time windows em ETAPA 3
- Dados não são salvos, mas usuário não sabe

**Probabilidade:** MÉDIA
**Impacto:** MÉDIO
**Severidade:** MÉDIA

### 8.4 Risco Baixo #4: Validações Duplicadas
**Descrição:**
- Frontend valida time windows
- Backend valida novamente
- Se validações divergirem, pode causar confusão

**Probabilidade:** BAIXA
**Impacto:** BAIXO
**Severidade:** BAIXA

---

## 9) RECOMENDAÇÕES (SEM CORREÇÃO AINDA)

### 9.1 Recomendação #1: Salvar Time Windows em Draft
**Ação:**
- Modificar `setTimeWindows` para salvar time windows em draft
- Salvar em `events.metadata.draft_time_windows` (temporário)
- Ou salvar em `events.metadata.declaration.desired_time_windows` mesmo em draft

**Justificativa:**
- Evita perda de dados
- Alinha frontend e backend
- Respeita contrato de "declaração, não agenda"

### 9.2 Recomendação #2: Validar Status Antes de Salvar
**Ação:**
- Se evento está em draft e não pode salvar, lançar erro explícito
- Ou salvar mesmo em draft (recomendação #1)

**Justificativa:**
- Evita operação silenciosa
- Usuário sabe que não salvou
- Frontend pode tratar erro adequadamente

### 9.3 Recomendação #3: Documentar Ordem das Etapas
**Ação:**
- Documentar que time windows só são persistidos se evento estiver `declared`
- Ou modificar para salvar em draft (recomendação #1)

**Justificativa:**
- Evita confusão
- Alinha expectativas
- Facilita manutenção

---

## 10) CONCLUSÃO

**Contratos quebrados identificados:** 3
**Pontos de risco críticos:** 3 (incluindo causa do erro 500)
**Validações silenciosas:** 3
**Dependências implícitas:** 3
**Estados inválidos possíveis:** 3

**Problema principal:**
- `setTimeWindows` em draft não salva dados
- Backend retorna 200 OK sem executar ação
- Frontend acha que salvou, mas não salvou
- Dados podem ser perdidos

**Causa provável do erro 500:**
- Evento em status `declared` mas sem `event_aspects` na declaration
- `setTimeWindows` tenta recriar declaration com `event_aspects: []`
- `declareEvent` rejeita array vazio e lança `BadRequestError`
- Erro pode ser capturado como 500 se não tratado corretamente

**Próximo passo:**
- Aguardar autorização para corrigir
- Não corrigir antes desta auditoria ser aprovada


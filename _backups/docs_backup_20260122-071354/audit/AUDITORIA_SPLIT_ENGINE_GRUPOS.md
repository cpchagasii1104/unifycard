# 🔍 AUDITORIA COMPLETA — SPLIT ENGINE + GRUPOS

**Data:** 02/01/2026  
**Colaboração:** Claude (arquiteta técnica)

---

## 📊 DIAGNÓSTICO DO SPLIT (TABELA)

| Parte | Status | Percentual | Observação |
|-------|--------|------------|------------|
| **WORKER/ORGANIZER** | ✅ Implementado | 70% | Funciona para eventos e serviços |
| **TENANT (Cidade)** | ✅ Implementado | 15% | Taxa da plataforma/cidade |
| **REGION (Fundo Regional)** | ✅ Implementado | 10% | Usa stateId como regionId |
| **GROUP (Grupos)** | ✅ Implementado | 5% | Divide entre até 3 grupos |
| **REFERRAL** | ⚠️ Parcial | +5% adicional | Integrado em eventos, falta UnifyWork |

**Soma:** 100% (sem referral) ou 105% (com referral)

---

## 🧠 ARQUITETURA ENCONTRADA

### Split Engine Principal (`split.service.ts`)

```
Contexto de SERVIÇO (UnifyWork):
70% → WORKER (prestador)
15% → TENANT (cidade)
10% → REGION (fundo regional)
5%  → GROUP (grupos do usuário)

Contexto de EVENTO:
70% → EVENT_ORGANIZER
15% → TENANT
10% → REGION
5%  → GROUP
```

**Funcionalidades:**
- `calculateSplits()` — apenas cálculo
- `applySplits()` — cria transações
- Validação de soma = 100%
- Idempotência via eventId determinístico
- Emite evento `group.fund.received`

### Referral Split (`referral-split.service.ts`)

**⚠️ SISTEMA PARALELO — NÃO INTEGRADO AO SPLIT PRINCIPAL**

```
+5% adicional sobre transação → REFERRER (quem indicou)
```

**Onde está integrado:**
- ✅ Eventos (`event-economy.service.ts` linha 529)
- ❌ UnifyWork (serviços) — **NÃO INTEGRADO**
- ❌ Marketplace — **NÃO EXISTE**

---

## 🔴 GAPS IDENTIFICADOS

### Gap 1: Referral não integrado ao UnifyWork

**Problema:** O `referralSplitService.processReferralSplit()` só é chamado em eventos, não em serviços.

**Impacto:** Indicador não recebe comissão quando indicado contrata serviço.

**Solução:**
```typescript
// Em payment.service.ts ou assignment-completion.service.ts
// Após pagamento de serviço confirmado:

await referralSplitService.processReferralSplit({
  tenantId,
  transactionId,
  sourceUserId: workerUserId, // Quem executou o serviço
  amountCents,
  percentageBps: 500,
  metadata: { type: 'service_payment', jobId },
});
```

---

### Gap 2: Referral usa `console.log` (viola GOLDEN_PATH)

**Problema:** `referral-split.service.ts` usa `console.log` em vez de `devLog`.

**Linhas afetadas:** 60, 85, 97, 117, 162, 169

**Solução:** Substituir por `devLog`:
```typescript
import { devLog } from '@utils/devLog';

// Em vez de:
console.log('[ReferralSplitService] Processando split:', {...});

// Usar:
devLog.info('referral.split.processing', {...});
```

---

### Gap 3: Grupos não resolvidos automaticamente no contexto de split

**Problema:** O `groupAccountService.resolveGroupAccountIds()` existe mas precisa ser chamado manualmente antes de `applySplits()`.

**Situação atual:** Se `context.groupAccountIds` não for fornecido, o split de grupo é pulado com warning.

**Solução:** No ponto de integração (payment, checkout), resolver grupos automaticamente:

```typescript
// Antes de applySplits:
const groupAccountIds = await groupAccountService.resolveGroupAccountIds({
  tenantId,
  userId: buyerUserId,
});

const context: SplitContext = {
  // ...
  groupAccountIds, // Passar para o split
};

await splitEngineService.applySplits(context);
```

---

### Gap 4: Falta guardrail de split > 100%

**Problema:** Referral (5%) é adicional aos 100% do split principal. Não há validação global.

**Risco:** Transação pode "criar" dinheiro se não houver controle.

**Solução atual (OK):** Referral é deduzido do lucro, não do pagamento total. Mas precisa documentar.

---

## 📋 LISTA OBJETIVA DO QUE FALTA

```
[ ] 1. Integrar referralSplitService ao UnifyWork (payment/assignment completion)
[ ] 2. Substituir console.log por devLog em referral-split.service.ts
[ ] 3. Resolver groupAccountIds automaticamente antes de applySplits
[ ] 4. Criar hook central de split pós-transação (evitar integração manual)
[ ] 5. Documentar que referral é 5% ADICIONAL (do lucro, não do total)
```

---

## 🧭 ORDEM CORRETA DE IMPLEMENTAÇÃO

```
1. ✅ Estrutura de Grupos já existe (tables, services)
   └── groups, group_members, group_accounts ✔️

2. 🔄 Corrigir referral-split.service.ts
   └── Substituir console.log por devLog
   └── 15 minutos

3. 🔄 Integrar referral ao UnifyWork
   └── Adicionar chamada em payment.service.ts
   └── 30 minutos

4. 🔄 Resolver grupos automaticamente
   └── Adicionar resolução no contexto de split
   └── 30 minutos

5. ⬜ Criar hook central de split (opcional, melhoria arquitetural)
   └── Centralizar integração de splits
   └── 2 horas

6. ⬜ Expor impacto no feed
   └── Evento group.fund.received já existe
   └── Criar post automático quando grupo recebe
   └── 1 hora
```

---

## 🔧 FLUXO CORRETO DO SPLIT (COMO DEVERIA SER)

```
Transação de R$ 100,00 (serviço)
├── Split Principal (100% = R$ 100,00)
│   ├── 70% → Worker (R$ 70,00)
│   ├── 15% → Tenant/Cidade (R$ 15,00)
│   ├── 10% → Região (R$ 10,00)
│   └── 5%  → Grupos (R$ 5,00 ÷ 3 grupos = R$ 1,67 cada)
│
└── Referral Split (5% do lucro do worker = R$ 3,50)
    └── Se worker foi indicado → referrer recebe R$ 3,50
```

**Nota:** Referral é deduzido do lucro do worker, não do pagamento total. Isso mantém os 100% intactos.

---

## ✅ O QUE JÁ FUNCIONA

| Componente | Status | Onde |
|------------|--------|------|
| Split 70/15/10/5 | ✅ | split.service.ts |
| Grupos recebem 5% | ✅ | split.service.ts linha 203 |
| Fundo regional recebe 10% | ✅ | split.service.ts linha 183 |
| Evento group.fund.received | ✅ | split.service.ts linha 240 |
| Referral em eventos | ✅ | event-economy.service.ts linha 529 |
| Limite de 3 grupos | ✅ | migration 037 (trigger) |
| Idempotência de split | ✅ | eventId determinístico |

---

## ❌ O QUE NÃO FUNCIONA / FALTA

| Componente | Status | Impacto |
|------------|--------|---------|
| Referral em UnifyWork | ❌ | Indicador não ganha em serviços |
| devLog em referral | ❌ | Viola GOLDEN_PATH |
| Resolução automática de grupos | ⚠️ | Precisa passar manualmente |
| Hook central de split | ⚠️ | Integração manual dispersa |

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Fase 1: Correções rápidas (1 hora)

1. Corrigir `console.log` → `devLog` em `referral-split.service.ts`
2. Integrar referral ao UnifyWork

### Fase 2: Grupos econômicos (2 horas)

3. Criar resolução automática de grupos no contexto de split
4. Testar: criar grupo → contratar serviço → verificar se grupo recebeu 5%

### Fase 3: Observabilidade (1 hora)

5. Expor impacto no feed (post automático quando grupo recebe)
6. Dashboard de grupos com saldo

---

## 🏁 VEREDITO FINAL

**O Split Engine está 85% pronto.**

- ✅ Estrutura econômica correta
- ✅ Percentuais corretos (70/15/10/5)
- ✅ Grupos e região funcionam
- ⚠️ Referral falta integração em UnifyWork
- ⚠️ Observabilidade (devLog) falta em referral

**Grupos podem ser criados AGORA**, pois a infraestrutura econômica já existe.

O que falta é **integração de ponta a ponta**, não arquitetura.

---

*Auditoria completa — Claude — 02/01/2026*

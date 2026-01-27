# 📜 CONTRATO DE EVENTOS v1.3 — UNIFICARD

**Status:** ATIVO  
**Versão:** v1.3  
**Data:** 28/12/2025  
**Escopo:** Backend, Frontend, Feed, Economia, IA, Escrow, Penalidades, Responsabilização  
**Caráter:** NORMATIVO (quebrar este contrato é bug arquitetural)

---

## 0. Princípio Fundamental

> **"No UnifiCard, ninguém ganha sem entregar, ninguém perde por culpa de outro, e o dinheiro só se move quando a realidade confirma."**

### 0.1 Regra-Mãe (INEGOCIÁVEL)

```
NENHUM organizador controla manualmente pagamentos.
TODO repasse financeiro é feito AUTOMATICAMENTE pelo sistema.
QUEM CUMPRIU, RECEBE. QUEM CAUSOU A FALHA, PAGA.
```

Isso vale para: Banda, Fornecedores, Limpeza, Segurança, Local, Produtor, Grupo, Comunidade, Plataforma.

**O humano NUNCA executa repasse.**
**O sistema GARANTE que quem trabalhou receba.**

---

## 1. Definições Canônicas

### 1.1 Actor

Entidade que inicia uma ação no sistema.

Tipos:
* `user` → pessoa física
* `page` → empresa, organização, igreja, clube, banda, etc.
* `group` → comunidade, interesse comum, agregador de pessoas

**Regra absoluta:**
> Nenhum evento existe sem um Actor.

### 1.2 Diferença Page × Group

| Aspecto | Page | Group |
|---------|------|-------|
| **Natureza** | Entidade que produz/vende | Pessoas com interesse comum |
| **Economia** | Recebe como organizador (70%) | Fundo interno (escrow) |
| **Criação de evento** | ✅ Todos os tipos | ⚠️ Apenas comunitários |
| **CNPJ potencial** | Sim | Não |
| **Saque direto** | ✅ Após evento | ❌ Via votação |

### 1.3 Evento

Evento é uma **operação estruturada** com:
* Início e fim definidos
* Participantes cadastrados
* Economia rastreável
* Consequências automáticas

Evento **não é post social**. É **central de gerenciamento**.

### 1.4 Entidades de Evento

Durante a criação, o organizador cadastra:

| Entidade | Campos obrigatórios | Papel na responsabilização |
|----------|---------------------|---------------------------|
| Artista/Banda | Quantidade, valor acordado, regra de check-in | ATRAÇÃO PRINCIPAL (Nível 1) |
| Fornecedor | Tipo, valor, critério de entrega | COLABORADOR |
| Segurança | Quantidade, valor por pessoa | COLABORADOR |
| Limpeza | Valor fixo ou variável | COLABORADOR |
| Staff | Quantidade, função, valor | COLABORADOR |
| Local/Venue | Percentual ou valor fixo | COLABORADOR |

### 1.5 Níveis de Responsabilidade (NOVO v1.3)

```
NÍVEL 1: ATRAÇÃO PRINCIPAL
  → Banda, artista, palestrante, atração que DEFINE o evento
  → Se faltar, CAUSA o cancelamento
  → Assume prejuízo de todos os colaboradores que cumpriram

NÍVEL 2: ORGANIZADOR
  → Responsável final por TUDO
  → Garantidor de última instância
  → Se Nível 1 não pagar, Organizador cobre

NÍVEL 3: COLABORADORES
  → Fornecedores, limpeza, segurança, staff
  → Se cumprirem, TÊM DIREITO a receber
  → Protegidos pela cadeia de responsabilidade
```

Tudo **registrado antes do evento**, **auditável**, **executado automaticamente**.

---

## 2. Modelo Arquitetural de Eventos

### 2.1 Tabela Canônica

> **Todos os eventos do sistema DEVEM existir na tabela `events`.**

### 2.2 Discriminador Central: `event_type`

```text
cultural | gastronomic | social | professional | community | spiritual | sports | private
```

### 2.3 Modelo de Vínculos

```
Evento
├── organizador (actor) ────────── 1:1 OBRIGATÓRIO (GARANTIDOR FINAL)
├── atração_principal (actor) ──── 1:N OBRIGATÓRIO para eventos pagos
├── entidade_vinculada (page) ──── 0:1 OPCIONAL
├── grupos_associados (group[]) ── 0:N OPCIONAL
├── colaboradores (actor[]) ────── 0:N COM CONTRATO
│   └── Cada um com: valor, regra de check-in, nível de responsabilidade
└── prestadores (service_provider[]) ── 0:N COM CONTRATO
```

---

## 3. Taxonomia Oficial de `event_type`

```text
cultural | gastronomic | social | professional | community | spiritual | sports | private
```

---

## 4. Matriz Actor × EventType (v1.3)

| Event Type    | User | Page | Group |
| ------------- | ---- | ---- | ----- |
| cultural      | ✅    | ✅    | ❌     |
| gastronomic   | ⚠️    | ✅    | ❌     |
| social        | ✅    | ❌    | ✅     |
| professional  | ✅    | ✅    | ❌     |
| community     | ✅    | ✅    | ✅     |
| spiritual     | ✅    | ✅    | ✅     |
| sports        | ✅    | ✅    | ✅     |
| private       | ✅    | ❌    | ❌     |

### 4.1 Restrições para Group

```typescript
if (organizer.type === 'group') {
  assert(event_type in ['community', 'social', 'spiritual', 'sports']);
  assert(ticket_price_cents <= 5000); // R$50
  assert(max_active_events <= 2);
}
```

---

## 5. ECONOMIA DE EVENTOS (v1.3 COMPLETA)

### 5.1 Regra-Mãe: ESCROW OBRIGATÓRIO

```
TODO dinheiro de evento pago entra em FUNDO BLOQUEADO (escrow).
NINGUÉM pode sacar NADA antes do evento acontecer.
```

### 5.2 Ciclo de Vida Financeiro

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO FINANCEIRO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COMPRA ──► ESCROW ──► EVENTO ──► VALIDAÇÃO ──► SPLIT      │
│     │          │          │           │            │        │
│  Registra   Bloqueia   Acontece   Check-ins    Distribui   │
│  no ledger  o valor    no mundo   validados    automático  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Status Financeiro do Evento

| Status | Saldo | Ação permitida |
|--------|-------|----------------|
| `DRAFT` | Nenhum | - |
| `PUBLISHED` | Acumulando em escrow | Compras entram |
| `PRE_EVENT` | Bloqueado | Nenhum saque |
| `DURING` | Bloqueado | Nenhum saque |
| `POST_EVENT` | Em liberação | Split automático |
| `COMPLETED` | Zerado | Tudo distribuído |
| `CANCELLED` | Reembolso + Responsabilização | Pagar quem cumpriu |

### 5.4 Split NÃO É Instantâneo

```
O split NÃO acontece no momento da compra.
O split acontece APÓS o evento, baseado em:
  - Check-ins realizados
  - Presenças confirmadas
  - Entregas validadas
  - Responsabilização aplicada (se houver falha)
```

### 5.5 Check-in É o Gatilho de Pagamento

**Regra absoluta:**

```
SEM CHECK-IN = SEM PAGAMENTO
COM CHECK-IN = DIREITO A RECEBER (mesmo se evento cancelado)
```

| Situação | Resultado |
|----------|-----------|
| Prestador não fez check-in | ❌ Não recebe |
| Banda não compareceu | ❌ Não recebe + paga colaboradores |
| Check-in parcial (3 de 5 músicos) | 💰 Recebe 60% |
| Evento cancelado, colaborador com check-in | ✅ RECEBE (responsável paga) |

### 5.6 Economia de Group

| Situação | Regra |
|----------|-------|
| Group cria evento gratuito | ✅ Permitido |
| Group cria evento até R$50 | ✅ Vai para fundo interno |
| Group recebe 70% | ❌ NUNCA (vai para fundo) |
| Saque do fundo | Via votação de admins |

---

## 5.9 RESPONSABILIZAÇÃO EM CASCATA (NOVO v1.3)

### 5.9.1 Princípio Fundamental

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   QUEM CUMPRIU, RECEBE.                                     │
│   QUEM CAUSOU A FALHA, PAGA.                                │
│   O SISTEMA GARANTE.                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.9.2 Cadeia de Responsabilidade

```
ORDEM DE COBRANÇA (quando evento falha):

1º CAUSADOR DIRETO
   → Quem faltou / quem causou o cancelamento
   → Primeiro a ser cobrado
   → Assume débito dos que cumpriram

2º ORGANIZADOR
   → Garantidor final
   → Se causador não pagar, organizador cobre
   → Pode cobrar do causador fora do sistema

3º FUNDO DO EVENTO
   → Última instância
   → Só se causador + organizador não cobrirem
   → Garante pagamento mínimo
```

### 5.9.3 Matriz de Cenários de Responsabilização

| Cenário | Causador | Quem cumpriu | Fluxo financeiro |
|---------|----------|--------------|------------------|
| Banda não aparece | Banda | Limpeza, Segurança, Staff | Banda paga colaboradores |
| Organizador cancela <24h | Organizador | Todos que vieram | Organizador paga + multa 10% |
| Organizador cancela <7d | Organizador | - | Multa 5%, sem pagamento extra |
| Ninguém comprou ingresso | Organizador | - | Evento não acontece |
| Força maior (chuva extrema) | Ninguém | Todos que vieram | Fundo paga proporcional |
| Colaborador faltou | Colaborador | - | Colaborador não recebe |
| Venue cancela | Venue | Todos que vieram | Venue paga colaboradores |

### 5.9.4 Regras de Débito

```typescript
interface Debito {
  devedorActorId: string;
  devedorActorType: 'user' | 'page';
  valorCents: number;
  motivo: 'NO_SHOW' | 'CANCELLATION' | 'PARTIAL_DELIVERY';
  eventoId: string;
  credorActorId: string;  // Quem tem direito a receber
}

// Consequências do débito não pago
const DEBITO_CONSEQUENCIAS = {
  imediato: {
    scoreChange: -50,
    bloqueio: 'CONTA_SUSPENSA',
  },
  ate7dias: {
    juros: 0,  // Sem juros por 7 dias
    notificacoes: ['email', 'push', 'inApp'],
  },
  apos7dias: {
    scoreChange: -20,  // Adicional
    restricao: 'NAO_PODE_CRIAR_EVENTOS',
  },
  apos30dias: {
    scoreChange: -30,  // Adicional
    restricao: 'CONTA_BLOQUEADA_TOTAL',
    cobrancaExterna: true,  // Pode ir para cobrança
  },
};
```

### 5.9.5 Fluxo de Responsabilização (Automático)

```
EVENTO CANCELADO (banda não apareceu)
         │
         ▼
┌─────────────────────────────────────┐
│ 1. IDENTIFICAR CAUSADOR             │
│    → Quem deveria estar e não veio? │
│    → Banda (Nível 1)                │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. IDENTIFICAR QUEM CUMPRIU         │
│    → Quem fez check-in?             │
│    → Limpeza: 3/3 ✅                │
│    → Segurança: 4/4 ✅              │
│    → Staff: 2/2 ✅                  │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. CALCULAR DÉBITO DO CAUSADOR      │
│    → Limpeza: R$ 300                │
│    → Segurança: R$ 500              │
│    → Staff: R$ 200                  │
│    → TOTAL: R$ 1.000                │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 4. EXECUTAR PAGAMENTOS              │
│    → Pagar colaboradores (do escrow)│
│    → Registrar débito na Banda      │
│    → Reembolsar compradores         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 5. APLICAR PENALIDADES              │
│    → Banda: -50 score               │
│    → Banda: conta bloqueada         │
│    → Banda: débito de R$ 1.000      │
│    → Organizador: -5 score (evento  │
│      falhou, mas não por culpa dele)│
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 6. REGISTRAR NO LEDGER              │
│    → Tudo auditável                 │
│    → Público para transparência     │
└─────────────────────────────────────┘
```

### 5.9.6 Fonte do Pagamento para Colaboradores

```
ORDEM DE PRIORIDADE:

1. ESCROW DO EVENTO
   → Sempre tem dinheiro (ingressos vendidos)
   → Primeira fonte para pagar quem cumpriu

2. DÉBITO DO CAUSADOR
   → Se escrow não cobrir, causador fica devendo
   → Débito fica na conta do causador
   → Bloqueio até quitar

3. ORGANIZADOR (GARANTIDOR)
   → Se causador não pagar em 7 dias
   → Sistema cobra do organizador
   → Organizador pode processar causador fora

4. FUNDO DE GARANTIA (FUTURO)
   → Para casos extremos
   → Quando ninguém pode pagar
   → Financiado por % de todas as transações
```

### 5.9.7 Proteções Especiais

**Para Colaboradores:**
```
✅ Check-in = direito garantido
✅ Evento cancelado = ainda recebe (se fez check-in)
✅ Causador não paga = organizador cobre
✅ Pagamento em até 7 dias úteis
```

**Para Organizadores:**
```
✅ Não é responsável se causador for identificado
✅ Score reduzido mínimo (-5) se falha for de terceiro
✅ Pode cobrar causador fora do sistema
⚠️ É garantidor final (assume se ninguém pagar)
```

**Para Causadores (Banda, Venue, etc):**
```
❌ Não recebe nada se não aparecer
❌ Paga quem apareceu
❌ Score despenca (-50)
❌ Conta bloqueada até quitar
❌ Histórico permanente
```

---

## 6. SISTEMA DE PENALIDADES (Atualizado v1.3)

### 6.1 Tabela de Penalidades Completa

#### Para ORGANIZADORES

| Infração | Score | Multa | Bloqueio |
|----------|-------|-------|----------|
| Cancelou >30 dias antes | -5 | 0% | Nenhum |
| Cancelou 7-30 dias antes | -10 | 2% | Nenhum |
| Cancelou <7 dias antes | -10 | 5% | Nenhum |
| Cancelou <24 horas | -20 | 10% | Revisão |
| >30% reclamações | -15 | - | 30 dias |
| Informações falsas | -50 | - | 90 dias |
| Fraude comprovada | -100 | Total | Permanente |

#### Para ATRAÇÕES PRINCIPAIS (Banda, Artista)

| Infração | Score | Débito | Bloqueio |
|----------|-------|--------|----------|
| No-show sem aviso | -50 | 100% dos colaboradores | Até quitar |
| Aviso <24h | -30 | 50% dos colaboradores | 30 dias |
| Aviso <7 dias | -15 | 0% | Nenhum |
| Entrega parcial (<50%) | -20 | Proporcional | 14 dias |
| 3 faltas em 90 dias | -100 | - | Permanente |

#### Para COLABORADORES

| Infração | Score | Resultado |
|----------|-------|-----------|
| No-show sem aviso | -30 | 0% pagamento |
| Aviso <24h | -15 | 50% pagamento |
| Check-in parcial | -10 | Proporcional |
| 3 faltas em 90 dias | -50 | 60 dias bloqueado |

#### Para COMPRADORES

| Infração | Score | Resultado |
|----------|-------|-----------|
| No-show | -5 | Nenhum reembolso |
| 3 no-shows em 90 dias | -15 | Restrição de compra |
| Chargeback fraudulento | -100 | Ban permanente |

### 6.2 Escala de Score e Consequências

```
SCORE 100-80: 🟢 EXCELENTE
  - Prioridade no feed
  - Limites expandidos
  - Badge de confiança
  - Pode ser garantidor de outros

SCORE 79-60: 🟡 BOM
  - Operação normal
  - Sem restrições

SCORE 59-40: 🟠 ATENÇÃO
  - Avisos periódicos
  - Limites reduzidos (50%)
  - Revisão obrigatória de novos eventos

SCORE 39-20: 🔴 CRÍTICO
  - Suspensão de criação de eventos
  - Só pode participar, não organizar
  - Pagamentos atrasados (7 dias)
  - Não pode ser atração principal

SCORE <20: ⛔ BLOQUEADO
  - Conta suspensa
  - Saldo congelado
  - Débitos executados primeiro
  - Requer apelação manual
```

---

## 7. Check-in e Impacto

### 7.1 Check-in

Check-in é **confirmação de presença no mundo real** e **gatilho de direitos**.

Pode ocorrer via:
* QR Code (preferencial)
* Manual (validado por organizador)
* Geolocalização (automático)

### 7.2 Impacto do Check-in

```
CHECK-IN FEITO:
  → Direito a receber GARANTIDO
  → Mesmo se evento for cancelado
  → Protegido pela cadeia de responsabilidade

CHECK-IN NÃO FEITO:
  → Sem direito a pagamento
  → Score negativo se era esperado
  → Pode ser cobrado por prejuízo causado
```

---

## 8. IA no Sistema de Eventos

### 8.1 Papel da IA

> **IA é guardiã, não criadora.**

A IA:
* Classifica e valida
* Detecta fraude
* Identifica padrões de no-show
* Sugere responsável em casos ambíguos

A IA **não**:
* Decide economia
* Publica sozinha
* Perdoa débitos

---

## 9. Wizard de Criação (Atualizado v1.3)

Fluxo obrigatório:

```
Actor → EventType → Contexto → PARTICIPANTES → RESPONSABILIDADES → Economia → Revisão → Publicar
                                    ↑                   ↑
                           Cadastrar todos      Definir quem é
                           os envolvidos        atração principal
```

### 9.1 Cadastro Obrigatório para Eventos Pagos

Para eventos com ingresso pago, é **OBRIGATÓRIO**:

1. Definir **atração principal** (quem causa cancelamento se faltar)
2. Cadastrar **todos os colaboradores** com valores
3. Aceitar **termo de responsabilidade**

---

## 10. Dashboard de Transparência (Atualizado v1.3)

### 10.1 Histórico do Ator

```
┌─────────────────────────────────────────────────────────────┐
│                    MEU HISTÓRICO                            │
├─────────────────────────────────────────────────────────────┤
│ Score Atual: 78/100 🟡                                      │
│                                                             │
│ Eventos:                                                    │
│ ├── Organizados: 5 (4 sucesso, 1 cancelado)                │
│ ├── Como prestador: 12 (11 check-in, 1 falta)              │
│ └── Como participante: 6                                    │
│                                                             │
│ Financeiro:                                                 │
│ ├── Total recebido: R$ 4.320,00                            │
│ ├── Total pago: R$ 890,00                                  │
│ ├── Débitos pendentes: R$ 0,00 ✅                          │
│ └── Impacto gerado: R$ 540,00                              │
│                                                             │
│ Responsabilização:                                          │
│ ├── Vezes como causador: 0 ✅                              │
│ ├── Vezes como garantidor: 2                               │
│ └── Valor garantido: R$ 800,00                             │
│                                                             │
│ Confiabilidade:                                             │
│ ├── Check-in rate: 95%                                     │
│ ├── Cancelamentos: 2%                                      │
│ └── Reclamações: 1%                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Governança (Atualizado v1.3)

### 11.1 Proteções Automáticas

| Situação | Ação do sistema |
|----------|-----------------|
| Atração principal faltou | Cancelar + responsabilizar + pagar colaboradores |
| Organizador cancelou tarde | Multa + responsabilizar + pagar quem veio |
| Débito não pago em 7 dias | Cobrar organizador |
| Débito não pago em 30 dias | Bloquear conta + cobrança externa |
| Score < 20 | Suspender conta |

### 11.2 Garantias do Sistema

```
✅ Comprador NUNCA perde dinheiro em cancelamento
✅ Colaborador com check-in SEMPRE recebe
✅ Causador SEMPRE é responsabilizado
✅ Tudo é rastreável no ledger
✅ Nenhum humano decide pagamento manualmente
```

---

## 12. Quebra de Contrato

Qualquer implementação que:

* Crie evento fora de `events`
* Calcule economia no frontend
* Permita saque antes do evento
* Pague sem check-in
* Ignore cadeia de responsabilidade
* Não proteja colaborador que cumpriu
* Permita causador escapar de débito

➡️ **É considerada BUG ARQUITETURAL.**

---

## 13. Encerramento

Este contrato existe para:

* **Eliminar calote** — Escrow obrigatório
* **Eliminar fraude** — Check-in como gatilho
* **Proteger quem trabalha** — Cadeia de responsabilidade
* **Responsabilizar quem falha** — Débito automático
* **Garantir transparência** — Ledger público

> **Quem cumpre, recebe.**
> **Quem falha, paga.**
> **O sistema garante.**

---

## Histórico

| Data | Versão | Mudança |
|------|--------|---------|
| 28/12/2025 | v1.0 | Contrato inicial |
| 28/12/2025 | v1.1 | Group como actor, Página Explorar |
| 28/12/2025 | v1.2 | Escrow, Split pós-evento, Penalidades |
| 28/12/2025 | v1.3 | **Responsabilização em Cascata**, proteção a colaboradores |

---

*Este documento é a ÚNICA fonte de verdade para o sistema de eventos.*

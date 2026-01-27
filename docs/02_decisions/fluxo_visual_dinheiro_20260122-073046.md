# 💰 FLUXO VISUAL DO DINHEIRO — UNIFICARD

**Versão:** 1.0  
**Data:** 28/12/2025  
**Derivado de:** `CONTRATO_EVENTOS_V1.2.md`  
**Público:** Time, Investidores, Parceiros, Desenvolvedores

---

## 🎯 OBJETIVO DESTE DOCUMENTO

> Mostrar **exatamente** como o dinheiro entra, fica parado, é validado e sai no sistema de eventos do UnifiCard.

Se você entender este documento, você entende a economia do produto.

---

## 1. VISÃO GERAL — O CICLO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        💰 CICLO DO DINHEIRO                                 │
│                                                                             │
│   COMPRA          ESCROW           EVENTO          VALIDAÇÃO        SPLIT  │
│     │               │                │                │               │     │
│     ▼               ▼                ▼                ▼               ▼     │
│  ┌─────┐       ┌─────────┐      ┌─────────┐     ┌──────────┐    ┌───────┐  │
│  │ 💳  │──────▶│ 🔒 FUNDO │──────▶│ 🎭 REAL │─────▶│ ✅ CHECK │────▶│ 💸    │  │
│  │PAGA │       │BLOQUEADO│      │ ACONTECE│     │   IN     │    │DISTRIBUI│ │
│  └─────┘       └─────────┘      └─────────┘     └──────────┘    └───────┘  │
│     │               │                │                │               │     │
│     │          NINGUÉM              │           SEM CHECK-IN         │     │
│     │          SACA AQUI            │           = SEM PAGAMENTO      │     │
│     │               │                │                │               │     │
│                                                                             │
│   R$100 ────▶ R$100 travado ────▶ Evento ────▶ Quem veio? ────▶ Paga quem  │
│   do usuário   no sistema          ocorre       Quem faltou?      cumpriu  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DETALHAMENTO — CADA ETAPA

### 2.1 COMPRA DO INGRESSO

```
┌─────────────────────────────────────────────────────────────────┐
│                     ETAPA 1: COMPRA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   USUÁRIO                      SISTEMA                          │
│      │                            │                             │
│      │  "Quero comprar ingresso"  │                             │
│      │ ─────────────────────────▶ │                             │
│      │                            │                             │
│      │                    ┌───────┴───────┐                     │
│      │                    │ Validar:      │                     │
│      │                    │ • Evento existe│                    │
│      │                    │ • Tem vaga    │                     │
│      │                    │ • Preço OK    │                     │
│      │                    └───────┬───────┘                     │
│      │                            │                             │
│      │  "Pague R$100"             │                             │
│      │ ◀───────────────────────── │                             │
│      │                            │                             │
│      │  💳 Paga                   │                             │
│      │ ─────────────────────────▶ │                             │
│      │                            │                             │
│      │                    ┌───────┴───────┐                     │
│      │                    │   DINHEIRO    │                     │
│      │                    │   VAI PARA    │                     │
│      │                    │   ════════    │                     │
│      │                    │    ESCROW     │                     │
│      │                    │  (não pro     │                     │
│      │                    │  organizador) │                     │
│      │                    └───────┬───────┘                     │
│      │                            │                             │
│      │  ✅ "Ingresso confirmado"  │                             │
│      │ ◀───────────────────────── │                             │
│                                                                 │
│   📌 PONTO CRÍTICO:                                             │
│   O organizador NÃO vê esse dinheiro ainda.                     │
│   Ele está TRAVADO no sistema.                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 FUNDO BLOQUEADO (ESCROW)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ETAPA 2: ESCROW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   🔒 FUNDO DO EVENTO                    │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │                                                         │   │
│   │   Evento: Show da Banda X                               │   │
│   │   Data: 15/01/2025                                      │   │
│   │                                                         │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │  💰 SALDO ATUAL: R$ 5.000,00                    │   │   │
│   │   │                                                 │   │   │
│   │   │  Entradas:                                      │   │   │
│   │   │  • 50 ingressos × R$100 = R$5.000              │   │   │
│   │   │                                                 │   │   │
│   │   │  Saídas: R$ 0,00                               │   │   │
│   │   │  (BLOQUEADO até o evento)                      │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   │                                                         │   │
│   │   STATUS: 🔒 COLLECTING (aceitando pagamentos)          │   │
│   │                                                         │   │
│   │   ⚠️  QUEM PODE SACAR AGORA?                           │   │
│   │   ❌ Organizador: NÃO                                   │   │
│   │   ❌ Banda: NÃO                                         │   │
│   │   ❌ Fornecedores: NÃO                                  │   │
│   │   ❌ Plataforma: NÃO                                    │   │
│   │   ❌ Ninguém: CORRETO                                   │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   📌 O DINHEIRO FICA AQUI ATÉ O EVENTO ACONTECER               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 BLOQUEIO PRÉ-EVENTO

```
┌─────────────────────────────────────────────────────────────────┐
│                 ETAPA 2.5: BLOQUEIO (30 min antes)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ⏰ 30 minutos antes do evento começar:                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   STATUS MUDA:  COLLECTING ──▶ 🔒 LOCKED                │   │
│   │                                                         │   │
│   │   O que isso significa:                                 │   │
│   │   • Não aceita mais compras                            │   │
│   │   • Não aceita mais reembolsos normais                 │   │
│   │   • Saldo está 100% congelado                          │   │
│   │   • Esperando o evento acontecer                       │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   Por quê?                                                      │
│   → Para garantir que o dinheiro existe                         │
│   → Para impedir manipulação de última hora                     │
│   → Para preparar o split                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 EVENTO ACONTECE + CHECK-IN

```
┌─────────────────────────────────────────────────────────────────┐
│               ETAPA 3: EVENTO + VALIDAÇÃO                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   🎭 EVENTO COMEÇA                                              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    CHECK-INS                            │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │                                                         │   │
│   │   PARTICIPANTES DO EVENTO:                              │   │
│   │                                                         │   │
│   │   ┌────────────────┬──────────┬───────────┬──────────┐  │   │
│   │   │ QUEM           │ ESPERADO │ CHECK-IN  │ STATUS   │  │   │
│   │   ├────────────────┼──────────┼───────────┼──────────┤  │   │
│   │   │ Banda X        │ 5 músicos│ 5 ✅      │ 100%     │  │   │
│   │   │ Segurança      │ 4 pessoas│ 3 ✅      │ 75%      │  │   │
│   │   │ Limpeza        │ 2 pessoas│ 0 ❌      │ 0%       │  │   │
│   │   │ Staff          │ 3 pessoas│ 3 ✅      │ 100%     │  │   │
│   │   │ Produtor       │ 1 pessoa │ 1 ✅      │ 100%     │  │   │
│   │   └────────────────┴──────────┴───────────┴──────────┘  │   │
│   │                                                         │   │
│   │   COMPRADORES:                                          │   │
│   │   • 50 ingressos vendidos                              │   │
│   │   • 42 pessoas fizeram check-in (84%)                  │   │
│   │   • 8 pessoas não apareceram (16%)                     │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   📌 REGRA DE OURO:                                             │
│   ══════════════════════════════════════════════════════════    │
│   ║  SEM CHECK-IN = SEM PAGAMENTO                          ║    │
│   ══════════════════════════════════════════════════════════    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 SPLIT AUTOMÁTICO (PÓS-EVENTO)

```
┌─────────────────────────────────────────────────────────────────┐
│                ETAPA 4: SPLIT AUTOMÁTICO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   🕐 EVENTO TERMINOU → SISTEMA PROCESSA AUTOMATICAMENTE         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   FUNDO DO EVENTO: R$ 5.000,00                         │   │
│   │                                                         │   │
│   │   ═══════════════════════════════════════════════════   │   │
│   │                                                         │   │
│   │   PASSO 1: PAGAR PRESTADORES (baseado em check-in)     │   │
│   │                                                         │   │
│   │   ┌────────────────┬──────────┬──────────┬──────────┐  │   │
│   │   │ QUEM           │ ACORDADO │ CHECK-IN │ RECEBE   │  │   │
│   │   ├────────────────┼──────────┼──────────┼──────────┤  │   │
│   │   │ Banda X        │ R$2.000  │ 100%     │ R$2.000  │  │   │
│   │   │ Segurança      │ R$500    │ 75%      │ R$375    │  │   │
│   │   │ Limpeza        │ R$300    │ 0%       │ R$0 ❌   │  │   │
│   │   │ Staff          │ R$300    │ 100%     │ R$300    │  │   │
│   │   │ Produtor       │ R$200    │ 100%     │ R$200    │  │   │
│   │   ├────────────────┼──────────┼──────────┼──────────┤  │   │
│   │   │ TOTAL PREST.   │ R$3.300  │          │ R$2.875  │  │   │
│   │   └────────────────┴──────────┴──────────┴──────────┘  │   │
│   │                                                         │   │
│   │   💰 Economia: R$425 (limpeza não apareceu)             │   │
│   │                                                         │   │
│   │   ═══════════════════════════════════════════════════   │   │
│   │                                                         │   │
│   │   PASSO 2: DISTRIBUIR RESTANTE (R$ 2.125,00)           │   │
│   │                                                         │   │
│   │   ┌────────────────────────────────┬─────────┬───────┐  │   │
│   │   │ DESTINO                        │ %       │ VALOR │  │   │
│   │   ├────────────────────────────────┼─────────┼───────┤  │   │
│   │   │ 👤 Organizador                 │ 70%     │R$1.487│  │   │
│   │   │ 🏙️ Cidade (Curitiba)           │ 15%     │ R$318 │  │   │
│   │   │ 🗺️ Região (Sul)                │ 10%     │ R$212 │  │   │
│   │   │ 👥 Grupo associado             │ 5%      │ R$106 │  │   │
│   │   ├────────────────────────────────┼─────────┼───────┤  │   │
│   │   │ TOTAL                          │ 100%    │R$2.125│  │   │
│   │   └────────────────────────────────┴─────────┴───────┘  │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   📌 TUDO ISSO ACONTECE AUTOMATICAMENTE                         │
│   📌 NENHUM HUMANO PRECISA APERTAR BOTÃO                        │
│   📌 NENHUM ORGANIZADOR CONTROLA O PAGAMENTO                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. CENÁRIOS ESPECIAIS

### 3.1 CANCELAMENTO PELO ORGANIZADOR

```
┌─────────────────────────────────────────────────────────────────┐
│              CENÁRIO: ORGANIZADOR CANCELA                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ⏰ QUANDO CANCELOU?                                           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   > 30 dias antes:                                      │   │
│   │   • ✅ Reembolso 100% aos compradores                   │   │
│   │   • ⚠️ Score: -5 (leve)                                 │   │
│   │   • 💰 Multa: 0%                                        │   │
│   │                                                         │   │
│   │   7-30 dias antes:                                      │   │
│   │   • ✅ Reembolso 100% aos compradores                   │   │
│   │   • ⚠️ Score: -10                                       │   │
│   │   • 💰 Multa: 2% do escrow                              │   │
│   │                                                         │   │
│   │   < 7 dias antes:                                       │   │
│   │   • ✅ Reembolso 100% aos compradores                   │   │
│   │   • 🔴 Score: -10                                       │   │
│   │   • 💰 Multa: 5% do escrow                              │   │
│   │                                                         │   │
│   │   < 24 horas antes:                                     │   │
│   │   • ✅ Reembolso 100% aos compradores                   │   │
│   │   • 🔴 Score: -20                                       │   │
│   │   • 💰 Multa: 10% do escrow                             │   │
│   │   • ⛔ Possível suspensão de criação                    │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   FLUXO DO DINHEIRO:                                            │
│                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│   │  ESCROW  │────▶│  MULTA   │────▶│ COMPRADORES│             │
│   │ R$5.000  │     │ (se houver)│   │ R$4.500   │              │
│   └──────────┘     └──────────┘     └──────────┘               │
│        │                │                                       │
│        │                ▼                                       │
│        │          ┌──────────┐                                  │
│        │          │ FUNDO DA │                                  │
│        └─────────▶│ CIDADE   │                                  │
│                   │ R$500    │                                  │
│                   └──────────┘                                  │
│                                                                 │
│   📌 Comprador SEMPRE recebe de volta                           │
│   📌 Organizador irresponsável é penalizado                     │
│   📌 Multa vai para fundo da comunidade                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 EMPRESA (PAGE) DELETADA

```
┌─────────────────────────────────────────────────────────────────┐
│              CENÁRIO: EMPRESA DELETA CONTA                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SITUAÇÃO:                                                     │
│   • Empresa "Bar do João" tinha evento agendado                 │
│   • 30 ingressos vendidos (R$3.000)                            │
│   • Empresa deleta a conta                                      │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   O QUE ACONTECE AUTOMATICAMENTE:                       │   │
│   │                                                         │   │
│   │   1. Evento → Status: CANCELLED                         │   │
│   │      Motivo: "Empresa deletada"                         │   │
│   │                                                         │   │
│   │   2. Compradores → Notificados                          │   │
│   │      • Push notification                                │   │
│   │      • Email                                            │   │
│   │      • In-app                                           │   │
│   │                                                         │   │
│   │   3. Dinheiro → Reembolso automático                    │   │
│   │      • Do FUNDO DO EVENTO (escrow)                      │   │
│   │      • NÃO da plataforma                                │   │
│   │      • NÃO do organizador (ele já deletou)              │   │
│   │                                                         │   │
│   │   4. Empresa → Bloqueio permanente                      │   │
│   │      • CNPJ/CPF marcado                                 │   │
│   │      • Não pode criar nova conta                        │   │
│   │      • Score: -100                                      │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ⚠️ E SE O FUNDO NÃO TIVER DINHEIRO SUFICIENTE?               │
│                                                                 │
│   → Isso NÃO ACONTECE porque:                                   │
│   → O dinheiro está no ESCROW desde a compra                    │
│   → A empresa NUNCA teve acesso a ele                           │
│   → Sempre tem saldo para reembolsar                            │
│                                                                 │
│   📌 O comprador NUNCA fica no prejuízo                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 PRESTADOR NÃO APARECE

```
┌─────────────────────────────────────────────────────────────────┐
│              CENÁRIO: BANDA NÃO APARECE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SITUAÇÃO:                                                     │
│   • Banda "Os Fulanos" contratada para R$2.000                 │
│   • Não fez check-in no evento                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   RESULTADO AUTOMÁTICO:                                 │   │
│   │                                                         │   │
│   │   💰 PAGAMENTO: R$ 0,00                                 │   │
│   │   (sem check-in = sem pagamento)                        │   │
│   │                                                         │   │
│   │   📉 SCORE: -30 pontos                                  │   │
│   │                                                         │   │
│   │   ⛔ PENALIDADE:                                        │   │
│   │   • Suspensão de convites por 60 dias                   │   │
│   │   • Registro permanente no histórico                    │   │
│   │                                                         │   │
│   │   💰 O QUE ACONTECE COM OS R$2.000?                     │   │
│   │   • Ficam no fundo do evento                            │   │
│   │   • São redistribuídos no split final                   │   │
│   │   • Organizador recebe mais                             │   │
│   │   • Comunidade recebe mais                              │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   📌 Quem falta, não recebe E perde reputação                   │
│   📌 Quem cumpre, recebe mais                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 CHECK-IN PARCIAL

```
┌─────────────────────────────────────────────────────────────────┐
│              CENÁRIO: SEGURANÇA PARCIAL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SITUAÇÃO:                                                     │
│   • Contratados 4 seguranças por R$500 total                   │
│   • Apenas 3 compareceram (75%)                                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   CÁLCULO:                                              │   │
│   │                                                         │   │
│   │   Acordado: R$ 500,00                                   │   │
│   │   Check-in: 75%                                         │   │
│   │   ─────────────────                                     │   │
│   │   Pagamento: R$ 375,00                                  │   │
│   │                                                         │   │
│   │   📉 SCORE: -10 pontos                                  │   │
│   │   (entrega parcial)                                     │   │
│   │                                                         │   │
│   │   💰 OS R$125 RESTANTES:                                │   │
│   │   • Ficam no fundo                                      │   │
│   │   • Redistribuídos no split                             │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   📌 Pagamento PROPORCIONAL ao cumprimento                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. FLUXO TÉCNICO (PARA DESENVOLVEDORES)

### 4.1 Estados do Escrow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÁQUINA DE ESTADOS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌─────────────┐                            │
│                      │   CREATED   │                            │
│                      │  (evento    │                            │
│                      │  publicado) │                            │
│                      └──────┬──────┘                            │
│                             │                                   │
│                             ▼                                   │
│                      ┌─────────────┐                            │
│                      │ COLLECTING  │◀──── Compras entram        │
│                      │ (aceitando  │                            │
│                      │  depósitos) │                            │
│                      └──────┬──────┘                            │
│                             │                                   │
│              30 min antes   │                                   │
│              do evento      ▼                                   │
│                      ┌─────────────┐                            │
│                      │   LOCKED    │                            │
│                      │ (bloqueado) │                            │
│                      └──────┬──────┘                            │
│                             │                                   │
│              Evento         │                                   │
│              terminou       ▼                                   │
│                      ┌─────────────┐                            │
│                      │ RELEASING   │──── Splits acontecem       │
│                      │ (liberando) │                            │
│                      └──────┬──────┘                            │
│                             │                                   │
│              Tudo           │                                   │
│              distribuído    ▼                                   │
│                      ┌─────────────┐                            │
│                      │ COMPLETED   │                            │
│                      │  (zerado)   │                            │
│                      └─────────────┘                            │
│                                                                 │
│   ESTADOS ALTERNATIVOS:                                         │
│                                                                 │
│   COLLECTING ──────▶ REFUNDING ──────▶ COMPLETED                │
│               (cancelamento)  (reembolso total)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Sequência de Chamadas (Split Pós-Evento)

```
┌─────────────────────────────────────────────────────────────────┐
│              SEQUÊNCIA: JOB DE SPLIT PÓS-EVENTO                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SCHEDULER                 ESCROW              PENALTY         │
│      │                        │                    │            │
│      │ [evento terminou]      │                    │            │
│      │                        │                    │            │
│      │ ── startRelease() ───▶ │                    │            │
│      │                        │                    │            │
│      │                   [status = RELEASING]      │            │
│      │                        │                    │            │
│      │ ── getParticipants() ─▶│                    │            │
│      │                        │                    │            │
│      │ ◀─── [{banda, seg...}] │                    │            │
│      │                        │                    │            │
│      │   for each participant:│                    │            │
│      │   ─── release() ──────▶│                    │            │
│      │   (valor × check-in %) │                    │            │
│      │                        │                    │            │
│      │ ── distributeRemainder()│                   │            │
│      │                        │                    │            │
│      │ ── processEvaluation() ──────────────────▶  │            │
│      │                        │    [aplica scores] │            │
│      │                        │    [aplica multas] │            │
│      │                        │                    │            │
│      │ ── complete() ────────▶│                    │            │
│      │                        │                    │            │
│      │                   [status = COMPLETED]      │            │
│      │                   [saldo = 0]               │            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Estrutura de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│              MODELO DE DADOS                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   event_escrow                                                  │
│   ├── id                                                        │
│   ├── event_id ────────────────┐                                │
│   ├── total_collected_cents    │                                │
│   ├── total_released_cents     │                                │
│   ├── total_refunded_cents     │                                │
│   ├── current_balance_cents    │ (computed)                     │
│   ├── status                   │                                │
│   └── locked_at / completed_at │                                │
│                                │                                │
│   event_escrow_transactions    │                                │
│   ├── id                       │                                │
│   ├── escrow_id ───────────────┘                                │
│   ├── transaction_type (DEPOSIT|RELEASE|REFUND|PENALTY)         │
│   ├── amount_cents                                              │
│   ├── source_account_id                                         │
│   ├── destination_account_id                                    │
│   ├── ticket_id                                                 │
│   ├── participant_id                                            │
│   ├── reason                                                    │
│   └── idempotency_key                                           │
│                                                                 │
│   event_participants                                            │
│   ├── id                                                        │
│   ├── event_id                                                  │
│   ├── actor_id / actor_type                                     │
│   ├── role (artist|vendor|security|staff...)                    │
│   ├── agreed_amount_cents                                       │
│   ├── expected_headcount                                        │
│   ├── check_in_required                                         │
│   ├── minimum_check_in_rate                                     │
│   └── status (INVITED|CONFIRMED|CHECKED_IN|NO_SHOW)             │
│                                                                 │
│   actor_scores                                                  │
│   ├── actor_id / actor_type                                     │
│   ├── current_score (0-100)                                     │
│   └── estatísticas agregadas                                    │
│                                                                 │
│   actor_penalties                                               │
│   ├── actor_id / actor_type                                     │
│   ├── penalty_type                                              │
│   ├── reason                                                    │
│   ├── starts_at / ends_at                                       │
│   └── status (ACTIVE|EXPIRED|REVOKED)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. RESUMO VISUAL (1 PÁGINA)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    💰 ECONOMIA DO UNIFICARD — EVENTOS                       │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   REGRA #1: DINHEIRO NUNCA VAI DIRETO PRO ORGANIZADOR                       │
│             Vai pro ESCROW (fundo bloqueado)                                │
│                                                                             │
│   REGRA #2: NINGUÉM SACA ANTES DO EVENTO                                    │
│             Nem organizador, nem banda, nem ninguém                         │
│                                                                             │
│   REGRA #3: SEM CHECK-IN = SEM PAGAMENTO                                    │
│             Faltou? Não recebe. Veio parcial? Recebe parcial.               │
│                                                                             │
│   REGRA #4: SPLIT É AUTOMÁTICO E PÓS-EVENTO                                 │
│             Sistema calcula e distribui. Humano não toca.                   │
│                                                                             │
│   REGRA #5: QUEM CANCELA TARDE PAGA MULTA                                   │
│             < 24h = 10% de multa + score negativo                           │
│                                                                             │
│   REGRA #6: TUDO FICA REGISTRADO NO LEDGER                                  │
│             Transparente, auditável, público                                │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   FLUXO SIMPLIFICADO:                                                       │
│                                                                             │
│   [COMPRA] ──▶ [ESCROW] ──▶ [EVENTO] ──▶ [CHECK-IN] ──▶ [SPLIT]            │
│      │            │            │             │             │                │
│   Usuário     Dinheiro      Acontece      Valida        Distribui           │
│   paga        trava         no mundo      presença      automático          │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   RESULTADO:                                                                │
│   ✅ Zero calote      ✅ Zero fraude       ✅ Zero bagunça                  │
│   ✅ Quem cumpre ganha   ✅ Quem falta perde   ✅ Tudo rastreável           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## CHANGELOG

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 28/12/2025 | 1.0 | Claude | Documento inicial |

---

*Este documento é a representação visual do CONTRATO_EVENTOS_V1.2.md*
*Use para alinhar time, investidores e parceiros*

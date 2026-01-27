# 📊 DASHBOARD DE CONFIANÇA — SPEC

**Versão:** 1.0  
**Data:** 28/12/2025  
**Derivado de:** `CONTRATO_EVENTOS_V1.3.md`  
**Público:** UX, Frontend, Usuário Final

---

## 🎯 OBJETIVO

Mostrar para qualquer pessoa no sistema:
- **Quem ela é** (reputação construída)
- **O que ela fez** (histórico real)
- **Quanto ela vale** (confiabilidade)

Isso substitui "avaliação de 5 estrelas" por **dados reais de comportamento**.

---

## 1. VISÃO GERAL — O QUE O USUÁRIO VÊ

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   👤 PERFIL DE CONFIANÇA                                        │
│   ══════════════════════════════════════════════════════════   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   🏆 SCORE DE CONFIANÇA: 82/100                         │   │
│   │   ████████████████████░░░░░  🟢 EXCELENTE               │   │
│   │                                                         │   │
│   │   "Você é um dos mais confiáveis da plataforma"         │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   📈 RESUMO RÁPIDO                                      │   │
│   │                                                         │   │
│   │   ┌─────────────┬─────────────┬─────────────┐           │   │
│   │   │ Eventos     │ Check-ins   │ Impacto     │           │   │
│   │   │ 23          │ 95%         │ R$ 4.320    │           │   │
│   │   │ participou  │ compareceu  │ movimentou  │           │   │
│   │   └─────────────┴─────────────┴─────────────┘           │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. SEÇÕES DO DASHBOARD

### 2.1 Cabeçalho — Score Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🏆 SCORE DE CONFIANÇA                                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │              82                                         │   │
│   │             ────                                        │   │
│   │             100                                         │   │
│   │                                                         │   │
│   │   ████████████████████░░░░░                             │   │
│   │                                                         │   │
│   │   🟢 EXCELENTE                                          │   │
│   │   "Você é um dos mais confiáveis da plataforma"         │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   LEGENDA:                                                      │
│   🟢 100-80: Excelente    🟡 79-60: Bom                         │
│   🟠 59-40: Atenção       🔴 39-20: Crítico                     │
│   ⛔ <20: Bloqueado                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- `current_score` de `actor_scores`
- Badge calculado por faixa

---

### 2.2 Estatísticas Gerais

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📊 SUAS ESTATÍSTICAS                                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   COMO PARTICIPANTE                                     │   │
│   │   ├── Eventos que participou: 23                        │   │
│   │   ├── Check-ins realizados: 22 (95%)                    │   │
│   │   ├── Faltas: 1 (4%)                                    │   │
│   │   └── Avaliação média: ⭐ 4.8                           │   │
│   │                                                         │   │
│   │   COMO ORGANIZADOR                                      │   │
│   │   ├── Eventos criados: 5                                │   │
│   │   ├── Sucesso: 4 (80%)                                  │   │
│   │   ├── Cancelados: 1 (20%)                               │   │
│   │   └── Reclamações: 0                                    │   │
│   │                                                         │   │
│   │   COMO PRESTADOR                                        │   │
│   │   ├── Serviços realizados: 12                           │   │
│   │   ├── Entregas completas: 11 (92%)                      │   │
│   │   ├── Parciais: 1 (8%)                                  │   │
│   │   └── Avaliação média: ⭐ 4.9                           │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- Agregados de `actor_scores`
- Contagens de `event_participants`, `event_check_ins`

---

### 2.3 Histórico Financeiro

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   💰 SEU HISTÓRICO FINANCEIRO                                   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   RECEBIDO                                              │   │
│   │   ├── Total: R$ 4.320,00                                │   │
│   │   ├── Como organizador: R$ 2.100,00                     │   │
│   │   ├── Como prestador: R$ 1.820,00                       │   │
│   │   └── Outros: R$ 400,00                                 │   │
│   │                                                         │   │
│   │   PAGO                                                  │   │
│   │   ├── Total: R$ 890,00                                  │   │
│   │   ├── Ingressos: R$ 650,00                              │   │
│   │   └── Serviços: R$ 240,00                               │   │
│   │                                                         │   │
│   │   IMPACTO GERADO                                        │   │
│   │   ├── Para comunidade: R$ 540,00                        │   │
│   │   ├── Para cidade: R$ 320,00                            │   │
│   │   └── Para região: R$ 180,00                            │   │
│   │                                                         │   │
│   │   DÉBITOS                                               │   │
│   │   └── Pendentes: R$ 0,00 ✅                             │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- Agregados do `ledger`
- Filtrados por `actor_id`

---

### 2.4 Histórico de Responsabilização

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ⚖️ RESPONSABILIZAÇÃO                                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   VOCÊ COMO CAUSADOR                                    │   │
│   │   └── Vezes: 0 ✅                                       │   │
│   │       "Você nunca causou cancelamento de evento"        │   │
│   │                                                         │   │
│   │   VOCÊ COMO GARANTIDOR                                  │   │
│   │   ├── Vezes que garantiu: 2                             │   │
│   │   ├── Valor garantido: R$ 800,00                        │   │
│   │   └── Valor pago: R$ 0,00 (causadores pagaram)          │   │
│   │                                                         │   │
│   │   VOCÊ COMO PROTEGIDO                                   │   │
│   │   ├── Vezes protegido: 1                                │   │
│   │   └── Valor recebido: R$ 300,00                         │   │
│   │       "Você trabalhou em evento cancelado e recebeu"    │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- De `actor_penalties` e `event_escrow_transactions`
- Agregados por papel no evento

---

### 2.5 Penalidades (se houver)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ⚠️ PENALIDADES                                                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   ATIVAS: 0 ✅                                          │   │
│   │                                                         │   │
│   │   HISTÓRICO:                                            │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │ 15/10/2025 — Falta em evento                    │   │   │
│   │   │ Score: -5 | Status: RESOLVIDO                   │   │   │
│   │   │ "Você não compareceu ao evento X"               │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- De `actor_penalties`
- Filtradas por status

---

### 2.6 Linha do Tempo de Score

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📈 EVOLUÇÃO DO SEU SCORE                                      │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │   100│                                                  │   │
│   │      │          ╭──────╮                                │   │
│   │   80 │    ╭─────╯      ╰────────────────                │   │
│   │      │────╯                          ▼ 82               │   │
│   │   60 │                                                  │   │
│   │      │                                                  │   │
│   │   40 │                                                  │   │
│   │      │                                                  │   │
│   │   20 │                                                  │   │
│   │      └──────────────────────────────────────────────    │   │
│   │       JAN  FEV  MAR  ABR  MAI  JUN  JUL  AGO  SET       │   │
│   │                                                         │   │
│   │   Eventos importantes:                                  │   │
│   │   ▲ MAR: +5 (evento bem-sucedido)                       │   │
│   │   ▼ JUN: -5 (falta em evento)                           │   │
│   │   ▲ JUL: +5 (prestador de excelência)                   │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dados:**
- De `actor_score_history`
- Agregado por mês

---

## 3. BADGES DE CONFIANÇA

### Badges Positivos (conquistáveis)

| Badge | Critério | Visual |
|-------|----------|--------|
| **Estreante Promissor** | 3 eventos com 100% check-in | ⭐ |
| **Colaborador Confiável** | 10 serviços sem reclamação | 🛡️ |
| **Organizador de Sucesso** | 5 eventos sem cancelamento | 🎯 |
| **Impactador Local** | R$1.000+ para comunidade | 💚 |
| **Membro Veterano** | 1 ano + score >80 | 🏆 |
| **Zero Faltas** | 20 eventos, 100% presença | ✨ |

### Badges de Alerta (temporários)

| Badge | Critério | Visual |
|-------|----------|--------|
| **Em Observação** | Score entre 40-59 | ⚠️ |
| **Restrição Ativa** | Penalidade vigente | 🔒 |
| **Débito Pendente** | Valor a pagar | 💸 |

---

## 4. VISIBILIDADE PÚBLICA vs PRIVADA

### Visível para TODOS
- Score atual (número)
- Badges conquistados
- Estatísticas gerais (eventos, check-in rate)
- Tempo na plataforma

### Visível apenas para O PRÓPRIO USUÁRIO
- Histórico financeiro detalhado
- Penalidades históricas
- Débitos
- Evolução do score

### Visível para ORGANIZADORES (ao convidar)
- Score
- Check-in rate
- Histórico de faltas
- Badges

---

## 5. COMPONENTES FRONTEND

```
/frontend/src/components/trust/
├── TrustDashboard.tsx          # Container principal
├── TrustScoreCard.tsx          # Score com barra visual
├── TrustStatsGrid.tsx          # Grid de estatísticas
├── TrustFinancialHistory.tsx   # Histórico financeiro
├── TrustResponsibilityCard.tsx # Responsabilização
├── TrustPenaltiesList.tsx      # Lista de penalidades
├── TrustScoreTimeline.tsx      # Gráfico de evolução
├── TrustBadges.tsx             # Badges conquistados
└── TrustPublicProfile.tsx      # Versão pública (para outros verem)
```

---

## 6. ENDPOINTS NECESSÁRIOS

```typescript
// Score e estatísticas
GET /api/trust/me
GET /api/trust/actor/:actorId  // Versão pública

// Histórico
GET /api/trust/me/history
GET /api/trust/me/timeline

// Penalidades
GET /api/trust/me/penalties

// Responsabilização
GET /api/trust/me/responsibility

// Badges
GET /api/trust/me/badges
```

---

## 7. REGRAS DE NEGÓCIO

### Score inicial
- Novo usuário: 80 pontos
- Nova page: 80 pontos
- Novo group: 80 pontos

### Decay (decaimento)
- Score não decai automaticamente
- Só muda com ações (positivas ou negativas)

### Recuperação
- Máximo +5 por evento bem-sucedido
- Sem limite de recuperação total
- Histórico de penalidades nunca some (mas expira)

### Transferência
- Score é do ACTOR, não da pessoa física
- Se usuário criar Page, Page começa com 80
- Score de Page e User são independentes

---

## 8. INTEGRAÇÃO COM OUTROS MÓDULOS

| Módulo | Usa score para |
|--------|----------------|
| **Feed** | Priorizar atores confiáveis |
| **Eventos** | Permitir/bloquear criação |
| **Serviços** | Destacar prestadores |
| **Convites** | Filtrar quem pode ser convidado |
| **Pagamentos** | Delay para score baixo |

---

## ✅ CONCLUSÃO

O Dashboard de Confiança transforma o UnifiCard em algo único:

> **Reputação baseada em comportamento real, não em opinião.**

- Você não "avalia" com 5 estrelas
- O sistema **mede** se você cumpriu ou não
- Isso cria confiança real, não simulada

---

*Spec derivada do CONTRATO_EVENTOS_V1.3.md*

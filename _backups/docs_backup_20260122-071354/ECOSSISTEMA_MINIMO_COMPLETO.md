# 🌐 ECOSSISTEMA MÍNIMO COMPLETO — UnifiCard

> **Pergunta-chave:** Qual é o menor ecossistema onde TUDO conversa com TUDO?

---

## 🧬 A ANATOMIA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIFICARD ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   🧠 SISTEMA NERVOSO          💰 SISTEMA CIRCULATÓRIO           │
│   ┌─────────────────┐        ┌─────────────────┐               │
│   │   REDE SOCIAL   │◄──────►│   UNIFYBANK     │               │
│   │   (Hub Central) │        │   (Invisível)   │               │
│   └────────┬────────┘        └────────┬────────┘               │
│            │                          │                         │
│            ▼                          ▼                         │
│   ┌─────────────────┐        ┌─────────────────┐               │
│   │   SERVIÇOS      │◄──────►│   SPLIT ENGINE  │               │
│   │   (Trabalho)    │        │   (70/15/10/5)  │               │
│   └────────┬────────┘        └────────┬────────┘               │
│            │                          │                         │
│            ▼                          ▼                         │
│   ┌─────────────────┐        ┌─────────────────┐               │
│   │   EVENTOS       │◄──────►│   IMPACTO       │               │
│   │   (Cultura)     │        │   (Visível)     │               │
│   └─────────────────┘        └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ O QUE ENTRA (Ecossistema Mínimo)

### 1. 🧠 REDE SOCIAL — Sistema Nervoso
**Status atual: 95% pronto**

| Componente | Status | Ciclo Fechado? |
|------------|--------|----------------|
| Feed como HUB central | ✅ | ✅ |
| Criar post (8 intents) | ✅ | ✅ |
| Reações + Comentários | ✅ | ✅ |
| CTA (booking, service, payment) | ✅ | ✅ |
| Actor (pessoa OU empresa) | ✅ | ✅ |
| Ledger Social (impacto visível) | ✅ | ✅ |

**O que falta para fechar:**
- [ ] Sidebar direita funcional (Saldo + Comunidades + Economia Local) — **4h**
- [ ] Badges de novidade no menu — **2h**

---

### 2. 💰 UNIFYBANK — Sistema Circulatório
**Status atual: 90% pronto**

| Componente | Status | Ciclo Fechado? |
|------------|--------|----------------|
| Saldo em Unify (moeda interna) | ✅ | ✅ |
| Split Engine (70/15/10/5) | ✅ | ✅ Automático |
| Transações | ✅ | ✅ |
| Doações para grupos | ✅ | ✅ |
| Transparência pública | ✅ | ✅ |
| Fundo Regional + Governança | ✅ | ✅ |

**O que falta para fechar:**
- [ ] Visualização de "para onde foi meu dinheiro" no post de compra — **4h**
- [ ] Mini-resumo de impacto após transação — **2h**

**Ciclo completo funciona:**
```
Usuário paga R$100 → Split automático:
├── R$70 → Prestador/Organizador
├── R$15 → Tenant (cidade)
├── R$10 → Região
└── R$5 → Grupo social do usuário
```

---

### 3. 🛠️ SERVIÇOS — O Trabalho
**Status atual: 60% pronto (backend 100%, frontend 60%)**

| Componente | Backend | Frontend | Ciclo Fechado? |
|------------|---------|----------|----------------|
| Oferta de serviço (via post) | ✅ | ✅ intent: service_offer | ✅ |
| CTA de booking | ✅ | ✅ CTAModal | ✅ |
| Skills no perfil | ✅ | ✅ | ✅ |
| Listagem de serviços | ✅ | ❌ | ❌ |
| Candidatura a trabalho | ✅ | ❌ | ❌ |

**O que falta para fechar o ciclo mínimo:**
- [ ] **Tela de "Serviços Disponíveis"** (listagem simples) — **8h**
- [ ] **Card de serviço no feed** (já existe como intent, precisa visual melhor) — **4h**

**Ciclo mínimo funciona:**
```
Prestador cria post "service_offer" → Aparece no feed
→ Interessado clica CTA → Booking confirmado
→ Pagamento via Unify → Split automático
→ Impacto registrado no ledger
```

---

### 4. 🎭 EVENTOS CULTURAIS — A Cultura
**Status atual: 85% pronto**

| Componente | Status | Ciclo Fechado? |
|------------|--------|----------------|
| Perfil de Atuação Cultural (PAC) | ✅ | ✅ |
| Criar evento (DRAFT → PUBLISHED → CONFIRMED) | ✅ | ✅ |
| Evento no feed | ✅ CulturalEventCard | ✅ |
| Check-in (QR + Manual) | ✅ | ✅ |
| Revenue split para artistas | ✅ | ✅ |
| Checkout de ingresso | ⚠️ Backend OK | ❌ Frontend |

**O que falta para fechar:**
- [ ] **Tela de compra de ingresso** (flow checkout) — **8h**
- [ ] Confirmação visual pós-compra — **2h**

**Ciclo mínimo funciona:**
```
Artista cria evento → Aparece no feed
→ Usuário faz check-in → Impacto gerado
→ Se pago: Split para artista + venue + fundo
```

---

### 5. 🏢 EMPRESAS — Atores do Ecossistema
**Status atual: 90% pronto**

| Componente | Status | Ciclo Fechado? |
|------------|--------|----------------|
| Criar empresa | ✅ | ✅ |
| Validação (PROVISIONAL → VERIFIED) | ✅ | ✅ |
| Postar como empresa | ✅ ActorSelector | ✅ |
| Oferecer serviço como empresa | ✅ | ✅ |

**Ciclo completo funciona:**
```
Usuário cria empresa → Status PROVISIONAL
→ Pode postar como empresa (badge visual)
→ Pode oferecer serviços
→ Recebe pagamentos via split
```

---

### 6. 📊 IMPACTO — Visibilidade da Economia
**Status atual: 90% pronto**

| Componente | Status | Ciclo Fechado? |
|------------|--------|----------------|
| Ledger Social pessoal | ✅ | ✅ |
| Resumo de impacto | ✅ | ✅ |
| Impacto por grupo | ✅ | ✅ |
| Dashboard de transparência | ✅ | ✅ |
| Fundo Regional público | ✅ | ✅ |

**Ciclo completo funciona:**
```
Qualquer transação → Impacto calculado
→ Visível no ledger pessoal
→ Acumulado no grupo do usuário
→ Dashboard público mostra economia total
```

---

## 🔒 O QUE FICA LATENTE (Pronto, mas não exposto)

### 🚗 DRIVER (Rides) — 411KB de código
**Decisão: LATENTE**

O módulo existe completo no backend, mas:
- Zero frontend
- Não fecha ciclo com o ecossistema atual
- 80-120h de trabalho para ativar

**Quando ativar:** Quando a economia do ecossistema já estiver circulando e houver demanda real por mobilidade integrada.

---

### ⚡ WORK INSTANT — 91KB de código
**Decisão: LATENTE**

Serviços sob demanda com matching em tempo real. Mas:
- Zero frontend
- Depende de massa crítica de prestadores
- 40-60h de trabalho para ativar

**Quando ativar:** Após Serviços básicos estarem rodando com volume.

---

### 🛒 MARKETPLACE (Mercado & Shop)
**Decisão: SIMPLIFICADO**

O marketplace full-featured fica latente. O que entra agora:
- Posts com intent `product_offer` (já funciona)
- CTA de compra simples
- Sem carrinho, sem estoque, sem logística

**Quando expandir:** Quando houver demanda por vendas recorrentes.

---

### 👥 GRUPOS — Funcional Básico
**Decisão: MÍNIMO**

O que entra:
- Criar grupo
- Listar grupos
- Impacto acumulado do grupo

O que fica latente:
- Feed próprio do grupo
- Moderação avançada
- Convites

---

## 🔄 OS 5 CICLOS FECHADOS DO ECOSSISTEMA MÍNIMO

### Ciclo 1: EXPRESSÃO
```
Pessoa → Cria post → Aparece no feed → Reação/Comentário
```
✅ **100% FUNCIONANDO**

---

### Ciclo 2: SERVIÇO
```
Prestador → Post service_offer → CTA booking 
→ Pagamento Unify → Split automático → Impacto registrado
```
✅ **90% FUNCIONANDO** (falta visual de serviços)

---

### Ciclo 3: EVENTO
```
Artista → Cria evento → Publica → Aparece no feed
→ Check-in → Impacto gerado → (ou) Compra ingresso → Split
```
⚠️ **85% FUNCIONANDO** (falta checkout de ingresso)

---

### Ciclo 4: EMPRESA
```
Pessoa → Cria empresa → Status PROVISIONAL
→ Posta como empresa → Oferece serviço → Recebe pagamento
```
✅ **100% FUNCIONANDO**

---

### Ciclo 5: IMPACTO
```
Qualquer transação → Split automático → Ledger atualizado
→ Grupo beneficiado → Dashboard público → Fundo Regional
```
✅ **100% FUNCIONANDO**

---

## 📋 CHECKLIST PARA ECOSSISTEMA MÍNIMO COMPLETO

### Trabalho Restante (estimativa total: ~40h)

#### Social (6h)
- [ ] Sidebar direita com Saldo + Comunidades — 4h
- [ ] Badges de novidade no menu — 2h

#### Serviços (12h)
- [ ] Tela "Serviços Disponíveis" — 8h
- [ ] Card de serviço visual melhorado — 4h

#### Eventos (10h)
- [ ] Flow de checkout de ingresso — 8h
- [ ] Confirmação visual pós-compra — 2h

#### Economia (6h)
- [ ] "Para onde foi meu dinheiro" no post — 4h
- [ ] Mini-resumo de impacto após transação — 2h

#### Polish Geral (6h)
- [ ] Consistência visual entre cards
- [ ] Loading states
- [ ] Empty states

---

## 🎯 O MOMENTO "UAU"

O ecossistema está pronto para causar o "UAU" quando:

1. **Uma pessoa no feed vê:**
   - Post de amigo
   - Oferta de serviço
   - Evento cultural
   - Promoção de loja
   - Resultado de votação
   - **Tudo no mesmo lugar**

2. **Uma pessoa faz uma compra e vê:**
   - "R$70 foi para o organizador"
   - "R$15 foi para Curitiba"
   - "R$5 foi para o grupo Empreendedores Locais"
   - **Economia visível**

3. **Uma pessoa abre o Dashboard de Transparência e vê:**
   - Total movimentado na região
   - Quanto foi para fundo regional
   - Projetos financiados
   - **Impacto coletivo**

---

## 🏁 CONCLUSÃO

### O Ecossistema Mínimo Completo é:

| Módulo | Status | Entra? |
|--------|--------|--------|
| Rede Social | 95% | ✅ HUB CENTRAL |
| UnifyBank | 90% | ✅ INVISÍVEL |
| Serviços | 60% | ✅ SIMPLIFICADO |
| Eventos Culturais | 85% | ✅ COMPLETO |
| Empresas | 90% | ✅ COMPLETO |
| Impacto | 90% | ✅ VISÍVEL |
| Votações | 85% | ✅ VIA FEED |
| Driver | 40% | 🔒 LATENTE |
| Work Instant | 35% | 🔒 LATENTE |
| Marketplace Full | 50% | 🔒 LATENTE |

### Trabalho restante: ~40 horas
### Módulos ativos: 7 de 10
### Código latente preservado: ~500KB (Driver + Work Instant)

---

## 📌 FRASE FINAL

> **UnifiCard não lança features.**
> **UnifiCard liga um ecossistema.**

Quando os 5 ciclos fechados estiverem funcionando, você não tem um app.
Você tem uma **economia local digital**.

---

*Documento gerado em 26/12/2025*
*Baseado em auditoria técnica + visão estratégica*

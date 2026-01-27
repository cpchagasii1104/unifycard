# 🧭 REGULAMENTO DE EXECUÇÃO — UnifiCard

> **Este documento é a BÚSSOLA do projeto.**
> **Qualquer AI, desenvolvedor ou colaborador DEVE ler antes de codar.**

---

## 📜 DECLARAÇÃO DE PROPÓSITO

O UnifiCard é uma **infraestrutura social-econômica** composta por módulos que se conectam a um **CORE central**. 

**Regra de ouro:**
> Nenhum módulo existe sozinho. Todo código deve fortalecer o CORE ou ser rejeitado.

---

## 🏗️ ARQUITETURA DO SISTEMA

```
                    ┌─────────────────────────────────────┐
                    │           APLICAÇÃO                 │
                    │   (Frontend React + Componentes)    │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                         🔷 CORE (Núcleo Central)                     │
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│   │   IDENTITY  │  │   ECONOMY   │  │    FEED     │  │  ACTORS   │  │
│   │  (Quem é)   │  │ (Dinheiro)  │  │  (O que     │  │ (User/    │  │
│   │             │  │             │  │  acontece)  │  │  Page)    │  │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│          │                │                │               │        │
│          └────────────────┴────────────────┴───────────────┘        │
│                                   │                                  │
│                          ┌───────┴───────┐                          │
│                          │  SPLIT ENGINE │                          │
│                          │  (70/15/10/5) │                          │
│                          └───────────────┘                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │  SOCIAL   │  │  EVENTS   │  │  WORK     │
             │  (Posts)  │  │ (Cultura) │  │(Serviços) │
             └───────────┘  └───────────┘  └───────────┘
                    │              │              │
                    └──────────────┴──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │  GROUPS   │  │  VOTES    │  │ COMPANIES │
             └───────────┘  └───────────┘  └───────────┘
                                   │
                          ┌────────┴────────┐
                          │    LATENTES     │
                          │  (Não ativar)   │
                          │                 │
                          │  🔒 Driver      │
                          │  🔒 Work Instant│
                          │  🔒 Marketplace │
                          └─────────────────┘
```

---

## 🔷 O CORE — Definição Técnica

O CORE é composto por **4 pilares obrigatórios** que TODO módulo deve usar:

### 1. IDENTITY (Quem é)
```
Localização: backend/src/core/identity/
Responsabilidade: 
  - global_user_id (identidade única)
  - Autenticação
  - Sessão
  - Tenant (multi-cidade)
```

### 2. ECONOMY (Dinheiro)
```
Localização: backend/src/core/economy/ + backend/src/core/unifybank/
Responsabilidade:
  - Contas (account)
  - Transações (transaction)
  - Split Engine (70/15/10/5)
  - Ledger
  - Fundo Regional
```

### 3. FEED (O que acontece)
```
Localização: backend/src/core/feed/ + backend/src/services/feed/
Responsabilidade:
  - Feed unificado
  - Eventos do sistema
  - Ordenação/priorização
```

### 4. ACTORS (Quem age)
```
Localização: backend/src/modules/social/actor.repository.ts
Responsabilidade:
  - Actor = User OU Page (empresa)
  - Toda ação tem um actor
  - Todo post tem um actor
  - Todo pagamento tem um actor
```

---

## ⚖️ REGRAS DE GOVERNANÇA DO CÓDIGO

### REGRA 1: Todo módulo DEVE usar o CORE
```typescript
// ✅ CORRETO
import { getGlobalUserId } from '@core/identity';
import { createTransaction } from '@core/economy';
import { publishToFeed } from '@core/feed';

// ❌ ERRADO - Criar lógica própria de economia
const balance = await db.query('SELECT balance FROM my_custom_table');
```

### REGRA 2: Todo pagamento DEVE passar pelo Split Engine
```typescript
// ✅ CORRETO
await splitEngine.processPayment({
  amount_cents: 10000,
  payer_id: userId,
  recipient_id: organizerId,
  // Split automático: 70/15/10/5
});

// ❌ ERRADO - Transferência direta
await db.query('UPDATE accounts SET balance = balance + 10000');
```

### REGRA 3: Toda ação pública DEVE aparecer no Feed
```typescript
// ✅ CORRETO
await createPost({
  actor_id: actorId,
  intent: 'service_offer',
  content: 'Ofereço serviço X',
});
// Automaticamente aparece no feed

// ❌ ERRADO - Criar serviço sem visibilidade
await db.insert('services', { ... }); // Invisível no ecossistema
```

### REGRA 4: Módulos LATENTES não devem ser tocados
```
🔒 PROIBIDO modificar até nova ordem:
- backend/src/modules/rides/ (Driver)
- backend/src/modules/work-instant/
- Qualquer "marketplace full"

Se precisar de algo desses módulos, PERGUNTE PRIMEIRO.
```

### REGRA 5: Consistência de nomenclatura
```typescript
// Padrão de IDs
global_user_id    // Usuário global
actor_id          // User ou Page agindo
tenant_id         // Cidade/região
company_id        // Empresa

// Padrão de valores monetários
*_cents           // Sempre em centavos (integer)
// Nunca: *_value, *_amount sem sufixo

// Padrão de status
'DRAFT' | 'PUBLISHED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
```

---

## 📋 PLANO DE EXECUÇÃO LINEAR

### ⚠️ ORDEM OBRIGATÓRIA — Não pular etapas

```
BLOCO 1 ──► BLOCO 2 ──► BLOCO 3 ──► BLOCO 4 ──► VALIDAÇÃO
   │            │            │            │           │
   ▼            ▼            ▼            ▼           ▼
 Social      Serviços     Eventos     Economia    Testes
 como Hub    Completos    Checkout    Visível     E2E
```

---

## 📦 BLOCO 1: SOCIAL COMO HUB (Prioridade Máxima)

**Objetivo:** O feed é o centro de TUDO. Usuário abre o app → vê o mundo acontecendo.

### Task 1.1: Sidebar Direita Funcional
```
Arquivo: frontend/src/components/social/SocialFeed2.tsx
Seção: aside.feed-sidebar-right

Deve conter:
┌─────────────────────┐
│ Meu Saldo Disponível│
│ R$ 98,32            │
│ Status: Ativo       │
├─────────────────────┤
│ Sugestões Comunidade│
│ • Sítio Cercado     │
│ • Empreendedores    │
├─────────────────────┤
│ Economia Local      │
│ Fundo Regional      │
│ R$ 7.500,00         │
│ [Visitar loja]      │
└─────────────────────┘

Conexões com CORE:
- Saldo: GET /economy/accounts/me
- Comunidades: GET /social/groups/suggestions
- Fundo: GET /fund/dashboard
```

### Task 1.2: Badges de Novidade no Menu
```
Arquivo: frontend/src/components/layout/SocialLayout.tsx

Implementar:
- Badge numérico em "Feed" (posts não lidos)
- Badge numérico em "Grupos" (novos membros)
- Badge numérico em "Eventos" (próximos eventos)
- Badge numérico em "Serviços" (novas ofertas)

Conexão com CORE:
- GET /social/unread-counts
```

### Task 1.3: Consistência Visual dos Cards
```
Arquivos:
- frontend/src/components/social/PostCard.tsx
- frontend/src/components/social/CulturalEventCard.tsx
- frontend/src/components/events/EventCard.tsx

Padronizar:
- Mesmo border-radius
- Mesma shadow
- Mesmo padding
- Badge de tipo visível (👤 Pessoa, 🛠️ Serviço, 🎭 Evento, etc.)
```

### ✅ Checklist Bloco 1
- [ ] Sidebar direita mostra saldo real
- [ ] Sidebar direita mostra sugestões de comunidades
- [ ] Sidebar direita mostra economia local
- [ ] Menu tem badges de novidade
- [ ] Cards têm visual consistente
- [ ] Badges de tipo são visíveis

**Critério de conclusão:** Usuário abre /social e vê um ecossistema vivo, não uma rede social comum.

---

## 📦 BLOCO 2: SERVIÇOS COMPLETOS

**Objetivo:** Fluxo completo de oferta → contratação → pagamento → impacto.

### Task 2.1: Tela "Serviços Disponíveis"
```
Criar: frontend/src/pages/ServicosPage.tsx
Rota: /servicos

Layout:
┌─────────────────────────────────────────┐
│ 🛠️ Serviços Disponíveis                 │
├─────────────────────────────────────────┤
│ [Filtros: Categoria | Localização]      │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Serviço │ │ Serviço │ │ Serviço │    │
│ │ Card 1  │ │ Card 2  │ │ Card 3  │    │
│ └─────────┘ └─────────┘ └─────────┘    │
└─────────────────────────────────────────┘

API: GET /social/feed?intent=service_offer
```

### Task 2.2: Card de Serviço Destacado
```
Arquivo: frontend/src/components/social/ServiceOfferCard.tsx (criar)

Deve mostrar:
- Avatar + Nome do prestador
- Título do serviço
- Preço (se houver)
- Badge: 🛠️ Serviço
- CTA: [Contratar] ou [Ver mais]

Diferencial visual: Borda azul ou ícone destacado
```

### Task 2.3: Flow de Contratação
```
Fluxo:
1. Usuário clica [Contratar]
2. Abre modal de confirmação (CTAModal existente)
3. Confirma → Cria transação via CORE
4. Split automático acontece
5. Toast: "Serviço contratado! R$X foi para o prestador, R$Y para sua comunidade"

Conexão com CORE:
- POST /social/cta/{cta_id}/confirm
- Internamente chama splitEngine.processPayment()
```

### ✅ Checklist Bloco 2
- [ ] Rota /servicos existe e lista serviços
- [ ] ServiceOfferCard tem visual diferenciado
- [ ] CTA de contratação funciona
- [ ] Pagamento passa pelo Split Engine
- [ ] Impacto é registrado no ledger
- [ ] Toast mostra distribuição do valor

**Critério de conclusão:** Usuário consegue contratar serviço e ver para onde foi o dinheiro.

---

## 📦 BLOCO 3: EVENTOS COM CHECKOUT

**Objetivo:** Evento cultural com venda de ingresso integrada.

### Task 3.1: Tela de Checkout de Ingresso
```
Criar: frontend/src/components/events/EventCheckout.tsx

Fluxo:
1. Usuário clica [Comprar Ingresso] no CulturalEventCard
2. Abre modal/página de checkout
3. Mostra: Evento, Data, Preço, Distribuição prévia
4. Confirma → Pagamento via CORE
5. Gera "ticket" (registro em event_attendees)

Layout do checkout:
┌─────────────────────────────────────────┐
│ 🎭 Show do Artista X                    │
│ 📅 27/12/2025 às 20h                    │
│ 📍 Bar do João                          │
├─────────────────────────────────────────┤
│ Ingresso: R$ 50,00                      │
├─────────────────────────────────────────┤
│ Distribuição:                           │
│ • R$ 35,00 → Artista                    │
│ • R$ 7,50 → Curitiba                    │
│ • R$ 5,00 → Região Sul                  │
│ • R$ 2,50 → Seu grupo                   │
├─────────────────────────────────────────┤
│ [Cancelar]          [Confirmar Compra]  │
└─────────────────────────────────────────┘
```

### Task 3.2: Confirmação Pós-Compra
```
Após pagamento, mostrar:
┌─────────────────────────────────────────┐
│ ✅ Ingresso Confirmado!                 │
│                                         │
│ 🎭 Show do Artista X                    │
│ 📅 27/12/2025 às 20h                    │
│                                         │
│ Seu impacto:                            │
│ R$ 2,50 foi para Empreendedores Locais  │
│                                         │
│ [Ver no Ledger] [Voltar ao Feed]        │
└─────────────────────────────────────────┘
```

### Task 3.3: Check-in no Evento
```
Já existe: frontend/src/api/cultural.ts → checkInToEvent()

Garantir que:
- QR Code funciona
- Check-in manual funciona
- Impacto é gerado no check-in
- Ledger é atualizado
```

### ✅ Checklist Bloco 3
- [ ] Modal/página de checkout existe
- [ ] Mostra preview da distribuição antes de pagar
- [ ] Pagamento passa pelo Split Engine
- [ ] Confirmação mostra impacto gerado
- [ ] Check-in funciona (QR + Manual)
- [ ] Ledger reflete a compra

**Critério de conclusão:** Usuário compra ingresso e entende exatamente para onde foi cada centavo.

---

## 📦 BLOCO 4: ECONOMIA VISÍVEL

**Objetivo:** Cada transação conta uma história de impacto.

### Task 4.1: "Para onde foi meu dinheiro" nos Posts
```
Quando post tem transação associada, mostrar:

┌─────────────────────────────────────────┐
│ 👤 Clayton contratou serviço de Maria   │
│ "Consultoria de marketing"              │
├─────────────────────────────────────────┤
│ 💰 Impacto desta transação:             │
│ ├── R$ 70,00 → Maria                    │
│ ├── R$ 15,00 → Curitiba                 │
│ ├── R$ 10,00 → Região Sul               │
│ └── R$ 5,00 → Empreendedores Locais     │
└─────────────────────────────────────────┘

Componente: frontend/src/components/social/TransactionImpact.tsx (criar)
```

### Task 4.2: Mini-resumo Após Transações
```
Toast/Modal após qualquer pagamento:

"Pronto! Você movimentou R$ 100,00 na economia local.
R$ 5,00 foi para o grupo Empreendedores Locais."

[Ver detalhes no Ledger]
```

### Task 4.3: Dashboard de Transparência Acessível
```
Garantir que existe link fácil para:
- /transparency → Dashboard público
- Mostra total movimentado
- Mostra fundo regional
- Mostra projetos financiados
```

### ✅ Checklist Bloco 4
- [ ] Posts com transação mostram distribuição
- [ ] Toast após pagamento mostra impacto
- [ ] Link para transparência é visível
- [ ] Ledger pessoal está acessível
- [ ] Dashboard público funciona

**Critério de conclusão:** Usuário SENTE que cada real que gasta faz diferença.

---

## 🔒 MÓDULOS LATENTES — NÃO TOCAR

### Driver (Rides) — 411KB
```
Status: 🔒 LATENTE
Localização: backend/src/modules/rides/
Razão: Zero frontend, não fecha ciclo com ecossistema atual
Quando ativar: Após economia circulando com volume
```

### Work Instant — 91KB
```
Status: 🔒 LATENTE
Localização: backend/src/modules/work-instant/
Razão: Zero frontend, depende de massa crítica
Quando ativar: Após Serviços básicos com adoção
```

### Marketplace Full
```
Status: 🔒 LATENTE
O que entra agora: Posts com intent product_offer (simples)
O que fica fora: Carrinho, estoque, logística, loja virtual
Quando expandir: Demanda por vendas recorrentes
```

---

## 🧪 VALIDAÇÃO FINAL

### Teste do Ecossistema Completo

Antes de considerar "pronto", executar este roteiro:

```
1. CRIAR CONTA
   - [ ] Registro funciona
   - [ ] Login funciona
   - [ ] Perfil básico preenchido

2. CRIAR EMPRESA
   - [ ] Empresa criada com status PROVISIONAL
   - [ ] Pode alternar para postar como empresa

3. OFERECER SERVIÇO
   - [ ] Post com intent service_offer criado
   - [ ] Aparece no feed
   - [ ] Aparece em /servicos

4. CONTRATAR SERVIÇO
   - [ ] CTA funciona
   - [ ] Pagamento processado
   - [ ] Split acontece (verificar no banco)
   - [ ] Impacto no ledger

5. CRIAR EVENTO
   - [ ] PAC criado
   - [ ] Evento criado e publicado
   - [ ] Aparece no feed

6. COMPRAR INGRESSO
   - [ ] Checkout funciona
   - [ ] Pagamento processado
   - [ ] Split para artista/venue
   - [ ] Confirmação com impacto

7. CHECK-IN
   - [ ] QR Code gerado
   - [ ] Check-in realizado
   - [ ] Impacto registrado

8. VERIFICAR ECONOMIA
   - [ ] Ledger pessoal correto
   - [ ] Dashboard transparência atualizado
   - [ ] Fundo regional recebeu %
```

---

## 📊 MÉTRICAS DE PROGRESSO

### Estado Atual (26/12/2025)

| Bloco | Status | % |
|-------|--------|---|
| Bloco 1: Social Hub | 🟡 Em progresso | 70% |
| Bloco 2: Serviços | 🟡 Em progresso | 50% |
| Bloco 3: Eventos Checkout | 🔴 Não iniciado | 20% |
| Bloco 4: Economia Visível | 🔴 Não iniciado | 30% |

### Meta
```
Bloco 1: Concluir até XX/XX/2025
Bloco 2: Concluir até XX/XX/2025
Bloco 3: Concluir até XX/XX/2025
Bloco 4: Concluir até XX/XX/2025
Validação: Concluir até XX/XX/2025
```

---

## 📝 TEMPLATE PARA TASKS

Ao criar task para o Cursor, use este formato:

```markdown
## Task: [Nome da Task]

### Contexto
[Por que isso é necessário]

### Arquivos Envolvidos
- frontend/src/...
- backend/src/...

### Conexão com CORE
- Usa: [qual parte do CORE]
- API: [endpoint]

### Critério de Aceite
- [ ] [Condição 1]
- [ ] [Condição 2]

### NÃO FAZER
- [O que evitar]
```

---

## 🚨 ALERTAS PARA O CURSOR/AI

```
⚠️ SEMPRE verificar antes de codar:

1. Este código usa o CORE ou cria lógica própria?
   → Se cria lógica própria de economia/identity → PARAR e perguntar

2. Este módulo está na lista de LATENTES?
   → Se sim → PARAR e perguntar

3. Este pagamento passa pelo Split Engine?
   → Se não → REFATORAR para usar

4. Esta ação aparece no Feed?
   → Se deveria aparecer e não aparece → Adicionar

5. Estou seguindo a ordem dos blocos?
   → Se pulando blocos → PARAR e perguntar
```

---

## 🏁 DECLARAÇÃO DE CONCLUSÃO

O Ecossistema Mínimo Completo está PRONTO quando:

1. ✅ Os 4 blocos estão concluídos
2. ✅ O roteiro de validação passa 100%
3. ✅ Nenhum módulo latente foi ativado sem autorização
4. ✅ Todo pagamento passa pelo Split Engine
5. ✅ O feed mostra o ecossistema vivo

Quando isso acontecer:
> **UnifiCard não é mais um projeto.**
> **É uma economia local digital funcionando.**

---

*Documento criado em 26/12/2025*
*Versão: 1.0*
*Este documento é a ÚNICA fonte de verdade para execução.*

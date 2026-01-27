# 🤖 BRIEFING COMPLETO — UnifiCard

> **Documento para contextualização de AI assistente**
> Cole este documento inteiro no início da conversa com outra AI para dar contexto completo do projeto.

---

## 1. O QUE É O UNIFICARD

O UnifiCard é uma **infraestrutura social-econômica digital** — não é um app comum. É uma plataforma multi-tenant que integra:

- **Rede Social** (Feed como hub central)
- **Banco Digital** (UnifyBank)
- **Eventos Culturais** (com ingressos e check-in)
- **Serviços** (marketplace de profissionais)
- **Grupos/Comunidades**
- **Sistema de Votação**
- **Economia Circular** com Split Engine (70/15/10/5)

### Diferencial Principal
Cada transação no sistema **redistribui valor automaticamente**:
- 70% → Prestador/Organizador
- 15% → Cidade/Tenant
- 10% → Região
- 5% → Grupo/Comunidade do usuário

Isso cria uma **economia local digital** onde cada real gasto fortalece a comunidade.

---

## 2. ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                         APLICAÇÃO                               │
│              (Frontend React + TypeScript)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      🔷 CORE (Núcleo Central)                   │
│                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│   │ IDENTITY  │  │  ECONOMY  │  │   FEED    │  │  ACTORS   │   │
│   │ (Quem é)  │  │ (Dinheiro)│  │(Acontece) │  │(User/Page)│   │
│   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
│         └──────────────┴──────────────┴──────────────┘         │
│                              │                                  │
│                    ┌─────────┴─────────┐                       │
│                    │   SPLIT ENGINE    │                       │
│                    │   (70/15/10/5)    │                       │
│                    └───────────────────┘                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
      ┌───────────┐    ┌───────────┐    ┌───────────┐
      │  SOCIAL   │    │  EVENTS   │    │   WORK    │
      │  (Posts)  │    │ (Cultura) │    │(Serviços) │
      └───────────┘    └───────────┘    └───────────┘
            │                 │                 │
            ▼                 ▼                 ▼
      ┌───────────┐    ┌───────────┐    ┌───────────┐
      │  GROUPS   │    │   VOTES   │    │ COMPANIES │
      └───────────┘    └───────────┘    └───────────┘
                              │
                    ┌─────────┴─────────┐
                    │     LATENTES      │
                    │  (Não ativar)     │
                    │                   │
                    │  🔒 Driver/Rides  │
                    │  🔒 Work Instant  │
                    │  🔒 Marketplace   │
                    └───────────────────┘
```

---

## 3. STACK TECNOLÓGICO

### Backend
- **Runtime:** Node.js
- **Framework:** Fastify
- **Linguagem:** TypeScript
- **Database:** PostgreSQL
- **ORM:** SQL direto com pool de conexões
- **Segurança:** Row Level Security (RLS) com 217 policies

### Frontend
- **Framework:** React 18
- **Linguagem:** TypeScript
- **Build:** Vite
- **Estilo:** CSS Modules

### Estrutura do Repositório
```
unificard/
├── backend/           # API Fastify
│   ├── src/
│   │   ├── core/      # Núcleo do sistema
│   │   ├── modules/   # Módulos de negócio
│   │   ├── services/  # Serviços auxiliares
│   │   └── plugins/   # Plugins Fastify
│   └── migrations/    # 89 migrations SQL
├── frontend/          # React SPA
│   └── src/
│       ├── api/       # Chamadas à API
│       ├── components/# Componentes React
│       ├── pages/     # Páginas/Rotas
│       ├── contexts/  # Estado global
│       └── hooks/     # Custom hooks
└── packages/
    └── contracts/     # Tipos compartilhados
```

---

## 4. MÉTRICAS ATUAIS (27/12/2025)

| Métrica | Valor |
|---------|-------|
| Backend - Arquivos TS | 594 |
| Backend - Linhas de código | 101.428 |
| Frontend - Arquivos | 185 |
| Frontend - Linhas de código | 35.145 |
| Migrations SQL | 89 |
| Rotas API Fastify | 465 |
| Políticas RLS | 217 |
| Erros TypeScript (Frontend) | 62 |

---

## 5. REGRAS DE GOVERNANÇA (OBRIGATÓRIAS)

### ✅ REGRA 1: Todo módulo DEVE usar o CORE
```typescript
// ✅ CORRETO
import { getGlobalUserId } from '@core/identity';
import { createTransaction } from '@core/economy';
import { publishToFeed } from '@core/feed';

// ❌ ERRADO - Criar lógica própria
const balance = await db.query('SELECT balance FROM my_custom_table');
```

### ✅ REGRA 2: Todo pagamento DEVE passar pelo Split Engine
```typescript
// ✅ CORRETO
await splitEngineService.applySplits({
  amount_cents: 10000,
  payer_id: userId,
  recipient_id: organizerId,
});

// ❌ ERRADO - Transferência direta
await db.query('UPDATE accounts SET balance = balance + 10000');
```

### ✅ REGRA 3: Toda ação pública DEVE aparecer no Feed
- Posts, serviços, eventos → tudo aparece no feed
- Feed é o HUB de descoberta

### ✅ REGRA 4: Módulos LATENTES não devem ser tocados
- 🔒 `backend/src/modules/rides/` (Driver)
- 🔒 `backend/src/modules/work-instant/`
- Não modificar sem autorização explícita

### ✅ REGRA 5: Consistência de nomenclatura
```typescript
global_user_id    // Usuário global
actor_id          // User ou Page agindo
tenant_id         // Cidade/região
*_cents           // Sempre em centavos (integer)
```

---

## 6. ANTI-PATTERNS (PROIBIDOS)

### ❌ Calcular split no frontend
- Frontend NUNCA calcula percentuais ou distribuição
- Única fonte da verdade: Ledger do backend

### ❌ Simular impacto ou "preview econômico"
- Não mostrar "você vai gerar X de impacto"
- Se não está no ledger, não existe

### ❌ Chamar feed sem activeActor
- Toda chamada social precisa de `actor_id` e `actor_type`
- Usar `validateActiveActor()` sempre

### ❌ Feed quebrar por dados inválidos
- Feed pode estar vazio, mas NUNCA pode quebrar
- Tratar todos os casos de null/undefined

### ❌ Gamificação agressiva
- Sem streaks, rankings ou pressão psicológica
- UnifiCard incentiva, não cobra

---

## 7. ESTADO ATUAL E BLOQUEADORES

### Bloqueadores de Produção 🔴

**1. Erros de @unificard/contracts (10 arquivos)**
- O pacote existe em `packages/contracts/` mas não é resolvido
- Solução: Adicionar `paths` no `tsconfig.json` do frontend

**2. Tipos faltando em componentes críticos:**
- `EventPage.tsx`: `created_at`, `updated_at` não existem em `Event`
- `EventCheckout.tsx`: `success`, `error` não existem em `CheckoutTicketResponse`
- `SocialFeed2.tsx`: 14 erros de tipagem

### Progresso dos Blocos

| Bloco | Status | % |
|-------|--------|---|
| Bloco 1: Social Hub | 🟡 Em progresso | 75% |
| Bloco 2: Serviços | 🟡 Em progresso | 60% |
| Bloco 3: Eventos Checkout | 🟡 Em progresso | 50% |
| Bloco 4: Economia Visível | 🟡 Em progresso | 40% |

---

## 8. ARQUIVOS CRÍTICOS

### Backend
- `backend/src/core/economy/split.service.ts` - Split Engine principal
- `backend/src/core/unifybank/split-engine.service.ts` - Implementação UnifyBank
- `backend/src/server.ts` - Entry point
- `backend/src/core/auth/` - Autenticação
- `backend/src/modules/social/` - Hub social (256KB)

### Frontend
- `frontend/src/components/social/SocialFeed2.tsx` - Feed principal (HUB)
- `frontend/src/components/events/EventPage.tsx` - Página de eventos
- `frontend/src/components/events/EventCheckout.tsx` - Checkout
- `frontend/src/contexts/SessionProvider.tsx` - Estado de sessão
- `frontend/src/api/` - Todas as chamadas de API

### Documentação de Governança
- `REGULAMENTO_EXECUCAO.md` - Bússola do projeto
- `GOLDEN_PATH.md` - Fluxo crítico que não pode quebrar
- `ANTI_PATTERNS.md` - O que nunca fazer

---

## 9. COMO AJUDAR

### Se for corrigir erros TypeScript:
1. Ler o tipo esperado no erro
2. Verificar a interface no backend ou em `packages/contracts`
3. Ajustar a interface no frontend para corresponder
4. NÃO criar lógica paralela — usar o que já existe

### Se for implementar funcionalidade:
1. Verificar qual BLOCO ela pertence (1, 2, 3 ou 4)
2. Seguir a ordem dos blocos
3. Usar o CORE (identity, economy, feed)
4. Todo pagamento → Split Engine
5. Toda ação pública → Feed

### Se for trabalhar com economia:
1. NUNCA calcular valores no frontend
2. NUNCA manipular balance diretamente
3. SEMPRE usar `splitEngineService`
4. SEMPRE atualizar ledger

---

## 10. CONTEXTO DO DESENVOLVEDOR

**Nome:** Clayton  
**Localização:** Curitiba, Paraná, Brasil  
**Idioma preferido:** Português brasileiro  

**Estilo de trabalho:**
- Prefere soluções arquiteturais sobre fixes temporários
- Valoriza fail-fast e defensive programming
- Trabalha com plano de execução linear (4 blocos)
- Usa Claude e Cursor AI para desenvolvimento

**Projeto relacionado:**
- UnifyWork MVP está 100% completo e pronto para produção

---

## 11. PERGUNTAS FREQUENTES

**P: Posso modificar o módulo de Rides?**
R: NÃO. Está marcado como LATENTE. Pergunte primeiro.

**P: Onde fica a lógica de split?**
R: `backend/src/core/economy/split.service.ts` e `backend/src/core/unifybank/split-engine.service.ts`

**P: Como adicionar uma nova rota?**
R: Criar arquivo `.routes.ts` no módulo apropriado, seguindo padrão Fastify existente.

**P: Frontend pode calcular preview de impacto?**
R: NÃO. Apenas exibir dados vindos do backend/ledger.

**P: O que é actor?**
R: Actor = User OU Page (empresa). Toda ação tem um actor_id e actor_type.

---

*Briefing gerado em 27/12/2025*
*Projeto: UnifiCard v1.0*

# 📝 CHANGELOG RECENTE - UNIFICARD

## FASE 8A — Métricas para Organizadores

### Backend
- ✅ Criado `event-organizer-metrics.service.ts`
- ✅ Rota `GET /api/events/:eventId/organizer-metrics`
- ✅ Verificação de permissões (criador/membro organizador)
- ✅ Insights acionáveis baseados em métricas

### Frontend
- ✅ Componente `OrganizerEventMetrics.tsx`
- ✅ UI simplificada e legível
- ✅ Função `getOrganizerEventMetrics()` em `events.ts`

---

## FASE 9A — Monetização Explícita

### Backend
- ✅ Migration `075_organizer_plans.sql`
- ✅ `organizer-plans.service.ts` — Definição de planos
- ✅ Integração com `FeedPriorityService` (multiplicador por plano)
- ✅ Rotas de planos

### Frontend
- ✅ Componente `OrganizerPlans.tsx`
- ✅ Comparação de planos
- ✅ Exibição de benefícios

### Planos Definidos
- **Free:** 3 eventos/mês, prioridade baixa
- **Basic:** 10 eventos/mês, prioridade normal, insights
- **Pro:** Ilimitado, prioridade alta, métricas avançadas
- **Enterprise:** Ilimitado, prioridade premium, suporte dedicado

---

## FASE 10A — Billing Real

### Backend
- ✅ Migration `076_organizer_subscriptions.sql`
- ✅ `organizer-billing.service.ts` — Gerenciamento completo
- ✅ Job `subscription-expiration.job.ts` — Expiração automática
- ✅ Rotas de assinatura (criar, buscar, cancelar)

### Funcionalidades
- ✅ Assinaturas recorrentes (mensais)
- ✅ Renovação automática
- ✅ Cancelamento (imediato ou no fim do período)
- ✅ Downgrade automático para free quando expira

---

## FASE 11A — Gateway Stripe

### Backend
- ✅ `stripe.service.ts` — Integração Stripe SDK
- ✅ Rota de checkout `POST /api/events/organizers/:id/subscribe/stripe`
- ✅ Webhook handler `POST /api/events/organizers/webhooks/stripe`
- ✅ Suspensão automática em falha de pagamento

### Webhooks Implementados
- ✅ `invoice.payment_succeeded` → Renova
- ✅ `invoice.payment_failed` → Marca `past_due` e faz downgrade
- ✅ `customer.subscription.deleted` → Cancela
- ✅ `customer.subscription.updated` → Atualiza período

### Dependências
- ✅ `stripe` package instalado

---

## FASE 11C — Produção

### Backend
- ✅ `logger.ts` — Winston estruturado
- ✅ `alert.service.ts` — Sistema de alertas
- ✅ `daily-metrics.service.ts` — Métricas diárias
- ✅ `daily-metrics.routes.ts` — Rotas de dashboard

### Documentação
- ✅ `PRODUCTION_CHECKLIST.md`
- ✅ `GO_LIVE_PILOT.md`
- ✅ `STRIPE_LIVE_SETUP.md`

---

## Go-Live Piloto

### Documentação Criada
- ✅ `GO_LIVE_PILOT.md` — Guia completo
- ✅ `STRIPE_LIVE_SETUP.md` — Setup Stripe
- ✅ `QUICK_START.md` — Quick start
- ✅ `SOLUCAO_RAPIDA.md` — Troubleshooting

### Scripts Criados
- ✅ `INICIAR_BACKEND.bat`
- ✅ `INICIAR_BACKEND.ps1`
- ✅ `REINICIAR_FRONTEND.bat`
- ✅ `backend/diagnostico.ps1`

---

## Correções de Bugs

### TypeScript
- ✅ Corrigido: Declaração duplicada em `event-state.service.ts`

### Frontend
- ✅ Corrigido: Conflito de nomes em `EventCard.tsx`
- ✅ Criado: `frontend/.env.local` com `VITE_API_BASE_URL`

---

## Arquivos Modificados Recentemente

### Backend
- `src/modules/events/event-state.service.ts` (corrigido)
- `src/modules/events/organizers/organizers.routes.ts` (adicionadas rotas)
- `src/services/feed/feed-priority.service.ts` (integração com planos)
- `src/core/dashboard/dashboard.module.ts` (adicionadas rotas de métricas)

### Frontend
- `src/components/events/EventCard.tsx` (corrigido)
- `src/api/events.ts` (adicionadas funções de billing)
- `src/components/social/SocialFeed2.tsx` (já estava usando FeedItem)

### Contracts
- Nenhuma mudança recente (última foi FASE 3B.3)

---

## Estado dos Testes

- ⚠️ Testes automatizados não implementados
- ✅ Testes manuais realizados (billing, webhooks, métricas)
- ✅ Validação de tipos (TypeScript) funcionando

---

## Dependências Adicionadas

### Backend
- `stripe` (v14.x) — Gateway de pagamento

### Frontend
- Nenhuma nova dependência

---

**Última Atualização:** 22/12/2025 20:55



















# ✅ Checklist de Produção - Unificard

## 🔐 Segurança

- [ ] Todas as variáveis sensíveis em `.env` (nunca commitadas)
- [ ] `STRIPE_SECRET_KEY` configurada
- [ ] `STRIPE_WEBHOOK_SECRET` configurada
- [ ] `DATABASE_URL` com SSL habilitado
- [ ] CORS configurado apenas para domínios permitidos
- [ ] Rate limiting ativo
- [ ] Helmet configurado (headers de segurança)

## 💳 Billing

- [ ] Stripe conectado (teste e produção)
- [ ] Webhooks do Stripe configurados
- [ ] Price IDs configurados no `.env`:
  - `STRIPE_PRICE_ID_BASIC`
  - `STRIPE_PRICE_ID_PRO`
  - `STRIPE_PRICE_ID_ENTERPRISE`
- [ ] Job de expiração rodando (cron diário)
- [ ] Testes de webhook realizados

## 📊 Monitoramento

- [ ] Logs estruturados configurados
- [ ] Alertas configurados (email/Slack)
- [ ] Health check endpoint funcionando
- [ ] Métricas de erro sendo coletadas

## 🗄️ Banco de Dados

- [ ] Migrações aplicadas
- [ ] Backup automático configurado
- [ ] RLS (Row Level Security) ativo
- [ ] Índices criados e otimizados
- [ ] Pool de conexões configurado

## 🚀 Deploy

- [ ] Variáveis de ambiente configuradas no servidor
- [ ] Process manager (PM2/systemd) configurado
- [ ] Auto-restart em caso de crash
- [ ] Porta configurada corretamente
- [ ] SSL/TLS configurado (HTTPS)

## 📧 Notificações

- [ ] Email transacional configurado (opcional)
- [ ] Webhooks de eventos críticos testados

## 🎯 Regras de Negócio: Eventos XL/XXL

### Produção Assistida Obrigatória

- [ ] **Regra implementada**: Eventos XL (801-3000) e XXL (>3000) **NÃO permitem booking direto**
- [ ] **Backend validado**: Endpoints `POST /services/:id/bookings` e `POST /service-bundles/book` bloqueiam XL/XXL
- [ ] **Frontend validado**: Banner de produção assistida exibido em `EventPage` para eventos XL/XXL
- [ ] **RFQ obrigatório**: Usuários são direcionados para criar RFQ ao invés de booking direto
- [ ] **Audit log**: Tentativas bloqueadas são registradas com ação `production_assisted_required`
- [ ] **Modal de compatibilidade**: Bloqueia booking se `requiresProductionAssistance = true`

### Como Validar em Produção

1. Criar evento com `capacityClass = 'XL'` ou `'XXL'`
2. Tentar criar booking direto → Deve retornar `EVENT_REQUIRES_ASSISTED_PRODUCTION`
3. Verificar banner na página do evento
4. Criar RFQ → Deve funcionar normalmente
5. Verificar audit logs para tentativas bloqueadas

### Endpoints Afetados

- `POST /services/:id/bookings` - **Bloqueado** para eventos XL/XXL
- `POST /service-bundles/book` - **Bloqueado** para eventos XL/XXL
- `POST /events/:eventId/rfqs` - **Recomendado** para eventos XL/XXL
- `GET /business-audit-logs?action=production_assisted_required` - Logs de tentativas bloqueadas

## 🔄 Jobs e Cron

- [ ] Job de expiração de assinaturas agendado
- [ ] Job de limpeza de dados antigos (se aplicável)

## 🧪 Testes

- [ ] Testes de integração com Stripe
- [ ] Testes de webhook
- [ ] Testes de downgrade automático
- [ ] Testes de renovação

## 📝 Documentação

- [ ] README atualizado
- [ ] Variáveis de ambiente documentadas
- [ ] Processo de deploy documentado
- [ ] Troubleshooting guide criado

---

**Última atualização:** FASE 11A + 11C
























# 💳 Setup Stripe em Live Mode

## 1. Criar Conta Stripe

1. Acesse [stripe.com](https://stripe.com)
2. Crie conta (ou faça login)
3. Complete verificação (documentos, banco, etc.)

## 2. Ativar Live Mode

1. No dashboard Stripe, clique em "Activate live mode"
2. Confirme que entende as diferenças entre test e live
3. Ative o modo live

## 3. Criar Products e Prices

### Product: Basic Plan

1. Vá em **Products** → **Add product**
2. Nome: `Unificard - Basic`
3. Descrição: `Plano Básico para organizadores ativos`
4. Preço: `R$ 29,90`
5. Frequência: `Monthly` (recorrente)
6. Copie o **Price ID** (ex: `price_xxx`)

### Product: Pro Plan

1. **Add product**
2. Nome: `Unificard - Pro`
3. Descrição: `Plano Profissional para quem quer crescer`
4. Preço: `R$ 99,90`
5. Frequência: `Monthly`
6. Copie o **Price ID**

### Product: Enterprise Plan

1. **Add product**
2. Nome: `Unificard - Enterprise`
3. Descrição: `Solução completa para grandes organizadores`
4. Preço: `Custom` (sob consulta)
5. Frequência: `Monthly`
6. Copie o **Price ID**

## 4. Configurar Webhook

1. Vá em **Developers** → **Webhooks**
2. Clique em **Add endpoint**
3. Endpoint URL: `https://app.unificard.com/api/events/organizers/webhooks/stripe`
4. Eventos para escutar:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Clique em **Add endpoint**
6. Copie o **Signing secret** (ex: `whsec_xxx`)

## 5. Obter API Keys

1. Vá em **Developers** → **API keys**
2. Copie a **Secret key** (ex: `sk_live_xxx`)
3. ⚠️ **NUNCA** compartilhe ou commite essa chave

## 6. Configurar Variáveis de Ambiente

Adicione no `.env` de produção:

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_BASIC=price_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxx
```

## 7. Testar Webhook (Stripe CLI)

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks para local (desenvolvimento)
stripe listen --forward-to localhost:3000/api/events/organizers/webhooks/stripe

# Em produção, use o endpoint real configurado no dashboard
```

## 8. Testar Fluxo Completo

1. Criar organizador
2. Criar assinatura via API
3. Verificar no dashboard Stripe:
   - Customer criado
   - Subscription criada
   - Invoice gerada
4. Simular pagamento bem-sucedido
5. Verificar webhook recebido
6. Verificar assinatura ativa no sistema

## 9. Monitoramento

- **Dashboard Stripe:** Verificar pagamentos, falhas, cancelamentos
- **Logs do sistema:** Verificar processamento de webhooks
- **Alertas:** Configurar notificações para falhas de pagamento

## ⚠️ Segurança

- **NUNCA** commite chaves do Stripe
- Use variáveis de ambiente
- Rotacione chaves periodicamente
- Monitore acesso às chaves

## 🔄 Rollback (se necessário)

Se precisar voltar para test mode:

1. Altere `STRIPE_SECRET_KEY` para chave de teste (`sk_test_xxx`)
2. Atualize webhook endpoint para test mode
3. Teste novamente

---

**Última atualização:** FASE 11A














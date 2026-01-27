# 🚀 Go-Live Piloto - Unificard

## Objetivo

Lançar o Unificard com **2-3 organizadores piloto** para validar:
- Fluxo completo de billing
- Experiência do organizador
- Métricas e dashboards
- Estabilidade operacional

---

## ✅ Pré-requisitos

### 1. Ambiente de Produção

- [ ] Servidor configurado (VPS/Cloud)
- [ ] Domínio configurado (ex: app.unificard.com)
- [ ] SSL/TLS ativo (HTTPS)
- [ ] Banco de dados em produção
- [ ] Variáveis de ambiente configuradas

### 2. Stripe Live Mode

- [ ] Conta Stripe criada e verificada
- [ ] Modo Live ativado
- [ ] Products e Prices criados:
  - Basic: R$ 29,90/mês
  - Pro: R$ 99,90/mês
  - Enterprise: Sob consulta
- [ ] Webhook endpoint configurado:
  - URL: `https://app.unificard.com/api/events/organizers/webhooks/stripe`
  - Eventos: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- [ ] Webhook secret copiado para `STRIPE_WEBHOOK_SECRET`

### 3. Variáveis de Ambiente (Produção)

```env
# Ambiente
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Banco de Dados
DATABASE_URL=postgresql://...
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Stripe (LIVE)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# Segurança
JWT_SECRET=...
CORS_ORIGIN=https://app.unificard.com

# Alertas (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=alerts@unificard.com
```

### 4. Monitoramento

- [ ] Logs estruturados ativos
- [ ] Alertas configurados (Slack/Email)
- [ ] Health check endpoint testado
- [ ] Job de expiração agendado (cron diário)

---

## 📋 Checklist de Go-Live

### Dia -7 (Uma semana antes)

- [ ] Migrações aplicadas em produção
- [ ] Testes de integração com Stripe (test mode)
- [ ] Backup automático configurado
- [ ] Documentação de rollback preparada

### Dia -3 (Três dias antes)

- [ ] Stripe em Live Mode configurado
- [ ] Webhook testado com Stripe CLI
- [ ] Organizadores piloto identificados
- [ ] Processo de onboarding documentado

### Dia -1 (Um dia antes)

- [ ] Teste completo de fluxo:
  - Criar organizador
  - Assinar plano
  - Criar evento
  - Ver métricas
- [ ] Alertas testados
- [ ] Equipe treinada no suporte básico

### Dia 0 (Go-Live)

- [ ] Deploy em produção
- [ ] Health check verde
- [ ] Onboarding do primeiro organizador
- [ ] Monitoramento ativo

---

## 👥 Organizadores Piloto

### Critérios de Seleção

1. **Diversidade de uso:**
   - Diferentes tipos de eventos
   - Diferentes volumes (pequeno, médio)
   - Diferentes necessidades (básico, pro)

2. **Engajamento:**
   - Dispostos a dar feedback
   - Disponibilidade para calls semanais
   - Abertura para testar features

3. **Tolerância a bugs:**
   - Entendem que é piloto
   - Reportam problemas construtivamente

### Processo de Onboarding

1. **Convite:**
   - Email personalizado
   - Explicação do programa piloto
   - Benefícios (desconto, suporte prioritário)

2. **Setup:**
   - Criação de conta
   - Criação de organizador
   - Tutorial guiado

3. **Primeiro Evento:**
   - Criação assistida
   - Publicação
   - Verificação de métricas

4. **Follow-up:**
   - Check-in semanal
   - Coleta de feedback
   - Ajustes rápidos

---

## 📊 Métricas Diárias (Acompanhar)

### Operacionais

- [ ] Uptime > 99%
- [ ] Tempo de resposta < 500ms (p95)
- [ ] Erros < 0.1%
- [ ] Webhooks processados com sucesso

### Negócio

- [ ] Organizadores ativos
- [ ] Eventos criados
- [ ] Assinaturas ativas
- [ ] Taxa de conversão (views → clicks → conversions)
- [ ] Churn (se aplicável)

### Feedback

- [ ] Issues reportados
- [ ] Feature requests
- [ ] NPS (se aplicável)

---

## 🚨 Plano de Contingência

### Se Stripe Falhar

1. Verificar logs de webhook
2. Verificar status no dashboard Stripe
3. Reprocessar manualmente se necessário
4. Notificar organizador

### Se Banco Falhar

1. Verificar conexão
2. Verificar pool de conexões
3. Failover (se configurado)
4. Rollback se necessário

### Se Deploy Quebrar

1. Rollback imediato (git revert + redeploy)
2. Notificar equipe
3. Investigar logs
4. Hotfix se crítico

---

## 📞 Contatos de Emergência

- **DevOps:** [contato]
- **Stripe Support:** [contato]
- **Database:** [contato]

---

## 🎯 Sucesso do Piloto

### Critérios de Sucesso (30 dias)

- ✅ 3 organizadores ativos
- ✅ 10+ eventos criados
- ✅ 2+ assinaturas pagas
- ✅ Uptime > 99%
- ✅ Feedback positivo

### Próximos Passos (pós-piloto)

- Análise de feedback
- Ajustes prioritários
- Expansão gradual (10-20 organizadores)
- Marketing para novos organizadores

---

**Última atualização:** FASE 11A + 11C



























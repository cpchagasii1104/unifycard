# Feed Service - READ-ONLY (Sem Lógica Financeira)

## 🔴 PRINCÍPIOS IMUTÁVEIS

Este módulo é **STRICTLY READ-ONLY**. Nenhuma lógica financeira é executada aqui.

### ❌ PROIBIDO

- ❌ Importar `UnifyBank` ou qualquer serviço de pagamento
- ❌ Importar `AvailabilityResolver` ou qualquer serviço de reserva
- ❌ Executar mutations (INSERT, UPDATE, DELETE)
- ❌ Criar transações
- ❌ Reservar slots
- ❌ Executar split
- ❌ Bloquear recursos

### ✅ PERMITIDO

- ✅ SELECT apenas (queries read-only)
- ✅ Exibir dados de eventos
- ✅ Preview de disponibilidade (sem reservar)
- ✅ Filtrar por cidade, tipo, data
- ✅ Direcionar para checkout (navegação)

## 📋 Checklist de Segurança

Antes de adicionar qualquer código ao feed:

- [ ] Nenhum import de `UnifyBank`
- [ ] Nenhum import de `AvailabilityResolver`
- [ ] Nenhum import de `TicketService` (exceto tipos)
- [ ] Nenhum import de `ConsumptionService`
- [ ] Apenas queries SELECT
- [ ] Nenhuma transação
- [ ] Nenhum lock

## 🎯 Fluxo Correto

```
FEED (Read-Only)
  ↓
Exibe eventos
  ↓
Preview de disponibilidade (read-only)
  ↓
CTA "Ver Evento" / "Comprar Ingresso"
  ↓
NAVEGAÇÃO (fora do feed)
  ↓
PÁGINA DO EVENTO
  ↓
CHECKOUT (aqui sim executa lógica financeira)
```

## 📁 Arquivos do Feed

- `FeedService.ts` - Busca feed (read-only)
- `EventAvailabilityPreviewService.ts` - Preview de slots (read-only)
- `feed.routes.ts` - Endpoints GET apenas

**Nenhum desses arquivos deve importar serviços financeiros.**
















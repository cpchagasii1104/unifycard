# Event CTA Consistency Audit Report

**Data:** 2024  
**Escopo:** CTAs de eventos em componentes relacionados

---

## 📋 Resumo Executivo

**Total de achados:** 3  
**Risco Alto:** 0  
**Risco Médio:** 1  
**Risco Baixo:** 2

---

## 🔍 Achados Detalhados

### 1. CulturalEventCard.tsx — CTA "Comprar Ingresso" ignora stateInfo

**Arquivo:** `frontend/src/components/social/CulturalEventCard.tsx`  
**Linha:** 367-377  
**CTA:** "🎫 Comprar Ingresso"  
**Risco:** **MÉDIO**

**Problema:**
```tsx
{event.ticket_price_cents && event.ticket_price_cents > 0 && 
 (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') && (
  <button onClick={() => setShowCheckout(true)}>
    🎫 Comprar Ingresso
  </button>
)}
```

**Análise:**
- ✅ Verifica `status` (PUBLISHED ou CONFIRMED)
- ❌ **NÃO verifica `event.stateInfo`**
- ❌ Pode renderizar CTA quando `stateInfo.state === 'POST'` (evento finalizado)
- ❌ Não segue o padrão de `EventPage.tsx` que usa `stateInfo.state === 'PRE'` para ingressos

**Impacto:**
- CTA pode aparecer em eventos finalizados se `stateInfo` não estiver disponível
- Inconsistência com `EventPage.tsx` que controla CTAs por estado

**Recomendação:**
- Adicionar verificação de `stateInfo` antes de renderizar
- Se `stateInfo` existir, usar `stateInfo.state === 'PRE'`
- Se `stateInfo` não existir, manter verificação de status como fallback

---

### 2. EventCard.tsx — CTA "Ver Evento" sem verificação de status

**Arquivo:** `frontend/src/components/events/EventCard.tsx`  
**Linha:** 105-107  
**CTA:** "Ver Evento" (navegação)  
**Risco:** **BAIXO**

**Problema:**
```tsx
<button className="event-card-cta" onClick={(e) => { 
  e.stopPropagation(); 
  onClick(); 
}}>
  Ver Evento
</button>
```

**Análise:**
- ❌ **NÃO verifica `status` do evento**
- ❌ **NÃO verifica `stateInfo`**
- ⚠️ É apenas botão de navegação (não é CTA de ação)
- ⚠️ Pode navegar para evento cancelado/finalizado

**Impacto:**
- Baixo risco pois é apenas navegação
- Usuário pode ver página de evento cancelado, mas isso pode ser intencional

**Recomendação:**
- Considerar desabilitar botão se `status === 'CANCELLED'` ou `status === 'FINISHED'`
- Ou manter como está se navegação para eventos finalizados é intencional

---

### 3. FeaturedToday.tsx — CTA "Ver evento" sem verificação

**Arquivo:** `frontend/src/components/social/FeaturedToday.tsx`  
**Linha:** 258-263  
**CTA:** "Ver evento" (navegação)  
**Risco:** **BAIXO**

**Problema:**
```tsx
<button
  className="featured-card-cta"
  onClick={() => handleEventCTA(event)}
>
  Ver evento
</button>
```

**Análise:**
- ❌ **NÃO verifica `status` do evento**
- ❌ **NÃO verifica `stateInfo`**
- ⚠️ É apenas botão de navegação (não é CTA de ação)
- ⚠️ Renderizado para todos os eventos em destaque

**Impacto:**
- Baixo risco pois é apenas navegação
- Eventos cancelados podem aparecer em destaque (mas isso pode ser controlado no backend)

**Recomendação:**
- Considerar filtrar eventos cancelados/finalizados antes de exibir em destaque
- Ou manter como está se navegação é intencional

---

## ✅ Componentes Corretos

### EventPage.tsx
- ✅ CTAs controlados por `stateInfo.state` (PRE/DURING/POST)
- ✅ Fallbacks condicionais com `!event.stateInfo`
- ✅ Verificação de status via `isCTADisabled`
- ✅ **Corrigido recentemente** — duplicação de CTAs resolvida

---

## 📊 Estatísticas

| Componente | CTAs Encontrados | Com stateInfo | Sem stateInfo | Risco |
|------------|------------------|---------------|---------------|-------|
| EventPage.tsx | 3 (ticket/consumption/parking) | ✅ 3 | ❌ 0 | ✅ OK |
| CulturalEventCard.tsx | 1 (ticket) | ❌ 0 | ❌ 1 | ⚠️ MÉDIO |
| EventCard.tsx | 1 (navegação) | ❌ 0 | ❌ 1 | ⚠️ BAIXO |
| FeaturedToday.tsx | 1 (navegação) | ❌ 0 | ❌ 1 | ⚠️ BAIXO |

---

## 🎯 Recomendações Prioritárias

### Prioridade Alta
1. **CulturalEventCard.tsx** — Adicionar verificação de `stateInfo` no CTA "Comprar Ingresso"
   - Risco: CTAs podem aparecer em eventos finalizados
   - Impacto: UX inconsistente, possível confusão do usuário

### Prioridade Baixa
2. **EventCard.tsx** — Considerar desabilitar navegação para eventos cancelados
3. **FeaturedToday.tsx** — Considerar filtrar eventos cancelados antes de exibir

---

## 📝 Notas

- `EventPage.tsx` está correto e serve como referência
- CTAs de navegação ("Ver evento") têm risco menor que CTAs de ação ("Comprar Ingresso")
- Todos os CTAs devem seguir o padrão: verificar `stateInfo` primeiro, depois `status` como fallback

---

**Fim do Relatório**


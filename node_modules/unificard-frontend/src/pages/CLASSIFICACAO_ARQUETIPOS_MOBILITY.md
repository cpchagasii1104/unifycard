# CLASSIFICAÇÃO DE ARQUÉTIPOS DE PÁGINAS — MÓDULO MOBILITY / AGENDA

Este documento classifica as páginas do módulo MOBILITY / AGENDA do UnifiCard
conforme os ARQUÉTIPOS CANÔNICOS DE PÁGINA definidos em
`/treinamento/ARQUETIPOS_PAGINA_CANONICOS.md`.

---

## 1️⃣ Home / Discovery Page
Página de descoberta e entrada principal.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo MOBILITY / AGENDA.**

---

## 2️⃣ Category / Collection Page
Página de categoria ou coleção.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo MOBILITY / AGENDA.**

---

## 3️⃣ Entity Listing Page
Listagem homogênea de entidades.

### UnifiedAgendaPage.tsx
- **Nome do arquivo:** `UnifiedAgendaPage.tsx`
- **Rota:** `/agenda-unificada` e `/unified-calendar`
- **Arquétipo:** Entity Listing Page
- **Observações:**
  - Lista entradas de calendário unificado (consolida todas as fontes de agenda)
  - Filtros por fonte (SERVICE_AVAILABILITY, CALENDAR_EVENT, UNIFIED_AVAILABILITY, EVENT)
  - Filtros por tipo (AVAILABLE, RESERVED, BLOCKED, UNAVAILABLE)
  - Filtros por serviço ID e evento ID
  - Modos de visualização: dia, semana, mês
  - Navegação para detalhes ao clicar em entrada
  - Apenas visualização e navegação (read-only)
  - Conecta-se à Agenda Universal (backend) - não cria verdade temporal

### CalendarPage.tsx
- **Nome do arquivo:** `CalendarPage.tsx`
- **Rota:** `/calendar`
- **Arquétipo:** Entity Listing Page
- **Observações:**
  - Lista eventos de calendário do funcionário/prestador
  - Visualização mensal com navegação entre meses
  - Filtro por período (mês selecionado)
  - Navegação para detalhes de evento ou ordem de serviço
  - CTA para criar bloqueio (`/calendar/events/new`) - navegação apenas
  - Apenas visualização e navegação (read-only)
  - Conecta-se à Agenda Universal (backend) - não cria verdade temporal

### MeusCompromissosPage.tsx
- **Nome do arquivo:** `MeusCompromissosPage.tsx`
- **Rota:** `/compromissos` e `/meus-compromissos`
- **Arquétipo:** Entity Listing Page (HÍBRIDA - mistura responsabilidades)
- **Observações:**
  - Lista múltiplos tipos de compromissos:
    - Eventos que participo
    - Eventos que organizo
    - Grupos que gerencio
    - Agenda (próximos compromissos/bookings)
    - Pendências (inbox)
    - Resumo econômico
    - Impacto atual
    - Pendências detalhadas (eventos, grupos, serviços, pagamentos, bookings)
  - ⚠️ **HÍBRIDA**: Mistura Entity Listing Page com Draft / Management Page
  - Funciona como hub de acompanhamento e gestão de compromissos
  - Exibe informações de múltiplas entidades (eventos, grupos, serviços, pagamentos, bookings)
  - Navegação para detalhes de cada tipo de entidade
  - Apenas visualização e navegação (read-only)
  - Recomendação: Considerar se requer separação em páginas mais específicas ou se pode permanecer como hub unificado

---

## 4️⃣ Entity Detail Page
Visualização focada em UMA entidade.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo MOBILITY / AGENDA.**

**Observação:** Detalhes de entidades de agenda (eventos, bookings, disponibilidades) são visualizados através de páginas de outros módulos (EventDetailPage, ServiceOrderDetailPage, etc.).

---

## 5️⃣ Action / Checkout Page
Página de ação ou checkout.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo MOBILITY / AGENDA.**

**Observação:** Ações relacionadas a agenda (criar bloqueio, confirmar booking, etc.) são realizadas através de páginas de outros módulos ou páginas dedicadas de ação.

---

## 6️⃣ Entity Declaration / Creation Page
Página de declaração progressiva de intenção.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo MOBILITY / AGENDA.**

**Observação:** Criação de eventos de agenda ou disponibilidades são realizadas através de páginas de outros módulos (EventCreationPage, ServiceAvailabilityPage, etc.).

---

## 7️⃣ Draft / Management Page
Página de acompanhamento e gestão.

### MeusCompromissosPage.tsx
- **Nome do arquivo:** `MeusCompromissosPage.tsx`
- **Rota:** `/compromissos` e `/meus-compromissos`
- **Arquétipo:** Draft / Management Page (HÍBRIDA - mistura responsabilidades)
- **Observações:**
  - ⚠️ **HÍBRIDA**: Mistura Entity Listing Page com Draft / Management Page
  - Funciona como hub de gestão e acompanhamento de compromissos
  - Exibe pendências, impacto, resumo econômico
  - Acompanhamento de múltiplos tipos de entidades
  - Recomendação: Considerar se requer separação ou se pode permanecer como hub unificado

---

## Páginas Não Classificáveis / Híbridas

### MeusCompromissosPage.tsx
- **Justificativa:** Mistura responsabilidades de Entity Listing Page (listagem de múltiplos tipos de entidades) com Draft / Management Page (acompanhamento, gestão, pendências, impacto)
- **Recomendação:** 
  - Opção 1: Manter como hub unificado se a mistura for intencional e não violar princípios canônicos
  - Opção 2: Separar em páginas mais específicas (ex: MeusEventosPage, MinhasPendenciasPage, MeuImpactoPage)

---

## RESUMO POR ARQUÉTIPO

### Home / Discovery Page
- Nenhuma página identificada

### Category / Collection Page
- Nenhuma página identificada

### Entity Listing Page
- UnifiedAgendaPage.tsx ✅
- CalendarPage.tsx ✅
- MeusCompromissosPage.tsx ⚠️ HÍBRIDA (Entity Listing + Draft / Management)

### Entity Detail Page
- Nenhuma página identificada exclusivamente (usa páginas de outros módulos)

### Action / Checkout Page
- Nenhuma página identificada exclusivamente (usa páginas de outros módulos)

### Entity Declaration / Creation Page
- Nenhuma página identificada exclusivamente (usa páginas de outros módulos)

### Draft / Management Page
- MeusCompromissosPage.tsx ⚠️ HÍBRIDA (Entity Listing + Draft / Management)

---

## OBSERVAÇÕES INSTITUCIONAIS

1. **Agenda Universal (Backend):** Todas as páginas de agenda conectam-se à Agenda Universal (backend) e não criam verdade temporal no frontend. Conformidade: ✅

2. **MeusCompromissosPage.tsx** é uma página híbrida que mistura Entity Listing Page com Draft / Management Page. Funciona como hub unificado de compromissos, pendências e impacto. Recomendação: Avaliar se a mistura é intencional e se não viola princípios canônicos, ou considerar separação em páginas mais específicas.

3. **Módulo MOBILITY:** Não foram identificadas páginas específicas de mobility/rides/trips/deslocamentos no frontend. O módulo pode estar ainda não implementado ou as funcionalidades podem estar integradas em outros módulos (ex: serviços, eventos).

4. **Navegação:** Todas as páginas identificadas são read-only e apenas navegam para detalhes ou ações. Conformidade: ✅

---

## CONFORMIDADE GERAL

- ✅ Nenhuma página cria verdade temporal
- ✅ Nenhuma página valida tempo como verdade
- ✅ Todas as páginas conectam-se à Agenda Universal (backend)
- ⚠️ Uma página híbrida identificada (MeusCompromissosPage.tsx)


# 🚀 BACKLOG DE CRESCIMENTO — UnifiCard

> **Fase:** Pós-consolidação estrutural  
> **Foco:** Crescimento seguro, zero refatoração arquitetural  
> **Criado:** 27/12/2025

---

## 📋 Regras do Backlog

1. **Nada toca o Golden Path** sem motivo crítico
2. **Nenhuma refatoração por gosto** — só por necessidade
3. **Guardrails são lei** — todo código novo segue ENGINEERING_README.md
4. **Ordem importa** — execute na sequência

---

## ✅ Pré-requisito (FEITO)

- [x] EventPage.tsx CTAs duplicados corrigidos
- [x] ENGINEERING_README.md consolidado
- [x] GOLDEN_PATH.md finalizado
- [x] ANTI_PATTERNS.md finalizado

**Commit sugerido:**
```bash
git add frontend/src/components/events/EventPage.tsx
git commit -m "fix(events): prevent duplicate CTAs when stateInfo exists"
```

---

## 🧩 Tarefas de Crescimento (Ordem Segura)

### Task 1: Event CTA Consistency Audit
**Objetivo:** Garantir consistência visual de todos os CTAs em eventos

**Escopo:**
- Verificar todos os arquivos em `frontend/src/components/events/`
- Confirmar padrão:
  - `stateInfo` presente → CTAs contextuais (PRE/DURING/POST)
  - `stateInfo` ausente → CTAs fallback simples
- Remover qualquer duplicação restante

**Arquivos:**
- `EventPage.tsx` ✅ (já corrigido)
- `CulturalEventCard.tsx`
- `EventCheckout.tsx` (se existir)

**Critério de aceite:**
- [ ] Zero CTAs duplicados em qualquer estado
- [ ] Visual consistente entre cards e páginas

**NÃO FAZER:**
- Criar novos tipos de CTA
- Mudar lógica de stateInfo
- Refatorar estrutura de componentes

---

### Task 2: Impact Visibility em Eventos
**Objetivo:** Mostrar impacto econômico após transações em eventos

**Escopo:**
- Adicionar `TransactionImpactSummary` após:
  - Compra de ingresso confirmada
  - Consumo local confirmado
- Usar infra existente (componente já existe)

**Arquivos:**
- `frontend/src/components/events/EventCheckout.tsx`
- `frontend/src/components/social/TransactionImpactSummary.tsx`

**Conexão com CORE:**
- Usa: Ledger existente
- Evento: `cta-confirmed`

**Critério de aceite:**
- [ ] Após compra de ingresso, mostra distribuição (70/15/10/5)
- [ ] Componente não quebra se ledger estiver vazio
- [ ] Usa `safeApiCall()` para carregar dados

**NÃO FAZER:**
- Calcular split no frontend (ANTI_PATTERN)
- Criar novo endpoint
- Simular valores

---

### Task 3: Event Trust Signals
**Objetivo:** Aumentar confiança em eventos com sinais contextuais

**Escopo:**
- Adaptar `getPostTrustSignals()` para eventos
- Mostrar em `CulturalEventCard`:
  - "🔄 Evento recorrente" (se já aconteceu antes)
  - "👥 X pessoas confirmadas"
  - "⭐ Organizador verificado"

**Arquivos:**
- `frontend/src/utils/feedScoring.ts`
- `frontend/src/components/social/CulturalEventCard.tsx`

**Critério de aceite:**
- [ ] Trust signals aparecem quando dados disponíveis
- [ ] Graceful degradation se dados ausentes
- [ ] Zero chamadas extras de API (usar dados existentes)

**NÃO FAZER:**
- Criar endpoint novo
- Adicionar campos no banco
- Mostrar dados falsos

---

### Task 4: EventPage JSX Guardrail
**Objetivo:** Melhorar manutenibilidade do EventPage.tsx

**Escopo:**
- Extrair blocos grandes para subcomponentes:
  - `EventCTASection.tsx`
  - `EventStateMessage.tsx`
  - `EventParticipantsList.tsx`
- Manter no mesmo diretório

**Regra JSX:**
- Nenhum `<>` atravessa `<main>`, `<aside>`, `<section>`
- Cada subcomponente recebe props tipadas

**Critério de aceite:**
- [ ] EventPage.tsx < 250 linhas
- [ ] Subcomponentes isolados e testáveis
- [ ] Zero mudança de comportamento

**NÃO FAZER:**
- Mudar lógica de negócio
- Criar contextos novos
- Adicionar estado global

---

### Task 5: Golden Path Smoke Test
**Objetivo:** Validar fluxo crítico antes de release

**Checklist Manual (10 min):**

```
1. AUTENTICAÇÃO
   [ ] Login funciona
   [ ] SessionProvider carrega
   [ ] activeActor definido

2. FEED
   [ ] Feed carrega sem erro
   [ ] Posts aparecem ordenados
   [ ] Estado vazio tratado corretamente

3. EVENTO
   [ ] Card de evento clicável
   [ ] EventPage carrega
   [ ] CTAs corretos por estado

4. TRANSAÇÃO
   [ ] CTA de compra funciona
   [ ] Confirmação processa
   [ ] Ledger atualizado

5. IMPACTO
   [ ] ImpactBalanceBadge atualiza
   [ ] TransactionImpactSummary mostra distribuição
   [ ] Fundo regional recebe %

6. RECORRÊNCIA
   [ ] Feed mostra atividade recente
   [ ] TodayForYou sugere próximo passo
   [ ] Sem loops infinitos
```

**Critério de aceite:**
- [ ] 100% do checklist passa
- [ ] Zero erros no console
- [ ] Zero quebras visuais

---

## 📊 Métricas de Progresso

| Task | Status | Responsável | Data |
|------|--------|-------------|------|
| Task 1 | 🟡 Em análise | - | - |
| Task 2 | ⚪ Não iniciado | - | - |
| Task 3 | ⚪ Não iniciado | - | - |
| Task 4 | ⚪ Não iniciado | - | - |
| Task 5 | ⚪ Não iniciado | - | - |

---

## 🚨 Alertas

### Antes de cada task:
1. Ler ENGINEERING_README.md
2. Verificar se toca Golden Path
3. Usar guardrails obrigatórios

### Se algo quebrar:
1. Reverter imediatamente
2. Analisar causa raiz
3. Documentar em ANTI_PATTERNS.md se for padrão novo

---

## 🏁 Critério de Release

O sistema está pronto para produção quando:

- [ ] Tasks 1-4 concluídas
- [ ] Task 5 (Smoke Test) passa 100%
- [ ] Zero erros TypeScript críticos
- [ ] Zero console.error em produção

---

*Documento criado em 27/12/2025*  
*Versão: 1.0*  
*Este backlog segue GOLDEN_PATH.md e ANTI_PATTERNS.md*

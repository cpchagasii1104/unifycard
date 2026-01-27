
# GOLDEN PATH — UnifiCard

Este documento descreve o **fluxo crítico que NÃO PODE QUEBRAR** no UnifiCard.
Tudo que for construído deve respeitar este caminho.

---

## 1. Autenticação & Contexto

### Fluxo
Login → SessionProvider → Actors → activeActor

### Regras
- `activeActor` **nunca pode ser null** quando o feed é chamado
- Sempre validar com `validateActiveActor()`
- SessionProvider é a única fonte de verdade

### Eventos
- `auth-changed`
- `active-actor-changed`

### Nunca pode acontecer
- Chamada de feed sem `actor_id` e `actor_type`
- Loop de bootstrap
- Retry silencioso de login

---

## 2. Feed & Descoberta (HUB)

### Fluxo
Feed → Ordenação → Descoberta → CTA

### Prioridades
1. service_offer
2. product_offer
3. event (com ingresso)
4. project / vote
5. posts pessoais

### Regras
- Feed **nunca quebra**
- Estados vazios são tratados com `SmartEmptyState`
- Ordenação via `scoreFeedItem()`

### Nunca pode acontecer
- Feed vazio sem ação sugerida
- Erro silencioso
- Dependência de backend para ordenação básica

---

## 3. Ação & Transação

### Fluxo
CTA → Modal → Confirmação → Ledger

### Regras
- Frontend **NÃO calcula split**
- Split Engine é backend-only
- Frontend apenas exibe dados reais

### Eventos
- `cta-confirmed`
- `impact-changed`

### Nunca pode acontecer
- Simular valores de split
- Confirmar CTA sem preço válido
- Criar checkout paralelo

---

## 4. Impacto & Transparência

### Fluxo
Ledger → TransactionImpact → ImpactSummary

### Regras
- Mostrar apenas dados reais do ledger
- Se não houver dados, não renderizar
- Impacto sempre visível após transação

### Nunca pode acontecer
- Impacto calculado no frontend
- Mostrar valores fictícios
- Divergir do ledger

---

## 5. Progressão & Recorrência

### Fluxo
Ação → Impacto → Progresso → Retorno

### Componentes
- FirstActionHint
- PersonalProgressCard
- CommunityActivitySummary
- TodayForYou

### Regras
- Sem gamificação agressiva
- Sem streaks ou rankings
- Tudo é sugestão, nada é obrigação

### Nunca pode acontecer
- Cobrança emocional
- Notificações invasivas
- Loops infinitos de eventos

---

## 6. Guardrails Obrigatórios

### Sempre usar
- `validateActiveActor()`
- `safeApiCall()`
- `safeArray<T>()`
- `safeDate()`
- `safeNumber()`

### Logs
- Apenas via `devLog`
- Nunca `console.log` direto

---

## 7. Princípios Invioláveis

1. Feed é o HUB de tudo
2. Economia é visível, não escondida
3. Frontend não decide dinheiro
4. Novo usuário nunca parece suspeito
5. Nada quebra o Golden Path

---

## Frase guia

> **Se isso quebrar o Golden Path, não entra.**

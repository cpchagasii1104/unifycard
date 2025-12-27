# GOLDEN PATH - UnifiCard

## Fluxo Crítico do Ecossistema

### 1. Autenticação e Contexto (Login → SessionProvider → activeActor)

**Fluxo:**
1. Usuário faz login → `SessionProvider` inicializa sessão
2. `SessionProvider` carrega atores disponíveis (user, pages, groups)
3. Define `activeActor` como fonte única da verdade
4. Componentes consomem `activeActor` via `useActiveActor()`

**Estados:**
- `activeActor` pode ser `null` durante bootstrap
- Após bootstrap, `activeActor` nunca deve ser `null` sem redirecionamento
- `activeActor.actor_id` e `activeActor.actor_type` são obrigatórios

**Eventos:**
- `active-actor-changed`: disparado quando ator muda

**Nunca pode acontecer:**
- Componente renderizar sem `validateActiveActor()` quando depende de `activeActor`
- `activeActor` ser usado sem verificar `actor_id` e `actor_type`
- Múltiplos listeners de `active-actor-changed` sem cleanup

---

### 2. Feed e Descoberta (Feed → Ordenação → Descoberta → CTA)

**Fluxo:**
1. `SocialFeed2` carrega feed via `getSocialFeed()` com `activeActor`
2. Posts são ordenados por relevância (scoring: localização, preferências, histórico)
3. `CommunityActivitySummary` mostra atividade recente (ledger + feed)
4. `TodayForYou` gera sugestão contextual (serviço local, evento próximo, comunidade)
5. `PostCard` exibe CTA quando disponível

**Estados:**
- Feed pode estar vazio (não é erro)
- Posts podem não ter CTA (não é erro)
- Ordenação pode falhar silenciosamente (usa ordem padrão)

**Eventos:**
- `post-created`: disparado após criar post

**Nunca pode acontecer:**
- Feed quebrar se `activeActor` for `null` (deve aguardar ou retornar vazio)
- Erro de API quebrar o feed (deve usar fallback: `[]`)
- Posts com `null` ou `undefined` causarem crash (deve usar `safePostsArray()`)
- Ordenação falhar e quebrar renderização

---

### 3. Transação e Impacto (CTA → Confirmação → Ledger → Impacto)

**Fluxo:**
1. Usuário clica em CTA → `CTAModal` abre
2. Usuário confirma → `confirmCTA()` é chamado
3. Backend processa → cria entries no ledger (`revenue`, `profit_share`)
4. `impact-changed` é disparado → `ImpactBalanceBadge` atualiza
5. `cta-confirmed` é disparado → `SocialLedger` e `CommunityActivitySummary` recarregam

**Estados:**
- CTA pode não ter preço (não é erro)
- Confirmação pode falhar (deve mostrar erro, não quebrar)
- Ledger pode estar vazio (não é erro)

**Eventos:**
- `cta-confirmed`: disparado após confirmação bem-sucedida
- `impact-changed`: disparado quando saldo de impacto muda

**Nunca pode acontecer:**
- Confirmação de CTA sem `activeActor` válido
- Ledger entries com `amount_cents` inválido (deve usar `safeNumber()`)
- Impacto não atualizar após confirmação (deve disparar evento)
- Múltiplos listeners de `cta-confirmed` ou `impact-changed` sem cleanup

---

### 4. Recorrência e Comunidade (Impacto → Saldo → Comunidade → Recorrência)

**Fluxo:**
1. `ImpactBalanceBadge` exibe saldo atualizado
2. `PersonalProgressCard` detecta inatividade semanal (7+ dias sem ação)
3. `CommunityActivitySummary` mostra impacto gerado hoje
4. `TodayForYou` sugere próximo passo baseado em histórico
5. Feed recarrega mostrando atividade recente

**Estados:**
- Saldo pode ser 0 (não é erro)
- Inatividade pode não existir (não é erro)
- Comunidade pode não ter recebido impacto (não é erro)

**Eventos:**
- `impact-changed`: usado para atualizar saldo
- `post-created`: usado para atualizar progresso

**Nunca pode acontecer:**
- Saldo quebrar se API falhar (deve usar fallback: `0`)
- Data de última ação inválida causar crash (deve usar `safeDate()`)
- Array de comunidades vazio quebrar renderização (deve usar `safeArray()`)
- Loop infinito de recarregamento (deve usar `actor_id` como dependência)

---

## Guardrails Críticos

### Validação de activeActor
- **Sempre usar:** `validateActiveActor(activeActor)` antes de usar `activeActor`
- **Nunca:** `if (activeActor)` ou `if (!activeActor)` diretamente

### Chamadas de API
- **Sempre usar:** `safeApiCall()` com fallback apropriado
- **Nunca:** `try/catch` sem fallback ou erro quebrando UI

### Validação de Dados
- **Sempre usar:** `safeDate()`, `safeNumber()`, `safeString()`, `safeArray()`
- **Nunca:** acessar propriedades sem validação ou assumir tipos

### Event Listeners
- **Sempre:** cleanup em `useEffect` return
- **Nunca:** múltiplos listeners do mesmo evento sem cleanup
- **Sempre:** usar `actor_id` como dependência, não objeto completo

---

## Princípios

1. **Feed nunca quebra:** erros são silenciosos, fallbacks são seguros
2. **activeActor é fonte única:** sempre validar antes de usar
3. **Eventos são unidirecionais:** disparar após mudança, escutar para atualizar
4. **Estados vazios são válidos:** `[]`, `0`, `null` não são erros
5. **Logs apenas em DEV:** usar `devLog` para não poluir produção


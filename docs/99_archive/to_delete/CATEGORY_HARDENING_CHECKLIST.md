# CATEGORY HARDENING CHECKLIST — UNIFICARD
Status: CANONICAL · BINDING · OPERATIONAL
Autoridade: NÍVEL 4 (GATE / CHECKPOINT OBRIGATÓRIO)
Escopo: Checklist Operacional para Blindagem de Categorias

---

## OBJETIVO

Este documento é um **CHECKLIST OPERACIONAL BLOQUEANTE** que deve ser executado **ANTES** de qualquer ação que envolva categorias.

Ele existe para **IMPEDIR INSTITUCIONALMENTE** que categorias sejam usadas para decisão, permissão, ranking ou qualquer forma de comportamento sistêmico.

---

## AUTORIDADE OPERACIONAL

Este checklist possui **AUTORIDADE OPERACIONAL MÁXIMA**.

- ❌ Nenhum código pode ser criado sem passar por este checklist
- ❌ Nenhum PR pode ser aprovado sem validar este checklist
- ❌ Nenhuma IA pode implementar sem verificar este checklist
- ❌ Nenhum humano pode propor mudança sem responder este checklist

**Violação deste checklist = VIOLAÇÃO INSTITUCIONAL**

---

## CHECKLIST OBRIGATÓRIO — ANTES DE CRIAR CATEGORIA

Antes de criar uma nova categoria, responder **OBRIGATORIAMENTE**:

### 1. Propósito da Categoria

- [ ] **A categoria é APENAS para visualização/navegação?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A categoria NÃO será usada para decisão?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A categoria NÃO será usada para permissão?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A categoria NÃO será usada para ranking?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A categoria NÃO será usada para preço?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

---

## CHECKLIST OBRIGATÓRIO — ANTES DE ALTERAR CATEGORIA

Antes de alterar uma categoria existente, responder **OBRIGATORIAMENTE**:

### 1. Impacto da Alteração

- [ ] **Se esta categoria mudar, algo quebra?**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria está sendo usada como verdade)

- [ ] **Se esta categoria for removida, comportamento muda?**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria está sendo usada para decisão)

- [ ] **Esta categoria está em código condicional?**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria está sendo usada para decisão)

---

## CHECKLIST OBRIGATÓRIO — ANTES DE USAR CATEGORIA EM CÓDIGO

Antes de usar categoria em qualquer código, responder **OBRIGATORIAMENTE**:

### 1. Testes Mentais Obrigatórios

- [ ] **"Se essa categoria sumir, algo quebra?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria está sendo usada como verdade)

- [ ] **"Se alguém mudar essa categoria, o sistema muda?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria está sendo usada para decisão)

- [ ] **"Isso altera comportamento?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria não pode alterar comportamento)

- [ ] **"Isso decide algo?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria não pode decidir)

- [ ] **"Isso bloqueia ou libera algo?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria não pode bloquear ou liberar)

- [ ] **"Isso prioriza ou ordena algo?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria não pode priorizar ou ordenar)

- [ ] **"Isso influencia preço ou valor financeiro?"**
  - ✅ Se NÃO → pode prosseguir
  - ❌ Se SIM → BLOQUEAR (categoria não pode influenciar preço)

---

## CHECKLIST OBRIGATÓRIO — ANTES DE EXPOR CATEGORIA EM API

Antes de expor categoria em qualquer API, responder **OBRIGATORIAMENTE**:

### 1. Uso da API

- [ ] **A API é APENAS para visualização?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A API NÃO será usada para decisão no frontend?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR

- [ ] **A API NÃO será usada para filtragem automática?**
  - ✅ Se SIM → pode prosseguir
  - ❌ Se NÃO → BLOQUEAR (filtragem automática é decisão)

---

## ANTI-PATTERNS EXPLÍCITOS (BLOQUEIO AUTOMÁTICO)

Os seguintes padrões são **BLOQUEIO AUTOMÁTICO**. Se qualquer um for encontrado, a proposta é **INVÁLIDA**.

### ❌ Anti-Pattern 1: Decisão Condicional por Categoria

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
if (item.category === 'X') {
  doSomething();
}
```

**Bloqueio:** Categoria não pode condicionar comportamento.

---

### ❌ Anti-Pattern 2: Categoria como Proxy de Permissão

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
const canAccess = user.category === 'admin';
```

**Bloqueio:** Categoria não pode conferir permissão.

---

### ❌ Anti-Pattern 3: Categoria como Score

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
const score = item.category === 'premium' ? 100 : 50;
```

**Bloqueio:** Categoria não pode representar score.

---

### ❌ Anti-Pattern 4: Categoria como Política

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
const policy = getPolicyByCategory(item.category);
```

**Bloqueio:** Categoria não pode ser policy.

---

### ❌ Anti-Pattern 5: Categoria Influenciando Preço

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
const price = basePrice * (item.category === 'luxury' ? 2 : 1);
```

**Bloqueio:** Categoria não pode influenciar preço.

---

### ❌ Anti-Pattern 6: Categoria Influenciando Split Financeiro

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
const split = calculateSplit({ category: transaction.category });
```

**Bloqueio:** Categoria não pode influenciar split financeiro.

---

### ❌ Anti-Pattern 7: Categoria Determinando Visibilidade

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
if (item.category === 'hidden') {
  return null;
}
```

**Bloqueio:** Categoria não pode determinar visibilidade.

---

### ❌ Anti-Pattern 8: Categoria Acionando Automação

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
if (event.category === 'automated') {
  autoApprove();
}
```

**Bloqueio:** Categoria não pode acionar automação.

---

### ❌ Anti-Pattern 9: Categoria em Switch/Case

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
switch (item.category) {
  case 'A': return actionA();
  case 'B': return actionB();
}
```

**Bloqueio:** Categoria não pode determinar fluxo.

---

### ❌ Anti-Pattern 10: Categoria em Ordenação

```typescript
// ❌ BLOQUEADO AUTOMATICAMENTE
items.sort((a, b) => {
  if (a.category === 'featured') return -1;
  return 0;
});
```

**Bloqueio:** Categoria não pode ordenar.

---

## FRASES CANÔNICAS DE BLOQUEIO

As seguintes frases são **BLOQUEIO AUTOMÁTICO** para qualquer proposta:

1. **"Se categoria for X, então..."**
   - ❌ BLOQUEADO — categoria não pode condicionar comportamento

2. **"Categoria premium tem acesso especial"**
   - ❌ BLOQUEADO — categoria não pode conferir permissão

3. **"Priorizar itens da categoria Y"**
   - ❌ BLOQUEADO — categoria não pode priorizar

4. **"Aplicar desconto para categoria Z"**
   - ❌ BLOQUEADO — categoria não pode influenciar preço

5. **"Calcular split baseado em categoria"**
   - ❌ BLOQUEADO — categoria não pode influenciar split financeiro

6. **"Categoria determina visibilidade"**
   - ❌ BLOQUEADO — categoria não pode determinar visibilidade

7. **"Automatizar ação para categoria W"**
   - ❌ BLOQUEADO — categoria não pode acionar automação

8. **"Categoria como filtro automático"**
   - ❌ BLOQUEADO — filtragem automática é decisão

9. **"Categoria como critério de matching"**
   - ❌ BLOQUEADO — matching por categoria é decisão

10. **"Categoria como regra de negócio"**
    - ❌ BLOQUEADO — categoria não é regra de negócio

---

## REGRA CLARA: CATEGORIA NUNCA INFLUENCIA COMPORTAMENTO

### Categoria PODE:
- ✅ Ser exibida
- ✅ Ser usada para navegação humana
- ✅ Ser usada para agrupamento visual
- ✅ Ser usada para busca textual
- ✅ Ser usada para filtro humano explícito

### Categoria NUNCA PODE:
- ❌ Alterar comportamento
- ❌ Decidir fluxo
- ❌ Bloquear ou liberar
- ❌ Priorizar ou ordenar
- ❌ Influenciar preço
- ❌ Influenciar split financeiro
- ❌ Determinar visibilidade
- ❌ Acionar automação
- ❌ Ser usada em condicionais
- ❌ Ser usada em switch/case
- ❌ Ser usada em ordenação
- ❌ Ser usada como proxy de permissão
- ❌ Ser usada como score
- ❌ Ser usada como policy

---

## CHECKLIST PARA REVISORES DE PR

Antes de aprovar qualquer PR que toque categorias, verificar **OBRIGATORIAMENTE**:

- [ ] PR não contém `if (category === ...)`
- [ ] PR não contém `switch (category)`
- [ ] PR não usa categoria para permissão
- [ ] PR não usa categoria para ranking
- [ ] PR não usa categoria para preço
- [ ] PR não usa categoria para split financeiro
- [ ] PR não usa categoria para visibilidade
- [ ] PR não usa categoria para automação
- [ ] PR não usa categoria em ordenação
- [ ] PR não usa categoria como score
- [ ] PR não usa categoria como policy

**Se qualquer item falhar → REJEITAR PR**

---

## CHECKLIST PARA PROCESSOS DE CI

Antes de permitir merge, CI deve verificar **OBRIGATORIAMENTE**:

- [ ] Nenhum arquivo contém `if.*category.*===`
- [ ] Nenhum arquivo contém `switch.*category`
- [ ] Nenhum arquivo contém `category.*permission`
- [ ] Nenhum arquivo contém `category.*rank`
- [ ] Nenhum arquivo contém `category.*price`
- [ ] Nenhum arquivo contém `category.*split`
- [ ] Nenhum arquivo contém `category.*visibility`
- [ ] Nenhum arquivo contém `category.*auto`

**Se qualquer item falhar → BLOQUEAR MERGE**

---

## CHECKLIST PARA IAs FUTURAS

Antes de implementar qualquer código que toque categorias, IA deve:

- [ ] Ler `CATEGORY_SCOPES_SEMANTICS.md`
- [ ] Ler `CATEGORY_HARDENING_CHECKLIST.md`
- [ ] Executar todos os testes mentais obrigatórios
- [ ] Verificar todos os anti-patterns
- [ ] Confirmar que categoria não altera comportamento
- [ ] Confirmar que categoria não decide nada
- [ ] Confirmar que categoria não influencia preço
- [ ] Confirmar que categoria não influencia split financeiro

**Se qualquer item falhar → RECUSAR IMPLEMENTAÇÃO**

---

## REGRA FINAL (INQUEBRÁVEL)

> **No UnifiCard, categoria é descrição, não decisão.  
> Se categoria muda comportamento, é violação institucional.  
> Este checklist é o GATE que impede violação.**

---

## AUTORIDADE DOCUMENTAL

Este checklist é respaldado por:

- `Category_System_Contract_UnifiCard.md` — Define categorias como descritivas
- `CATEGORY_SCOPES_SEMANTICS.md` — Define escopos permitidos e proibidos
- `Decision_Safety_and_Containment_Contract.md` — Proíbe decisão por categoria
- `Database_Canonical_Truth_Contract.md` — Define que categoria não é verdade
- `OBSERVABILIDADE_CONSTITUCIONAL.md` — Define que categoria é observação, não ação

Este checklist possui **precedência operacional** sobre qualquer interpretação, sugestão ou implementação que use categoria para decisão.

---

FIM DO DOCUMENTO CATEGORY_HARDENING_CHECKLIST.md



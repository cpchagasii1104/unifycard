# ❌ ANTI_PATTERNS.md
## Coisas que **NUNCA** devem ser feitas no UnifiCard

Este documento lista **padrões proibidos** no sistema.
Se algo aqui aparecer em PR, refactor ou feature nova, **é bug por definição**.

Este arquivo é complementar ao `GOLDEN_PATH.md`.
O Golden Path diz *o que deve acontecer*.
Este documento diz *o que não pode acontecer nunca*.

---

## 1. Economia & Impacto

### ❌ Calcular split no frontend
**Proibido.**

- Frontend **nunca** calcula:
  - percentuais
  - divisão de valores
  - distribuição por grupo, região ou plataforma

✅ Única fonte da verdade:
- Ledger retornado pelo backend

Motivo:
> Qualquer cálculo no frontend cria divergência econômica.

---

### ❌ Simular impacto ou “preview econômico”
**Proibido.**

- Não mostrar “você vai gerar X de impacto”
- Não estimar valores que **não estão no ledger**
- Não inferir dados ausentes

Se não está no ledger:
- **não existe**

---

### ❌ Criar transação sem ledger
**Proibido.**

Toda ação econômica **tem que**:
1. Criar entry no ledger
2. Emitir eventos (`cta-confirmed`, `impact-changed`)
3. Ser idempotente

Se não passou pelo ledger:
- não aconteceu

---

## 2. ActiveActor & Sessão

### ❌ Chamar feed sem `activeActor`
**Erro grave.**

- Nenhuma chamada social acontece sem:
  - `actor_id`
  - `actor_type`

Uso obrigatório:
- `validateActiveActor()`

Nunca:
```ts
if (activeActor) { ... }
```

Sempre:
```ts
validateActiveActor(activeActor)
```

---

### ❌ Fallback silencioso de actor
**Proibido.**

- Não “assumir user”
- Não criar actor automático escondido
- Não trocar actor sem ação explícita

---

## 3. Feed & Descoberta

### ❌ Feed quebrar por dados inválidos
**Proibido.**

Feed pode:
- estar vazio
- não ter ofertas
- ter pouco conteúdo

Feed **não pode**:
- lançar erro
- renderizar `undefined`
- quebrar por API parcial

---

## 4. UX & Loops

### ❌ Loops automáticos invisíveis
**Proibido.**

- retry automático de login
- retry automático de CTA
- retry automático de feed

Toda repetição:
- tem limite
- tem guard
- tem log (dev)

---

### ❌ Gamificação agressiva
**Proibido.**

- Streaks
- Rankings
- Pressão psicológica

O UnifiCard incentiva, **não cobra**.

---

## 5. Eventos & Estado Global

### ❌ Criar estado global sem evento
**Proibido.**

Mudou algo relevante?
- Dispare evento.

---

## Regra Final

> Se algo viola este documento ou o `GOLDEN_PATH.md`, **não é decisão técnica: é bug.**

---

Status: **Contrato Arquitetural**

# Camada de Sugestões Contextuais

## 🎯 Objetivo

Fazer o usuário sentir que o produto o entende, sem nunca parecer:
- Algoritmo
- Funil
- Coach
- Sistema avaliando

## 🧠 Princípios

1. **Silencioso**: Não invasivo, não bloqueia fluxo
2. **Opcional**: Sempre pode ser ignorado
3. **Respeitoso**: Linguagem humana, não técnica
4. **Inteligente**: Observa padrões, não força decisões

## 📦 Componente Único

### `ContextualSuggestion`

**Características:**
- Um único componente para todas as sugestões
- Não fragmentar em múltiplos componentes
- Governança centralizada

**Comportamento:**
- Chama `GET /profile/inference`
- Seleciona apenas a sugestão prioritária
- Renderiza copy humana
- Oferece 2 ações: "Aceitar" e "Dispensar"

**O que NÃO faz:**
- ❌ Não aparece no onboarding
- ❌ Não bloqueia fluxo
- ❌ Não repete sugestão rejeitada
- ❌ Não mostra "por que isso apareceu"

## 📝 Copy Oficial

### Regra A — Prazer → Aprendizado
**Copy:** "Percebi que você gosta de [X]. Quer aprender um pouco mais?"

### Regra B — Aprendizado → Profissional
**Copy:** "Você já está se aprofundando nisso. Já pensou em levar mais adiante?"

### Regra C — Profissional sem Físico
**Copy:** "E fora do trabalho, o que te faz bem?"

**Linguagem:**
- Primeira pessoa implícita
- Sem verbo técnico
- Sem promessa
- Sem pressão

## 🔒 Governança

### Regras Técnicas Obrigatórias

1. **Salvar no backend:**
   - `suggestion_id`
   - `status: shown | accepted | dismissed`
   - `timestamp`

2. **Cooldown:**
   - Sugestão rejeitada → nunca mais
   - Sugestão aceita → não repetir
   - Nova sugestão só após mudança real de trilha

3. **Filtragem:**
   - Backend filtra sugestões já dispensadas
   - Frontend também verifica localStorage (fallback)

### Regras de UX

- ❌ Mesma sugestão não aparece 2x
- ❌ Sugestão rejeitada não reaparece
- ❌ No máximo 1 sugestão ativa
- ❌ Nunca bloquear ação do usuário

## 📊 Analytics

### Eventos Simples

- `suggestion_shown` - Sugestão exibida
- `suggestion_accepted` - Usuário aceitou
- `suggestion_dismissed` - Usuário dispensou
- `trilha_updated` - Usuário mudou trilha após sugestão

### Métricas Certas

**Não medir:**
- Cliques
- Taxa de conversão

**Medir:**
- Aumento de preenchimento espontâneo das trilhas
- Tempo entre prazer → aprendizado
- Quantidade de usuários que ignoram tudo e continuam usando

**Ignorar e continuar usando = confiança.**

## 🚀 API

### GET /profile/inference

Retorna inferências já filtradas (sem sugestões dispensadas).

### POST /profile/inference/action

Registra ação do usuário:
```json
{
  "suggestionId": "physical_to_learning_xxx",
  "action": "accept" | "dismiss"
}
```

## ✅ Checklist Final

- [x] Usuário nunca se sente avaliado
- [x] Usuário nunca se sente cobrado
- [x] Sugestões parecem conversa, não sistema
- [x] Três trilhas nunca se misturam
- [x] Dá para usar o produto sem aceitar nenhuma sugestão

## 🎯 Resultado Esperado

- Usuário sente que o sistema o acompanha
- Sugestões parecem naturais
- Nenhuma sensação de pressão ou funil
- Sistema observa, sugere e respeita



























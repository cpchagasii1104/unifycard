# Matching Humano

## 🎯 Objetivo

Conectar pessoas que estão em estados compatíveis,
não pessoas que "se parecem no perfil".

## 🧠 Princípios

1. **Conexão por momento**: Estado atual, não histórico inteiro
2. **Afinidade semântica**: Categorias, não cargo
3. **Proximidade de fase**: Nem muito à frente, nem atrás
4. **Sem pressão**: Sistema sugere, nunca força

## 🚫 O que o Matching NÃO É

- ❌ Dating
- ❌ Networking agressivo
- ❌ "Quem é melhor"
- ❌ Busca manual infinita
- ❌ Ranking ou métricas públicas

## 🧩 Tipos de Matching

### 1. Matching de Exploração
**Para:** Explorador, Curioso
**Entrega:** Pessoas descobrindo coisas parecidas, conversa leve, zero pressão
**Copy:** "Tem gente explorando algo parecido"

### 2. Matching de Aprendizado
**Para:** Curioso, Em Transição, Profissional em Formação
**Entrega:** Pares, pequenos grupos, gente um passo à frente ou ao lado
**Nunca:** Mentor "guru", hierarquia explícita

### 3. Matching de Espelhamento
**Para:** Profissional Estável, Em Risco
**Entrega:** Pessoas com histórias parecidas, conversas humanas, sensação de "não estou sozinho"

## 🔐 Regra de Ouro

**O sistema sugere conexões. Nunca força contato. Nunca expõe rejeição.**

Se alguém ignora → some.
Sem notificação. Sem ego ferido.

## 🧭 Lógica de Priorização

1. Estado compatível
2. Afinidade Físico / Aprendizado
3. Atividade recente
4. Distância de fase (nem muito à frente, nem atrás)

Nada além disso.

## 📦 Componentes

### `MatchSuggestion`
- 1 pessoa ou grupo (max 3)
- Texto humano
- CTA leve: "Conhecer" / "Agora não"

### `MatchSection`
- Títulos humanos:
  - "Pessoas explorando algo parecido"
  - "Gente aprendendo isso também"
  - "Histórias que podem te interessar"
- Nunca: "Recomendado para você", "Algoritmo sugere"

## 🚀 API

### GET /matching/suggestions

Retorna sugestões de matching:
```json
{
  "ok": true,
  "data": {
    "suggestions": [
      {
        "id": "exploration_1",
        "type": "exploration",
        "users": [...],
        "title": "Pessoas explorando algo parecido",
        "message": "Tem gente descobrindo coisas similares ao que você curte.",
        "priority": 8
      }
    ],
    "hasMore": false
  }
}
```

### POST /matching/action

Registra ação do usuário:
```json
{
  "matchId": "exploration_1",
  "action": "accept" | "dismiss"
}
```

## 📊 Métricas Certas

**Ignore:**
- Número de matches
- Taxa de aceitação imediata

**Observe:**
- Conversas iniciadas espontaneamente
- Retorno após primeira conexão
- Tempo até segunda conexão aceita

**Poucas conexões boas > muitas ruins.**

## ✅ Checklist

- [x] Conexões parecem naturais
- [x] Usuário não sente pressão social
- [x] Matching respeita o momento de vida
- [x] Base para comunidades e conversas reais
- [x] Rejeições não geram feedback visível
- [x] Conexões ignoradas não reaparecem
- [x] Nunca exibir rankings ou métricas públicas



























# Oportunidades Suaves

## 🎯 Objetivo

Apresentar possibilidades ao usuário no momento certo,
sem pressão, sem funil e sem obrigação de ação.

## 🧠 Princípios

1. **No tempo certo**: Só aparece quando condições são atendidas
2. **Sem pressão**: Pode ser ignorada sem consequência
3. **Sem funil**: Nunca empurra decisão
4. **Contextual**: Aparece no feed, não como aba separada

## 🚫 O que as Oportunidades NÃO São

- ❌ Vagas de emprego
- ❌ Jobs
- ❌ Pitch de venda
- ❌ "Se candidate"
- ❌ "Ganhe dinheiro"
- ❌ "Monetize seu talento"

## ✅ O que as Oportunidades São

- ✅ "Isso existe"
- ✅ "Talvez faça sentido"
- ✅ "Quando você quiser"

## 🔒 Regra Dura de Aparição

Uma oportunidade **SÓ aparece** se:

1. ✅ Aprendizado ativo (usuário tem categorias de aprendizado)
2. ✅ Progresso >= Intermediário (pelo menos uma categoria em nível intermediário ou avançado)
3. ✅ Afinidade clara com Profissional (inferência detecta transição ou formação profissional)

**Se qualquer condição falhar → não aparece.**

**Nunca:**
- ❌ No onboarding
- ❌ Antes de confiança
- ❌ Sem aprendizado ativo

## 🧩 Tipos de Oportunidade

### 1. Exploratória
**Para:** Quem está em transição
**Exemplos:** Projetos pequenos, colaborações, convites leves
**Copy:** "Experimentar sem compromisso"

### 2. Comunitária
**Para:** Quem quer pertencer
**Exemplos:** Grupos fechados, coletivos, iniciativas, comunidades temáticas
**Não é:** Job
**É:** Ambiente

### 3. Profissional Suave
**Para:** Quem já está pronto, mas não foi empurrado
**Exemplos:** Oportunidades reais, parcerias, projetos pagos
**Nunca:** Urgência, escassez, ranking

## 🔐 Regra de Ouro

**Oportunidade nunca pede ação imediata.**
**Ela pode ser ignorada sem consequência.**

Se parecer funil → falhou.

## 🧭 Onde Aparece

- ✅ Como bloco discreto no feed contextual
- ✅ Após matching bem-sucedido (futuro)
- ✅ Como continuação natural de uma conversa (futuro)

**Nunca:**
- ❌ Vira aba separada
- ❌ Vira feed próprio
- ❌ Vira lista de oportunidades

**Contexto manda. Sempre.**

## 📦 Componente Único

### `OpportunitySuggestion`
- Mesma governança das sugestões contextuais
- Mesma lógica de dismiss
- Mesma linguagem humana
- Componente único (não fragmentar)

## 🚀 API

### GET /opportunities/contextual

Retorna oportunidades contextuais (só se condições forem atendidas):
```json
{
  "ok": true,
  "data": {
    "opportunities": [
      {
        "id": "exploratory_1",
        "type": "exploratory",
        "title": "Projeto colaborativo em fotografia",
        "description": "Um grupo está criando um projeto coletivo. Você pode participar quando quiser, sem compromisso.",
        "priority": 7
      }
    ],
    "hasMore": false
  }
}
```

### POST /opportunities/action

Registra ação do usuário:
```json
{
  "opportunityId": "exploratory_1",
  "action": "accept" | "dismiss"
}
```

## 📊 Métricas Certas

**Ignore:**
- Conversão imediata
- Clique rápido

**Observe:**
- Tempo até aceitar a primeira oportunidade
- Correlação com matching
- Retenção após ignorar oportunidades

**Ignorar e continuar usando = confiança intacta.**

## ✅ Checklist

- [x] Oportunidade é opcional
- [x] Pode ser ignorada sem impacto
- [x] Nunca exibir urgência ou escassez
- [x] Nunca bloquear fluxo
- [x] Aparece apenas quando condições são atendidas
- [x] Linguagem humana e respeitosa
- [x] Integrada ao feed contextual

## 🎯 Resultado Esperado

- Usuário sente que existem caminhos
- Nenhuma sensação de cobrança
- Monetização futura possível sem quebrar confiança
- Sistema respeita fases da vida














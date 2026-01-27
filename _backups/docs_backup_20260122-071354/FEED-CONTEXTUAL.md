# Feed Contextual

## 🎯 Objetivo

Um feed que encontra a pessoa, não o contrário.
Conteúdo que reflete o momento do usuário, não sua identidade fixa.

## 🧠 Princípios

1. **Reflexo vivo do raio-X**: Consome Físico, Aprendizado, Profissional e Inferência
2. **Espelho de momento**: Não identidade fixa
3. **Silenciosamente inteligente**: Não parece algoritmo
4. **Nunca pede nada**: Só oferece

## 📦 O que o Feed É

- ✅ Conteúdo alinhado ao estado atual
- ✅ Conteúdo alinhado ao prazer
- ✅ Conteúdo alinhado ao aprendizado
- ✅ Conteúdo de transição (histórias, trajetórias)
- ✅ Conteúdo humano (pessoas com afinidade)

## 🚫 O que o Feed NÃO É

- ❌ Feed cronológico
- ❌ Feed de seguidores
- ❌ Feed de autopromoção
- ❌ Feed "pra postar qualquer coisa"
- ❌ Feed que pede ação

## 🧩 Tipos de Conteúdo

### 1. Conteúdo de Prazer
**Origem:** Físico
**Exemplos:** Vídeos leves, textos curtos, inspirações, experiências
**Copy implícita:** "Isso combina com você agora"

### 2. Conteúdo de Aprendizado
**Origem:** Aprendizado
**Exemplos:** Artigos, dicas, micro-aprendizados, pessoas ensinando
**Nunca:** Curso longo, CTA agressivo, cobrança de progresso

### 3. Conteúdo de Transição
**Origem:** Inferência
**Exemplos:** Histórias reais, "como comecei", bastidores, trajetórias humanas
**Ouro do feed:** Não ensina. Não vende. Mostra caminhos.

### 4. Conteúdo Humano
**Origem:** Afinidade + Estado
**Exemplos:** Alguém parecido, alguém um passo à frente, alguém explorando a mesma coisa
**Nunca:** Comparação direta, ranking, métricas visíveis

## 🔐 Regra de Ouro

**O feed nunca pede nada do usuário. Ele só oferece.**

Se o feed começar a "chamar", "convocar", "pressionar" → quebrou.

## 🧭 Lógica de Prioridade

Em ordem:
1. Conteúdo alinhado ao estado atual
2. Conteúdo alinhado ao prazer
3. Conteúdo alinhado ao aprendizado
4. Conteúdo de transição (com moderação)

⚠️ Nunca misturar tudo no mesmo bloco.

## 📦 Componentes

### `FeedCard`
- Conteúdo simples
- Sem CTA pesado
- Reação leve (salvar / ignorar)

### `FeedSection`
- Agrupa por contexto
- Título humano:
  - "Talvez você curta"
  - "Você pode gostar de explorar"
  - "Pessoas em algo parecido"

### `FeedContextHeader` (opcional)
- Exemplo: "Hoje seu perfil está mais voltado para criar e explorar."
- ⚠️ Nunca técnico. Nunca explícito.

## 🚀 API

### GET /feed/contextual

Retorna feed contextual baseado no estado inferido:
```json
{
  "ok": true,
  "data": {
    "userState": "curious",
    "contextHeader": "Você está explorando e aprendendo ao mesmo tempo.",
    "sections": [
      {
        "id": "pleasure",
        "title": "Talvez você curta",
        "subtitle": "Conteúdo leve para o seu momento",
        "contentType": "pleasure",
        "contents": [...],
        "priority": 8
      }
    ],
    "hasMore": false
  }
}
```

## 📊 Métricas Certas

**Não medir:**
- Likes
- Comentários
- Tempo infinito

**Medir:**
- Retorno espontâneo
- Scroll curto + frequência
- Salvamentos silenciosos
- Mudança gradual de trilha

## ✅ Checklist

- [x] Feed parece "feito para mim"
- [x] Usuário não se sente cobrado
- [x] Conteúdo acompanha o momento de vida
- [x] Base para evolução futura (matching, oportunidades)
- [x] Nunca exige ação
- [x] Linguagem humana
- [x] Não exibe métricas públicas



























# Arquitetura Completa - Raio-X do Usuário

## 🎯 Visão Geral

Sistema completo de entendimento do usuário baseado em **três trilhas** e **quatro camadas de inteligência**.

---

## 🧩 TRILHAS (Fonte de Verdade)

### 1. Físico (context: 'interest')
**Pergunta:** "O que você faz porque te dá prazer?"
**Princípio:** Coisas que a pessoa faria mesmo se ninguém visse e ninguém pagasse
**Estrutura:** Categoria → Subcategoria → Atividades

### 2. Aprendizado (context: 'learning')
**Pergunta:** "O que você está aprendendo ou quer aprender?"
**Princípio:** Foco em processo de aprendizagem, não em identidade profissional
**Estrutura:** Categoria → Subcategoria → Temas

### 3. Profissional (context: 'professional')
**Pergunta:** "Como você gera renda ou quer gerar?"
**Princípio:** Tudo aqui tem implicação fiscal, reputacional ou de oferta
**Estrutura:** Categoria → Subcategoria → Profissões

---

## 🧠 CAMADAS DE INTELIGÊNCIA

### 1. Motor de Inferência
**Arquivo:** `backend/src/core/profile/profile-inference.service.ts`
**Função:** Observa padrões entre trilhas e detecta estado do usuário
**Estados:** `explorer`, `curious`, `in_transition`, `professional_training`, `professional_stable`, `at_risk`
**API:** `GET /profile/inference`

### 2. Sugestões Contextuais
**Arquivo:** `frontend/src/components/ContextualSuggestion.tsx`
**Função:** Exibe sugestões humanas baseadas em inferência
**Regras:** Uma sugestão por vez, opcional, dismissível
**API:** `GET /profile/inference`, `POST /profile/inference/action`

### 3. Feed Contextual
**Arquivo:** `backend/src/core/feed/feed.service.ts`
**Função:** Entrega conteúdo relevante ao momento do usuário
**Tipos:** Prazer, Aprendizado, Transição, Humano
**API:** `GET /feed/contextual`

### 4. Matching Humano
**Arquivo:** `backend/src/core/matching/matching.service.ts`
**Função:** Conecta pessoas em estados compatíveis
**Tipos:** Exploração, Aprendizado, Espelhamento
**API:** `GET /matching/suggestions`, `POST /matching/action`

### 5. Oportunidades Suaves
**Arquivo:** `backend/src/core/opportunity/opportunity.service.ts`
**Função:** Apresenta possibilidades no tempo certo
**Tipos:** Exploratória, Comunitária, Profissional Suave
**Regra Dura:** Só aparece se condições forem atendidas
**API:** `GET /opportunities/contextual`, `POST /opportunities/action`

---

## 🔒 TRAVAS DE GOVERNANÇA

### Trava 1: CONTEXTO
- Físico só consome `context: 'interest'`
- Aprendizado só consome `context: 'learning'`
- Profissional só consome `context: 'professional'`
- **PR bloqueado se violar**

### Trava 2: LINGUAGEM
- Copy oficial é o teto, não o chão
- Nunca parecer algoritmo, funil ou coaching
- **Revisar PRs contra `TRAVAS-FINAIS.md`**

### Trava 3: AMBIÇÃO
- Nunca automatizar decisão de vida
- Sugestão: sim | Pré-preencher: não
- **Se alguém sugerir "otimizar conversão" → NÃO**

---

## 📊 MÉTRICAS CERTAS

### Observar
- Retorno espontâneo (D1/D7)
- Scroll curto + frequência
- Salvamentos silenciosos
- Mudança natural entre trilhas (30-60 dias)

### Ignorar
- Clique
- Like
- Match count
- Conversão imediata

---

## 🎯 RESULTADO FINAL

Sistema que:
- Entende pessoas em fases diferentes
- Respeita silêncio
- Sugere sem invadir
- Cresce sem se tornar tóxico

**Base de produto de década, não de trimestre.**

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `TRAVAS-FINAIS.md` - Governança do raio-X
- `FEED-CONTEXTUAL.md` - Documentação do feed
- `MATCHING-HUMANO.md` - Documentação do matching
- `OPORTUNIDADES-SUAVES.md` - Documentação de oportunidades
- `ENCERRAMENTO-ATIVACAO.md` - Plano de ativação controlada



























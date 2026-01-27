# Travas Finais - Governança do Raio-X

## 🔒 Trava 1: CONTEXTO (Técnica)

**Regra:**
Nunca mais permitir que `context === 'interest' | 'learning' | 'professional'` seja usado fora da trilha correspondente.

**Implementação:**
- Físico só consome `context: 'interest'`
- Aprendizado só consome `context: 'learning'`
- Profissional só consome `context: 'professional'`

**Validação em PR:**
Se alguém tentar:
- Usar categoria `learning` no Físico
- Usar categoria `interest` no Profissional
- Usar categoria `professional` no Aprendizado

👉 **PR bloqueado.**

## 🔒 Trava 2: LINGUAGEM (Produto)

**Regra:**
Se o texto parecer:
- Coaching
- Algoritmo
- Funil

→ **Está errado.**

**Copy oficial é o teto, não o chão:**
- ✅ "Percebi que você gosta de [X]. Quer aprender um pouco mais?"
- ✅ "Você já está se aprofundando nisso. Já pensou em levar mais adiante?"
- ✅ "E fora do trabalho, o que te faz bem?"

**Nunca:**
- ❌ "Recomendamos"
- ❌ "O sistema detectou"
- ❌ "Baseado nos seus dados"

## 🔒 Trava 3: AMBIÇÃO

**Regra de Ouro:**
Nunca automatizar uma decisão de vida do usuário.

**Permitido:**
- ✅ Sugestão
- ✅ Observação
- ✅ Acompanhamento

**Nunca:**
- ❌ Pré-preencher
- ❌ Mover usuário de trilha automaticamente
- ❌ Forçar transição

**Se alguém sugerir:**
- "Vamos automatizar isso"
- "Vamos pré-preencher"
- "Vamos empurrar o funil"

👉 **Não fazer.**

## 🧪 Teste Real

**Antes de abrir para muita gente:**

Pegue 3 perfis reais:
- Alguém perdido
- Alguém curioso
- Alguém profissional cansado

Peça só:
**"Preenche teu perfil como você quiser."**

**Se acontecer isso:**
- ✅ Ninguém pergunta "o que isso significa?"
- ✅ Ninguém pergunta "onde coloco isso?"
- ✅ Ninguém sente pressão

👉 **Você venceu.**

## ✅ Checklist de Validação

- [ ] Usuário nunca se sente avaliado
- [ ] Usuário nunca se sente cobrado
- [ ] Sugestões parecem conversa, não sistema
- [ ] Três trilhas nunca se misturam
- [ ] Dá para usar o produto sem aceitar nenhuma sugestão
- [ ] Feed nunca pede ação
- [ ] Linguagem sempre humana

## 🎯 Resultado Esperado

- Sistema observa, sugere e respeita
- Usuário sente que o sistema o acompanha
- Nenhuma sensação de pressão ou funil
- Produto adulto, não MVP



























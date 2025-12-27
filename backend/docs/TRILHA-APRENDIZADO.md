# Trilha de Aprendizado - "O Que Você Está Aprendendo"

## 🎯 Princípio-Mãe

**APRENDIZADO = coisas que a pessoa está tentando aprender, melhorar ou explorar com intenção.**

Não é obrigação formal. Não é renda. É direção.

## 📋 Separação das Três Trilhas

### 1️⃣ PROFISSIONAL
**Pergunta:** "Como você gera renda ou quer gerar?"
- Linguagem: objetiva, formal
- Termos: cargos, serviços, áreas
- Exemplo: Pedreiro, Desenvolvedor Backend, Cuidador de Idosos

### 2️⃣ APRENDIZADO / TRILHA
**Pergunta:** "O que você está aprendendo ou gostaria de aprender?"
- Linguagem: processo, evolução
- Termos: temas de aprendizagem, não cargos
- Exemplo: "Programação Básica", "Fotografia", "Culinária"
- Pode ter: interesses que ainda não são profissão, atividades que talvez nunca sejam

### 3️⃣ FÍSICO / MOMENTO PRAZER
**Pergunta:** "O que você faz porque te dá prazer?"
- Linguagem: leve, experiencial, cotidiana
- Foco: desligar do mundo, relaxar

## 🌳 Estrutura do Aprendizado

### 1. Criatividade e Expressão
- Desenho e Ilustração
- Fotografia
- Vídeo
- Escrita Criativa
- Música
- Design

### 2. Tecnologia e Digital
- Programação
- Inteligência Artificial
- Ferramentas Digitais
- Games (desenvolvimento)

### 3. Comunicação e Conteúdo
- Produção de Conteúdo
- Redes Sociais
- Escrita Profissional
- Oratória
- Marketing Digital

### 4. Bem-Estar e Corpo
- Nutrição
- Atividade Física
- Saúde Mental

### 5. Gastronomia e Sabores
- Culinária
- Confeitaria
- Panificação

### 6. Negócios e Empreendedorismo
- Empreender
- Vendas
- Gestão
- Finanças Pessoais
- Organização e Produtividade

### 7. Casa, Manual e Prático
- Marcenaria
- Jardinagem
- DIY
- Manutenção Básica
- Decoração

### 8. Educação e Conhecimento Geral
- Idiomas
- História
- Filosofia
- Ciências
- Estudos Gerais

## 🚀 Como Executar

```bash
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/seed-learning-categories.ts
```

## ✅ Mudanças Implementadas

### Backend
- ✅ Novo seed `seed-learning-categories.ts` com estrutura focada em aprendizado
- ✅ Service `profile-learning.service.ts` para gerenciar perfil de aprendizado
- ✅ Routes `profile-learning.routes.ts` com endpoints GET/PUT
- ✅ Todas as categorias criadas com `context: 'learning'`
- ✅ Suporte a `context: 'learning'` em autocomplete, suggestPath e createCategoryWithAI

### Frontend
- ✅ Novo componente `ProfileLearning.tsx`
- ✅ API client `learning.ts` com getLearningProfile e updateLearningProfile
- ✅ Título: "O Que Você Está Aprendendo"
- ✅ Descrição focada em direção: "O que você está aprendendo ou gostaria de aprender?"
- ✅ Campo de progresso (Iniciante, Intermediário, Avançado)
- ✅ Validação obrigatória de seleção
- ✅ Nova aba "Aprendizado" no Profile.tsx

## 🔒 Regras de Validação

1. **Nunca mais entram no Aprendizado:**
   - Cargos profissionais diretos
   - Identidade profissional
   - Promessas de renda

2. **Sempre entram:**
   - Temas de aprendizagem
   - Processos de evolução
   - Exploração com intenção

## 🧩 Como as 3 Trilhas Se Conectam

Exemplo real:

**Físico:**
- "Criar & Expressar → Fotografia"

**Aprendizado (inferido ou escolhido):**
- "Criatividade & Expressão → Fotografia"

**Profissional (quando fizer sentido):**
- "Fotógrafo"

👉 O sistema não força. Ele acompanha a evolução humana.

## 📊 Resultado Esperado

- ✅ Usuário entende claramente que Aprendizado = direção
- ✅ Não há confusão entre trabalho, aprendizado e hobby
- ✅ Sistema pode inferir transições entre trilhas
- ✅ Base sólida para recomendações e matching














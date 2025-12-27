# Reorganização do Físico - Foco em Prazer

## 🎯 Princípio-Mãe

**FÍSICO = coisas que a pessoa faria mesmo se ninguém visse e ninguém pagasse.**

Se a categoria fizer o usuário se perguntar "isso vira trabalho?" → **NÃO É FÍSICO**.

## 📋 Separação das Três Trilhas

### 1️⃣ PROFISSIONAL
**Pergunta:** "Como você gera renda ou quer gerar?"
- Linguagem: objetiva, formal
- Termos: cargos, serviços, áreas
- Exemplo: Pedreiro, Desenvolvedor Backend, Cuidador de Idosos

### 2️⃣ APRENDIZADO / TRILHA
**Pergunta:** "O que você está aprendendo ou quer aprender?"
- Linguagem: processo, evolução
- Termos: "Introdução à Fotografia", "Programação para Iniciantes"
- Pode ter: interesses que ainda não são profissão, atividades que talvez nunca sejam

### 3️⃣ FÍSICO / MOMENTO PRAZER
**Pergunta:** "O que você faz porque te dá prazer?"
- Linguagem: leve, experiencial, cotidiana
- Foco: desligar do mundo, relaxar
- ❌ NÃO pode parecer trabalho, obrigação ou rótulo profissional

## 🌳 Nova Estrutura do Físico

### 1. Assistir e Consumir Conteúdo
- Filmes
- Séries
- Vídeos Online
- Cinema

### 2. Jogar e Brincar
- Jogos Digitais
- Jogos de Mesa
- Jogos Online
- E-sports

### 3. Ler e Aprender por Prazer
- Leitura Recreativa
- HQs e Mangás
- Escrita Pessoal

### 4. Ouvir e Fazer Música
- Ouvir Música
- Tocar Instrumentos
- Cantar
- Produção Musical (hobby)

### 5. Criar e Expressar
- Artes Visuais
- Vídeo Criativo
- Artesanato

### 6. Cozinhar e Comer Bem
- Cozinhar em Casa
- Confeitaria
- Churrasco
- Gastronomia (hobby)

### 7. Se Movimentar
- Atividades Físicas
- Esportes Recreativos

### 8. Cuidar de Si
- Bem-Estar

### 9. Natureza e Ar Livre
- Atividades na Natureza

### 10. Desacelerar e Relaxar
- Tempo para Si (Relaxar, Não Fazer Nada, Silêncio, Rotina Leve, Pausa Digital)

## 🚀 Como Executar a Migração

### Passo 1: Arquivar Categorias Antigas
```bash
cd backend
npx ts-node -r tsconfig-paths/register src/scripts/migrate-physical-categories.ts
```

Este script arquiva categorias antigas que não se encaixam no novo modelo.

### Passo 2: Criar Novas Categorias
```bash
npx ts-node -r tsconfig-paths/register src/scripts/seed-physical-categories.ts
```

Este script cria as novas categorias baseadas em verbos de prazer.

## ✅ Mudanças Implementadas

### Backend
- ✅ Novo seed `seed-physical-categories.ts` com estrutura focada em prazer
- ✅ Script de migração `migrate-physical-categories.ts` para arquivar categorias antigas
- ✅ Todas as categorias criadas com `context: 'interest'`

### Frontend
- ✅ Título atualizado: "O Que Você Gosta de Fazer"
- ✅ Descrição focada em prazer: "O que você faz porque te dá prazer?"
- ✅ Labels atualizados para refletir atividades de prazer
- ✅ Placeholders mais intuitivos
- ✅ Mensagens focadas em "atividades de prazer" ao invés de "interesses"

## 🎨 Linguagem no Frontend

### Antes
- "Perfil Físico e Interesses"
- "Buscar Interesse ou Hobby"
- "Seus Interesses"

### Depois
- "O Que Você Gosta de Fazer"
- "O que você gosta de fazer no seu tempo livre?"
- "O Que Você Gosta de Fazer (X)"

## 🔒 Regras de Validação

1. **Nunca mais entram no Físico:**
   - Profissões
   - Serviços
   - Tecnologia "como área"
   - Comércio
   - Educação formal
   - Transporte

2. **Se alguém quiser forçar → vai para:**
   - Aprendizado (se está aprendendo)
   - Profissional (se é trabalho)

## 📊 Resultado Esperado

- ✅ Usuário entende claramente que Físico = prazer
- ✅ Não há confusão entre trabalho e hobby
- ✅ Recomendação social funciona melhor
- ✅ Matching é mais preciso
- ✅ IA aprende corretamente

## 🧪 Validação

Após executar os scripts, verifique:

1. Categorias antigas estão arquivadas (status = 'archived')
2. Novas categorias estão ativas (status = 'active')
3. Frontend mostra nova linguagem
4. Usuário consegue selecionar atividades de prazer
5. Não há categorias profissionais no Físico

## 📝 Notas Importantes

- Categorias arquivadas não são deletadas, apenas marcadas como 'archived'
- Dados existentes de usuários são preservados
- A migração é idempotente (pode ser executada múltiplas vezes)
- O seed também é idempotente (ignora categorias que já existem)














Status: NON-NORMATIVE
Purpose: Explanation only
Authority: None
# 📘 CANONICAL_CONTEXT_FOR_AI.md

*(Arquivo canônico de leitura obrigatória para qualquer IA que analise o UnifiCard)*

---

## 1. VISÃO GERAL DO UNIFICARD (CANÔNICA)

O UnifiCard é um sistema social-econômico integrado.

Ele NÃO é apenas:
- um marketplace
- uma rede social tradicional
- um sistema de perfil pessoal

Ele é um **sistema de interseção semântica** entre:
- pessoas
- atividades econômicas
- interesses declarados
- objetos do mundo (eventos, grupos, empresas, conteúdos)

> **Regra fundamental:**  
> O sistema NÃO entende pessoas.  
> O sistema entende interseções entre sinais declarados e objetos do mundo.

---

## 2. PRINCÍPIOS ARQUITETURAIS (OBRIGATÓRIOS)

- Preferência ≠ identidade  
- Hábito ≠ destino  
- Interesse ≠ classificação humana  

Nenhuma informação declarada pelo usuário:
- define quem ele é
- cria rótulos
- gera score
- libera ou bloqueia acesso
- altera preço ou permissões

IA **NUNCA** decide sobre usuários.  
IA apenas **ajuda na organização, sugestão e leitura de sinais**.

---

## 3. PERFIS DO USUÁRIO — DEFINIÇÕES CANÔNICAS

### 3.1 Perfil PROFISSIONAL

Representa:
- setor de atuação econômica
- profissões exercidas
- configuração de como a pessoa deseja trabalhar

NÃO representa:
- identidade pessoal
- status
- currículo
- ranking
- tipo de pessoa

#### Agenda Profissional (CRÍTICO)
- A agenda é **UNIFICADA**
- Horário bloqueado bloqueia **todas as profissões**
- NÃO existe agenda por profissão

O profissional configura:
1. Agenda
2. Profissões
3. Forma de atuação

Nunca o contrário.

---

### 3.2 Perfil INTERESSES E GOSTOS  
*(antigo “Físico” — renomeado canonicamente)*

Representa:
- interesses
- gostos
- hábitos
- práticas do dia a dia

É:
- declarativo
- voluntário
- mutável
- contextual

NÃO é:
- saúde clínica
- personalidade
- score
- identidade fixa
- classificação humana

Serve apenas para:
- sugestões
- descobertas
- cruzamento com objetos do mundo

---

### 3.3 Perfil APRENDIZADO
Relacionado a:
- temas que a pessoa quer aprender
- interesses educacionais
- desenvolvimento pessoal

Não interfere em ranking ou status.

---

### 3.4 Pessoa Jurídica
Representa entidades econômicas, não pessoas.

---

## 4. SISTEMA DE CATEGORIAS (BACKEND — DECISÃO CANÔNICA)

O sistema canônico de categorias do backend é:

> **`src/core/categories` (plural)**

Motivos:
- ontologia de longo prazo
- validação semântica
- workflow de status
- contexto de uso
- políticas e auditoria
- integração futura com IA

O sistema `src/core/category` (singular) **não é canônico**.

---

## 5. CATEGORIAS NO PROFISSIONAL (CONGELADAS)

Categorias válidas no PROFISSIONAL:
- Educação e Conhecimento
- Finanças e Economia
- Mobilidade e Logística
- Organizações e Instituições
- Produtos e Comércio
- Serviços
- Tecnologia e Sistemas
- Saúde e Bem-Estar
- Cultura, Lazer e Eventos

Categorias que **NÃO entram** no profissional:
- Pessoas e Perfis
- Comunidades e Grupos
- Causas e Impacto Social

---

## 6. INTERESSES E GOSTOS — MODELO SEMÂNTICO

### Camada 1 — Domínios de Vida (UI apenas)
Usados somente para organização visual.

Domínios iniciais:
- Atividades e Práticas
- Lazer e Entretenimento
- Leitura e Conteúdo
- Música e Cultura
- Gastronomia e Consumo
- Hábitos e Rotinas
- Experiências, Viagens e Eventos

Domínios:
- NÃO são salvos como identidade
- NÃO são filtros sistêmicos
- NÃO decidem nada

---

### Camada 2 — Concept IDs (interno)
Cada interesse mapeia para um **Concept ID canônico**.

Exemplos:
- activity.swimming
- leisure.videogames
- music.rock
- leisure.reading

O usuário **nunca vê** Concept IDs.

---

### Camada 3 — Declaração do Usuário
O usuário pode:
- selecionar
- digitar
- editar
- remover

Estados possíveis (qualitativos, não comparáveis):
- Curto
- Faço
- Faço com frequência

Sem score.  
Sem ranking.  
Sem rótulos.

---

## 7. USO DOS DADOS (LIMITES CLAROS)

É permitido:
- sugerir eventos
- sugerir grupos
- sugerir conteúdos
- sugerir empresas

É proibido:
- bloquear acesso
- liberar recursos
- inferir saúde
- inferir personalidade
- classificar usuários

A pergunta sistêmica correta é sempre:

> “Este objeto compartilha conceitos com interesses declarados pelo usuário?”

Nunca:
> “Este usuário é do tipo X?”

---

## 8. ANTI-PATTERNS (NÃO FAZER)

- “usuário gamer”
- “perfil fitness”
- “usuário ideal”
- score oculto
- ranking social
- inferência psicológica
- inferência clínica

Se surgir dúvida:
👉 **conter, não expandir**.

---

## 9. PAPEL DA IA (CLAUDE, GPT, ETC.)

A IA pode:
- sugerir vocabulário
- melhorar microcopy
- identificar ambiguidades
- alertar riscos semânticos

A IA NÃO pode:
- redefinir arquitetura
- criar regras de negócio
- classificar pessoas
- decidir fluxos
- “melhorar” o sistema sozinha

---

## 10. REGRA FINAL (ABSOLUTA)

> **O humano governa.  
> A IA sugere.  
> O sistema cruza sinais.  
> Pessoas nunca são rotuladas.**

---

### 📌 COMO USAR ESTE ARQUIVO

Antes de qualquer IA analisar o UnifiCard:
1. **Ela deve ler este arquivo integralmente**
2. Este documento é **autoridade máxima**
3. Qualquer sugestão que o contradiga deve ser descartada

---

## 🧊 STATUS

Este documento define o **estado canônico atual do sistema**.  
Mudanças só ocorrem por decisão humana explícita.


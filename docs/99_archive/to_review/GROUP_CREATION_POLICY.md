📄 DOCUMENTO — GROUP_CREATION_POLICY.md

👉 Copie e cole exatamente isso:

# GROUP CREATION POLICY — UnifiCard

Status: **Ativo**
Versão: **1.0**
Escopo: **Governança de Criação de Grupos**

---

## 🎯 Objetivo

Definir regras claras, previsíveis e escaláveis para **criação de grupos** no UnifiCard,
sem misturar governança social com regras econômicas (ledger / split).

---

## 🧠 Princípio Central

> Criar um grupo **não é** o mesmo que participar de impacto econômico.

- Criação de grupo é um **ato organizacional**
- Participação em split é um **ato econômico**
- Essas regras **não devem ser acopladas**

---

## 📜 Regra Canônica (v1)

### 🚦 Regra Atual (MVP)

**Limite inicial de criação: 1 grupo por usuário**

- Um usuário pode criar **NO MÁXIMO 1 grupo**
- Se tentar criar outro, recebe erro HTTP 403 com código `GROUP_CREATION_LIMIT_REACHED`
- Mensagem ao usuário: *"Você já criou um grupo. No momento, cada usuário pode criar apenas um grupo."*

**Não depende de:**
- Número de membros
- Split econômico
- Regra dos 3 grupos
- Participação em outros grupos

**Aplica-se antes de qualquer criação** (no backend, via `GroupCreationPolicy`)

### 🔓 Evolução Planejada (não implementada ainda)

O limite de criação poderá aumentar com base em:

- **Impacto econômico (ledger)**: Grupos que geram transações reais
- **Atividade real do grupo**: Membros ativos, posts, eventos
- **Eventos ou serviços concluídos**: Grupos que completam ações
- **Reputação do criador**: Histórico de grupos bem-sucedidos

**Exemplo futuro:**
- Cada grupo que gerar impacto real desbloqueia +1 slot de criação
- Limite máximo pode ser definido (ex: 5 grupos por usuário)
- Desbloqueio progressivo conforme resultados

❌ O que esta policy NÃO faz

❌ Não limita participação em grupos

❌ Não controla split econômico

❌ Não interage com ledger

❌ Não substitui regras de impacto

Essas responsabilidades pertencem a policies diferentes.

🧱 Implementação Técnica

Local: backend/src/modules/groups/policies/GroupCreationPolicy.ts

Aplicada no service de criação de grupos

Nunca aplicada no frontend

🧭 Mensagem ao Usuário

Quando o limite for atingido, o sistema deve informar:

“Você já criou um grupo.
Quando ele gerar impacto, você poderá criar outros.”

Nunca expor regras internas ou números técnicos.

🏁 Regra Final

Se uma mudança bloquear criação de grupos por motivo econômico,
ela viola esta policy e deve ser rejeitada.


📌 **Isso fecha o Passo 1 no nível de produto.**

---

# ✅ PARTE B — CÓDIGO (USAR O CURSOR)

Agora sim: **o código que garante que o documento é respeitado**.

Você já pediu explicitamente:  
👉 *“se envolver código, use o Cursor”*  
Então aqui vai o **prompt certo**.

---

## 🧠 PROMPT PARA O CURSOR — PASSO 1 (CRIAÇÃO DE GRUPO)

👉 **Cole isso exatamente no Cursor**

```markdown
## Task: Implementar GroupCreationPolicy (limite de criação de grupos)

### Contexto
O UnifiCard precisa separar regras de criação de grupos
de regras econômicas (split / ledger).

Atualmente, existe risco de regras econômicas bloquearem criação,
o que viola a policy oficial definida em `docs/GROUP_CREATION_POLICY.md`.

---

### Objetivo
Implementar uma **GroupCreationPolicy** que:
- Limite criação inicial de grupos a 1 por usuário
- Não utilize regras de split ou participação
- Seja aplicada exclusivamente no backend
- Seja fácil de evoluir futuramente

---

### Arquivos a criar / modificar

#### 1. Criar policy
`backend/src/modules/groups/policies/GroupCreationPolicy.ts`

Responsabilidades:
- Verificar quantos grupos o usuário já criou
- Bloquear criação se limite for atingido
- Não retornar boolean (lançar erro)

---

#### 2. Repositório
No `GroupRepository` (ou equivalente):

Criar método:
```ts
countGroupsCreatedByUser(userId: string): Promise<number>


Query esperada:

SELECT COUNT(*)
FROM groups
WHERE created_by_user_id = $1

3. Aplicar no service

No groups.service.ts (ou equivalente):

Antes de criar o grupo:

await groupCreationPolicy.canCreateGroup(userId);

4. Erro controlado

Se o limite for atingido, lançar erro com código:

GROUP_CREATION_LIMIT_REACHED


E mapear para resposta 403 com mensagem amigável.

Critérios de Aceite

 Usuário consegue criar o primeiro grupo

 Usuário NÃO consegue criar o segundo grupo

 Erro retornado é claro e amigável

 Nenhuma regra econômica interfere na criação

 Frontend não decide nada

 Backend aplica a policy

NÃO FAZER

❌ Não usar regra de split

❌ Não usar regra de “3 grupos”

❌ Não aplicar no frontend

❌ Não hardcode no controller


---

# 🏁 RESUMO FINAL (sem rodeio)

### O que você faz agora:
1. ✅ Cria o documento `GROUP_CREATION_POLICY.md` em `/docs`
2. ✅ Roda o **Cursor com o prompt acima**
3. ✅ Testa: criar 1 grupo funciona, criar 2º bloqueia

Depois disso:
👉 **Passo 1 está oficialmente encerrado**  
👉 A base do produto está sólida  
👉 Não há mais confusão entre criação e economia  

---

## Próximo passo (quando quiser)
Quando você disser **“vamos para o passo 2”**, eu assumo e faço:
- desbloqueio por impacto
- modelo de dados mínimo
- ou policy de split separada

Você agora está operando em **nível de plataforma**, não de feature.
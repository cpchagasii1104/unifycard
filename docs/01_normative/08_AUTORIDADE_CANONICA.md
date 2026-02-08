# **08_AUTORIDADE_CANONICA.md**

**Eixo:** AUTORIDADE / PODER / RESPONSABILIDADE
**Status:** ATIVO (LEI ESTRUTURAL)
**Tipo:** NORMA CANÔNICA
**Última atualização:** **2026-02-08**

---

## 1. FINALIDADE

Este documento define, de forma **canônica, normativa e irreversível**,
como **autoridade é criada, delegada, exercida, revogada e auditada** no sistema.

Ele elimina ambiguidades entre:

* Pessoa (CPF)
* Empresa (CNPJ)
* Actor (representação operacional)

Nenhuma execução, permissão, decisão de poder ou escopo
pode contrariar este documento.

---

## 2. PRINCÍPIO-MÃE

> **Autoridade é sempre delegada.
> Responsabilidade é sempre rastreável.**

O sistema:

* não confia em pessoas
* não confia em empresas
* não confia em sessões
* não confia em identificadores soltos

O sistema confia **exclusivamente** em:

* vínculos documentados
* delegações explícitas
* histórico imutável
* identidade canônica

---

## 3. ENTIDADES CANÔNICAS

### 3.1 Pessoa Física (CPF)

A Pessoa Física é a **âncora moral, jurídica e histórica** do sistema.

Características:

* possui CPF
* possui identidade única
* pode ser bloqueada, suspensa ou banida globalmente
* carrega histórico permanente de atuação

A Pessoa Física:

* **NÃO recebe permissões diretamente**
* **NÃO decide poder**
* **NUNCA desaparece do histórico**

Toda responsabilização **termina no CPF**.

---

### 3.2 Empresa (CNPJ)

A Empresa é a **entidade jurídica**.

Características:

* possui CNPJ
* existe apenas após validação documental
* não executa ações diretamente

A Empresa:

* **não age**
* **não clica**
* **não decide**

Toda ação ocorre **em nome da empresa**,
por meio de um Actor legitimamente delegado.

---

### 3.3 Actor (Representação Operacional)

O Actor é a **única entidade que executa ações** no sistema.

Características:

* representa uma Empresa (CNPJ) **ou** diretamente uma Pessoa Física (CPF)
* possui escopo, intenção e limites claros
* é temporário por definição

Regras absolutas:

* ❌ Actor **NUNCA** existe sem lastro em CPF
* ❌ Actor **NUNCA** é anônimo
* ❌ Actor **NUNCA** pertence a uma pessoa
* ✅ Actor **SEMPRE** pertence à entidade que representa

---

## 4. REGRA FUNDAMENTAL (ANTI-FRAUDE)

> **Um Actor pode existir sem CNPJ.
> Um Actor NUNCA pode existir sem CPF.**

Todo Actor deve possuir:

* pelo menos **UM CPF âncora responsável**
* histórico completo de criação, delegação e atuação

Actor “genérico”, “temporário sem vínculo”
ou “solto no sistema” é **violação estrutural grave**.

---

## 5. ÂNCORA LEGAL

### 5.1 Definição

Âncoras Legais são Pessoas Físicas (CPF) que possuem
**poder legítimo, validado e documentado** sobre uma entidade.

Exemplos:

* sócios
* administradores legais
* representantes definidos em contrato social

---

### 5.2 Regras de Âncora

* Toda Empresa válida deve possuir **ao menos UMA âncora ativa**
* Sem âncora ativa:

  * a empresa entra em estado suspenso
  * nenhum Actor pode atuar

---

## 6. CRIAÇÃO E DELEGAÇÃO DE ACTORS

### 6.1 Quem pode criar Actors

Somente:

* Âncoras Legais
* ou Pessoas explicitamente delegadas por elas

Regra dura:

> **Ninguém pode delegar mais poder do que possui.**

---

### 6.2 Delegação

Delegar poder significa:

* permitir que outro CPF **ocupe temporariamente** um Actor
* sempre com escopo, duração e limites explícitos

Toda delegação registra obrigatoriamente:

* CPF delegador
* CPF ocupante
* Actor
* escopo
* período
* origem da autoridade

---

## 7. VÍNCULO TEMPORÁRIO (OCUPAÇÃO)

A relação correta é:

Pessoa (CPF)
→ ocupa temporariamente
→ Actor
→ representa
→ Empresa (CNPJ **ou** CPF)

Quando o vínculo termina:

* o poder termina
* o acesso termina
* o histórico permanece

---

## 8. REVOGAÇÃO AUTOMÁTICA (REGRA DE SEGURANÇA)

O sistema **DEVE** revogar automaticamente Actors quando:

* o vínculo CPF ↔ Empresa é encerrado
* a Âncora Legal é removida, bloqueada ou expira
* a Empresa é suspensa, encerrada ou invalidada
* há ordem judicial ou bloqueio sistêmico

Revogação é **imediata, automática e não negociável**.

---

## 9. HISTÓRICO E RESPONSABILIZAÇÃO

Regra canônica:

> **Autoridade expira.
> Histórico nunca expira.**

O sistema preserva permanentemente:

* quem criou o Actor
* quem delegou poder
* quem ocupou
* o que foi feito
* quando foi feito
* em nome de quem foi feito

Não existe:

* “reset de histórico”
* “troca de usuário para apagar rastro”
* “saída limpa do sistema”

---

## 10. DECISÃO CANÔNICA — IDENTIDADE E AUTORIDADE

### 10.1 Fonte Única de Autoridade

A **única fonte canônica de identidade e autoridade** no sistema é:

* `users.user_id`
* `users.tenant_id`
* `users.global_user_id`

Toda decisão de escopo, permissão ou isolamento **DEVE** ser resolvida a partir dessa base.

---

### 10.2 Descontinuação de `user_identity_links`

A tabela `user_identity_links`:

* ❌ **NÃO é fonte de autoridade**
* ❌ **NÃO pode ser usada para escopo**
* ❌ **NÃO pode participar de decisões de permissão**
* ❌ **NÃO pode ser usada em JOINs de produção**

Qualquer uso de `user_identity_links` em código ativo
é considerado **violação estrutural do sistema**.

---

## 11. PROIBIÇÕES ABSOLUTAS

É proibido:

* Actor sem CPF responsável
* Actor criado “para depois ver”
* Delegação implícita ou inferida
* Poder baseado em `userId` isolado
* Poder baseado em tabelas auxiliares não canônicas
* Apagar ou mascarar histórico de atuação
* Confiar em usuário sem lastro documental

---

## 12. RELAÇÃO COM ACTIONCONTEXT E RBAC

* **ActionContext** declara:

  * qual Actor está agindo
  * com qual intenção
  * em qual escopo

* **RBAC** decide:

  * se aquele Actor pode executar aquela ação

CPF:

* **NUNCA decide permissão**
* **SEMPRE responde historicamente**

---

## 13. CRITÉRIO DE CONFORMIDADE

O sistema é considerado **conforme** somente se:

* não existir Actor sem CPF
* não existir poder sem delegação explícita
* toda ação for auditável até uma Pessoa Física
* toda revogação encerrar poder imediatamente
* não existir uso de `user_identity_links` em produção

---

**FIM DA NORMA**
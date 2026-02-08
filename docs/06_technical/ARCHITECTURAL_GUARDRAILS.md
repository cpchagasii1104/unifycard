
# ARCHITECTURAL GUARDRAILS — UNIFICARD
Status: CANONICAL · BINDING  
Scope: Architecture · Engineering · CI/CD  
Authority: Overrides implementation convenience  

Este documento consolida e substitui os seguintes arquivos:
- ANTI_PATTERNS.md
- Bússola De Correções.txt
- REGULAMENTO_EXECUCAO.md

Eles deixam de existir como fontes primárias.
Este arquivo é a fonte única de **guardrails arquiteturais**.

---

## 1. PRINCÍPIO FUNDAMENTAL

> Código não decide. Código executa decisões explícitas.

Qualquer lógica que:
- altera comportamento
- concede acesso
- bloqueia fluxo
- muda preço, ranking ou visibilidade

é **decisão** e exige domínio explícito, evento, versão e auditoria.

---

## 2. PROIBIÇÕES ABSOLUTAS (HARD FAIL)

É TERMINANTEMENTE PROIBIDO:

### 2.1 Decisão por Estado Mutável
- users.plan
- users.tier
- users.level
- status genérico
- flags booleanas operacionais

Se pode ser alterado por UPDATE e não tem evento, **não decide nada**.

### 2.2 Categoria como Decisão
- if (category == X)
- score baseado em categoria
- ranking por taxonomia

Categoria é **read-model semântico**, nunca política.

### 2.3 Score como Autoridade
- trust score
- reputation score
- risk level automático

Score:
- pode informar
- pode alertar
- **nunca decide ou ordena sozinho**

### 2.4 Observabilidade Ativa
- métricas disparando fluxo
- analytics alterando UX
- sinais gerando CTA automático

Observabilidade termina em exposição, não em ação.

---

## 3. ANTI-PATTERNS CLÁSSICOS (REJEITAR EM REVIEW)

### ❌ “Só um if temporário”
Temporário vira permanente. Rejeitar.

### ❌ “Depois a gente audita”
Sem trilha desde o início, não existe depois.

### ❌ “Não é decisão, é só ordenação”
Ordenação altera visibilidade → é decisão.

### ❌ “Mas funciona”
Funcionar não é critério arquitetural.

---

## 4. BÚSSOLA DE CORREÇÃO (COMO CONSERTAR)

Se algo parece errado, pergunte:

1. Isso altera comportamento?
2. Isso pode ser explicado depois?
3. Existe evento, regra e versão?
4. Um auditor externo entenderia?

Se qualquer resposta for NÃO → **refatorar**.

Correções válidas:
- Criar domínio explícito de decisão
- Criar evento imutável
- Criar log de decisão
- Rebaixar lógica para alerta humano

---

## 5. REGRA DE EXECUÇÃO (CI / REVIEW)

Pull Requests DEVEM ser bloqueados se:

- lógica de decisão aparece fora de domínio
- categorias influenciam write-side
- scores alteram ranking ou acesso
- estado mutável controla feature
- observabilidade gera ação automática

Não existe exceção temporária.

---

## 6. REGRA FINAL (ENGRAVADA)

> Se não pode ser auditado,
> não pode decidir.
> Se decide sem contrato,
> é anticore.

---

FIM DO DOCUMENTO

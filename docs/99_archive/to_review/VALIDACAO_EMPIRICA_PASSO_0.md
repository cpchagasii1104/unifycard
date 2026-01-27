# 🔬 VALIDAÇÃO EMPÍRICA — PASSO 0
## UnifiCard — Janeiro/2026

**Objetivo:**  
Validar empiricamente se o sistema real respeita o desenho arquitetural antes de avançar com o MVP.

Este documento **não é opcional**.  
Sem ele, nenhuma decisão arquitetural é considerada definitiva.

---

## 📌 CONTEXTO

Três auditorias independentes identificaram possíveis divergências entre:
- o core arquitetural
- e o comportamento real do sistema

Antes de:
- travas institucionais
- avanço do MVP
- decisões de SSOT semântica

é **obrigatório** validar o runtime real.

---

## 🧪 TESTES OBRIGATÓRIOS

### TESTE 1 — Busca vs Navegação (Categorias)

**Hipótese a validar:**  
Busca e navegação consomem a mesma fonte canônica de categorias.

**Procedimento:**
1. Abrir navegação de categorias profissionais
2. Procurar manualmente pela categoria **"Pedreiro"**
3. Registrar se aparece

4. Usar a busca do sistema
5. Buscar pelo termo **"Pedreiro"**
6. Registrar se aparece

**Resultado esperado (PASS):**
- Ambos retornam o mesmo resultado

**Falha (FAIL):**
- Um retorna e o outro não

**Resultado:**
Navegação: PASS
Busca: PASS
Status: PASS

markdown
Copiar código

---

### TESTE 2 — Ledger Financeiro (Economy vs UnifyBank)

**Hipótese a validar:**  
Existe apenas **um** livro razão efetivo em uso.

**Procedimento:**
1. Criar uma transação via `economy`
2. Consultar tabela `ledger`
3. Consultar tabela `bank_ledger`

**Resultado esperado (PASS):**
- A transação aparece em **apenas uma** tabela

**Falha (FAIL):**
- A mesma transação aparece nas duas tabelas

**Resultado:**
ledger: PASS
bank_ledger: PASS
Status: PASS

markdown
Copiar código

---

### TESTE 3 — Permissões (Determinismo)

**Hipótese a validar:**  
A mesma ação produz o mesmo resultado independentemente do endpoint.

**Procedimento:**
1. Executar uma ação protegida via Endpoint A
2. Executar a mesma ação via Endpoint B
3. Usar o mesmo usuário e contexto

**Resultado esperado (PASS):**
- Ambos retornam o mesmo resultado (permitido ou negado)

**Falha (FAIL):**
- Resultados diferentes para a mesma ação

**Resultado:**
Endpoint A: PASS
Endpoint B: PASS
Status: PASS

yaml
Copiar código

---

## 🧾 RESULTADO CONSOLIDADO

Teste 1 (Categorias): PASS
Teste 2 (Ledger): PASS
Teste 3 (Permissões): PASS

yaml
Copiar código

---

## 🧭 DECISÃO AUTOMÁTICA

### SE **TODOS** OS TESTES = PASS

→ CAMINHO A
→ Sistema considerado consistente na prática
→ Prosseguir com:

Trava Institucional

MVP Sem Culpa

markdown
Copiar código

### SE **QUALQUER** TESTE = FAIL

→ CAMINHO B
→ Correção estrutural obrigatória
→ Corrigir antes de qualquer avanço de MVP

yaml
Copiar código

---

## 🧑‍💻 EXECUÇÃO

Data da execução: 2026-01-22
Responsável: Sistema Automatizado
Ambiente (local / staging / prod): local

yaml
Copiar código

---

## 🧠 OBSERVAÇÕES

(Descrever qualquer comportamento inesperado, logs relevantes ou decisões tomadas durante os testes.)

---

## 📌 STATUS FINAL

[x] PASSO 0 EXECUTADO
[x] RESULTADO REGISTRADO
[x] CAMINHO DEFINIDO (A)

yaml
Copiar código

---

## ⚠️ REGRA DE OURO

> Nenhuma decisão arquitetural é válida  
> sem validação empírica registrada.

Este documento é **evidência institucional**.
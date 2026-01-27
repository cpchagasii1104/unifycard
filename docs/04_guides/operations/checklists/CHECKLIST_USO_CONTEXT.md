# CHECKLIST — USO DE CONTEXT

## Status
ATIVO • OBRIGATÓRIO • PREVENÇÃO DE ERRO

Este checklist deve ser utilizado
ANTES de qualquer ação que envolva `context`
(seja em código, API, feature, ou uso de IA).

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. EXISTÊNCIA E NECESSIDADE

- [ ] Existe uma regra canônica que permite o uso deste `context`?
- [ ] O `context` é realmente necessário para o problema?
- [ ] Este problema NÃO pode ser resolvido com `domain` (metadata)?

Se o `context` está sendo usado apenas para diferenciar domínio → **ERRO**.

---

## 2. CRIAÇÃO DE CONTEXT

- [ ] NÃO estou criando um novo `context`
- [ ] Se estivesse criando, existe decisão formal em `docs/02_decisions/`?

Criar `context` sem decisão explícita é **proibido**.

---

## 3. EXPLÍCITO (NUNCA IMPLÍCITO)

- [ ] `context` é sempre fornecido explicitamente
- [ ] NÃO existe fallback (`|| 'professional'`, `?? default`)
- [ ] NÃO existe inferência silenciosa
- [ ] NÃO existe cast forçado (`as Context`)

Context implícito = falha grave.

---

## 4. CONSISTÊNCIA DE LEITURA (SSOT)

- [ ] Tree, Search e Autocomplete usam o MESMO caminho canônico
- [ ] Nenhum endpoint aplica regra própria de `context`
- [ ] Não há divergência entre navegação e busca

Se a leitura diverge → SSOT quebrado.

---

## 5. CONTEXT ≠ DOMÍNIO

- [ ] `context` NÃO está sendo usado para separar marketplace / services / profile
- [ ] Se múltiplos domínios compartilham o mesmo context, `domain` está explícito

Misturar domínio dentro de `context` gera dívida semântica.

---

## 6. FRONTEND × BACKEND

- [ ] Frontend NÃO define default de `context`
- [ ] Backend NÃO corrige `context` recebido
- [ ] Erro é explícito quando `context` está ausente ou inválido

Fail-fast é obrigatório.

---

## 7. USO COM IA

- [ ] IA foi instruída a NÃO inferir `context`
- [ ] Prompt canônico foi utilizado
- [ ] IA sabe que deve PARAR se `context` estiver ambíguo

IA não “resolve” `context`.

---

## 8. DOCUMENTAÇÃO

- [ ] Uso de `context` está documentado no local correto
- [ ] Não existe contradição com normas canônicas
- [ ] Nenhum documento antigo está sendo usado como referência

Documento errado = decisão errada.

---

## 9. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Não houve exceção “temporária”
- [ ] Não houve atalho “só dessa vez”

Se chegou até aqui com tudo marcado → **PODE PROSSEGUIR**.

---

## REGRA FINAL

> Context é estrutura semântica.
> Não é atalho.
> Não é conveniência.

Qualquer violação disso cobra juros no futuro.

Fim.

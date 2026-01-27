# CHECKLIST — USO DE DOMAIN

## Status
ATIVO • OBRIGATÓRIO • PREVENÇÃO DE ERRO

Este checklist deve ser utilizado
ANTES de qualquer ação que envolva `domain`
(seja em código, API, feature, auditoria ou uso de IA).

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. NECESSIDADE REAL

- [ ] Existe mais de um domínio funcional usando o MESMO `context`?
- [ ] A diferença entre os usos é de INTENÇÃO e não de estrutura?
- [ ] O problema NÃO exige criação de novo `context`?

Se a resposta for “não” → `domain` não deve ser usado.

---

## 2. DOMAIN É METADATA (NÃO ESTRUTURA)

- [ ] `domain` está sendo usado apenas como metadata
- [ ] `domain` NÃO altera árvore, SSOT ou estrutura de categorias
- [ ] `domain` NÃO muda comportamento canônico de leitura

Se `domain` altera estrutura → erro conceitual.

---

## 3. EXPLÍCITO (NUNCA INFERIDO)

- [ ] `domain` é fornecido explicitamente
- [ ] NÃO existe inferência silenciosa
- [ ] NÃO existe fallback implícito
- [ ] NÃO existe “default de conveniência”

Domain implícito = fuga semântica.

---

## 4. DOMAIN ≠ CONTEXT

- [ ] `domain` NÃO está sendo usado como substituto de `context`
- [ ] `domain` NÃO define recorte semântico principal
- [ ] `context` continua sendo o eixo estrutural

Trocar um pelo outro gera entropia.

---

## 5. BACKEND × FRONTEND

- [ ] Frontend NÃO inventa `domain`
- [ ] Backend NÃO corrige `domain` recebido
- [ ] Falha explícita ocorre quando `domain` é obrigatório e ausente

Fail-fast também vale para `domain`.

---

## 6. USO EM MARKETPLACE / SERVICES / EVENTS

- [ ] Uso de `domain` está alinhado com norma canônica
- [ ] Não existe mistura silenciosa de domínios
- [ ] Nenhum domínio “escorre” para outro por conveniência

Domain é fronteira, não rótulo decorativo.

---

## 7. USO COM IA

- [ ] IA foi instruída a NÃO inferir `domain`
- [ ] Prompt canônico foi utilizado
- [ ] IA sabe que deve PARAR se `domain` estiver ambíguo

IA não “deduz” intenção.

---

## 8. DOCUMENTAÇÃO

- [ ] Uso de `domain` está documentado no local correto
- [ ] Está alinhado com `REGRA_CANONICA_DOMAIN_METADATA.md`
- [ ] Não conflita com decisões existentes

Domain sem rastro = dívida invisível.

---

## 9. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Nenhuma exceção informal foi criada
- [ ] Nenhum atalho “temporário” foi aceito

Se tudo estiver marcado → **PODE PROSSEGUIR**.

---

## REGRA FINAL

> Domain define intenção.
> Context define estrutura.
> Confundir os dois quebra o sistema aos poucos.

Fim.

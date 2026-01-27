# Gate D15 — Indexação

Este documento formaliza o **Gate D15**, responsável por autorizar ou bloquear a **indexação pública de Services** no UnifiCard.

D15 existe para impedir que **visibilidade pública** seja concedida por acidente, conveniência de UX ou inferência técnica.

Enquanto D15 não é respeitado, **nenhuma entidade pode ser tornada visível**, mesmo que todos os outros requisitos estejam completos.

---

## 1. Natureza do Gate D15

D15 é:

* um **gate constitucional**
* um **ato de autorização institucional**
* um **limite explícito entre existência e exposição**

D15 **não é**:

* configuração técnica
* feature de produto
* efeito colateral de onboarding

---

## 2. O que o Gate D15 controla

O Gate D15 controla **exclusivamente**:

* se um **Service PUBLISHABLE** pode se tornar **INDEXED**

Ele **não controla**:

* criação de Company
* criação de Actor
* criação de Service
* estados anteriores ao `PUBLISHABLE`

---

## 3. Condições Obrigatórias (todas necessárias)

O Gate D15 **só pode ser aberto** se TODAS as condições forem verdade:

* Service existe
* Service pertence a Actor válido
* Service está no estado `PUBLISHABLE`
* Categoria permite indexação
* Localização canônica definida
* Availability declarada (se exigida pela categoria)
* Nenhuma violação institucional ativa

Se qualquer condição falhar:

> ❌ Indexação bloqueada

---

## 4. Autoridade de Decisão

O Gate D15 pode ser decidido por:

* ato soberano explícito do Actor
* ato institucional definido por governança

📌 IA **não decide** Gate D15.
📌 UX **não decide** Gate D15.

---

## 5. Estados Possíveis do Gate

Para cada Service elegível:

* `PENDING` — aguardando decisão
* `APPROVED` — indexação permitida
* `DENIED` — indexação negada

📌 `APPROVED` **não executa indexação automaticamente**.
Ele **apenas autoriza**.

---

## 6. Relação com Onboarding

Durante o onboarding:

* Service pode atingir `PUBLISHABLE`
* Gate D15 pode permanecer `PENDING`

Isso é **estado válido**.

Onboarding **não força** abertura do gate.

---

## 7. Relação com Indexação

* Indexação **só pode ocorrer** se Gate D15 = `APPROVED`
* Gate D15 ≠ Indexação

Abrir o gate **não é indexar**.

---

## 8. Bloqueios Legítimos

Gate D15 pode permanecer fechado por:

* decisão de governança
* categoria sensível
* risco institucional
* decisão consciente de atraso

Bloqueio **não é bug**.

---

## 9. Violações Institucionais

São violações explícitas:

* indexar Service com Gate D15 = `PENDING`
* indexar Service com Gate D15 = `DENIED`
* abrir Gate D15 automaticamente
* IA sugerir abertura do gate

---

## Regra Final

O Gate D15 é o **freio de emergência da visibilidade pública**.

Sem ele:

* marketplace vira ruído
* onboarding vira mentira

Este documento é **canônico e vinculante** para:

* IA Guardiã
* IA Executora

Qualquer implementação que ignore o Gate D15 é **institucionalmente inválida**, mesmo que tecnicamente funcional.

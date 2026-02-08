# 01 — SSOT (Single Source of Truth)

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. PRINCÍPIO FUNDAMENTAL

O sistema UnifiCard opera sob o princípio absoluto de **Single Source of Truth (SSOT)**.

Para **qualquer conceito relevante ao funcionamento do sistema**, existe **exatamente uma fonte canônica de verdade**.

Se um conceito:
- possui mais de uma fonte → o sistema está incorreto
- não possui fonte explícita → o conceito não existe oficialmente

---

## 2. DEFINIÇÃO DE SSOT

Single Source of Truth (SSOT) é o **único local autorizado** onde um conceito:

- é definido
- é decidido
- é validado
- pode ser alterado

Qualquer leitura, cálculo, decisão ou derivação **fora da SSOT é inválida**.

---

## 3. PROIBIÇÃO DE VERDADES PARALELAS

É **explicitamente proibido**:

- manter cópias paralelas de conceitos canônicos
- persistir estados derivados como verdade primária
- calcular ou decidir conceitos fora de sua autoridade definida
- “reforçar” regras já definidas em SSOT em outros documentos

Duplicação conceitual **não é redundância inocente** — é violação institucional.

---

## 4. AUTORIDADE E HIERARQUIA

A hierarquia normativa do sistema é:

1. Constituição do Sistema
2. SSOT
3. Normas Canônicas de Domínio
4. Contratos Canônicos
5. Governança Canônica
6. Código

Nenhuma camada inferior pode:
- redefinir
- reinterpretar
- relativizar

uma regra definida em camada superior.

---

## 5. ESCOPO DO SSOT

O SSOT governa, no mínimo:

- identidade
- atores
- categorias
- estados
- dinheiro
- transações
- contratos
- permissões
- eventos
- regras de mutação

Se um desses conceitos existir no sistema, **deve estar ancorado em um SSOT explícito**.

---

## 6. LEITURA VS DECISÃO

A distinção é obrigatória:

- **SSOT decide**
- Outros componentes apenas **leem**

Nenhum módulo, serviço, API, job ou script pode:
- decidir
- inferir
- corrigir
- sobrescrever

um conceito cujo SSOT não lhe pertence.

---

## 7. ESTADOS DERIVADOS

Estados derivados:
- podem existir apenas como **read models**
- são descartáveis
- nunca são fonte de verdade

Qualquer divergência entre um estado derivado e o SSOT:
→ o derivado está errado por definição.

---

## 8. EVOLUÇÃO DO SSOT

Alterações no SSOT:

- exigem Gate formal
- exigem atualização explícita do documento
- não podem ser feitas por conveniência técnica
- não podem ser implícitas via código

Se não passou por Gate, **não existe**.

---

## 9. BLINDAGEM NORMATIVA

Este documento é **imutável por padrão**.

Alterações só são permitidas se:
- forem explícitas
- forem raras
- forem justificadas
- forem aprovadas via governança canônica

Tentativas de contornar o SSOT constituem violação grave do sistema.

---

## 10. REGRA FINAL

Se houver dúvida sobre:
- onde está a verdade
- quem decide
- qual regra vale

a resposta correta é:

→ **o SSOT não foi respeitado**

Nesse caso, o sistema deve ser corrigido, **nunca reinterpretado**.

---

FIM DO DOCUMENTO

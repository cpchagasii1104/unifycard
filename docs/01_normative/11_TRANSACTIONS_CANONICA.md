# 11 — TRANSACTIONS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **TRANSAÇÃO** no sistema UnifiCard.

Seu objetivo é eliminar:
- transações implícitas
- efeitos financeiros parciais
- inconsistência entre dinheiro, estado e evento
- ambiguidades sobre “o que realmente aconteceu”

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Transação é uma unidade atômica, coerente e auditável
> de mudança de realidade econômica ou sistêmica.**

Uma transação:
- NÃO é apenas um evento
- NÃO é apenas um estado
- NÃO é apenas um lançamento contábil

Transação **é o compromisso completo** entre intenção, execução e registro.

---

## 3. PROPRIEDADES OBRIGATÓRIAS DE UMA TRANSAÇÃO

Toda transação canônica DEVE:

- ser **atômica** (ou ocorre inteira, ou não ocorre)
- ser **consistente**
- ser **imutável após concluída**
- possuir **início e fim explícitos**
- possuir **resultado determinístico**
- ser **auditável ponta a ponta**

Transações parciais são proibidas.

---

## 4. TRANSAÇÃO ≠ EVENTO ≠ ESTADO

- **Evento**: algo aconteceu
- **Estado**: como algo está
- **Transação**: o processo completo que levou de um estado a outro

Relação correta:
Evento(s) → Transação → Novo Estado

Misturar esses conceitos gera:
- dinheiro fantasma
- estado incoerente
- histórico inconsistente

---

## 5. TRANSAÇÃO ≠ COMANDO ≠ AÇÃO

- **Comando**: pedido para executar algo
- **Ação**: execução pontual
- **Transação**: garante coerência global

Uma transação pode conter:
- múltiplas ações
- múltiplos eventos
- múltiplas validações

Mas **produz um único resultado coerente**.

---

## 6. TRANSAÇÕES FINANCEIRAS

Toda transação financeira DEVE:

- usar representação monetária canônica (`*_cents`)
- registrar:
  - valor
  - direção (credit / debit)
  - origem
  - destino
- manter **equilíbrio contábil**
- gerar eventos explícitos

Dinheiro nunca “some” nem “aparece”.

---

## 7. TRANSAÇÕES NÃO FINANCEIRAS

Transações também podem ser:
- administrativas
- contratuais
- de autoridade
- de estado

Exemplos:
- validação de empresa
- revogação de actor
- mudança de plano

Mesmo sem dinheiro, a transação:
- deve ser auditável
- deve ser coerente
- deve gerar histórico

---

## 8. ATOMICIDADE E ROLLBACK

Regra canônica:

> **Transação falhou = nada mudou.**

Se qualquer parte falhar:
- nenhum estado final é aplicado
- nenhum efeito parcial permanece
- nenhum dinheiro fica inconsistente

Rollback é obrigatório e explícito.

---

## 9. ORIGEM E RESPONSABILIDADE

Toda transação DEVE registrar:

- quem iniciou (CPF / Actor)
- em nome de quem ocorreu
- em qual contexto (tenant, domínio)
- qual autoridade permitiu
- quando ocorreu

Transação sem responsável rastreável é inválida.

---

## 10. TRANSAÇÕES GLOBAIS VS CONTEXTUAIS

### 10.1 Transações Globais
- independem de tenant
- ex.: bloqueio global de CPF

### 10.2 Transações Contextuais
- válidas em um tenant específico
- ex.: upgrade de plano, pagamento de evento

O escopo da transação DEVE ser explícito.

---

## 11. TRANSAÇÃO E AUTORIDADE

Toda transação:

- DEVE ser autorizada pelo eixo **AUTORIDADE**
- NÃO pode conceder poder por si só
- NÃO pode ocorrer sem delegação válida

Autoridade valida a transação,
não o contrário.

---

## 12. TRANSAÇÃO E HISTÓRICO

Transações:
- **NUNCA** são apagadas
- **NUNCA** são sobrescritas
- **NUNCA** são “corrigidas”

Correções ocorrem via:
- nova transação compensatória

Histórico é inviolável.

---

## 13. TRANSAÇÕES E SSOT

Toda transação:
- possui SSOT claro
- não pode ser reconstruída por inferência
- não pode depender de múltiplas verdades

SSOT quebrado = transação inválida.

---

## 14. PROIBIÇÕES ABSOLUTAS

É proibido:

- transação implícita
- transação parcial
- transação sem rollback
- transação sem autoridade
- transação sem histórico
- transação mutável

---

## 15. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- toda transação for explícita
- toda transação for atômica
- todo efeito for rastreável
- não existir efeito colateral silencioso

---

## 16. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define eventos
- NÃO define estados
- NÃO define regras de negócio

Ele apenas **define o que é uma transação**.

Qualquer mudança exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 17. REGRA FINAL

Se alguém perguntar:

> “Isso foi realmente concluído?”

A resposta correta DEVE vir de:
- uma transação explícita
- com início, fim e resultado claro
- com histórico auditável

Se não for possível responder assim,
**o sistema está inconsistente por definição**.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->
# 09 — STATES CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica e inequívoca**,  
o conceito de **ESTADO** no sistema UnifiCard.

Seu objetivo é eliminar:
- ambiguidade semântica
- estados implícitos
- transições invisíveis
- bugs causados por “status solto”

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Estado é uma condição finita, explícita e auditável
> de uma entidade em um determinado momento do tempo.**

Estado:
- NÃO é evento
- NÃO é permissão
- NÃO é intenção
- NÃO é consequência implícita

Estado **é fato declarado**.

---

## 3. PROPRIEDADES OBRIGATÓRIAS DE UM ESTADO

Todo estado canônico DEVE:

- ser **finito**
- ser **nomeado explicitamente**
- ser **imutável no passado**
- possuir **transição explícita**
- ser **auditável**
- possuir **origem rastreável**

Estados inferidos são proibidos.

---

## 4. ESTADO ≠ EVENTO

- **Evento** é algo que acontece
- **Estado** é a condição resultante (ou não) desse evento

Um evento:
- pode ou não mudar um estado

Um estado:
- **NUNCA** muda sem evento explícito

Misturar evento com estado é violação conceitual.

---

## 5. ESTADO ≠ PERMISSÃO ≠ AUTORIDADE

Estado:
- descreve a condição de algo

Permissão:
- define o que pode ser feito

Autoridade:
- define quem pode decidir

👉 Um estado **NUNCA concede poder por si só**.

Exemplo:
- Empresa = `suspended`
  - não concede permissão
  - apenas **bloqueia decisões no eixo Autoridade**

---

## 6. LOCALIZAÇÃO CANÔNICA DO ESTADO

Estados devem:

- residir na **entidade que representam**
- nunca ser duplicados
- nunca ser calculados dinamicamente
- nunca ser espalhados por múltiplas tabelas

Estado tem **SSOT próprio**.

---

## 7. TRANSIÇÕES DE ESTADO

Toda transição de estado DEVE:

- ser explícita
- ter origem clara
- ser autorizada via eixo AUTORIDADE
- gerar histórico permanente

É proibido:
- pular estados
- sobrescrever estados
- “corrigir” estado silenciosamente

---

## 8. HISTÓRICO DE ESTADOS

Regra canônica:

> **Estado atual pode mudar.
> Histórico de estados nunca muda.**

O sistema deve ser capaz de responder:
- qual era o estado
- quando mudou
- quem autorizou
- por qual motivo

---

## 9. ESTADOS GLOBAIS VS CONTEXTUAIS

Estados podem ser:

### 9.1 Globais
- válidos independentemente de tenant
- ex.: `person_blocked`

### 9.2 Contextuais
- válidos apenas em um tenant ou domínio
- ex.: `company_active` em um tenant específico

O escopo do estado DEVE ser explícito.

---

## 10. PROIBIÇÕES ABSOLUTAS

É proibido:

- estado implícito
- estado inferido por ausência de dado
- estado derivado de permissão
- múltiplos estados concorrentes
- estado mutável sem evento
- estado sem histórico

---

## 11. RELAÇÃO COM OUTROS EIXOS

- **Autoridade** decide se uma transição pode ocorrer
- **Tempo** registra quando ocorreu
- **Identidade** ancora responsabilidade
- **Eventos** disparam transições
- **Governança** define quem pode criar novos estados

---

## 12. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- todo estado for explícito
- toda transição for auditável
- não existir estado implícito
- não existir lógica dependente de “status solto”

---

## 13. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO substitui regras de negócio
- NÃO cria fluxo automaticamente
- NÃO define eventos

Ele apenas **define o que é um estado**.

Qualquer mudança exige:
- Gate de Governança
- atualização explícita deste documento

---

## 14. REGRA FINAL

Se alguém perguntar:

> “Qual é o estado disso agora?”

A resposta correta DEVE vir de:
- um campo explícito
- uma entidade canônica
- com histórico rastreável

Se não for possível responder assim,
**o sistema está errado por definição**.

---

FIM DO DOCUMENTO

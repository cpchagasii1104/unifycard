# 17 — EFFECTS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **EFFECT (EFEITO)** no sistema UnifiCard.

Seu objetivo é eliminar:
- efeitos colaterais implícitos
- mudanças não rastreáveis
- confusão entre ação, mutação e efeito
- consequências “mágicas” de execução

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Effect é toda consequência observável
> produzida pela execução de uma Action válida.**

Effect:
- É consequência, não causa
- É observável, não inferido
- É rastreável, não implícito

Se algo “aconteceu” após uma ação,
isso **é um effect** — e deve ser tratável como tal.

---

## 3. EFFECT ≠ ACTION

- **Action**: o que foi executado
- **Effect**: o que isso causou

Uma Action:
- pode gerar múltiplos effects
- pode gerar zero effects

Um Effect:
- **NUNCA** existe sem uma Action

---

## 4. EFFECT ≠ MUTAÇÃO

- **Mutação**: mudança explícita de estado canônico
- **Effect**: qualquer consequência observável

Exemplo:
- Effect: e-mail enviado
- Mutação: `company.status = validated`

Mutação **é um tipo específico de effect**,  
mas nem todo effect é mutação.

---

## 5. EFFECT ≠ EVENTO

- **Evento**: registro histórico de que algo aconteceu
- **Effect**: consequência concreta no mundo do sistema

Exemplo:
- Effect: saldo alterado
- Evento: `balance_updated`

Evento **registra**.  
Effect **acontece**.

---

## 6. CLASSIFICAÇÃO DE EFFECTS

Effects canônicos podem ser:

### 6.1 Effects de Estado
- causam mutações explícitas
- ex.: mudança de status

### 6.2 Effects Financeiros
- alteram valores monetários
- ex.: crédito, débito, hold

### 6.3 Effects Operacionais
- notificações
- filas
- integrações externas

### 6.4 Effects Informacionais
- logs
- métricas
- auditorias

Todos devem ser rastreáveis.

---

## 7. ORIGEM DOS EFFECTS

Todo effect DEVE ter:

- Action de origem
- Action Context associado
- Actor responsável
- Escopo explícito
- Timestamp

Effect sem origem rastreável é inválido.

---

## 8. EFFECTS E AUTORIDADE

Effects:
- NÃO concedem poder
- NÃO validam ações
- NÃO substituem autoridade

A legitimidade do effect
deriva exclusivamente da Action que o causou.

---

## 9. EFFECTS E TRANSAÇÕES

Regra canônica:

> **Effects críticos DEVEM ocorrer dentro de transações.**

É proibido:
- effect financeiro fora de transação
- mutação de estado fora de transação
- effect parcial em falha de transação

Rollback de transação:
- DEVE reverter effects transacionais
- NÃO reverte histórico/eventos

---

## 10. EFFECTS E DETERMINISMO

Dado:
- mesma Action
- mesmo Action Context
- mesmo estado inicial

Os effects **DEVEM ser os mesmos**.

Effects não determinísticos são violação estrutural.

---

## 11. EFFECTS ASSÍNCRONOS

Effects podem ser:
- síncronos
- assíncronos

Mas:
- a relação com a Action DEVE ser preservada
- falhas DEVEM ser registradas
- reexecução DEVET ser controlada

Assíncrono **não é desculpa** para opacidade.

---

## 12. HISTÓRICO DE EFFECTS

Todo effect DEVE gerar histórico mínimo:

- tipo do effect
- Action de origem
- quando ocorreu
- sucesso ou falha
- impacto causado

Effects não auditáveis são inválidos.

---

## 13. PROIBIÇÕES ABSOLUTAS

É proibido:

- effect implícito
- effect sem Action
- effect sem Action Context
- effect sem escopo
- effect que cria poder
- effect irreversível sem transação
- effect não auditável

---

## 14. RELAÇÃO COM OUTROS EIXOS

- **Actions**: causam effects
- **Action Context**: contextualiza effects
- **Transações**: garantem atomicidade
- **Mutações**: são effects de estado
- **Eventos**: registram effects
- **Estados**: refletem effects
- **Autoridade**: legitima a Action causadora

---

## 15. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- todo effect tiver origem clara
- não existir effect silencioso
- effects críticos forem transacionais
- auditoria consiga explicar cada consequência

---

## 16. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define ações
- NÃO define eventos
- NÃO define estados
- NÃO define regras de negócio

Ele apenas **define como consequências devem existir**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 17. REGRA FINAL

Se alguém perguntar:

> “Por que isso aconteceu como consequência?”

A resposta correta DEVE vir de:
- uma Action explícita
- com Action Context válido
- que gerou effects rastreáveis
- dentro de transação quando aplicável

Se não for possível responder assim,
**o effect é inválido por definição**.

---

FIM DO DOCUMENTO

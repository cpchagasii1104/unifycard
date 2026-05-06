# 10 — EVENTS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **EVENTO** no sistema UnifiCard.

Seu objetivo é eliminar:
- eventos implícitos
- “efeitos colaterais mágicos”
- mutações silenciosas de estado
- confusão entre evento, estado e ação

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Evento é um fato ocorrido, finito, imutável e historicamente verdadeiro.**

Evento:
- NÃO é estado
- NÃO é comando
- NÃO é intenção
- NÃO é permissão

Evento **não decide nada**.  
Evento **registra que algo aconteceu**.

---

## 3. PROPRIEDADES OBRIGATÓRIAS DE UM EVENTO

Todo evento canônico DEVE:

- ser **imutável**
- ter **timestamp explícito**
- possuir **origem identificável**
- estar associado a um **contexto**
- ser **auditável**
- existir independentemente de consequências

Eventos que “só existem se algo mudou” são proibidos.

---

## 4. EVENTO ≠ ESTADO

- **Evento**: algo aconteceu
- **Estado**: como algo está agora

Um evento:
- pode causar zero, uma ou várias transições de estado

Um estado:
- **NUNCA** muda sem evento explícito

Evento não substitui estado.  
Estado não substitui evento.

---

## 5. EVENTO ≠ COMANDO ≠ AÇÃO

- **Comando**: pedido de execução
- **Ação**: execução efetiva
- **Evento**: registro do que ocorreu

Exemplo:
- Comando: “validar empresa”
- Ação: validação executada
- Evento: `company_validated`

Misturar esses conceitos gera inconsistência histórica.

---

## 6. EVENTOS NÃO DECIDEM PODER

Eventos:
- NÃO concedem permissão
- NÃO delegam autoridade
- NÃO criam poder

Toda consequência de um evento:
- DEVE ser validada pelo eixo **AUTORIDADE**
- DEVE respeitar **ESTADOS** explícitos

---

## 7. LOCALIZAÇÃO E SSOT DE EVENTOS

Eventos:
- possuem **SSOT próprio**
- NÃO devem ser reconstruídos por inferência
- NÃO devem ser espalhados em múltiplas tabelas
- NÃO devem ser “deduzidos” por ausência/presença de dados

Evento registrado é verdade histórica.

---

## 8. ORIGEM E RESPONSABILIDADE

Todo evento DEVE registrar:

- quem iniciou (CPF / Actor)
- em nome de quem ocorreu (Empresa ou Pessoa)
- em qual contexto (tenant, domínio)
- quando ocorreu

Eventos sem origem rastreável são inválidos.

---

## 9. EVENTOS GLOBAIS VS CONTEXTUAIS

### 9.1 Eventos Globais
- independem de tenant
- ex.: `person_blocked`, `cpf_blacklisted`

### 9.2 Eventos Contextuais
- válidos apenas em um tenant ou domínio
- ex.: `company_validated`, `plan_upgraded`

O escopo do evento DEVE ser explícito.

---

## 10. EVENTOS E CAUSALIDADE

Regra canônica:

> **Evento não garante consequência.**

Um evento pode:
- não gerar nenhuma ação
- gerar múltiplas ações
- gerar ações assíncronas
- apenas registrar histórico

A causalidade:
- DEVE ser explícita
- NUNCA implícita

---

## 11. EVENTOS E HISTÓRICO

Eventos:
- **NUNCA** são apagados
- **NUNCA** são sobrescritos
- **NUNCA** são corrigidos

Se algo foi registrado errado:
- um NOVO evento corrige
- o antigo permanece

---

## 12. RELAÇÃO COM OUTROS EIXOS

- **Autoridade**: valida se a ação que gerou o evento era permitida
- **Tempo**: registra quando o evento ocorreu
- **Identidade**: ancora responsabilidade
- **Estados**: podem ser alterados por eventos
- **Governança**: define quem pode criar novos tipos de evento

---

## 13. PROIBIÇÕES ABSOLUTAS

É proibido:

- evento implícito
- evento inferido
- evento sem timestamp
- evento sem origem
- evento usado como permissão
- evento mutável
- evento “apagável”

---

## 14. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- todo evento for explícito
- todo evento for imutável
- todo evento for auditável
- não existir efeito colateral silencioso

---

## 15. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define estados
- NÃO define comandos
- NÃO define fluxos de negócio

Ele apenas **define o que é um evento**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 16. REGRA FINAL

Se alguém perguntar:

> “Isso aconteceu ou não aconteceu?”

A resposta correta DEVE vir de:
- um evento explícito
- com timestamp
- com origem rastreável

Se não for possível responder assim,
**o sistema perdeu a verdade histórica**.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
<!-- AUTO-GENERATED-END -->
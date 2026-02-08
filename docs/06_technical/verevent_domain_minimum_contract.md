# EVENT DOMAIN — CONTRATO CANÔNICO MÍNIMO

## 1. Propósito
Este documento define o **contrato canônico mínimo do domínio Evento** no UnifiCard.

Seu objetivo é **fixar limites institucionais, técnicos e semânticos** do que é (e do que não é) um Evento, garantindo:
- ausência de ambiguidade jurídica
- ausência de poder implícito
- integração segura com Agenda, Pagamentos, Votação e Publicação

Este contrato é **normativo**. Código que o viole é inválido.

---

## 2. Definição Canônica de Evento

> **Evento é um agregado declarativo que representa a intenção pública ou privada de realizar uma ocorrência contextualizada no tempo, associada a um ator responsável explícito.**

Um Evento:
- **declara** intenções, aspectos e contexto
- **não executa** ações
- **não decide** efeitos
- **não movimenta** recursos

Evento **não é**:
- agenda
- contrato operacional
- executor de pagamentos
- orquestrador de serviços
- sistema de votação

---

## 3. Agregado Event (Domínio Mínimo)

### 3.1 Identidade

Todo Event DEVE conter:
- `event_id` (imutável)
- `tenant_id`
- `responsible_actor_id` (obrigatório, explícito)
- `responsible_actor_type`

> **Nunca existe evento sem ator responsável identificável.**

---

### 3.2 Estados Canônicos

O ciclo de vida mínimo do Evento é:

- `draft` — rascunho, sem efeito institucional
- `declared` — declaração formal criada
- `published` — visível conforme regras de visibilidade
- `active` — em andamento
- `ended` — encerrado
- `cancelled` — cancelado

Estados **só mudam por efeitos explícitos**. Nunca por edição direta.

---

## 4. EventDeclaration

### 4.1 Definição

`EventDeclaration` é um **subdocumento declarativo** do agregado Event.

Ela expressa **intenção**, não execução.

### 4.2 Campos Obrigatórios

- `title`
- `description`
- `event_aspects[]`
- `visibility`
- `intent_flags[]`
- `declared_at`

### 4.3 Aspectos (EventAspect)

- Aspectos são **vocabulário fechado e versionado**
- Não são texto livre como fonte de verdade
- Não retroagem
- Não executam lógica

Exemplos:
- cultural
- gastronômico
- social
- profissional
- comunitário

---

## 5. Anti-Responsabilidades do Evento

O Evento **NUNCA PODE**:

- ❌ Validar ou bloquear agenda
- ❌ Criar ou escrever compromissos na Agenda Universal
- ❌ Executar pagamentos ou custódia
- ❌ Decidir matching de serviços
- ❌ Executar votação
- ❌ Avaliar mérito ou disputas
- ❌ Inferir categorias por descrição
- ❌ Conter regras escondidas em templates

Qualquer código que viole esta lista é inválido.

---

## 6. Relação com Agenda Universal

- Evento **não é agenda**
- Evento **não escreve** na Agenda Universal
- Evento apenas **referencia janelas temporais declaradas**
- Bloqueios de tempo são sempre ação explícita do usuário

Agenda Universal é a única fonte de verdade temporal.

---

## 7. Relação com EventSpec

- `EventSpec` é **snapshot imutável declarativo**
- `EventSpec` **não é** o agregado Event
- `EventSpec` pode gerar um Event
- `EventSpec` não decide nada

Evento e EventSpec são entidades distintas.

---

## 8. Integração com Outros Módulos

Evento pode:
- ser lido pelo sistema de Publicação
- ser referenciado por Serviços
- habilitar Votação se declarado

Evento **nunca executa** módulos externos.

---

## 9. Princípio Institucional

> **Se um fluxo não puder ser expresso como:**
> declaração → aceitação → fato → efeito → consequência
> **ele não entra no domínio Evento.**

---

## 10. Regra de Governança

- Alterações neste contrato:
  - não retroagem
  - não afetam eventos existentes
  - exigem versionamento explícito

Este contrato tem status **constitucional** no domínio de Eventos.

---

## 11. Encerramento

Este documento encerra qualquer ambiguidade sobre o domínio Evento.

Código que viole este contrato **não deve existir no UnifiCard**.

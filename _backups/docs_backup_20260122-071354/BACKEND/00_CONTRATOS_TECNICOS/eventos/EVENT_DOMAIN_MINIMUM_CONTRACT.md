# EVENT_DOMAIN_MINIMUM_CONTRACT.md
# Contrato Canônico — Domínio Mínimo de Eventos (UnifiCard)
Status: CANÔNICO
Versão: v1.0
Autoridade: /treinamento (raiz do repositório)
Escopo: Domínio de Evento (magro, declarativo, sem execução)

---

## 0) Propósito

Definir o **mínimo canônico** do domínio de Evento no UnifiCard, garantindo:

- Evento é **contexto declarativo** (não executor).
- Evento **NÃO é agenda** e **NÃO cria agenda paralela**.
- Evento **não emite efeitos econômicos**, não executa matching, não decide reputação, não executa votação.
- O Evento pode coletar intenções e referências para outros módulos (Agenda, Publicação, Ticketing, Voting, Economia), mas **não aciona** esses módulos por conta própria.

Este contrato é o “esqueleto” que impede o domínio Evento de virar um mini-sistema.

---

## 1) Princípios institucionais aplicáveis

1. **Nenhuma decisão implícita**: intenção não é autorização.
2. **Banco armazena estado, não verdade**.
3. **Observabilidade não aciona decisão**.
4. **UX não decide** e não valida domínio.
5. **Qualquer efeito institucional exige evento explícito + autorização explícita + auditoria explícita**.

---

## 2) Entidades e relação com estruturas existentes (anti-duplicação)

Este contrato reconhece e NÃO substitui automaticamente estruturas já existentes no sistema:

### 2.1 Tabela `events` (Migration 026)
A tabela `events` já existe e contém campos básicos (id, tenant_id, title, start/end, city_id, created_by_global_user_id etc.).
**Exigência:** O Domínio mínimo deve evoluir **sem apagar** essa base e sem assumir que ela já está completa para governança institucional.

### 2.2 `EventSpec` (Migration 157)
`EventSpec` existe como **snapshot imutável** de um questionário/especificação declarativa.

- `EventSpec` **não é** o Agregado `Event`.
- `EventSpec` **não decide nada**.
- `EventSpec` pode **originar/gerar** uma `EventDeclaration`, mas **são entidades distintas**.

### 2.3 Tipos e serviços existentes
Se o código já contiver `EventStatus`, `visibility`, `actor_id` etc., este contrato **padroniza** o comportamento canônico e elimina inferências escondidas.

---

## 3) Definições canônicas

### 3.1 Event (Agregado)
**Event** é o agregado que representa um contexto institucional onde outras coisas podem ocorrer.

**Evento não é:**
- agenda
- contrato econômico
- wizard de UX
- motor de matching
- motor de reputação
- motor de votação
- motor de pagamentos/splits/custódia

### 3.2 Actor responsável
Todo Event MUST possuir um **responsible_actor** explícito.

- `responsible_actor_id` (obrigatório)
- `responsible_actor_type` (obrigatório)

**Proibição absoluta:** inferir actor por sessão, tenant, user, grupo, página, ou “quem está logado”.

### 3.3 EventDeclaration (Subdocumento do Event)
`EventDeclaration` é um subdocumento 1:1 do agregado Event.

- É **declaração** (dado), não regra.
- Não executa nada.
- Não valida nada por conta própria.
- Não cria agenda.
- Não cria economia.
- Não cria compromissos operacionais automaticamente.

Persistência recomendada (mínimo): `events.metadata.declaration` (JSONB) — como estado; a verdade institucional está no contrato e nos efeitos.

---

## 4) Status mínimos canônicos do Event

Estados mínimos (obrigatórios):

- `draft` — rascunho sem efeito institucional
- `declared` — declaração registrada (ainda não publicado)
- `published` — publicado conforme visibilidade (apenas publicação; sem economia e sem agenda)
- `active` — em andamento (marcação de contexto, não valida presença)
- `ended` — encerrado
- `cancelled` — cancelado

Regra: **status muda por transição explícita** (não por “edição direta” e não por inferência do sistema).

---

## 5) EventDeclaration — campos mínimos e regras

### 5.1 Multi-aspecto (sem macro único)
O Evento deve suportar **múltiplos aspectos** simultâneos.
“Macro” pode existir como UX, mas no core é multi-aspecto.

### 5.2 Vocabulário fechado de aspectos (governança)
`EventAspect` MUST ser **vocabulário fechado**, **versionado** e **não-retroativo**.

- O EventDeclaration armazena:
  - `aspects: EventAspect[]`
  - `aspects_version: string` (ex.: `v1`)
- `EventAspect` NÃO é texto livre como fonte de verdade.
- Mudanças no vocabulário:
  - exigem governança
  - não retroagem
  - não reclassificam eventos antigos automaticamente

### 5.3 Visibilidade e intent flags
- `visibility` é **declaração** (não decisão).
- `intent_flags` são **declaração** (ex.: “quero serviços”, “quero votação”, “quero ticketing”).
- Declaração pode ser “fora do escopo” do actor; o sistema deve marcar como **intenção fora de escopo**, mas não “executar”.

### 5.4 Janela temporal (declaração, não agenda)
Evento pode coletar `datetime_start/datetime_end` ou janelas desejadas.
Isso:
- **não cria** slot
- **não bloqueia** agenda
- **não valida** disponibilidade por conta própria

---

## 6) Integração com Agenda Universal (read-only)

O Evento:
- **NUNCA escreve** na Agenda Universal
- **NUNCA bloqueia** horário
- **NUNCA cria** reserva/slot/booking

Permitido:
- Consultar disponibilidade **read-only** via Agenda Universal
- Retornar conflitos como **informação**
- Retornar sugestões apenas se forem **resultados de consulta** (não inferência “criativa” do Evento)

Qualquer bloqueio temporal é ação explícita do usuário via **módulo de Agenda**, não pelo Evento.

---

## 7) Anti-responsabilidades explícitas (proibições)

O Event (e EventDeclaration) NUNCA PODE:

1. Validar agenda por conta própria
2. Criar agenda paralela
3. Bloquear slots / criar reservas / escrever na Agenda Universal
4. Decidir matching de empresas/serviços
5. Executar pagamentos, ledger, splits, custódia, ticketing
6. Executar votação
7. Inferir categorias/aspects a partir de texto livre
8. Embutir “templates” que virem regra institucional
9. Alterar reputação, punir ou classificar pessoas automaticamente
10. Converter observabilidade/logs em decisão (ex.: “faltou então pune”)

---

## 8) Relação EventSpec ↔ EventDeclaration (obrigatório)

- `EventSpec` = snapshot imutável de questionário (declaração bruta do formulário).
- `EventDeclaration` = declaração estruturada do Event, governada por vocabulário fechado.
- `EventSpec` pode alimentar `EventDeclaration`, mas:
  - não substitui Event
  - não decide
  - não cria efeitos
  - não valida agenda

---

## 9) Compatibilidade e não-retroatividade

- Eventos existentes sem `EventDeclaration` permanecem válidos.
- Novos campos devem ser opcionais para compatibilidade até migração/adoção completa.
- Nenhuma mudança de regra pode alterar resultado de eventos antigos “retroativamente”.

---

## 10) Critério de PR (regra de aço)

Se um fluxo não puder ser expresso como:
**declaração → aceitação → fato → efeito → consequência**, ele NÃO entra no domínio Evento.

E se tocar em:
agenda write, economia, punição, reputação, decisão automática → **PR bloqueado**.

---

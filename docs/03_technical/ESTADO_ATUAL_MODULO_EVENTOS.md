# ESTADO ATUAL — MÓDULO EVENTOS

Status: ✅ FECHADO / PRONTO PARA PRODUÇÃO  
Última validação: 2025-01-07

---

## 📌 VISÃO GERAL

O módulo de Eventos do UnifiCard está **formalmente encerrado em termos arquiteturais**.

- Eventos NÃO são um módulo isolado
- Eventos são um tipo de conteúdo social
- O Feed da rede social é o CORE
- A página /eventos é apenas uma visão filtrada (agenda)

Não existem motores paralelos.

---

## 🧠 MOTOR DE EVENTOS — DECISÃO FINAL

- Existe **UM único fluxo de criação**:
  → `EventCreationWizard`

- Não existe criação de eventos via modal independente
- Não existe lógica duplicada de criação
- Feed e /eventos usam o mesmo motor e as mesmas fontes de dados

---

## 🧩 STEP 2 — INTENÇÃO (UX CONGELADO)

A pergunta oficial do Step 2 é:

> **“O que você quer que aconteça?”**

As intenções disponíveis e seu mapeamento são:

- 🎭 Apresentar algo → `cultural`
- 🤝 Reunir pessoas → `social`
- 🎓 Ensinar algo → `professional`
- 🎉 Celebrar algo → `private`
- 🏆 Competir / Desafiar → `sports`
- 🙏 Inspirar / Conectar → `spiritual`
- 🍽️ Experiência gastronômica → `gastronomic`
- 📣 Promover / Divulgar → `community`

⚠️ Regras importantes:
- “Intenção” **NÃO é persistida** no banco
- O backend recebe apenas `event_type`
- Nenhum novo `event_type` pode ser criado sem revisão arquitetural

---

## 🧱 GOVERNANÇA

Este módulo respeita integralmente:

- `REGULAMENTO_EXECUCAO.md`
- `GOLDEN_PATH.md`
- `ANTI_PATTERNS.md`
- `PROPOSTA_STEP2_INTENCAO_FINAL.md`

Não houve:
- mudança de contrato de banco
- criação de entidades novas
- bypass de governança

---

## 🧪 VALIDAÇÃO OBRIGATÓRIA

Antes de qualquer merge ou deploy:

1. Executar:
   - `HOTFIX_MIGRATION_070.sql`

2. Executar checklist:
   - `VALIDACAO_POS_IMPLEMENTACAO.md`

Se qualquer item falhar, o módulo **não está pronto**.

---

## ⛔ PROIBIÇÕES (CONTRATO RÍGIDO)

- NÃO alterar o Step 2 sem reavaliar governança
- NÃO criar novos fluxos de criação de eventos
- NÃO duplicar fetch de eventos
- NÃO refatorar backend relacionado a eventos
- NÃO introduzir lógica paralela no frontend

---

## 🔜 EVOLUÇÕES PERMITIDAS (FUTURO)

Somente após nova revisão arquitetural:

- Checkout de ingressos
- Destaque de eventos por cidade/data
- Recomendação baseada em intenção (via metadata)
- Analytics e relatórios de eventos

Qualquer outra mudança exige nova validação formal.

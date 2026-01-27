# FASE 5.0 — CHECKLIST CANÔNICO DE PR
## Event Creation Orchestration

Este checklist é OBRIGATÓRIO para qualquer PR relacionado à Fase 5.0.
PR que não passa aqui NÃO SOBE.

---

## 1. BACKEND — ORQUESTRADOR

- [ ] Existe `event-creation.orchestrator.ts`
- [ ] O arquivo apenas encadeia serviços existentes
- [ ] Nenhuma regra de negócio nova foi criada
- [ ] Nenhuma escrita econômica ocorre
- [ ] Nenhuma tabela de ledger, split ou custódia é tocada
- [ ] TEST currency aparece apenas como preview

❌ PROIBIDO:
- criar pagamento
- criar reserva
- confirmar qualquer coisa

---

## 2. API — CONTRATOS V2

- [ ] `POST /events/v2/create` cria ou avança RASCUNHO
- [ ] `GET /events/:id/v2/summary` apenas agrega dados
- [ ] Nenhuma resposta contém:
  - “confirmado”
  - “criado com sucesso”
  - “reservado”

---

## 3. FRONTEND — UX E SEMÂNTICA

- [ ] Nenhuma tela usa “Criar evento”
- [ ] Sempre usar “Rascunho de evento” ou “Explorar evento”
- [ ] Datas são chamadas de:
  - janelas
  - possibilidades
- [ ] Fornecedores são apresentados como PAPÉIS
- [ ] Valores são INTERVALOS (TEST)

---

## 4. COPY / TEXTO

- [ ] Não existe promessa implícita
- [ ] Não existe linguagem jurídica antecipada
- [ ] Todo CTA deixa claro que NÃO executa

---

## 5. KILL SWITCH

Se qualquer item abaixo aparecer, o PR DEVE SER BLOQUEADO:

- valor fixo
- data confirmada
- fornecedor nomeado
- pagamento iniciado

---

## ENCERRAMENTO

Este checklist é vinculante.
Nenhuma exceção é permitida.

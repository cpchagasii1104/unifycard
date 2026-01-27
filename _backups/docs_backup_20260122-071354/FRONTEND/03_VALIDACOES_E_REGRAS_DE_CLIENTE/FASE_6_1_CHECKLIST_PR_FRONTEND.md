# FASE 6.1 — CHECKLIST CANÔNICO DE PR
## Frontend Econômico (UX Segura)

Este checklist é OBRIGATÓRIO para qualquer PR de frontend
que toque economia real no UnifiCard.

VINCULANTE.

---

## 1. PREMISSAS BÁSICAS

- [ ] Frontend consome APENAS endpoints econômicos V2
- [ ] Nenhuma lógica econômica é reimplementada no frontend
- [ ] Nenhum estado é inferido (somente refletido)

---

## 2. SEMÂNTICA E TEXTO

- [ ] Nenhuma tela usa “pago”, “confirmado”, “finalizado”
- [ ] Estados usam termos:
  - “em custódia”
  - “autorizado”
  - “executado”
  - “revertido”
- [ ] Textos deixam claro quando algo NÃO aconteceu ainda

---

## 3. BOTÕES E AÇÕES

- [ ] Cada botão dispara UM endpoint
- [ ] Nenhum botão combina autorização + execução
- [ ] Botões perigosos exigem confirmação explícita
- [ ] Não existe “Pagar agora” genérico

---

## 4. ESTADOS VISUAIS

- [ ] Custódia, split, autorização e execução
      aparecem em seções separadas
- [ ] Estados não se confundem visualmente
- [ ] Chargeback bloqueia ações visivelmente

---

## 5. ERROS E BLOQUEIOS

- [ ] Erros são explícitos e compreensíveis
- [ ] Bloqueios econômicos são visíveis ao usuário
- [ ] Frontend não tenta “contornar” erro do backend

---

## 6. QA DE UX (OBRIGATÓRIO)

Pergunta final de review:

> “Um usuário pode sair achando que já pagou?”

- [ ] NÃO

Se a resposta for SIM, o PR NÃO SOBE.

---

## ENCERRAMENTO

Este checklist protege:
- usuário
- jurídico
- sistema
- reputação

Frontend bonito que mente
é bug crítico.

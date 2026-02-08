# DECISION — CRIAÇÃO DO GATE ZERO-B

## Contexto

O Gate Zero FUNCIONAL foi definido com o critério explícito:
> “Sistema sobe + `npm run build` passa”.

Esse critério foi executado e **falhou**, conforme evidência registrada no execution_log
`2026-02-05_referral-service.md`.

A falha não decorre de regressão recente, mas do estado estrutural histórico do repositório,
que inviabiliza o uso de `npm run build` como instrumento de validação funcional neste estágio.

## Decisão

Declara-se formalmente que:

1. **O Gate Zero FUNCIONAL original falhou**, e essa falha permanece registrada.
2. O Gate Zero original **não será redefinido retroativamente**.
3. Cria-se um novo Gate operacional denominado **Gate Zero-B**.

## Definição do Gate Zero-B

**Objetivo:** validar execução funcional mínima do sistema sem depender de compilação global.

**Critérios de PASS:**
- Backend sobe em modo `dev`
- Fluxo de cadastro de usuário executa até o banco com schema canônico
- Não há uso de estruturas proibidas
- Não há mutação fora da autoridade definida

**Critérios de FAIL:**
- Erros em runtime no fluxo de cadastro
- Violação de SSOT
- Uso de tabelas ou colunas proibidas
- Necessidade de redefinir o schema

## Escopo e Limitações

- O Gate Zero-B **não invalida** a falha do Gate Zero original.
- O Gate Zero-B **não elimina a necessidade futura de saneamento de build**.
- O Gate Zero-B é um **instrumento temporário**, criado para permitir avanço funcional governado.

## Estado do Projeto

- Gate Zero (original): ❌ FALHOU
- Gate Zero-B: 🟡 EM EXECUÇÃO
- Fase 3: ❌ BLOQUEADA até PASS do Gate Zero-B

## Justificativa

Manter o Gate Zero original como único critério tornaria o projeto incapaz de avançar
sem uma campanha de saneamento estrutural não prevista neste ciclo.

A criação do Gate Zero-B preserva:
- a verdade histórica,
- a integridade da governança,
- e a possibilidade de progresso funcional mensurável.

---

**Decisão tomada por:** Direção do Projeto  
**Data:** 2026-02-05

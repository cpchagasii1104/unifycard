Status: NON-NORMATIVE
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# FASE 6.1 — CONTRATO CANÔNICO DE UX ECONÔMICA
## Frontend Econômico Seguro (UnifiCard)

Este documento define o CONTRATO CANÔNICO DE UX para qualquer
interface que interaja com a economia real do UnifiCard.

VINCULANTE para frontend, produto, design e QA.

---

## PRINCÍPIO CENTRAL

A UI NÃO PODE CRIAR EXISTÊNCIA PSICOLÓGICA FALSA.

Nenhuma tela pode induzir o usuário a acreditar que:
- algo já foi pago
- algo já está garantido
- algo já aconteceu

quando, institucionalmente, isso não ocorreu.

---

## MODELO MENTAL OBRIGATÓRIO

A UX deve deixar explícitos os seguintes estados, SEM AMBIGUIDADE:

1. Nenhuma preparação econômica
2. Valor em custódia (protegido, não executado)
3. Pagamento autorizado (intenção registrada)
4. Pagamento executado (dinheiro movimentado)
5. Execução revertida (estorno / chargeback)

Esses estados NÃO podem parecer iguais visualmente.

---

## FRASES PROIBIDAS (ABSOLUTAS)

Nunca usar, em nenhuma hipótese:

- “Pagamento feito”
- “Pagamento confirmado”
- “Valor pago”
- “Dinheiro enviado”
- “Tudo certo”
- “Evento pago”

Mesmo quando o pagamento foi executado.

---

## FRASES PERMITIDAS E RECOMENDADAS

Usar linguagem técnica, clara e honesta:

- “Pagamento autorizado”
- “Execução pendente”
- “Execução realizada”
- “Valor em custódia”
- “Execução revertida”
- “Chargeback em análise”

---

## BOTÕES E AÇÕES

### PROIBIDO

- Botões genéricos (“Pagar agora”, “Confirmar tudo”)
- Ações múltiplas em um clique
- Combinar autorização + execução

### OBRIGATÓRIO

Cada botão deve:

- Ter verbo explícito
- Disparar UM endpoint
- Gerar UM evento econômico

Exemplos corretos:

- “Autorizar pagamento”
- “Executar pagamento”
- “Solicitar estorno”
- “Iniciar chargeback”

---

## SEPARAÇÃO VISUAL OBRIGATÓRIA

A tela econômica deve ser dividida claramente em seções:

- 📦 Custódia
- 🧮 Split
- ✍️ Autorização
- 💸 Execução
- 🔄 Estorno / Chargeback

Nunca misturar tudo em um único card.

---

## REGRA DE QA DE UX

Pergunta obrigatória em review:

> “Um usuário pode sair desta tela achando que já pagou?”

Se a resposta for SIM → A UX FALHOU.

---

## RELAÇÃO COM BACKEND

A UX deve refletir exatamente os estados retornados pelos endpoints V2.
Nenhum estado pode ser inferido.
Nenhum estado pode ser “simplificado”.

---

## ENCERRAMENTO

Este contrato protege:
- jurídico
- suporte
- reputação
- confiança institucional

UX que mente quebra o sistema.
UX honesta sustenta o UnifiCard.


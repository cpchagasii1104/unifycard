# POLÍTICA DE ATIVAÇÃO ECONÔMICA — UNIFICARD
## Quem Pode Ligar o Dinheiro, Quando e Como

Este documento define a POLÍTICA INSTITUCIONAL
para ativação da EXECUÇÃO ECONÔMICA REAL no UnifiCard.

VINCULANTE.
Sem exceções implícitas.

---

## PRINCÍPIO CENTRAL

Dinheiro não liga sozinho.
Código não liga dinheiro.
IA não liga dinheiro.

A ativação econômica é:
- humana
- explícita
- rastreável

---

## PAPÉIS AUTORIZADOS

Somente os seguintes papéis podem autorizar produção:

- Responsável Institucional (RI)
- Responsável Técnico (RT)

Ambos DEVEM concordar.

---

## DUPLA AUTORIZAÇÃO (OBRIGATÓRIA)

A ativação econômica exige:

1. Aprovação do Responsável Institucional
2. Aprovação do Responsável Técnico
3. Registro explícito da decisão

Sem dupla autorização:
→ produção BLOQUEADA.

---

## EVENTO DE ATIVAÇÃO

A liberação da economia ocorre SOMENTE via:

EVENTO INSTITUCIONAL:
`economic.execution.enabled`

Este evento:
- identifica quem autorizou
- identifica quando
- identifica por qual motivo

Sem esse evento:
→ execução econômica é inválida.

---

## SEPARAÇÃO DE AMBIENTES

- SANDBOX: execução permitida para teste
- PRODUÇÃO: execução permitida SOMENTE após evento de ativação

Trocar variável de ambiente NÃO é autorização.

---

## REVOGAÇÃO DE ATIVAÇÃO

A ativação econômica pode ser REVOGADA a qualquer momento via:

EVENTO:
`economic.execution.disabled`

Motivos comuns:
- incidente
- suspeita de erro
- decisão estratégica

Revogação é imediata.

---

## AUDITORIA

Toda ativação e desativação deve:

- gerar evento
- gerar log
- ser auditável posteriormente

Não existe “ligou sem registro”.

---

## ENCERRAMENTO

Esta política existe para garantir que:
- o dinheiro só circule quando decidido
- o sistema nunca seja culpado
- a responsabilidade seja sempre humana

Sem este documento,
produção é risco institucional.

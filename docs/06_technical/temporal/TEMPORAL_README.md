# TEMPORAL_README.md

## Por que este documento existe

Este sistema já esteve **temporalmente inconsistente**.

Não por descuido.
Não por falta de competência.
Mas porque **tempo é traiçoeiro** e, sem contrato explícito, ele se espalha pelo sistema de formas silenciosas.

Este README existe para explicar **o porquê** das regras temporais,
não apenas **o que** elas são.

Se você está lendo isso, considere um aviso amistoso:
**não simplifique o tempo no sistema.**

---

## O problema que já existiu

Antes do contrato temporal:

* `Date`, `string`, `timestamp` e `DATE` conviviam sem fronteira clara
* contratos expunham `Date`
* repositories retornavam estruturas ambíguas
* adapters improvisavam conversões
* eventos carregavam tempo de forma inconsistente
* bugs só apareciam em runtime
* auditoria temporal era impossível

O sistema **parecia funcionar**, mas não era confiável.

---

## A decisão tomada

Foi tomada uma decisão estrutural:

> **Tempo no sistema não é implementação.
> É contrato.**

Isso significa que:

* o formato é padronizado
* o boundary é explícito
* exceções não existem
* regressão não é aceitável

---

## A regra central (em linguagem simples)

* O sistema **opera com tempo como string ISO**
* `Date` **não é tipo de domínio**
* `Date` só existe no boundary
* Se atravessou boundary, está errado
* Se parece conveniente, provavelmente está errado

---

## Onde as regras vivem

Este README **não é a lei**.
Ele aponta para as leis reais:

* `TEMPORAL_CONTRACT.md`
  → define **o que é permitido e o que é proibido**

* `TEMPORAL_PREFLIGHT.md`
  → impede regressão antes do merge

Leia esses arquivos antes de:

* criar campos temporais
* alterar contratos
* mexer em eventos
* tocar em repositories ou services

---

## “Mas por que não usar Date em todo lugar?”

Porque:

* `Date` carrega timezone implícito
* serialização varia por ambiente
* comparações mudam silenciosamente
* eventos ficam ambíguos
* contratos ficam instáveis
* bugs aparecem tarde demais

`Date` é ótimo **na borda**.
É péssimo **no coração do sistema**.

---

## O que acontece se você quebrar isso

Se você:

* introduzir `Date` fora do adapter
* criar campo temporal sem `_at` / `At`
* usar duração sem unidade
* ignorar timezone

Então:

* o PR deve falhar
* a correção é obrigatória
* não existe “só dessa vez”

Isso não é burocracia.
É autopreservação.

---

## Como pensar tempo corretamente no sistema

Pergunte sempre:

1. Isso é um **ponto no tempo** ou uma **duração**?
2. A **hora importa**?
3. Alguém vai ordenar, comparar ou auditar isso?
4. Onde esse tempo entrou no sistema?
5. Onde ele foi convertido?

Se você não souber responder,
o código está errado.

---

## Para quem chega novo no projeto

Se você é novo aqui:

* não tente “simplificar” datas
* não copie código antigo sem entender
* não confie que “sempre funcionou”
* confie no contrato

Este sistema **já pagou o preço** da bagunça temporal.
Não vai pagar de novo.

---

## Declaração final

Este README existe para garantir que:

* o passado foi corrigido
* o presente é consistente
* o futuro não regrida

**Tempo é infraestrutura.
E infraestrutura não se improvisa.**

---

**FIM DO DOCUMENTO**
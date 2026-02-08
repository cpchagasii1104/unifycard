# Service — Estados e Transições Canônicas

Este documento define **os estados permitidos de um Service** no UnifiCard e **as transições institucionais válidas entre eles**.

Ele complementa `SERVICE_CANONICO.md` e existe para **impedir mutações implícitas, saltos ilegais e efeitos colaterais disfarçados**.

Nada aqui é técnico.
Tudo aqui é **lei de movimento do Service**.

---

## 1. Princípio Fundamental

Um Service:

* **sempre existe** depois de criado
* **nunca muda de natureza**, apenas de **estado**
* **não desaparece**, apenas muda de visibilidade e elegibilidade

> Estados controlam **o que o Service pode causar no sistema**, não sua existência.

---

## 2. Estados Canônicos Permitidos

### `DRAFT`

**Natureza:** promessa privada

* Criado pelo Actor
* Não visível
* Não indexável
* Não elegível para RFQ

Uso típico:

* declaração inicial
* rascunho institucional

---

### `DECLARED`

**Natureza:** promessa formal não pública

* Actor assume formalmente a oferta
* Ainda não visível
* Ainda não indexável

Uso típico:

* Service completo semanticamente
* aguardando governança

---

### `PUBLISHABLE`

**Natureza:** promessa apta à publicação

* Atende critérios institucionais
* Ainda não visível
* Ainda não indexada

Uso típico:

* pronto para indexação
* aguardando ato soberano

---

### `INDEXED`

**Natureza:** promessa pública ativa

* Visível em busca e marketplace
* Elegível para RFQ e matching

Uso típico:

* oferta ativa no ecossistema

---

### `SUSPENDED`

**Natureza:** promessa retirada temporariamente

* Não visível
* Não elegível para RFQ
* Histórico preservado

Uso típico:

* pausa operacional
* indisponibilidade prolongada

---

### `CLOSED`

**Natureza:** promessa encerrada

* Não visível
* Não reativável automaticamente
* Mantido apenas para histórico

Uso típico:

* encerramento definitivo
* mudança estrutural de oferta

---

## 3. Transições Canônicas Permitidas

As **únicas transições válidas** são:

```
DRAFT → DECLARED
DECLARED → PUBLISHABLE
PUBLISHABLE → INDEXED
INDEXED → SUSPENDED
SUSPENDED → INDEXED
INDEXED → CLOSED
DECLARED → CLOSED
DRAFT → CLOSED
```

Qualquer transição fora dessa lista é **ilegal institucionalmente**.

---

## 4. Autoridade por Transição

| Transição              | Autoridade                |
| ---------------------- | ------------------------- |
| DRAFT → DECLARED       | Actor                     |
| DECLARED → PUBLISHABLE | Governança                |
| PUBLISHABLE → INDEXED  | Ato soberano explícito    |
| INDEXED → SUSPENDED    | Actor                     |
| SUSPENDED → INDEXED    | Actor + critérios válidos |
| INDEXED → CLOSED       | Actor                     |
| DECLARED → CLOSED      | Actor                     |
| DRAFT → CLOSED         | Actor                     |

📌 Nenhuma IA possui autoridade de transição.

---

## 5. Transições Proibidas (Explícitas)

São **sempre inválidas**:

* `DRAFT → INDEXED`
* `DECLARED → INDEXED`
* `CLOSED → qualquer estado`
* `INDEXED → DECLARED`
* `SUSPENDED → DECLARED`

Essas transições configuram:

> visibilidade sem governança
> ou ressurreição sem rito

---

## 6. Relação com Indexação

* **Apenas o estado `INDEXED` implica visibilidade pública**
* Indexação **não é estado implícito**
* Indexação **não ocorre por efeito colateral**

Service em `PUBLISHABLE` **não aparece**.

---

## 7. Relação com RFQ e Matching

* Apenas Services em `INDEXED`:

  * aparecem em busca
  * recebem RFQ
  * participam de matching

Qualquer exceção a isso é **violação constitucional**.

---

## 8. Logs, Auditoria e Histórico

* Toda transição deve ser:

  * explícita
  * registrada
  * auditável

Histórico de estados **não pode ser sobrescrito**.

---

## 9. Erros Clássicos (Proibidos)

* “Publicar automaticamente ao completar formulário”
* “Reindexar ao editar Service”
* “Suspender por falta de resposta”
* “Fechar Service silenciosamente”

Todos são **atalhos ilegais**.

---

## Regra Final

O Service **só se move dentro da lei**.

Estados existem para:

* proteger o marketplace
* proteger o Actor
* proteger o sistema

Este documento é **canônico e vinculante** para:

* IA Guardiã
* IA Executora

Qualquer implementação que ignore estas transições é **institucionalmente inválida**.

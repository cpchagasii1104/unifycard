# 📜 CONTRATO DE EVENTOS v1 — UNIFICARD

**Status:** ATIVO  
**Versão:** v1.1  
**Data:** 28/12/2025  
**Escopo:** Backend, Frontend, Feed, Economia, IA  
**Caráter:** NORMATIVO (quebrar este contrato é bug arquitetural)

---

## 0. Princípio Fundamental

> **O UnifiCard não é um lugar para postar.
> É um sistema para organizar ações reais, com intenção clara, impacto rastreável e economia visível.**

Todo evento no UnifiCard é:

* uma **ação estruturada**
* criada por um **Actor**
* com **intenção explícita**
* que pode (ou não) gerar **impacto econômico**
* e sempre gera **impacto sistêmico**

---

## 1. Definições Canônicas

### 1.1 Actor

Entidade que inicia uma ação no sistema.

Tipos:

* `user` → pessoa física
* `page` → empresa, organização, igreja, clube, banda, etc.
* `group` → comunidade, coletivo de pessoas com interesse comum

**Regra absoluta:**

> Nenhum evento existe sem um Actor.

**Diferença fundamental:**
- **Page** produz valor econômico (tem CNPJ potencial, recebe cachê, vende)
- **Group** agrega pessoas (interesse comum, ação coletiva, não comercial)

---

### 1.2 Evento

Evento é uma **instância de ação** com:

* início
* contexto
* regras
* consequências

Evento **não é conteúdo social genérico**.

---

### 1.3 Feed

O Feed é o **HUB de execução** do sistema, não um mural.

O Feed:

* orquestra ações
* prioriza intenções
* conecta eventos, serviços e economia

---

## 2. Modelo Arquitetural de Eventos

### 2.1 Tabela Canônica

> **Todos os eventos do sistema DEVEM existir na tabela `events`.**

Não é permitido:

* múltiplas tabelas por tipo de evento
* silos por domínio (`cultural_events`, `social_events`, etc.)

**Justificativa normativa:**

* Feed precisa de fonte única
* Ledger referencia `event_id`
* Split Engine não conhece domínios
* IA precisa de contrato estável

---

### 2.2 Discriminador Central: `event_type`

Todo evento **OBRIGATORIAMENTE** possui `event_type`.

`event_type`:

* governa UI
* governa economia
* governa visibilidade
* governa feed

Sem `event_type`, o evento é inválido.

---

## 3. Taxonomia Oficial de `event_type` (v1)

```text
cultural
gastronomic
social
professional
community
spiritual
sports
private
```

### Regra:

* Novos `event_type` **NÃO** são criados dinamicamente.
* A expansão ocorre via **subtypes**, nunca via novos tipos raiz sem revisão arquitetural.

---

## 4. Matriz Actor × EventType (Regra de Domínio)

### 4.1 Tipos de Actor

* `user` → pessoa física
* `page` → empresa, organização, banda, igreja, venue
* `group` → comunidade, coletivo de pessoas (NÃO é empresa)

### 4.2 Permissões

| Event Type   | User | Page | Group |
| ------------ | ---- | ---- | ----- |
| cultural     | ✅    | ✅    | ❌     |
| gastronomic  | ✅    | ✅    | ❌     |
| social       | ✅    | ❌    | ✅     |
| professional | ✅    | ✅    | ❌     |
| community    | ✅    | ✅    | ✅     |
| spiritual    | ✅    | ✅    | ✅     |
| sports       | ✅    | ✅    | ✅     |
| private      | ✅    | ❌    | ❌     |

### 4.3 Regra especial para Groups

> **Grupo pode criar evento, mas NUNCA como produtor comercial.**

Quando `organizer.type = group`:
- `event_type` DEVE ser: `community`, `social`, `spiritual` ou `sports`
- `ticket_price_cents` DEVE ser ≤ limite configurável (ex: R$50)
- Split profile DEVE ser `community`, nunca `commercial`

**Válido para grupo:**
- Mutirão, encontro de moradores, churrasco comunitário
- Retiro espiritual interno, treino do time
- Contribuição simbólica (R$10-20)

**Inválido para grupo:**
- Show com ingresso comercial
- Festival com produção profissional
- Qualquer evento que deveria ser Page

> Se virou produção comercial → tem que ser Page.

### 4.4 Regra normativa

> O backend é a autoridade final.
> O frontend apenas reflete essas regras.

---

## 5. Economia de Eventos

### 5.1 Regra-Mãe

```text
Se um evento possui valor monetário (> 0),
ele OBRIGATORIAMENTE passa pelo Split Engine.
```

Não é permitido:

* cálculo de split no frontend
* simulação econômica no frontend
* eventos pagos fora do ledger

---

### 5.2 Evento Gratuito

Evento gratuito:

* NÃO gera transação financeira
* MAS gera ação sistêmica
* Aparece no feed
* Conta para score e histórico

Evento gratuito **não é irrelevante**.

---

### 5.3 Split Engine (Regra Híbrida)

* Existe uma **base fixa imutável** (plataforma / cidade / região / comunidade)
* Existe uma **parte variável controlada** (organizador / parceiros)

Não é permitido:

* evento fora do ecossistema
* organizador receber 100%
* zerar impacto sistêmico

---

### 5.4 Economia de Grupos (Regra Especial)

Quando **grupo é organizador**:

| Situação | Regra |
|----------|-------|
| Evento gratuito | ✅ Permitido |
| Contribuição simbólica (≤ R$50) | ✅ Permitido, split simplificado |
| Ingresso comercial (> R$50) | ❌ Proibido |
| Grupo recebe 70% (parte principal) | ❌ Nunca |
| Grupo recebe 5% (fundo comunitário) | ✅ Sim, vai para caixa do grupo |

> **Se o evento precisa de economia comercial → deve ser criado por Page, não Group.**

---

## 6. Check-in e Impacto

### 6.1 Check-in

Check-in é uma **confirmação de ação no mundo real**.

Pode ocorrer via:

* QR
* manual
* automático

### 6.2 Impacto

Impacto:

* nunca é simulado
* nunca é calculado no frontend
* sempre vem do backend

Se houver impacto:

* ele é exibido
* ele é rastreável
* ele é transparente

---

## 7. IA no Sistema de Eventos

### 7.1 Papel da IA

> **IA é guardiã, não criadora.**

A IA:

* classifica
* valida
* protege

A IA **não**:

* inventa categorias raiz
* decide economia
* publica sozinha

---

### 7.2 Pipeline de Moderação

Todo input passa por:

1. **Blocklist determinística**

   * crime
   * sexo
   * drogas
   * spam
   * fraude

2. **Análise semântica**

   * legitimidade
   * intenção
   * tentativa de burlar sistema

3. **Decisão**

   * approved
   * flagged
   * rejected

---

## 8. Subtypes Dinâmicos

### 8.1 Definição

Subtypes refinam `event_type`.

Exemplo:

* `event_type = cultural`
* `event_subtype = encontro_colecionadores`

### 8.2 Regras

* Subtypes começam como `provisional`
* Só viram `official` por uso real
* Spam morre por inércia

Nenhum subtype vira raiz.

---

## 9. Wizard de Criação (Obrigatório)

Evento **não pode** ser criado por formulário livre.

Fluxo obrigatório:

```text
Actor → EventType → Contexto → Economia → Revisão → Publicar
```

Sem wizard:

* evento inválido
* publicação bloqueada

---

## 10. PAC (Perfil Artístico Cultural)

### Decisão normativa:

> PAC NÃO é origem de evento.

PAC:

* é metadata
* é persona artística
* é curadoria estética

**Origem sempre é Actor.**

---

## 11. Feed como Executor

O Feed:

* não é cronológico puro
* não é mural social
* não é marketplace isolado

O Feed:

* executa ações
* prioriza intenções
* conecta economia e impacto

---

## 12. Compatibilidade com Legado

* `cultural_events`:

  * congelado
  * migrável
  * posteriormente deprecado

* Nenhum novo sistema deve depender dele.

---

## 13. Quebra de Contrato

Qualquer implementação que:

* crie evento fora de `events`
* calcule economia no frontend
* burle `event_type`
* ignore Actor

➡️ **É considerada BUG ARQUITETURAL.**

---

## 14. Encerramento

Este contrato existe para garantir que:

* o sistema escale
* o feed não degrade
* a economia seja íntegra
* a IA não corrompa o domínio
* decisões não fiquem implícitas

> **Código muda.
> Contrato não.**

---

## Anexo: Resolução dos GAPS do Diagnóstico

| GAP | Problema | Resolução no Contrato |
|-----|----------|----------------------|
| 1 | Split não integrado com CORE | Seção 5.1 - Obrigatório passar pelo Split Engine |
| 2 | Três formas de identificar criador | Seção 1.1 + 10 - Actor é única origem, PAC é metadata |
| 3 | Feed não sabe qual sistema usar | Seção 2.1 - Tabela única `events` |
| 4 | Event types inconsistentes | Seção 3 - Taxonomia oficial de 8 tipos |
| 5 | Check-in não gera transação real | Seção 6.2 - Impacto sempre vem do backend |
| 6 | Posts linkam só com events | Seção 2.1 - Tabela unificada resolve |

---

## Histórico

| Data | Versão | Mudança |
|------|--------|---------|
| 28/12/2025 | v1.0 | Contrato inicial cristalizado |
| 28/12/2025 | v1.1 | Group adicionado como actor organizador (com restrições) |

---

*Este documento é a ÚNICA fonte de verdade para o sistema de eventos.*
*Qualquer dúvida arquitetural deve ser resolvida consultando este contrato.*

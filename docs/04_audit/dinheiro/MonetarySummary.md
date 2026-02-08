# RELATÓRIO EXECUTIVO — MAPA MONETÁRIO ARQUITETURAL (MonetarySummary)

## STATUS
AUDITORIA COMPLETA · CONCLUÍDA  
**Data:** 2026-02-05  
**Modo:** GUARDIÃO (somente leitura)  
**Escopo:** backend/src (TypeScript)

Este relatório consolida **todo o uso de valores monetários** identificado no sistema,
sem qualquer alteração de código.

---

## RESUMO EXECUTIVO

Foram identificadas **60 ocorrências monetárias** no backend, classificadas em **quatro eixos arquiteturais** distintos.

| Categoria | Quantidade | Papel no sistema |
|---------|------------|------------------|
| **MonetaryDomain** | 20 | Dinheiro como dado persistido / contrato |
| **MonetaryBusiness** | 15 | Dinheiro como regra e cálculo |
| **MonetaryBoundary** | 15 | Conversões entre camadas |
| **MonetaryIO** | 10 | Exposição externa (API, logs, mensagens) |
| **TOTAL** | **60** | — |

---

## LEITURA CORRETA DO RESULTADO

👉 **Não há bug monetário detectado.**  
👉 O que existe é **inconsistência semântica e ausência de contrato explícito**.

O sistema:
- Funciona
- Calcula
- Persiste
- Retorna valores

Mas **não declara formalmente**:
- unidade
- precisão
- responsabilidade de conversão
- local correto de formatação

---

## PRINCIPAIS CONSTATAÇÕES

### 1. Unidade monetária não é universal
- Alguns campos usam `_cents`
- Outros não indicam unidade (`rate`, `amount`, `earnings`)
- Isso gera ambiguidade silenciosa

---

### 2. Percentuais não são normativos
- Usados como `0–100`
- Sem `_bps`
- Hardcoded em alguns pontos

---

### 3. Conversões inconsistentes no boundary
- `Number()`
- `parseFloat()`
- atribuição direta
- defaults variam entre `0`, `null`, `undefined`

---

### 4. Formatação quase inexistente
- API retorna centavos crus
- Apenas **1 ponto** converte para exibição humana
- Logs expõem valores sem contexto

---

### 5. Moeda não é tratada como domínio
- `'BRL'` aparece hardcoded
- Sem abstração
- Sem preparo para múltiplas moedas

---

## O QUE ESTE RELATÓRIO NÃO FAZ

❌ Não corrige código  
❌ Não impõe padrão  
❌ Não muda contratos  
❌ Não mexe em cálculo  

Ele **apenas delimita o terreno** para decisões conscientes.

---

## CONCLUSÃO ARQUITETURAL

O eixo **MONETÁRIO**:

- ❌ **não está fechado**
- ❌ **não é inconsistente por acidente**
- ✅ **é inconsistente por falta de decisão formal**

Diferente do eixo **TEMPO**, aqui o próximo passo **não é mecânico** —
é **normativo**.

---

## PRÓXIMO PASSO CANÔNICO (NÃO EXECUTADO)

Criar uma norma explícita definindo:
- unidade padrão (centavos)
- tipo permitido (`bigint` vs `number`)
- sufixos obrigatórios (`_cents`, `_bps`)
- onde converter
- onde formatar
- onde é proibido mexer

Somente **depois disso** qualquer correção é segura.

---

## ARQUIVOS DE SUPORTE

Este resumo se apoia nos seguintes documentos:

- `docs/04_audit/MonetaryDomain.md`
- `docs/04_audit/MonetaryBusiness.md`
- `docs/04_audit/MonetaryBoundary.md`
- `docs/04_audit/MonetaryIO.md`

---

## CONFIRMAÇÃO FINAL

✅ **Nenhum código foi alterado**  
✅ **Nenhuma regra foi imposta**  
✅ **Nenhuma decisão foi antecipada**

Este relatório encerra **a fase de diagnóstico monetário**.

**FIM DO DOCUMENTO**

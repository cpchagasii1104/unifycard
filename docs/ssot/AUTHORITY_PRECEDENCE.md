# AUTHORITY PRECEDENCE — SSOT UnifiCard

Status: RECOMENDADO · NORMATIVO  
Tipo: DOCUMENTO DE BLINDAGEM  
Escopo: GLOBAL  
Subordinação:
- `AUTHORITY_LAW.md`
- `08_AUTORIDADE_CANONICA.md`

Dependências diretas:
- `GATES.md` (aplica esta precedência nos critérios de Gate A)
- `AUTHORITY_RECOVERY.md` (usa esta ordem para recuperação)
- `FALSIFICATION_LOG.md` (registra violações desta precedência)
entre travas de autoridade, segurança e operação no sistema UnifiCard.

Seu objetivo é:
- eliminar ambiguidade
- evitar negociação entre camadas
- impedir “jeitinho de produto”
- resolver conflitos **sem interpretação humana**

Este documento **NÃO cria novas regras**.
Ele apenas define **qual regra vence quando há conflito**.

Nota DECISION-0021: autoridade não é definida por pasta, rota, tabela ou acoplamento técnico. Em conflito de camadas, primeiro identifica-se quem possui jurisdição legítima sobre a verdade envolvida; depois aplica-se a precedência mais restritiva deste documento.

---

## 2. PRINCÍPIO FUNDAMENTAL

> **Em qualquer conflito, vence sempre a trava MAIS RESTRITIVA.**

Não existe:
- ponderação
- exceção contextual
- override operacional
- decisão “caso a caso”

---

## 3. ORDEM CANÔNICA DE PRECEDÊNCIA

A ordem de precedência **imutável** é:

1. **ATL — Authority Trust Level**
2. **KYC — Verificação de Identidade**
3. **GUARDA — Responsabilidade Econômica**
4. **IA / SISTEMAS — Automação**
5. **PRODUTO — Fluxo, UX, regra de negócio**

---

## 4. DEFINIÇÃO DAS CAMADAS

### 4.1 ATL — Authority Trust Level

- Define se o ator **PODE EXISTIR OPERACIONALMENTE**
- Bloqueia:
  - criação
  - delegação
  - ações irreversíveis
- ATL restritivo **sempre vence** qualquer outra permissão

---

### 4.2 KYC — Verificação de Identidade

- Define **capacidade econômica e jurídica**
- Sem KYC mínimo:
  - não há poder econômico
  - não há guarda
  - não há delegação financeira
- KYC restritivo vence Guarda, IA e Produto

---

### 4.3 Guarda — Responsabilidade Econômica

- Define **quem responde financeiramente**
- Impõe:
  - teto
  - prazo
  - escopo
- Violação de guarda gera:
  - restrição imediata
  - possível ATL

Guarda restritiva vence IA e Produto.

---

### 4.4 IA / Sistemas

- IA **nunca é soberana**
- Opera apenas dentro de:
  - escopo delegado
  - limites quantitativos
  - reversibilidade
- IA nunca pode:
  - criar autoridade
  - aliviar restrição superior

IA perde para qualquer camada acima.

---

### 4.5 Produto

- Produto é **sempre a camada mais fraca**
- Produto:
  - não cria exceção
  - não redefine poder
  - não suaviza restrição
- Qualquer regra de produto que conflite com camadas superiores
  é **inválida por definição**

---

## 5. MATRIZ DE CONFLITO (EXEMPLOS)

| Situação | Decisão |
|--------|--------|
| Produto permite, ATL bloqueia | ❌ BLOQUEADO |
| IA sugere, KYC impede | ❌ BLOQUEADO |
| Guarda limita, produto expande | ❌ BLOQUEADO |
| IA automatiza, ação é irreversível | ❌ BLOQUEADO |
| Produto tenta “exceção temporária” | ❌ BLOQUEADO |

---

## 6. PROIBIÇÕES ABSOLUTAS

É proibido:
- inverter precedência
- criar override de camada inferior
- “flexibilizar” por urgência
- tratar produto como autoridade
- ignorar ATL, KYC ou Guarda

Violação desta ordem é **falha estrutural grave**.

---

## 7. USO EM AUDITORIA E GATES

Este documento:
- é referência obrigatória em auditorias
- é critério de PASS/FAIL em Gates
- resolve conflitos sem debate

Dúvida de precedência:
→ aplica-se a camada mais restritiva
→ registra-se no `FALSIFICATION_LOG.md` se houver contestação

---

## 8. SUPREMACIA

Este documento prevalece sobre:
- decisões de produto
- conveniência operacional
- otimizações técnicas
- pressão comercial

---

FIM DO AUTHORITY PRECEDENCE

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 08_AUTORIDADE_CANONICA.md
- AUTHORITY_LAW.md
- AUTHORITY_RECOVERY.md
- FALSIFICATION_LOG.md
- GATES.md

### Referenciado por
- 00_INDEX.md
- AUTHORITY_RECOVERY.md
- GATES.md
- GATE_2_BLOCKERS.md
<!-- AUTO-GENERATED-END -->

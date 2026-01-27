# AUTONOMY_RULES.md

## Propósito deste documento

Este documento define **regras explícitas** que permitem implementação autônoma de funcionalidades observacionais no sistema Unify.

Estas são **regras do jogo**, não sugestões.

**Leia este documento antes de implementar qualquer funcionalidade observacional.**

---

## 1. Decision Log é exceção à regra READ-ONLY

### Regra formal:

**SIM. Decision Log é exceção explícita.**

### Definição clara:

- **READ-ONLY** = não alterar estado de negócio
- **Decision Log** = memória observacional, não estado de negócio

### O que é permitido:

- ✅ Escrever em `logs/decisions/*.json`
- ✅ Registrar observações no Decision Log
- ✅ Criar entradas de simulação/insight

### O que NÃO é permitido:

- ❌ UPDATE/INSERT em tabelas de domínio (orders, offers, prices, ledger, etc.)
- ❌ Alterar estado de negócio

### Regra prática:

> **Escrever no Decision Log não é execução, é telemetria estruturada.**

**Decision Log é o "black box recorder" do sistema.**

Sem ele, o sistema é cego.
Com ele, o sistema **aprende sem agir**.

### Status:

✅ **Autorizado**
❌ **Não precisa perguntar de novo**

---

## 2. Tabelas observacionais — quando criar

### Regra prática:

**NÃO por padrão. SIM apenas com autorização explícita.**

### Prioridade absoluta (ordem):

1. **Event Log existente** (primeira opção)
2. **Decision Log** (segunda opção)
3. **Views** (terceira opção)
4. **Agregações em memória** (quarta opção)
5. **Arquivos derivados** (quinta opção)
6. **Tabela nova** (última opção, só com aprovação)

### Tabela nova só é aceitável se **TODAS** forem verdade:

- ✅ Observacional (não dirige execução)
- ✅ Reversível (DROP sem impacto)
- ✅ Isolada (não referenciada por core)
- ✅ Justificada por volume/performance
- ✅ Aprovada explicitamente

### Regra prática:

> **Se chegar no ponto "isso realmente precisa de tabela", para e pergunta.**

### Status:

- Hoje: **assuma que NÃO**
- Futuro: exceção consciente

---

## 3. Identificação automática de módulos CORE

### Regra de ouro:

> **Se escreve em produção, é CORE.**

### Checklist mental:

- Faz `INSERT / UPDATE / DELETE` em tabelas de domínio?
  → **CORE**
- Move dinheiro?
  → **CORE**
- Altera preço real?
  → **CORE**
- Cria pedido, corrida, reserva?
  → **CORE**

### Pode importar em observacional?

- ❌ Se escreve → **NÃO**
- ✔️ Se só lê → **SIM**

### Classificação rápida:

#### CORE (não pode importar em observacional):
- `economy/ledger` → CORE
- `economy/transactions` → CORE
- `economy/split` → CORE
- `canonical-orchestrator` → CORE (mesmo sem escrever, é nervo central)
- `event_log` → CORE

#### EXCEÇÃO OBSERVACIONAL (pode importar):
- `decision-log` → **EXCEÇÃO OBSERVACIONAL**

#### OBSERVACIONAL (pode importar entre si):
- `catalog/*` → observacional
- `simulation/*` → observacional
- `insight/*` → observacional

### Regra prática:

> **Observacional NUNCA importa CORE que escreve.**
> Ele só **observa** CORE.

---

## 4. Compatibilidade retroativa (quando algo não existe)

### Regra oficial:

> **Verificar → tentar usar → fallback conservador**

### Padrão aceito:

```typescript
// Verificar se existe
if (serviceExists) {
  // Tentar usar
  try {
    const result = await service.doSomething();
    return result;
  } catch (error) {
    // Fallback conservador
    return fallbackValue;
  }
} else {
  // Fallback explícito e documentado
  return fallbackValue;
}
```

### Princípios:

- ✅ Verificar antes de usar
- ✅ `try/catch` sem quebrar fluxo
- ✅ Fallback explícito e documentado
- ✅ Nunca inventar dado

### Exemplos válidos:

- City Readiness não existe → marca `confidence = 'insufficient'`
- Policy não existe → usa base ou retorna `null`
- Decision Log não tem campo novo → assume `'unknown'`

### Regra prática:

> **Compatibilidade > pureza arquitetural**
> Sistema vivo > sistema perfeito

---

## 5. Adicionar campos novos a dados existentes

### Regra de migração:

1. Campo novo = **opcional**
2. Código novo escreve o campo
3. Código antigo continua funcionando
4. Leitores tratam ausência como `'unknown'` ou `null`
5. Só depois (muito depois) pode se tornar obrigatório

### Nunca fazer:

- ❌ Quebrar contratos existentes
- ❌ Exigir migração imediata
- ❌ Assumir que histórico tem o novo campo

### Exemplo correto:

```typescript
interface ProductDemandSignal {
  // Campos existentes (obrigatórios)
  demandIndex: number;
  supplyIndex: number;
  
  // Campo novo (opcional inicialmente)
  confidence?: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize?: number;
}

// Código que lê trata ausência
const confidence = signal.confidence || 'unknown';
```

### Regra prática:

> **Evolução progressiva, nunca ruptura.**

---

## 6. Thresholds e heurísticas

### Regra:

**SIM, pode hardcodar — com marcação e disciplina.**

### Requisitos:

- ✅ Nomear claramente:
  - `TEMPORARY_HEURISTIC`
  - `EXPERIMENTAL_THRESHOLD`
- ✅ Documentar no código **por quê**
- ✅ Nunca esconder em número mágico
- ✅ Nunca tratar como regra de negócio

### Exemplo correto:

```typescript
// TEMPORARY_HEURISTIC:
// 20 samples chosen as conservative minimum for high confidence
// Will be replaced by percentile-based calculation when sufficient data exists
const MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE = 20;

// TEMPORARY_HEURISTIC:
// 7 days chosen as minimum observation window
// Will be replaced by adaptive window based on city maturity
const MIN_DATA_WINDOW_DAYS = 7;
```

### Exemplo incorreto:

```typescript
// ❌ Número mágico sem explicação
if (samples.length >= 20) { ... }

// ❌ Tratado como regra de negócio permanente
const REQUIRED_SAMPLES = 20; // Sem documentação
```

### Regra prática:

> **Isso é simulação, não execução.**
> Heurística aqui é aceitável, desde que marcada.

---

## 7. Quando parar e perguntar

### ❌ NÃO perguntar quando:

- ✅ É observacional
- ✅ É reversível
- ✅ Tem fallback conservador
- ✅ Não escreve em produção
- ✅ Não muda contrato externo
- ✅ Não cria dependência irreversível

### 🚨 PARAR E PERGUNTAR quando:

- ❌ Vai escrever em produção (exceto Decision Log)
- ❌ Vai criar tabela
- ❌ Vai mudar economia
- ❌ Vai acoplar módulos
- ❌ Vai assumir decisão automática
- ❌ Vai criar novo "tipo" de coisa
- ❌ Vai importar módulo CORE que escreve

### Critério atual:

> **"Assumo o mais conservador e pergunto se quiser diferente"**

✅ **Correto. Continue assim.**

---

## 8. Resumo — regras fechadas

Com estas regras, você pode assumir:

1. ✅ **Decision Log é exceção legítima ao READ-ONLY**
2. ❌ **Tabela nova só com autorização explícita**
3. 🔥 **Se escreve em produção, é CORE**
4. ✅ **Fallback conservador é sempre correto**
5. ✅ **Campos novos começam opcionais**
6. ✅ **Thresholds podem ser TEMPORARY_HEURISTIC**
7. ✅ **Em dúvida, caminho mais conservador**

---

## 9. O que você pode fazer sozinho agora

Com estas regras internalizadas, você pode operar **sozinho** em:

- ✅ Observação (medir, calcular índices)
- ✅ Simulação (calcular cenários "e se...")
- ✅ Insight (gerar insights de padrões)
- ✅ Confidence (adicionar confidence/dataQuality)
- ✅ Readiness (verificar City Readiness)
- ✅ Logging (registrar no Decision Log)
- ✅ Auditoria (verificar guardrails)

E **parar automaticamente** antes de causar dano estrutural.

---

## 10. O que você NÃO pode fazer sozinho

Você **deve parar e perguntar** antes de:

- ❌ Escrever em produção (exceto Decision Log)
- ❌ Criar tabela
- ❌ Importar módulo CORE que escreve
- ❌ Assumir decisão automática
- ❌ Criar novo tipo de módulo
- ❌ Alterar economia existente

---

## Documentos relacionados

- `ARCHITECTURE_GUARDRAILS.md`: O que o sistema **NUNCA pode fazer**
- `ECOSYSTEM_UNDERSTANDING.md`: O que o sistema **É**
- Este documento: **Como operar sozinho** dentro dos guardrails

**Leia todos antes de implementar qualquer funcionalidade.**

---

**Este documento é obrigatório para implementação autônoma no sistema Unify.**












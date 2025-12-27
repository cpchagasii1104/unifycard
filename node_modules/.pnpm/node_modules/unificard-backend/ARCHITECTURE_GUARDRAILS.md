# ARCHITECTURE_GUARDRAILS.md

## 1. Propósito do documento

Este documento define **guardrails negativos** do sistema UnifyCard. Ele não descreve o que o sistema faz, mas o que ele **NUNCA pode fazer**.

Estes guardrails são **absolutos** e devem ser verificados antes de qualquer implementação de nova camada ou módulo.

Violar qualquer guardrail deste documento indica **erro arquitetural grave** que compromete os princípios fundamentais do sistema.

---

## 2. Guardrails absolutos (NUNCA PODE)

### 2.1. Escrita em produção por camadas observacionais

**NUNCA PODE:**
- Camadas de observação (`InsightEngine`, `SimulationEngine`, `ProductDemandService`, `DynamicPricingService`) executarem `UPDATE`, `INSERT` ou `DELETE` em tabelas de produção.
- Camadas observacionais modificarem estado persistente (exceto `Decision Log` que é memória observacional).
- Rotas GET de simulação/observação terem handlers que alterem dados.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: DynamicPricingService escrevendo preço real
class DynamicPricingService {
  async simulateProductPricing(...) {
    const simulatedPrice = await this.calculatePrice(...);
    await runQueryWithTenant(
      'UPDATE product_offers SET price = $1 WHERE product_id = $2',
      [simulatedPrice, productId]
    );
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Apenas leitura e registro no Decision Log
class DynamicPricingService {
  async simulateProductPricing(...) {
    const simulatedPrice = await this.calculatePrice(...);
    await decisionLogService.logObservation({
      type: 'simulation',
      data: { simulatedPrice },
      decision: null
    });
    return { simulatedPrice };
  }
}
```

---

### 2.2. Simulação virando execução

**NUNCA PODE:**
- `SimulationEngine` ter métodos que executem ações baseadas em resultados de simulação.
- Resultados de simulação serem automaticamente aplicados sem aprovação externa.
- Existir handler que leia `Decision Log` e execute mudanças automaticamente.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Simulação executando ação
class SimulationEngine {
  async simulateRegionalSplit(...) {
    const result = await this.calculateSplit(...);
    if (result.suggestedSplit > 0.15) {
      await this.applySplit(result.suggestedSplit); // ❌ Execução automática
    }
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Simulação apenas registra observação
class SimulationEngine {
  async simulateRegionalSplit(...) {
    const result = await this.calculateSplit(...);
    await decisionLogService.logObservation({
      type: 'simulation',
      data: result,
      decision: null // Sempre null em simulação
    });
    return result;
  }
}
```

---

### 2.3. Acoplamento irreversível entre módulos

**NUNCA PODE:**
- Módulo A importar módulo B de forma que remover B quebre A.
- Módulo observacional depender de módulo de execução.
- Módulo de simulação depender de módulo que escreve em produção.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: DynamicPricingService importando módulo de execução
import { priceExecutionService } from '../price-execution/price-execution.service';

class DynamicPricingService {
  async simulateProductPricing(...) {
    const price = await this.calculatePrice(...);
    await priceExecutionService.applyPrice(price); // ❌ Dependência irreversível
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Apenas leitura de dados, sem dependência de execução
import { offerIndexService } from '../offer-index/offer-index.service';

class DynamicPricingService {
  async simulateProductPricing(...) {
    const currentPrice = await offerIndexService.getAveragePrice(...); // ✅ Apenas leitura
    const simulatedPrice = await this.calculatePrice(currentPrice, ...);
    return { simulatedPrice };
  }
}
```

---

### 2.4. Hardcode de policies

**NUNCA PODE:**
- Valores de policy serem hardcoded em código de negócio.
- Módulos assumirem valores fixos de policy sem passar por `PolicyResolutionEngine`.
- Policies serem definidas em múltiplos lugares (deve existir apenas em `PolicyRegistry`).

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Policy hardcoded
class SimulationEngine {
  async simulateRegionalSplit(...) {
    const maxSplit = 0.20; // ❌ Hardcoded
    const minSplit = 0.05; // ❌ Hardcoded
    // ...
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Policy resolvida dinamicamente
class SimulationEngine {
  async simulateRegionalSplit(...) {
    const maxSplit = await policyResolutionEngine.resolvePolicy(
      'economy',
      'max_regional_split',
      { regionId, ... }
    );
    const minSplit = await policyResolutionEngine.resolvePolicy(
      'economy',
      'min_regional_split',
      { regionId, ... }
    );
    // ...
  }
}
```

---

### 2.5. Normalizações fixas sem marcação TEMPORARY_HEURISTIC

**NUNCA PODE:**
- Normalizações como `100 buscas = 1.0` ou `10 ofertas = 1.0` serem tratadas como constantes imutáveis.
- Valores de threshold serem hardcoded sem documentação de que são heurísticas temporárias.
- Normalizações serem usadas em múltiplos lugares sem centralização.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Normalização fixa sem marcação
class ProductDemandService {
  calculateDemandIndex(searches: number): number {
    return Math.min(searches / 100, 1.0); // ❌ Sem marcação de temporário
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Heurística marcada como temporária
class ProductDemandService {
  // TEMPORARY_HEURISTIC: Normalização fixa será substituída por
  // percentil local ou baseline móvel por cidade quando houver dados suficientes
  private readonly TEMP_DEMAND_NORMALIZATION_THRESHOLD = 100;
  
  calculateDemandIndex(searches: number): number {
    return Math.min(searches / this.TEMP_DEMAND_NORMALIZATION_THRESHOLD, 1.0);
  }
}
```

---

### 2.6. Confundir dados insuficientes com valores reais

**NUNCA PODE:**
- `supplyIndex = 0.1` por falta de dados ser tratado igual a `supplyIndex = 0.1` por baixa oferta real.
- Cálculos serem executados com dados insuficientes sem verificação de `confidence` ou `dataQuality`.
- Simulações usarem valores derivados de dados frágeis sem indicar incerteza.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Tratando dados insuficientes como valor real
class DynamicPricingService {
  async calculatePriceAdjustment(demandSupplyRatio: number) {
    // ❌ Não verifica se ratio foi calculado com dados suficientes
    if (demandSupplyRatio > 1.2) {
      return { adjustment: 0.05 };
    }
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Incerteza como dado de primeira classe
interface DemandSupplySignal {
  demandIndex: number | null;
  supplyIndex: number | null;
  ratio: number | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
}

class DynamicPricingService {
  async calculatePriceAdjustment(signal: DemandSupplySignal) {
    if (signal.confidence === 'insufficient' || signal.ratio === null) {
      return { 
        adjustment: null, 
        reason: 'Dados insuficientes para simulação' 
      };
    }
    if (signal.confidence === 'low' && signal.sampleSize < 7) {
      return { 
        adjustment: null, 
        reason: 'Amostra insuficiente (< 7 dias)' 
      };
    }
    // Apenas calcula se confidence é 'high' ou 'medium'
    if (signal.ratio > 1.2) {
      return { adjustment: 0.05 };
    }
  }
}
```

---

### 2.7. Assumir pipeline linear observação → execução

**NUNCA PODE:**
- Código assumir que simulação sempre gera insight.
- Código assumir que insight sempre gera decisão.
- Código assumir que decisão sempre gera execução.
- Módulos dependerem de que o próximo estágio do "pipeline" exista.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Assumindo pipeline linear
class SimulationEngine {
  async simulate(...) {
    const result = await this.calculate(...);
    const insight = await insightEngine.generateInsight(result); // ❌ Assume que sempre existe
    const decision = await decisionService.makeDecision(insight); // ❌ Assume que sempre existe
    await executionService.execute(decision); // ❌ Assume que sempre existe
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Cada camada é independente
class SimulationEngine {
  async simulate(...) {
    const result = await this.calculate(...);
    await decisionLogService.logObservation({
      type: 'simulation',
      data: result,
      decision: null // Sempre null, não assume próximo estágio
    });
    return result; // Retorna resultado, não assume uso
  }
}

// Insight Engine lê Decision Log independentemente
class InsightEngine {
  async generateInsights() {
    const observations = await decisionLogService.getObservations({ type: 'simulation' });
    // Pode não gerar insight se não houver padrão suficiente
    if (observations.length < 10) return [];
    // ...
  }
}
```

---

## 3. Guardrails de dependência

### 3.1. O que cada tipo de módulo PODE importar

#### Módulos Observacionais (`InsightEngine`, `SimulationEngine`, `ProductDemandService`, `DynamicPricingService`)

**PODE:**
- Importar `PolicyRegistry` e `PolicyResolutionEngine` (leitura de policies).
- Importar `DecisionLogService` (escrita de observações).
- Importar módulos de leitura de dados (`OfferIndexService`, `CanonicalProductService`).
- Importar `EventLog` (leitura de eventos).
- Importar `Ledger` (leitura de transações).

**NÃO PODE:**
- Importar módulos de execução (qualquer serviço que escreva em produção).
- Importar módulos que dependem de execução.
- Ter rotas POST/PUT/PATCH (apenas GET).

---

#### Módulos de Execução (futuros, quando `OBSERVATION_MODE = false`)

**PODE:**
- Importar módulos observacionais (leitura de insights/simulações).
- Importar `DecisionLogService` (leitura de decisões aprovadas).
- Importar `PolicyResolutionEngine` (resolução de policies para execução).

**NÃO PODE:**
- Importar módulos observacionais de forma que remover observação quebre execução (deve ser opcional).
- Executar sem aprovação externa (humana ou governança automatizada).

---

#### Módulos de Policy (`PolicyRegistry`, `PolicyResolutionEngine`)

**PODE:**
- Importar `CityReadinessService` (verificar se cidade está pronta).
- Importar módulos observacionais (usar dados para resolução dinâmica).

**NÃO PODE:**
- Importar módulos de execução.
- Ter dependências não reversíveis.

---

#### Módulos de Dados (`OfferIndexService`, `CanonicalProductService`)

**PODE:**
- Importar apenas utilitários de banco de dados (`runQueryWithTenant`).
- Importar `PolicyResolutionEngine` (se precisar de policies para filtros).

**NÃO PODE:**
- Importar módulos de negócio (apenas fornecem dados).
- Ter lógica de negócio (apenas leitura/transformação de dados).

---

## 4. Guardrails de dados

### 4.1. Incerteza como dado de primeira classe

**OBRIGATÓRIO:**
- Qualquer índice calculado (`demandIndex`, `supplyIndex`, `demandSupplyRatio`) deve incluir campo `confidence` ou `dataQuality`.
- Valores calculados com dados insuficientes devem retornar `null` para o valor, não `0` ou valor default.

**Exemplo obrigatório:**
```typescript
interface IndexWithConfidence {
  value: number | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
  dataQuality: 'sufficient' | 'insufficient';
  reason?: string; // Motivo se confidence for 'insufficient'
}
```

---

### 4.2. Confidence / dataQuality obrigatórios

**OBRIGATÓRIO:**
- `confidence: 'high'` → `sampleSize >= threshold` E dados consistentes por período mínimo (ex: 7 dias).
- `confidence: 'medium'` → `sampleSize >= threshold * 0.5` E dados parcialmente consistentes.
- `confidence: 'low'` → `sampleSize < threshold` OU dados inconsistentes.
- `confidence: 'insufficient'` → `sampleSize < threshold * 0.3` OU período de observação < 3 dias.

**NUNCA PODE:**
- Retornar `confidence: 'high'` com `sampleSize < 7` (para métricas diárias).
- Assumir `confidence: 'high'` por padrão sem verificação.

---

### 4.3. Threshold mínimo antes de cálculo

**OBRIGATÓRIO:**
- Antes de calcular `demandSupplyRatio`, verificar:
  - `demandIndex.confidence !== 'insufficient'`
  - `supplyIndex.confidence !== 'insufficient'`
  - `sampleSize >= threshold` para ambos.
- Se qualquer condição falhar, retornar `ratio: null` e `confidence: 'insufficient'`.

**Exemplo:**
```typescript
function calculateDemandSupplyRatio(
  demand: IndexWithConfidence,
  supply: IndexWithConfidence
): IndexWithConfidence {
  if (
    demand.confidence === 'insufficient' ||
    supply.confidence === 'insufficient' ||
    demand.value === null ||
    supply.value === null
  ) {
    return {
      value: null,
      confidence: 'insufficient',
      sampleSize: Math.min(demand.sampleSize, supply.sampleSize),
      dataQuality: 'insufficient',
      reason: 'Dados insuficientes para cálculo de ratio'
    };
  }
  
  return {
    value: demand.value / supply.value,
    confidence: demand.confidence === 'high' && supply.confidence === 'high' 
      ? 'high' 
      : 'medium',
    sampleSize: Math.min(demand.sampleSize, supply.sampleSize),
    dataQuality: 'sufficient'
  };
}
```

---

## 5. Guardrails de cidade

### 5.1. Nenhum módulo assume contexto global

**NUNCA PODE:**
- Módulo assumir que dados estão disponíveis globalmente.
- Módulo executar operações sem verificar se cidade está ativada.
- Módulo usar valores default globais sem considerar contexto de cidade.

**Exemplo de violação:**
```typescript
// ❌ VIOLAÇÃO: Assumindo contexto global
class PolicyResolutionEngine {
  async resolvePolicy(domain: string, key: string) {
    const policy = await this.getPolicy(domain, key);
    return policy.defaultValue; // ❌ Não considera cidade
  }
}
```

**Comportamento correto:**
```typescript
// ✅ CORRETO: Sempre requer contexto de cidade
class PolicyResolutionEngine {
  async resolvePolicy(
    domain: string, 
    key: string, 
    context: PolicyContext // Deve incluir cityId
  ) {
    if (!context.cityId) {
      throw new Error('City context required');
    }
    const policy = await this.getPolicy(domain, key);
    // Aplica ajustes baseados em cidade
    return this.applyCityAdjustments(policy, context);
  }
}
```

---

### 5.2. City Readiness como pré-condição

**OBRIGATÓRIO:**
- Antes de ativar módulo em cidade, verificar `CityReadinessService.checkReadiness(cityId, moduleName)`.
- Módulos que dependem de dados de cidade devem verificar se cidade está pronta antes de processar.

**NUNCA PODE:**
- Módulo assumir que cidade está pronta sem verificação.
- Módulo falhar silenciosamente se cidade não estiver pronta (deve retornar erro explícito).

**Exemplo:**
```typescript
class ProductDemandService {
  async getProductDemand(cityId: string, productId: string) {
    const readiness = await cityReadinessService.checkReadiness(
      cityId, 
      'product-demand'
    );
    
    if (!readiness.ready) {
      return {
        demandIndex: null,
        supplyIndex: null,
        confidence: 'insufficient',
        reason: `City ${cityId} not ready for product-demand module: ${readiness.reason}`
      };
    }
    
    // Processa apenas se cidade estiver pronta
    return await this.calculateDemand(cityId, productId);
  }
}
```

---

## 6. Sinais de violação arquitetural

### 6.1. Código que indica violação

**Sinais de escrita em produção por camada observacional:**
- `UPDATE`, `INSERT`, `DELETE` em métodos de `*Service` que terminam com `Simulation`, `Insight`, `Demand`, `Pricing`.
- Rotas GET que executam `UPDATE` ou `INSERT`.
- Handlers que leem `Decision Log` e executam ações automaticamente.

**Sinais de acoplamento irreversível:**
- `import` de módulo de execução em módulo observacional.
- Módulo A que não funciona se módulo B for removido (exceto dependências de dados).
- Dependências circulares entre módulos.

**Sinais de pipeline linear assumido:**
- Método que chama `simulate()` → `generateInsight()` → `makeDecision()` → `execute()` em sequência.
- Código que assume que `decisionLog.observation.decision !== null` sempre existe.
- Tratamento de erro que assume que próximo estágio sempre existe.

**Sinais de dados insuficientes não tratados:**
- Cálculo de `ratio` sem verificar `confidence`.
- Uso de `demandIndex` ou `supplyIndex` sem verificar `dataQuality`.
- Valores `null` sendo tratados como `0` ou valor default.

**Sinais de contexto global assumido:**
- Método que não recebe `cityId` como parâmetro.
- Policy resolution sem `PolicyContext` incluindo `cityId`.
- Valores default aplicados sem considerar cidade.

---

## 7. Regra de precedência

### 7.1. Em caso de dúvida, escolher o caminho mais conservador

**Hierarquia de conservadorismo:**

1. **Mais conservador:** Não executar, não calcular, retornar `null` com `confidence: 'insufficient'`.
2. **Conservador:** Executar apenas leitura, registrar observação sem decisão.
3. **Menos conservador (requer aprovação):** Executar ação após verificação explícita de aprovação.

**Exemplos de aplicação:**

- **Dúvida sobre dados suficientes:** Retornar `null` com `confidence: 'insufficient'` (não inventar número).
- **Dúvida sobre se simulação deve gerar insight:** Não gerar (insight é opcional).
- **Dúvida sobre se decisão deve executar:** Não executar (execução requer aprovação explícita).
- **Dúvida sobre se cidade está pronta:** Assumir que não está pronta (verificar `CityReadiness`).
- **Dúvida sobre se policy deve ser resolvida dinamicamente:** Usar valor base do `PolicyRegistry` (resolução dinâmica é opcional).

**NUNCA:**
- Inventar valores quando dados são insuficientes.
- Assumir que próximo estágio do "pipeline" existe.
- Executar ação sem aprovação explícita.
- Usar valores default globais sem considerar contexto de cidade.

---

## 8. Verificação antes de implementação

Antes de implementar qualquer nova camada ou módulo, verificar:

- [ ] Módulo não escreve em produção (apenas leitura ou `Decision Log`).
- [ ] Módulo não assume pipeline linear (cada camada é independente).
- [ ] Módulo não cria dependências irreversíveis (pode ser removido sem quebrar outros).
- [ ] Módulo não hardcodeia policies (usa `PolicyResolutionEngine`).
- [ ] Módulo marca normalizações fixas como `TEMPORARY_HEURISTIC`.
- [ ] Módulo trata incerteza como dado de primeira classe (`confidence`, `dataQuality`).
- [ ] Módulo verifica threshold mínimo antes de cálculos.
- [ ] Módulo não assume contexto global (sempre requer `cityId`).
- [ ] Módulo verifica `CityReadiness` antes de processar.
- [ ] Módulo segue regra de precedência (caminho mais conservador em caso de dúvida).

---

**Este documento é obrigatório para qualquer implementação no sistema UnifyCard.**




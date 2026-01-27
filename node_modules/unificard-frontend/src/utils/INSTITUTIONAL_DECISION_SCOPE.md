# Escopo Declarado de Decisão

**SPRINT 32**: Registro explícito do escopo de decisões humanas.

Este documento permite registrar explicitamente o escopo de decisões humanas, tornando claro o alcance e validade de cada decisão sem criar governança, workflow ou aprovação.

## Regra de Ouro

**Decisões humanas devem declarar explicitamente seu escopo. Escopo não tem efeito técnico, apenas declaração humana.**

---

## Tensão entre Decisões (SPRINT 33)

**Decisões que coexistem em tensão devem ser registradas em: `INSTITUTIONAL_DECISION_TENSIONS.md`**

---

## Não-Decisão Declarada (SPRINT 34)

**Pontos onde optou-se conscientemente por não decidir devem ser registrados em: `INSTITUTIONAL_NON_DECISIONS.md`**

---

## Escopos Possíveis

### Local
- **Definição**: Decisão válida apenas no contexto específico onde foi tomada
- **Exemplo**: "Decisão sobre como interpretar um evento específico observado no piloto"
- **Características**: Não se aplica a outros contextos, não cria precedente geral

### Contextual
- **Definição**: Decisão válida dentro de um contexto mais amplo, mas não universal
- **Exemplo**: "Decisão sobre como ler padrões observados durante o piloto"
- **Características**: Aplica-se a um conjunto de situações similares, mas não a todo o sistema

### Experimental
- **Definição**: Decisão válida apenas durante um período experimental ou teste
- **Exemplo**: "Decisão sobre como interpretar dados durante fase de piloto"
- **Características**: Temporal, limitada ao período experimental, não cria regra permanente

### Institucional
- **Definição**: Decisão que afeta o entendimento institucional do sistema de forma ampla
- **Exemplo**: "Decisão sobre princípios fundamentais de leitura institucional"
- **Características**: Amplo alcance, mas ainda apenas declaração, não regra técnica

---

## Estrutura de Entrada

Cada decisão registrada deve conter:
- **Data**: Data em que a decisão foi declarada (formato: YYYY-MM-DD)
- **Autor**: Nome ou identificador do autor da decisão (texto livre)
- **Descrição da decisão**: Descrição clara do que foi decidido (texto livre)
- **Escopo declarado**: Um dos escopos possíveis (local | contextual | experimental | institucional)
- **Observação**: "Declaração de escopo, não regra do sistema"

---

## Decisões Registradas

_Atualmente não há decisões registradas. Este documento será atualizado quando decisões humanas forem declaradas com seu escopo._

---

## Exemplo de Estrutura (Comentado)

<!--
## Decisão #1: Interpretação de Ritmo Concentrado

- **Data**: 2024-12-20
- **Autor**: Operador A
- **Descrição da decisão**: "Decidimos interpretar padrão de ritmo 'concentrado' como indicativo de atividade focada, não como problema"
- **Escopo declarado**: experimental
- **Observação**: Declaração de escopo, não regra do sistema. Esta interpretação é válida apenas durante o período experimental do piloto.

---

## Decisão #2: Princípio de Leitura Não-Avaliativa

- **Data**: 2024-12-21
- **Autor**: Equipe de Operação
- **Descrição da decisão**: "Decidimos que todos os textos de leitura institucional devem ser não-avaliativos e não-diretivos"
- **Escopo declarado**: institucional
- **Observação**: Declaração de escopo, não regra do sistema. Este princípio orienta a criação de novos textos de leitura, mas não é validado automaticamente pelo sistema.
-->

---

## Notas Importantes

1. **Não é governança**: Este documento não cria processo de decisão, workflow ou aprovação. Apenas registra escopo declarado.

2. **Não é enforcement**: Escopo declarado não tem efeito técnico. Não valida, não bloqueia, não cria permissões.

3. **Não é regra do sistema**: Decisões registradas são declarações humanas sobre escopo, não regras que o sistema deve seguir.

4. **Plasticidade mantida**: O sistema mantém plasticidade. Escopo declarado apenas torna explícito o alcance de decisões humanas.

5. **Não criar decisões fictícias**: Apenas registrar decisões reais que foram tomadas, não criar exemplos fictícios para "demonstrar o padrão".

6. **Arquivos de referência**: Arquivos de leitura institucional, memória institucional e exceções contêm comentários indicando que decisões relacionadas devem declarar seu escopo aqui.


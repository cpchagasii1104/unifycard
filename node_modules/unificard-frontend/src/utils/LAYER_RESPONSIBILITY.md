# Limites de Responsabilidade entre Camadas

**SPRINT 28**: Documentação explícita de limites de responsabilidade entre camadas do sistema.

## Classificação de Camadas

### UI (Interface de Usuário)
- **Responsabilidade**: Exibição e apresentação para usuários finais
- **Público permitido**: Usuários finais, admin, piloto
- **Características**: Pode ser usado em componentes de ação, handlers de execução, fluxos de usuário final
- **Exemplos**: `temporal-state.ts`, `action-nature.ts`, `institutional-pulse.ts` (quando usado em UI)

### Leitura Institucional
- **Responsabilidade**: Ferramentas de interpretação humana para operadores
- **Público permitido**: Apenas admin em modo piloto
- **Características**: NÃO pode ser usado em componentes de ação, handlers de execução, fluxos de usuário final
- **Exemplos**: `institutional-rhythm.ts`, `institutional-reading-principles.ts`, `institutional-semantic-alignment.tsx`, `institutional-review-ritual.ts`

### Memória Institucional
- **Responsabilidade**: Registro de declarações de aprendizado
- **Público permitido**: Apenas admin em modo piloto
- **Características**: NÃO pode ser usado em componentes de ação, handlers de execução, fluxos de usuário final
- **Exemplos**: `institutional-memory.tsx`, `institutional-memory.ts` (API)

### Observação
- **Responsabilidade**: Registro de eventos e fricções do piloto
- **Público permitido**: Apenas admin em modo piloto
- **Características**: NÃO pode ser usado em componentes de ação, handlers de execução, fluxos de usuário final
- **Exemplos**: `pilot-events.service.ts`, `pilot-observer.service.ts`

## Regras de Vazamento Conceitual

### ❌ BLOQUEADO: Leitura → Ação
Estruturas de leitura institucional NÃO podem ser importadas em:
- Componentes de ação (botões, formulários, handlers)
- Fluxos de execução (workflows, processos)
- Handlers de eventos de usuário final

### ❌ BLOQUEADO: Memória → Ação
Estruturas de memória institucional NÃO podem ser importadas em:
- Componentes de ação
- Fluxos de execução
- Handlers de eventos de usuário final

### ❌ BLOQUEADO: Observação → Ação
Estruturas de observação NÃO podem ser importadas em:
- Componentes de ação
- Fluxos de execução
- Handlers de eventos de usuário final

### ✅ PERMITIDO: UI → Qualquer lugar
Estruturas de UI podem ser usadas em qualquer contexto apropriado.

## Estruturas Classificadas

### UI
- `temporal-state.ts` - Estados temporais para UI
- `action-nature.ts` - Natureza de ações para UI
- `institutional-pulse.ts` - Pulso institucional (quando usado em UI de usuário final)
- `closure-continuity.ts` - Encerramento e continuidade para UI
- `functioning-evidence.ts` - Evidência de funcionamento para UI

### Leitura Institucional
- `institutional-rhythm.ts` - Ritmo institucional
- `institutional-reading-principles.ts` - Princípios de leitura
- `institutional-semantic-alignment.tsx` - Alinhamento semântico
- `institutional-review-ritual.ts` - Ritual de revisão

### Memória Institucional
- `institutional-memory.tsx` - Componente de memória
- `institutional-memory.ts` (API) - API de memória

### Observação
- `pilot-events.service.ts` - Service de eventos
- `pilot-observer.service.ts` - Service de observação

## Notas Importantes

1. **Não é validação automática**: Esta documentação é apenas explicativa. Não gera validações, warnings ou bloqueios automáticos.

2. **Não é refatoração**: Não estamos movendo código ou criando novas camadas. Apenas documentando limites existentes.

3. **Evolução permitida**: O sistema continua evoluível. Esta documentação serve como guia, não como restrição técnica.

4. **Comentários no código**: Cada arquivo contém comentários explícitos sobre sua camada e público permitido.








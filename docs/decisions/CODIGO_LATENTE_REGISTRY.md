# REGISTRO DE CÓDIGO LATENTE

Inventário de código funcional mas não integrado, identificado durante a reconstrução do sistema. Não é lista de bugs. É lista de decisões arquiteturais incompletas que devem ser revisitadas em momento próprio.

## Categoria

**Código Latente** = código que (a) tem dependências reais e funcionais, (b) declara intenção arquitetural clara, mas (c) não possui caller no sistema atual e (d) não está integrado a executor (scheduler, worker, rota, evento).

Distingue-se de:
- **Código ativo**: tem callers, executa em runtime
- **Código morto**: sem propósito identificável, candidato a remoção
- **Código contaminado**: ativo, porém em local arquitetural errado

## Inventário

### subscription-expiration.job

- **Localização:** `backend/src/core/jobs/subscription-expiration.job.ts`
- **Classificado:** 2026-05-04 (sessão piloto Hipótese #019)
- **Função pretendida:** processar expiração de assinaturas de organizadores de eventos
- **Estado:**
  - Funcional, importa `organizerBillingService.processExpirations()`
  - Sem scheduler que o invoque
  - Sem callers no código (zero importadores em produção)
- **Débito conhecido:** inversão de dependência — `core/` importa de `modules/`
- **Decisões pendentes que destravam:**
  - Arquitetura de jobs (centralizado em `src/jobs/` vs descentralizado por módulo)
  - Repurificação core/modules (Hipótese #019)
- **Proibições:** não mover, não deletar, não integrar a scheduler sem decisão formal
- **Histórico:**
  - 2026-05-04: classificado durante diagnóstico #019, comentário aplicado no arquivo

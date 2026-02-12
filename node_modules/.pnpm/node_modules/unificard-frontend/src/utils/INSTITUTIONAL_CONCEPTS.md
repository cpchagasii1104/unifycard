# Conceitos Institucionais Canônicos

**SPRINT 29**: Inventário de conceitos institucionais e seus pontos canônicos.

Este documento lista os conceitos institucionais já implementados no sistema, seus arquivos canônicos, e serve como referência para prevenir duplicação conceitual silenciosa.

## Regra de Ouro

**Cada conceito institucional tem UM ponto canônico. NÃO duplique conceitos em outros arquivos.**

---

## 1. Temporalidade / Tempo

- **Nome Canônico**: Temporalidade Institucional
- **Arquivo Canônico**: `temporal-state.ts`
- **Arquivos Relacionados**: 
  - `institutional-pulse.ts` (usa conceito de tempo)
- **Descrição**: Estados temporais, formatação de tempo relativo/absoluto, diferenciação entre ausência e encerramento
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de tempo/temporalidade, use `temporal-state.ts`.

---

## 2. Ausência

- **Nome Canônico**: Ausência vs Encerramento
- **Arquivo Canônico**: `temporal-state.ts` (função `getAbsenceText`)
- **Arquivos Relacionados**: 
  - `closure-continuity.ts` (usa conceito de ausência)
- **Descrição**: Diferenciação entre "não aconteceu", "sem atividade recente" e "encerrado"
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de ausência, use `temporal-state.ts`.

---

## 3. Silêncio

- **Nome Canônico**: Silêncio Institucional
- **Arquivo Canônico**: `institutional-pulse.ts`
- **Arquivos Relacionados**: 
  - `temporal-state.ts` (usa conceito de silêncio em estados vazios)
- **Descrição**: Ausência de eventos não indica ausência de funcionamento
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de silêncio, use `institutional-pulse.ts`.

---

## 4. Encerramento

- **Nome Canônico**: Encerramento Explícito
- **Arquivo Canônico**: `closure-continuity.ts` (função `getClosureText`)
- **Arquivos Relacionados**: 
  - `temporal-state.ts` (usa conceito de encerramento)
- **Descrição**: Textos informativos para fluxos concluídos, sem celebração
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de encerramento, use `closure-continuity.ts`.

---

## 5. Continuidade

- **Nome Canônico**: Continuidade Declarada
- **Arquivo Canônico**: `closure-continuity.ts` (função `getContinuityText`)
- **Arquivos Relacionados**: 
  - `temporal-state.ts` (usa conceito de continuidade)
- **Descrição**: Textos informativos para entidades contínuas, sem conclusão esperada
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de continuidade, use `closure-continuity.ts`.

---

## 6. Leitura Institucional

- **Nome Canônico**: Leitura Institucional
- **Arquivo Canônico**: `institutional-reading-principles.ts`
- **Arquivos Relacionados**: 
  - `institutional-rhythm.ts` (usa conceito de leitura)
  - `institutional-review-ritual.ts` (usa conceito de leitura)
  - `institutional-semantic-alignment.tsx` (usa conceito de leitura)
- **Descrição**: Princípios de como o sistema deve ser lido por operadores humanos, sem gerar decisão
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de leitura institucional, use `institutional-reading-principles.ts`.

---

## 7. Ritmo Institucional

- **Nome Canônico**: Ritmo Institucional
- **Arquivo Canônico**: `institutional-rhythm.ts`
- **Arquivos Relacionados**: 
  - `institutional-reading-principles.ts` (usa conceito de ritmo)
- **Descrição**: Leitura qualitativa do movimento do sistema, padrões temporais amplos
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de ritmo, use `institutional-rhythm.ts`.

---

## 8. Observação

- **Nome Canônico**: Observação Silenciosa
- **Arquivo Canônico**: `pilot-observer.service.ts`
- **Arquivos Relacionados**: 
  - `pilot-events.service.ts` (backend)
  - `pilot-events.repository.ts` (backend)
- **Descrição**: Registro de eventos de observação sem interferir no comportamento
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de observação, use `pilot-observer.service.ts`.

---

## 9. Memória Institucional

- **Nome Canônico**: Memória Institucional Declarativa
- **Arquivo Canônico**: `institutional-memory.tsx`
- **Arquivos Relacionados**: 
  - `institutional-memory.ts` (API)
  - `institutional-memory.repository.ts` (backend)
  - `institutional-memory.service.ts` (backend)
- **Descrição**: Declarações explícitas de aprendizado registradas por operadores humanos
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de memória institucional, use `institutional-memory.tsx`.

---

## 9. Evidência de Funcionamento

- **Nome Canônico**: Evidência de Funcionamento
- **Arquivo Canônico**: `functioning-evidence.ts`
- **Arquivos Relacionados**: 
  - `institutional-pulse.ts` (usa conceito de evidência)
- **Descrição**: Confirmações passivas e sinais de coerência, sem induzir ação
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de evidência, use `functioning-evidence.ts`.

---

## 10. Pulso Institucional

- **Nome Canônico**: Pulso Institucional
- **Arquivo Canônico**: `institutional-pulse.ts`
- **Arquivos Relacionados**: 
  - `functioning-evidence.ts` (usa conceito de pulso)
- **Descrição**: Sinal de vida temporal, sistema em operação contínua mesmo em silêncio
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de pulso, use `institutional-pulse.ts`.

---

## 11. Natureza da Ação

- **Nome Canônico**: Natureza da Ação
- **Arquivo Canônico**: `action-nature.ts`
- **Arquivos Relacionados**: 
  - Componentes de UI que marcam ações
- **Descrição**: Marcação de natureza (sugestão, estado, registro, opcional, irreversível) para reduzir obrigação implícita
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de natureza de ação, use `action-nature.ts`.

---

## 12. Expectativa

- **Nome Canônico**: Expectativa Explícita
- **Arquivo Canônico**: `canonical-language.ts`
- **Arquivos Relacionados**: 
  - Componentes que exibem microtextos de expectativa
- **Descrição**: Microtextos canônicos de expectativa sobre consequências de ações
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de expectativa, use `canonical-language.ts`.

---

## 13. Não-Ação

- **Nome Canônico**: Não-Ação / Consequência da Não-Ação
- **Arquivo Canônico**: `canonical-language.ts` (quando aplicável)
- **Arquivos Relacionados**: 
  - `closure-continuity.ts` (usa conceito de não-ação em encerramento)
- **Descrição**: Textos passivos sobre consequências da não-ação, sem linguagem punitiva
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de não-ação, use `canonical-language.ts` ou `closure-continuity.ts`.

---

## 14. Alinhamento Semântico

- **Nome Canônico**: Alinhamento Semântico Institucional
- **Arquivo Canônico**: `institutional-semantic-alignment.tsx`
- **Arquivos Relacionados**: 
  - `institutional-reading-principles.ts` (usa conceito de alinhamento)
- **Descrição**: Referência semântica interna para termos críticos usados na leitura e memória
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de alinhamento semântico, use `institutional-semantic-alignment.tsx`.

---

## 15. Ritual de Revisão

- **Nome Canônico**: Ritual de Revisão Institucional
- **Arquivo Canônico**: `institutional-review-ritual.ts`
- **Arquivos Relacionados**: 
  - `institutional-reading-principles.ts` (usa conceito de ritual)
- **Descrição**: Marco simbólico explícito de momento de leitura e reflexão, sem decisão
- **Observação**: Este conceito NÃO deve ser reimplementado em outro lugar. Para qualquer necessidade de ritual de revisão, use `institutional-review-ritual.ts`.

---

## Notas Importantes

1. **Não é refatoração**: Este documento não indica que código deve ser movido ou unificado. Apenas documenta onde cada conceito vive.

2. **Não é validação automática**: Este documento serve como guia humano, não como restrição técnica.

3. **Evolução permitida**: O sistema continua evoluível. Este documento previne duplicação acidental, não evolução consciente.

4. **Duplicação consciente**: Se um desenvolvedor precisar duplicar um conceito conscientemente (por razões arquiteturais válidas), deve documentar a razão explicitamente.

5. **Novos conceitos**: Novos conceitos institucionais devem ser adicionados a este documento quando criados.








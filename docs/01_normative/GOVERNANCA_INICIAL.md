Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Governança Inicial — UnifiCard

**Versão**: 1.0  
**Data**: 2024-12-19  
**Status**: Fase 1 — Empresa com Missão Social

---

## MODELO DE GOVERNANÇA

### Fase 1: Empresa com Missão Social (Atual)

**Estrutura**:
- Decisões técnicas: Fundadores
- Decisões de produto: Fundadores + Comunidade (consultiva)
- Decisões financeiras: Fundadores (com transparência)
- Decisões estratégicas: Fundadores (com documentação)

**Limites**:
- Nenhuma decisão pode violar princípios inegociáveis
- Nenhuma decisão pode ser tomada sem documentação
- Nenhuma decisão pode alterar blindagens técnicas sem consenso

---

## QUEM DECIDE O QUÊ

### Decisões Técnicas

**Quem**: Fundadores (equipe técnica)

**O que inclui**:
- Arquitetura do sistema
- Escolha de tecnologias
- Estrutura de dados
- Performance e escalabilidade

**Como**:
- Decisões documentadas em código
- Comentários explicando escolhas
- PRs revisados por pares técnicos
- Testes de não-regressão

**Limites**:
- Não pode adicionar automação decisória
- Não pode criar scores ou rankings
- Não pode remover blindagens técnicas
- Não pode alterar princípios inegociáveis

---

### Decisões de Produto

**Quem**: Fundadores + Comunidade (consultiva)

**O que inclui**:
- Novas funcionalidades
- Mudanças de interface
- Fluxos de usuário
- Priorização de features

**Como**:
- Propostas documentadas
- Feedback da comunidade
- Decisão final: Fundadores
- Decisão documentada publicamente

**Limites**:
- Não pode propor features que violem princípios
- Não pode criar CTAs manipulativos
- Não pode adicionar lógica financeira automática
- Não pode sugerir automação decisória

---

### Decisões Financeiras

**Quem**: Fundadores (com transparência)

**O que inclui**:
- Definição de taxas administrativas
- Estrutura de preços
- Investimentos
- Distribuição de receita

**Como**:
- Decisões documentadas em `TAXA_ADMINISTRATIVA.md`
- Transparência pública de valores
- Auditoria anual (quando aplicável)
- Revisão periódica

**Limites**:
- Não pode taxar o que é proibido
- Não pode alterar limites máximos sem justificativa
- Não pode criar taxas ocultas
- Não pode usar receita para violar princípios

---

### Decisões Estratégicas

**Quem**: Fundadores (com documentação)

**O que inclui**:
- Mudança de fase (1→2, 2→3)
- Parcerias estratégicas
- Expansão geográfica
- Modelo de negócio

**Como**:
- Proposta documentada
- Justificativa clara
- Impacto nos princípios avaliado
- Decisão registrada publicamente

**Limites**:
- Não pode alterar missão sem consenso amplo
- Não pode violar princípios inegociáveis
- Não pode criar lock-in
- Não pode reduzir transparência

---

## O QUE NUNCA PODE SER DECIDIDO SOZINHO

### Princípios Inegociáveis

**Ninguém pode decidir**:
- Remover blindagens técnicas
- Adicionar automação decisória
- Criar scores ou rankings
- Adicionar CTAs manipulativos
- Alterar propriedade dos dados

**Processo para mudança**:
1. Proposta documentada
2. Justificativa técnica e social
3. Consulta ampla à comunidade
4. Consenso mínimo de 80% dos stakeholders
5. Aprovação por governança coletiva (quando existir)

---

### Taxas e Preços

**Ninguém pode decidir**:
- Taxar o que é proibido
- Exceder limites máximos sem justificativa
- Criar taxas ocultas
- Alterar transparência

**Processo para mudança**:
1. Proposta em `TAXA_ADMINISTRATIVA.md`
2. Justificativa financeira
3. Impacto nos usuários avaliado
4. Aprovação por governança (quando existir)
5. Documentação pública

---

### Arquitetura de Dados

**Ninguém pode decidir**:
- Reduzir portabilidade
- Criar lock-in técnico
- Ocultar dados do usuário
- Alterar propriedade dos dados

**Processo para mudança**:
1. Proposta técnica documentada
2. Impacto na portabilidade avaliado
3. Consulta à comunidade
4. Aprovação técnica e social
5. Implementação com período de transição

---

## COMO REGRAS MUDAM

### Regras Técnicas

**Processo**:
1. Proposta em PR ou issue
2. Revisão técnica
3. Testes de não-regressão
4. Aprovação por pares
5. Merge e documentação

**Validação**:
- Não viola princípios inegociáveis
- Não remove blindagens
- Não adiciona automação decisória
- Documentação atualizada

---

### Regras de Produto

**Processo**:
1. Proposta documentada
2. Feedback da comunidade
3. Prototipagem (se necessário)
4. Decisão final documentada
5. Implementação e validação

**Validação**:
- Não viola princípios
- Não cria CTAs manipulativos
- Não adiciona lógica automática
- UX preserva autonomia

---

### Regras de Governança

**Processo**:
1. Proposta em documento de governança
2. Consulta ampla
3. Período de discussão (mínimo 30 dias)
4. Votação (quando governança coletiva existir)
5. Aprovação e registro

**Validação**:
- Não viola missão
- Não reduz transparência
- Não concentra poder indevidamente
- Preserva autonomia dos usuários

---

## COMO EVITAR CAPTURA

### Captura por Interesses Financeiros

**Proteções**:
- Limites máximos de taxas
- Transparência absoluta
- Proibições explícitas
- Auditoria periódica

**Sinais de alerta**:
- Taxas aumentando sem justificativa
- Taxas ocultas aparecendo
- Transparência reduzindo
- Proibições sendo relaxadas

**Ação**:
- Documentar violação
- Consultar comunidade
- Reverter se necessário
- Atualizar proteções

---

### Captura por Interesses Técnicos

**Proteções**:
- Código aberto (quando aplicável)
- Documentação completa
- Blindagens explícitas
- Testes de não-regressão

**Sinais de alerta**:
- Blindagens sendo removidas
- Automação sendo adicionada
- Scores sendo criados
- Decisões automáticas aparecendo

**Ação**:
- Reverter mudança
- Documentar violação
- Atualizar blindagens
- Reforçar testes

---

### Captura por Interesses de Produto

**Proteções**:
- Princípios inegociáveis
- Processo de aprovação
- Feedback da comunidade
- Documentação de decisões

**Sinais de alerta**:
- CTAs manipulativos aparecendo
- Sugestões automáticas sendo adicionadas
- Rankings sendo criados
- Automação sendo proposta

**Ação**:
- Reverter feature
- Documentar violação
- Reforçar princípios
- Atualizar processo

---

### Captura por Interesses de Governança

**Proteções**:
- Transição planejada (Fase 1→2→3)
- Governança distribuída (Fase 2+)
- Decisões por consenso
- Transparência absoluta

**Sinais de alerta**:
- Poder concentrando
- Decisões não documentadas
- Transparência reduzindo
- Comunidade sendo ignorada

**Ação**:
- Documentar concentração
- Consultar comunidade
- Reforçar distribuição
- Acelerar transição (se necessário)

---

## TRANSIÇÃO DE FASES

### Fase 1 → Fase 2 (Empresa → Cooperativa/Fundação)

**Gatilhos**:
- Receita estável
- Comunidade ativa
- Governança distribuída necessária
- Missão social consolidada

**Processo**:
1. Proposta documentada
2. Consulta ampla (6 meses)
3. Estruturação legal
4. Transferência de propriedade
5. Nova governança ativa

**Validação**:
- Princípios preservados
- Transparência mantida
- Comunidade envolvida
- Missão preservada

---

### Fase 2 → Fase 3 (Cooperativa/Fundação → Infraestrutura Pública)

**Gatilhos**:
- Escala crítica alcançada
- Impacto social comprovado
- Sustentabilidade garantida
- Governança coletiva madura

**Processo**:
1. Proposta documentada
2. Consulta ampla (12 meses)
3. Estruturação institucional
4. Transferência para bem comum
5. Operação como infraestrutura pública

**Validação**:
- Acesso universal garantido
- Princípios preservados
- Sustentabilidade mantida
- Governança institucional estabelecida

---

## AUDITORIA

Este documento deve ser revisado:
- A cada mudança de fase
- A cada violação de princípios reportada
- A cada concentração de poder detectada
- Anualmente (mesmo sem mudanças)

**Responsável**: Fundadores (Fase 1), Governança Coletiva (Fase 2+)

---

**Status**: ✅ Documento fundacional aprovado



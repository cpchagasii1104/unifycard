# Taxa Administrativa — UnifiCard

**Versão**: 1.0  
**Data**: 2024-12-19  
**Status**: Fase 1 — Empresa com Missão Social

---

## PRINCÍPIOS

### Transparência Absoluta

- Todas as taxas são públicas
- Todos os valores são auditáveis
- Todas as mudanças são documentadas
- Nenhuma taxa oculta

### Limites Máximos

- Taxas não podem exceder limites definidos
- Limites não podem ser alterados sem justificativa
- Justificativas devem ser públicas
- Alterações requerem aprovação

### Proibições Explícitas

- O que nunca pode ser taxado
- O que nunca pode ter taxa variável
- O que nunca pode ter taxa oculta
- O que nunca pode ser monetizado

---

## ONDE A TAXA INCIDE

### Eventos

**O que pode ser taxado**:
- Venda de ingressos (taxa sobre valor do ingresso)
- Venda de consumo (taxa sobre valor do consumo)
- Venda de estacionamento (taxa sobre valor do estacionamento)

**Limite máximo**: 5% sobre valor transacionado

**Como funciona**:
- Taxa aplicada no momento da venda
- Valor líquido para organizador: valor bruto - taxa
- Taxa visível para comprador (opcional, mas recomendado)
- Taxa registrada em ledger com transparência

**Exemplo**:
- Ingresso: R$ 100,00
- Taxa (5%): R$ 5,00
- Organizador recebe: R$ 95,00
- UnifiCard recebe: R$ 5,00

---

### Serviços

**O que pode ser taxado**:
- Prestação de serviço paga (taxa sobre valor do serviço)
- Booking confirmado (taxa sobre valor do booking, se houver)

**Limite máximo**: 5% sobre valor transacionado

**Como funciona**:
- Taxa aplicada no momento do pagamento
- Valor líquido para prestador: valor bruto - taxa
- Taxa visível para cliente (opcional, mas recomendado)
- Taxa registrada em ledger com transparência

**Exemplo**:
- Serviço: R$ 200,00
- Taxa (5%): R$ 10,00
- Prestador recebe: R$ 190,00
- UnifiCard recebe: R$ 10,00

---

### Grupos

**O que pode ser taxado**:
- Nada (grupos são gratuitos)

**Justificativa**:
- Grupos são comunidades, não transações
- Taxar grupos criaria barreira de entrada
- Missão social prioriza acesso, não receita

---

### Disponibilidade e Bookings

**O que pode ser taxado**:
- Nada (disponibilidade e bookings são gratuitos)

**Justificativa**:
- Disponibilidade é coordenação, não transação
- Bookings são agendamentos, não pagamentos
- Taxar criaria barreira de uso

---

### Feed Social

**O que pode ser taxado**:
- Nada (feed é gratuito)

**Justificativa**:
- Feed é orquestrador visual, não produto
- Taxar feed criaria barreira de comunicação
- Missão social prioriza coordenação livre

---

## LIMITES MÁXIMOS

### Taxa sobre Transações

**Limite atual**: 5% sobre valor transacionado

**Aplicação**:
- Eventos (ingressos, consumo, estacionamento)
- Serviços (prestação paga)

**Alteração do limite**:
1. Proposta documentada em `TAXA_ADMINISTRATIVA.md`
2. Justificativa financeira e social
3. Impacto nos usuários avaliado
4. Consulta à comunidade (30 dias)
5. Aprovação por governança
6. Implementação com período de transição (60 dias)

**Limite máximo absoluto**: 10% (não pode ser excedido sem mudança de fase)

---

### Taxa Fixa

**Limite atual**: Não aplicável (sem taxas fixas)

**Se implementada no futuro**:
- Limite máximo: R$ 50,00/mês por usuário
- Aplicação apenas para funcionalidades premium (se existirem)
- Isenção para usuários sem receita
- Transparência absoluta

---

## O QUE NUNCA PODE SER TAXADO

### Funcionalidades Básicas

**Proibido taxar**:
- Criação de perfil
- Criação de grupo
- Criação de evento (sem venda de ingressos)
- Criação de serviço (sem prestação paga)
- Disponibilidade e bookings
- Feed social
- Inbox
- Observabilidade passiva

**Justificativa**:
- Funcionalidades básicas são coordenação, não transação
- Taxar criaria barreira de entrada
- Missão social prioriza acesso universal

---

### Dados do Usuário

**Proibido taxar**:
- Exportação de dados
- Portabilidade de dados
- Acesso aos próprios dados
- Backup de dados

**Justificativa**:
- Dados são propriedade do usuário
- Taxar acesso aos próprios dados é antiético
- Portabilidade é direito fundamental

---

### Comunicação

**Proibido taxar**:
- Posts no feed
- Mensagens (se existirem)
- Notificações
- Alertas

**Justificativa**:
- Comunicação é coordenação, não produto
- Taxar comunicação criaria barreira social
- Missão social prioriza coordenação livre

---

### Observabilidade

**Proibido taxar**:
- Acesso a métricas próprias
- Acesso a dados agregados
- Acesso a histórico

**Justificativa**:
- Observabilidade é transparência, não produto
- Taxar transparência é antiético
- Dados agregados são bem comum

---

## COMO TRANSPARÊNCIA É GARANTIDA

### Registro Público

**O que é registrado**:
- Todas as taxas aplicadas
- Valores transacionados
- Valores líquidos recebidos
- Valores de taxa coletados

**Onde**:
- Ledger interno (auditável)
- Relatórios públicos (trimestrais)
- Documentação em `TAXA_ADMINISTRATIVA.md`

---

### Auditoria

**Frequência**:
- Trimestral (relatórios públicos)
- Anual (auditoria completa, quando aplicável)

**O que é auditado**:
- Valores coletados
- Taxas aplicadas
- Conformidade com limites
- Conformidade com proibições

**Quem audita**:
- Fundadores (Fase 1)
- Comunidade (Fase 2+)
- Auditoria externa (quando aplicável)

---

### Documentação

**O que é documentado**:
- Todas as taxas em `TAXA_ADMINISTRATIVA.md`
- Todas as mudanças com justificativa
- Todos os limites e proibições
- Todos os relatórios trimestrais

**Acesso**:
- Público (documentação)
- Público (relatórios)
- Auditável (ledger interno)

---

## USO DA RECEITA

### O que a receita financia

**Operação**:
- Infraestrutura técnica
- Manutenção do sistema
- Suporte básico
- Desenvolvimento de features

**Missão Social**:
- Redução de taxas (quando possível)
- Melhoria de acesso
- Sustentabilidade do sistema
- Transição para Fase 2 (quando aplicável)

---

### O que a receita NÃO financia

**Proibido**:
- Features que violem princípios
- Automação decisória
- Scores ou rankings
- CTAs manipulativos
- Lógica financeira automática

**Justificativa**:
- Receita não pode ser usada para violar missão
- Princípios inegociáveis se aplicam também ao uso de receita

---

## MUDANÇAS DE TAXA

### Processo

1. **Proposta**:
   - Documentada em `TAXA_ADMINISTRATIVA.md`
   - Justificativa financeira e social
   - Impacto nos usuários avaliado

2. **Consulta**:
   - Publicação pública (30 dias)
   - Feedback da comunidade
   - Ajustes se necessário

3. **Aprovação**:
   - Por governança (Fase 1: Fundadores, Fase 2+: Coletiva)
   - Decisão documentada
   - Registro público

4. **Implementação**:
   - Período de transição (60 dias)
   - Notificação aos usuários
   - Atualização de documentação

---

### Validação

**Antes de aprovar mudança**:
- Não viola limites máximos?
- Não viola proibições?
- Justificativa é clara?
- Impacto foi avaliado?
- Comunidade foi consultada?

**Se qualquer resposta for "não"**: Mudança não pode ser aprovada

---

## AUDITORIA

Este documento deve ser revisado:
- A cada mudança de taxa
- A cada violação reportada
- Trimestralmente (conformidade)
- Anualmente (estrutura completa)

**Responsável**: Fundadores (Fase 1), Governança Coletiva (Fase 2+)

---

**Status**: ✅ Documento fundacional aprovado


# DOCUMENTO INSTITUCIONAL CANÔNICO - UnifyCard
## Identidade, Governança e Regras Econômicas - DECISÕES FECHADAS

**Data:** 12 de Janeiro de 2026  
**Status:** EXECUTÁVEL  
**Validade:** Permanente (até transição Fase 2)  

---

## PARTE 1: MODELO INSTITUCIONAL

### Estrutura: HÍBRIDO

**Fase 1 (Ano 0-2): Fundação/Associação Guardiã + Braço Executivo**

```
UnifyCard Foundation (Guardiã)
├─ Detém: Código-fonte, marca, arquitetura
├─ Define: Regras imutáveis, limites éticos
├─ Veta: Mudanças que violem missão
└─ Composição: 5 membros fundadores iniciais

UnifyCard Operações (Executivo)
├─ Executa: Infraestrutura, desenvolvimento, suporte
├─ Opera: Sob licença da Foundation
├─ Lucro: Permitido, mas limitado e transparente
└─ Transição: Torna-se cooperativa (Ano 2)
```

**Por que funciona:**
- ✅ Foundation protege missão (não capturável)
- ✅ Operações age rápido (sem engessamento)
- ✅ Transição planejada desde o início (não promessa vaga)

**Precedentes:**
- Ethereum Foundation + ConsenSys (separação clara)
- Signal Foundation + Signal Messenger LLC
- Linux Foundation + Red Hat / SUSE

---

### Transição de Fases

**Ano 2: Operações → Cooperativa**
```
Triggers automáticos:
- 1000+ usuários ativos/mês
- 6+ comunidades usando
- Sustentabilidade financeira provada

Cooperativa UnifyCard:
- Membros = usuários ativos
- 1 voto = 1 pessoa (não 1 real)
- Operações servem cooperativa
- Foundation mantém guardaria
```

**Ano 5+: Cooperativa → Fundação Pública**
```
Triggers automáticos:
- 10.000+ usuários ativos
- Sustentabilidade garantida
- Múltiplas implementações operando

Foundation UnifyCard (Pública):
- Governança 100% comunitária
- Código bem público
- Operações descentralizadas
- Impossível de capturar
```

**Garantias legais (imutáveis):**
- Foundation NÃO pode ser vendida
- Foundation NÃO pode mudar missão
- Cooperativa NÃO pode privatizar código
- Transições SÃO irreversíveis (statute locks)

---

## PARTE 2: GOVERNANÇA INICIAL (Fase 1)

### Conselho Foundation (5 membros)

**Composição:**
```
2 Fundadores técnicos
2 Representantes comunitários (eleitos)
1 Especialista independente (ética/economia)
```

**Mandato:**
- Fundadores: Permanente (Fase 1), consultivo (Fase 2+)
- Comunitários: 1 ano (renovável)
- Independente: 2 anos (rotativo)

**Decisões:**

| Tipo | Quórum | Poder de Veto |
|------|--------|---------------|
| Operacional | 3/5 | Não |
| Estratégica | 4/5 | Fundadores (até Ano 2) |
| Mudança de missão | IMPOSSÍVEL | N/A |
| Taxa administrativa | 5/5 | Foundation statute |
| Transição de fase | 4/5 | Automática (triggers) |

---

### Assembleia Comunitária

**Frequência:** Trimestral

**Composição:** Todos os usuários ativos (>= 1 transação/trimestre)

**Poder:**
```
Ano 0-1: Consultivo (Foundation escuta, decide)
Ano 1-2: Deliberativo parcial (veto em decisões grandes)
Ano 2+:  Deliberativo total (Cooperativa decide)
```

**Quórum:**
- Ano 0-1: 10% usuários ativos
- Ano 1-2: 20% usuários ativos
- Ano 2+: 30% membros cooperativa

**Votação:**
- Online (via sistema)
- 1 pessoa = 1 voto
- Transparente (resultado público)
- Auditável (blockchain opcional Fase 2+)

---

### Transparência Obrigatória

**Relatórios trimestrais (públicos):**
- Uso de recursos (detalhado)
- Decisões do conselho (atas completas)
- Roadmap atualizado
- Métricas de impacto (O-01 a O-06)
- Distribuição de taxa administrativa

**Código-fonte:**
- 100% aberto (GPL v3)
- Issues públicas
- Pull requests transparentes
- Security audits anuais

**Dados agregados:**
- Usuários ativos (agregado)
- Transações (volume, não detalhe)
- Comunidades servidas
- Taxa efetiva cobrada

**Proibições:**
- ❌ Venda de dados pessoais
- ❌ Anúncios targeted
- ❌ Rastreamento individual
- ❌ Algoritmo de ranking manipulativo

---

## PARTE 3: REGRAS ECONÔMICAS

### Taxa Administrativa: ESCALONADA

**Fase 1 (Ano 0-2): 3% Base**

**Regra de aplicação:**

```
Transações ISENTAS (0%):
- Doações diretas
- Repasses de fundo regional
- Interações sociais puras (posts, comentários, votos)
- Mensagens
- Transferências P2P sem intermediação

Transações INTERMEDIADAS (até 3%):
- Venda de ingressos (evento)
- Pagamento de serviços (agendamento)
- Compra de produtos (marketplace)
- Subscrições (membros premium de grupo)
```

**Cálculo:**

```typescript
// Exemplo 1: Ingresso R$ 100
Valor bruto: R$ 100,00
Taxa (3%):  R$ 3,00
Destinatário: R$ 97,00

// Exemplo 2: Doação R$ 100
Valor bruto: R$ 100,00
Taxa (0%):  R$ 0,00
Destinatário: R$ 100,00

// Exemplo 3: Serviço R$ 200
Valor bruto: R$ 200,00
Taxa (3%):  R$ 6,00
Destinatário: R$ 194,00
```

---

### Distribuição da Taxa (Fase 1)

```
R$ 3,00 (taxa administrativa) divididos em:

├─ R$ 1,20 (40%) → Infraestrutura
│  ├─ Servidores
│  ├─ CDN
│  ├─ Banco de dados
│  └─ Segurança
│
├─ R$ 0,90 (30%) → Fundo Regional
│  ├─ Projeto A (votado)
│  ├─ Projeto B (votado)
│  └─ Reserva de impacto
│
├─ R$ 0,60 (20%) → Desenvolvimento
│  ├─ Salários
│  ├─ Ferramentas
│  └─ Pesquisa
│
└─ R$ 0,30 (10%) → Reserva Emergencial
   └─ Nunca gasto (só cresce)
```

**Garantias imutáveis:**
- Fundo Regional ≥ 30% (sempre)
- Infraestrutura ≤ 50% (máximo)
- Reserva Emergencial nunca diminui

---

### Evolução da Taxa (Fases 2 e 3)

**Fase 2 (Cooperativa - Ano 2-5):**
```
Taxa votável: 2% a 4%
Votação: Trimestral
Quórum: 30% membros
Maioria: 2/3
Limite: 5% (statute, não alterável)
```

**Fase 3 (Fundação Pública - Ano 5+):**
```
Taxa regional: 1% a 3%
Decisão: Cada comunidade
Governança: Assembleia local
Limite global: 5% (statute)
Transparência: 100% pública
```

---

### Fundo Regional (Obrigatório)

**Captação:**
- Mínimo 30% da taxa administrativa (sempre)
- Doações diretas (isentas de taxa)
- Grants de terceiros

**Governança:**
```
Fase 1: Conselho Foundation + Assembleia (consulta)
Fase 2: Cooperativa (votação)
Fase 3: Assembleias locais (autonomia)
```

**Uso permitido:**
- Projetos de impacto social (votados)
- Infraestrutura comunitária
- Eventos culturais
- Educação popular
- Economia solidária

**Uso proibido:**
- ❌ Campanhas políticas
- ❌ Proselitismo religioso
- ❌ Enriquecimento pessoal
- ❌ Investimentos financeiros especulativos

**Transparência:**
- Todos os projetos públicos
- Votação pública
- Prestação de contas trimestral
- Auditoria anual

---

### Moeda (MFI Coins)

**Fase 1: Paridade Fixa**
```
1 MFI = R$ 1,00 (fixo)
Conversibilidade: Sim
Taxa de conversão: 2% (MFI → BRL)
Lastro: 100% em BRL (reserva)
```

**Fase 2: Paridade Flexível**
```
1 MFI ≈ R$ 1,00 (flutuante)
Conversibilidade: Sim
Taxa de conversão: 1% (MFI ↔ BRL)
Lastro: Misto (BRL + ativos comunidade)
```

**Fase 3: Moeda Comunitária Plena**
```
1 MFI = valor definido pela comunidade
Conversibilidade: Opcional (cada comunidade decide)
Lastro: Trabalho/serviços/produtos locais
```

**Emissão:**
```
Fase 1: Centralizada (1:1 com BRL depositado)
Fase 2: Semi-descentralizada (múltiplos emissores autorizados)
Fase 3: Descentralizada (comunidades emitem baseado em lastro local)
```

---

## PARTE 4: BLINDAGENS PERMANENTES

### Arquiteturais (Código)

**Observabilidade Passiva (O-01 a O-06):**
```
✅ Implementado
✅ CI bloqueia violação
✅ Zero exceções
✅ Auditável linha a linha
```

**Guardas Zod:**
```
✅ Validação obrigatória
✅ Fastify schema banido
✅ CI bloqueia regressão
✅ Zero ambiguidade
```

**Vocabulário Ético:**
```
❌ Proibido: urgente, risco, otimizar, ranking, performance pessoal
✅ Permitido: disponível, pendente, total, estado, histórico
```

---

### Estatutárias (Legal)

**Foundation Statute (imutável):**
```
1. Missão NÃO pode ser alterada
2. Taxa administrativa ≤ 5% (máximo absoluto)
3. Código SEMPRE aberto (GPL v3)
4. Fundo Regional ≥ 30% (mínimo absoluto)
5. Transição Cooperativa OBRIGATÓRIA (Ano 2)
6. Transição Fundação Pública OBRIGATÓRIA (Ano 5)
7. Venda/aquisição PROIBIDA (qualquer fase)
```

**Consequências de violação:**
```
- Violação de 1-4: Conselho dissolve automaticamente
- Violação de 5-6: Transition triggers automaticamente
- Violação de 7: Nulidade absoluta (ato jurídico inexistente)
```

---

### Éticas (Operação)

**Proibições absolutas:**
```
❌ Venda de dados pessoais
❌ Rastreamento individual
❌ Algoritmo de ranking manipulativo
❌ Gamificação forçada
❌ Notificações não solicitadas
❌ A/B testing sem consentimento explícito
❌ Dark patterns
❌ Anúncios targeted
❌ Perfil psicográfico
❌ Manipulação de feed
```

**Garantias absolutas:**
```
✅ Dados pessoais são do usuário (portabilidade total)
✅ Conta pode ser deletada a qualquer momento
✅ Export completo disponível sempre
✅ Opt-out de qualquer feature
✅ Zero lock-in
```

---

## PARTE 5: ROADMAP EXECUTÁVEL

### Mês 1 (Janeiro 2026) - AGORA

**Semana 1-2:**
```
[ ] Registrar Foundation (ou Associação)
[ ] Estatuto com blindagens
[ ] Conta bancária separada
[ ] Publicar documentos (site/GitHub)
```

**Semana 3-4:**
```
[ ] Congelar código core
[ ] Preparar ambiente piloto
[ ] Documentação do piloto
[ ] Recrutamento usuários
```

---

### Mês 2 (Fevereiro 2026) - Piloto Tech

**Objetivo:** Validação técnica com 50-100 usuários tech

**Escopo:**
```
✅ Habilitado:
- Rede social (posts, comentários, reações)
- Eventos (criar, participar, ingressos)
- Grupos (criar, gerenciar, membros)
- Agenda (disponibilidade, bookings)
- Compromissos (painel)
- Economia passiva (visibilidade)

❌ Desabilitado:
- Marketplace (produtos)
- Jobs (vagas)
- Payments reais (só simulação)
- MFI coins reais (apenas virtual)
```

**Métricas:**
```
- 50+ usuários cadastrados
- 10+ eventos criados
- 5+ grupos ativos
- 100+ posts publicados
- 50+ agendamentos realizados
- 0 violações de blindagens éticas
```

---

### Mês 3-4 (Março-Abril 2026) - Ajustes

**Foco:**
```
- Bugs críticos (baseado em feedback)
- UX (baseado em observação)
- Performance (baseado em métricas)
- Documentação (baseado em dúvidas)
```

**Não fazer:**
```
❌ Features novas
❌ Mudanças arquiteturais
❌ Otimizações prematuras
```

---

### Mês 5-8 (Maio-Agosto 2026) - Piloto Bairro

**Objetivo:** Validação de impacto social com 200-300 usuários reais

**Perfil:**
```
- Bairro ou comunidade organizada
- Economia local ativa (feira, comércio, serviços)
- Eventos culturais regulares
- Liderança comunitária engajada
```

**Escopo:**
```
✅ Tudo do Piloto Tech +
✅ Payments reais (BRL via Pix)
✅ MFI coins conversíveis
✅ Fundo Regional ativo
✅ Marketplace básico
```

**Métricas:**
```
- 200+ usuários ativos/mês
- 20+ eventos/mês
- 10+ grupos ativos
- R$ 10k+ em transações/mês
- R$ 3k+ para Fundo Regional
- Sustentabilidade básica provada
```

---

### Mês 9-12 (Set-Dez 2026) - Preparação Fase 2

**Objetivo:** Estruturar transição para Cooperativa

**Atividades:**
```
[ ] Modelo jurídico cooperativa (advogados)
[ ] Processo de adesão membros
[ ] Sistema de votação
[ ] Migração de governança
[ ] Eleição do primeiro conselho cooperativa
```

**Triggers para Fase 2:**
```
✅ 1000+ usuários ativos/mês
✅ 6+ comunidades usando
✅ Sustentabilidade financeira (6 meses de reserva)
✅ Conselho comunitário eleito
✅ Assembleia aprova transição (>70% votos)
```

---

## PARTE 6: COMPLIANCE E AUDITORIA

### Auditoria Técnica (Trimestral)

**Escopo:**
```
- Blindagens O-01 a O-06 (violações?)
- Guardas Zod (regressões?)
- Vocabulário ético (desvios?)
- Performance (degradação?)
- Segurança (vulnerabilidades?)
```

**Responsável:** Especialista independente (contratado)

**Resultado:** Relatório público + issues abertas

---

### Auditoria Econômica (Semestral)

**Escopo:**
```
- Receitas e despesas (detalhado)
- Distribuição de taxa (conforme regras?)
- Fundo Regional (30% garantido?)
- Reserva emergencial (crescendo?)
- Sustentabilidade (projeção 12 meses)
```

**Responsável:** Contador registrado + Conselho Fiscal

**Resultado:** Balanço público + recomendações

---

### Auditoria Social (Anual)

**Escopo:**
```
- Impacto mensurável (quantitativo)
- Percepção comunitária (qualitativo)
- Inclusão (perfil de usuários)
- Acessibilidade (barreiras?)
- Governança participativa (satisfação?)
```

**Responsável:** ONG ou universidade parceira

**Resultado:** Relatório de impacto social público

---

## CHECKLIST DE GO-LIVE

### Antes do Piloto Tech (Semana 4)

```
[ ] Foundation registrada
[ ] Estatuto publicado
[ ] Documentos institucionais no GitHub
[ ] Código congelado (branch `stable`)
[ ] Ambiente de produção seguro
[ ] Backup automático configurado
[ ] Monitoramento ativo
[ ] Logs estruturados
[ ] Suporte responsivo (email/telegram)
[ ] 50 usuários tech recrutados
[ ] Onboarding preparado
[ ] Termos de uso + Privacidade
```

### Antes do Piloto Bairro (Mês 5)

```
[ ] Piloto Tech validado (métricas OK)
[ ] Bugs críticos resolvidos
[ ] UX melhorada (feedback incorporado)
[ ] Payments reais testados
[ ] Pix integrado e funcionando
[ ] MFI coins conversíveis (BRL)
[ ] Fundo Regional ativo
[ ] Comunidade escolhida
[ ] Liderança engajada
[ ] Oficinas de onboarding agendadas
[ ] Suporte local treinado
```

### Antes da Fase 2 (Mês 12)

```
[ ] 1000+ usuários ativos
[ ] 6+ comunidades ativas
[ ] Sustentabilidade provada
[ ] Cooperativa estruturada
[ ] Conselho eleito
[ ] Sistema de votação funcionando
[ ] Assembleia aprovou transição
[ ] Documentos legais preparados
[ ] Migração de governança planejada
```

---

## DOCUMENTO VIVO

**Versão:** 1.0  
**Última atualização:** 12/01/2026  
**Próxima revisão:** Trimestral (ou quando atingir triggers)  

**Mudanças permitidas:**
- Detalhes operacionais (como, não o quê)
- Calendário (quando, não se)
- Métricas (valores, não princípios)

**Mudanças proibidas:**
- Missão
- Valores
- Blindagens
- Taxa > 5%
- Fundo Regional < 30%
- Transições obrigatórias

**Processo de mudança:**
```
1. Proposta documentada (PR no GitHub)
2. Discussão pública (mínimo 2 semanas)
3. Votação (Conselho ou Assembleia)
4. Registro (ata pública)
5. Atualização do documento (nova versão)
```

---

**Status:** ✅ EXECUTÁVEL  
**Próximo passo:** ESCOPO DO PILOTO  
**Bloqueador:** NENHUM  

**Sistema pronto para lançar em 4-8 semanas.** 🚀

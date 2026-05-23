# COMPLIANCE REGULATÓRIO — UNIFYBANK

**Status:** DOCUMENTAÇÃO DE ESTADO — NÃO É PLANO DE EXECUÇÃO
**Criado:** 2026-04-21
**Escopo:** Auditoria de prontidão do UnifyBank para compliance tributário e regulatório brasileiro
**Responsável:** Clayton
**Validação técnica:** Cursor (auditoria de código e schema) + Claude (análise de arquitetura)

---

## 1. CONTEXTO

Este documento consolida a análise feita em 2026-04-21 sobre a prontidão do UnifyBank para:
- Prestar informações à Receita Federal
- Sofrer auditoria externa
- Operar como instituição financeira regulamentada no Brasil

O documento existe para **preservar a análise**, não para iniciar execução imediata.
Compliance regulatório não é escopo da remediação sistêmica atual (FASE 4-8).
É trabalho subsequente que depende de conclusão das fases estruturais e de decisões
de produto/jurídicas que ainda não foram tomadas.

---

## 2. VEREDICTO ATUAL

**Classificação de maturidade:** nível 2 de 5

- Nível 1: não existe ledger
- **Nível 2: ledger interno funcional** ← estado atual
- Nível 3: ledger + camada fiscal mínima + KYC real
- Nível 4: enquadramento regulatório definido + relatórios BCB/Receita
- Nível 5: instituição autorizada com supervisão plena

**Resposta direta "Receita bate à porta hoje":**

| Pergunta | Resposta |
|----------|----------|
| Listar movimentos internos? | ✅ Sim (via `bank_ledger` + `bank_transactions`) |
| Provar identidade civil real de todos os intervenientes? | ❌ Não (CPF sintético, KYC parcial) |
| Emitir NFS-e/NFC-e retroativas? | ❌ Não (SEFAZ desligado, invoicing stub) |
| Provar integridade criptográfica do livro? | ⚠️ Parcial (relacional sim, hash/TSA não) |
| Demonstrar retenções legais nos splits? | ❌ Não (modelo fiscal ausente) |

---

## 3. O QUE JÁ EXISTE (pré-requisitos atingidos)

### 3.1 Núcleo contábil-técnico

| Componente | Estado | Evidência |
|------------|--------|-----------|
| SSOT financeiro | ✅ | `bank_accounts`, `bank_transactions`, `bank_ledger`, `bank_splits` em `backend/migrations/0003_bank_core.sql` |
| Ledger append-only | ✅ | `bank_ledger` com `direction` (credit/debit), `amount_cents BIGINT` |
| Dupla entrada | ✅ | Modelo: `bank_transactions` + 2+ linhas em `bank_ledger` com mesma `transaction_id` |
| Identidade por transação | ✅ | `actor_id` canônico em `bank_transactions` |
| Cadeia civil humana | ✅ | `responsible_actor_id` garantindo CPF ancorado (§4.8 LEI) |
| Timestamps | ✅ | `TIMESTAMPTZ` em todas as tabelas do núcleo |
| Fronteira de domínio | ✅ | Gate `bank-ledger-boundaries` PASS |
| Compensação | ✅ | `ledger-compensation.service.ts` documentado |

**Nota técnica (correção fina):** `bank_transactions` **não** tem colunas `from_account_id` / `to_account_id`
na DDL inicial. O modelo correto é: uma transação + múltiplas linhas no ledger com `direction`
e `account_id`. A "dupla entrada" é emergente do ledger, não da tabela de transação.

### 3.2 Sementes de fiscal (não operacional)

| Componente | Estado | Observação |
|------------|--------|------------|
| Provider SEFAZ | 🌱 Skeleton | `fiscal-provider.sefaz.ts` com `SEFAZ_ENABLED=false` |
| Emissão fiscal | 🌱 Skeleton | `fiscal-issuance.service.ts` no marketplace |
| Tipos fiscais | 🌱 Tipagem | `tax-profile.types.ts` existe como roadmap |
| Invoicing | ⚠️ Stub | `invoice.service.ts` calcula imposto como "5% simplificado (exemplo)" |
| Consulta CNPJ | ⚠️ Opcional | `companies.service.ts` consulta Receita como não-bloqueante |

### 3.3 Controles de risco de produto (não-PLD)

- `bank-transaction.service.ts`: sequência ATL → KYC → GUARDA antes de débito em contas não-system
- `authority-decision.service.ts`: orquestração de camadas com auditoria de decisão
- `actor_debts` e `atl_blocked_actors`: cadeia de responsabilidade e bloqueio operacional

Importante: isto é **controle de risco de negócio**, não PLD regulamentar nem KYC Receita.

---

## 4. LACUNAS POR DOMÍNIO

### 4.1 Identidade e prova civil

| Item | Estado | Lacuna |
|------|--------|--------|
| CPF real validado | ❌ | Seed usa `000.000.000-00`. Sem integração Receita. |
| CNPJ validado | ⚠️ | Consulta opcional, sem vínculo fiscal obrigatório |
| Prova de vida | ❌ | Não modelado |
| Armazenamento de documentos | ❌ | Sem gestão documental probatória |
| Níveis de identidade (I, II, III) | ❌ | Política de KYC ausente |
| Base legal LGPD | ❌ | Sem DPO, sem política de retenção documentada |
| Incidentes | ❌ | Sem procedimento de notificação ANPD |

### 4.2 Emissão fiscal

| Item | Estado | Lacuna |
|------|--------|--------|
| NFS-e | ❌ | Integração municipal inexistente (cada município tem webservice próprio) |
| NFC-e | ❌ | Sem integração estadual SEFAZ |
| NF-e | ❌ | Sem integração nacional SEFAZ |
| Certificado digital A1 | ❌ | Não incorporado ao sistema |
| Série/numeração fiscal | ❌ | Não modelado |
| CFOP / NBS / NCM | ❌ | Taxonomia fiscal ausente nos itens |
| Ambiente de homologação SEFAZ | ❌ | Pré-requisito antes de produção |

### 4.3 Obrigações acessórias

| Obrigação | Aplicabilidade | Estado |
|-----------|----------------|--------|
| e-Financeira | Se IF/IP | ❌ Zero |
| DIMOF | Se movimentar > R$ 2k/sem mês | ❌ Zero |
| DeCred | Se emissor de cartão | ❌ Zero |
| CCS (Cadastro de Clientes do SFN) | Se IF | ❌ Zero |
| SCR (Sistema de Informações de Crédito) | Se dar crédito | ❌ Zero |
| EFD-Reinf | Retenções INSS/IRRF/PIS/COFINS | ❌ Zero |
| EFD-Contribuições | PIS/COFINS | ❌ Zero |
| ECD / ECF | Contabilidade digital | ❌ Zero |
| DIRPF fontes pagadoras | Se pagar PF | ❌ Zero |

### 4.4 Regulação financeira (BCB / CMN / CVM)

**Decisão não tomada:** qual é o enquadramento do UnifyBank?

| Hipótese | Regulação aplicável | Implicações |
|----------|---------------------|-------------|
| Instituição de Pagamento (IP) | Res. BCB 80/2024 | Arranjo de pagamento, conta pré-paga, segregação |
| Subcredenciadora | Circular BCB 3.886 | Intermediação em arranjos |
| Marketplace com repasse | CVM, Receita | Responsabilidade limitada se bem estruturado |
| Cooperativa de crédito digital | LC 130/2009, Res. CMN 4.434 | Regime cooperativista próprio |
| "Fintech de agenda financeira" | Circular BCB 3.952 | Gestão de recebíveis de arranjo |

Cada enquadramento muda **tudo**: relatórios, obrigações, licenças, limites operacionais.
**Sem essa decisão, não há caminho claro para compliance.**

### 4.5 PLD/COAF

| Item | Estado |
|------|--------|
| Monitoramento de operações atípicas | ❌ |
| Reporte ao COAF | ❌ |
| Cadastro de PEP | ❌ |
| Política escrita de PLD | ❌ |
| Treinamento de colaboradores | ❌ |
| Responsável pela PLD (perante BCB) | ❌ |

### 4.6 Segregação patrimonial real

**Estado:** segregação **lógica** em base de dados via `owner_type = 'system' | 'escrow'`.

**Lacuna:** titularidade **jurídica** ausente. Para custodiar dinheiro de terceiros:
- Contrato de conta de pagamento com IF autorizada
- IF depositária real
- FGC (se aplicável)
- Política de resolução em caso de insolvência
- Reconciliação diária com extrato bancário real (conectado a **C13**)

### 4.7 Auditabilidade técnica forte

| Técnica | Estado | Lacuna |
|---------|--------|--------|
| Append-only | ✅ | Implementado |
| Compensação documentada | ✅ | Implementado |
| Hash encadeado (blockchain-like) | ❌ | Nenhum mecanismo criptográfico |
| Timestamping externo (TSA) | ❌ | Sem âncora temporal externa |
| WORM (Write Once Read Many) | ❌ | Backups não são imutáveis |
| Retenção de 5 anos documentada | ❌ | Sem política formal |
| Exportação assinada para auditor | ❌ | Ausente |

### 4.8 Relatórios e reconciliação

- Existe: `modules/reporting`, `modules/reconciliation`, `modules/observability`
- **Problema (C13):** 37 arquivos leem `bank_*` fora de `modules/bank/` → risco de lógica financeira duplicada
- Para auditor: narrativa única é essencial. Múltiplas leituras paralelas criam **drift semântico**

---

## 5. COMO AS VIOLAÇÕES ABERTAS AGRAVAM COMPLIANCE

Tabela de impacto regulatório das violações rastreadas em `SYSTEM_REMEDIATION_STATUS.md`:

| ID | Descrição técnica | Impacto em compliance |
|----|-------------------|------------------------|
| **C2** | `bank_transactions` sem `concept_ref` | Transação sem "o que foi comprado/vendido" → difícil amarrar fato gerador a documento fiscal |
| **C13** | 37 arquivos lendo `bank_*` fora do Bank | Risco de segunda verdade financeira → auditor não sabe qual narrativa é oficial |
| **C21** | `bank_accounts.owner_id` dual representation | Ambiguidade de titular em relatórios regulatórios |
| **C22** | `users.id` + `users.user_id` duplicados | Dupla identidade em trilhas que misturam colunas |
| **C27** | 3 sistemas de autorização coexistindo | Impossível provar "quem autorizou" de forma única |
| **C38** | Valores monetários em NUMERIC | Para fiscal, misturar NUMERIC e BIGINT cents aumenta risco de arredondamento |

**Conclusão desta seção:** fechar FASE 4-6 não cria compliance legal, mas **remove razões** para um auditor dizer "não confio nem na estrutura de dados".

---

## 6. ROADMAP RECOMENDADO (pós-remediação)

### FASE A — Consistência estrutural (em andamento agora)
Fechar C1, C2, C3, C12, C13, C21, C22, C38, C44, C46 conforme `SYSTEM_REMEDIATION_STATUS.md`.
**Status atual:** C1, C4, C8, C14, C20, C26, C45 FIXED. C1 fechado em 2026-04-21.

### FASE B — Contrato semântico por transação
- `concept_ref` em `bank_transactions` (C2)
- Política de imutabilidade após emissão fiscal
- Tabela satélite 1:1 com `bank_transactions.id` para dados fiscais se necessário

### FASE C — Camada fiscal mínima viável (MVP Brasil)
Ordem sugerida:
1. **Escolher 1 município + 1 regime tributário** para piloto (ex: MEI ou Simples em São Paulo)
2. **Certificado digital A1** + ambiente SEFAZ **de homologação**
3. **Modelar corretamente**: série, número, CFOP, NBS/NCM, alíquotas, retenções
4. **Substituir stub "5% exemplo"** por cálculo real por tipo de serviço/produto
5. **Testar em homologação** antes de produção

### FASE D — Enquadramento regulatório (jurídico, não tech)
**Decisão crítica que não é técnica.** Envolve:
- Consultoria jurídica-regulatória especializada em fintech/cooperativismo
- Definição entre hipóteses da seção 4.4
- Redação de contratos (termo de uso, política de privacidade LGPD, contrato de conta de pagamento se IP)
- Protocolização junto ao BCB se necessário licença

### FASE E — Operações e prova
- Retenção de logs (mínimo 5 anos para fiscal)
- WORM ou exportações assinadas periodicamente
- RPO/RTO documentados
- Procedimento de incidente (inclui ANPD para LGPD)
- DPO designado (LGPD)

### FASE F — Segregação patrimonial real
- Conta em IF autorizada (Banco Central)
- Contratos de custódia
- Conciliação diária com extrato bancário real
- Conecta diretamente à remediação de C13

---

## 7. PRAZO E EQUIPE REALISTAS

### Horizonte temporal

| Objetivo | Prazo após FASE 4-6 concluídas |
|----------|-------------------------------|
| MVP fiscal + KYC forte + enquadramento claro | 6-12 meses |
| Instituição de Pagamento completa com relatórios BCB/Receita | 18-36 meses |
| Cooperativa de crédito digital licenciada | 24-48 meses |

### Equipe mínima credível

| Função | Necessidade |
|--------|-------------|
| Tech (backend + infra + segurança) | Equipe atual |
| Contabilidade tributária | 1 contador especializado em fintech |
| Jurídico regulatório | Advogado regulatório (BCB/CMN/CVM) |
| Compliance/PLD | Responsável pelo programa de PLD perante BCB |
| Segurança da informação | ISO 27001 / LGPD |
| PCI-DSS | Apenas se processar cartão diretamente |
| DPO | LGPD (pode ser terceirizado inicialmente) |

---

## 8. MENSAGEM FINAL

O que está sendo construído agora **não é compliance à Receita** — é **infraestrutura para um dia poder argumentar** que os dados são coerentes, rastreáveis e geridos por um domínio único (Bank).

Isso é:
- **Necessário:** sem estrutura consistente, compliance é band-aid que cai na primeira auditoria
- **Insuficiente:** sem camada fiscal + regulatória explícita, o sistema continua sendo um ledger interno bem desenhado, não uma instituição sujeita a supervisão plena

**Prioridade atual permanece:** terminar FASE 4-6 da remediação sistêmica.
Compliance é trabalho subsequente, não paralelo.

---

## 9. PRÓXIMAS AÇÕES QUANDO ESTE DOCUMENTO FOR REATIVADO

Quando a remediação estrutural (FASE 4-8) estiver suficientemente avançada para iniciar
trabalho de compliance, as primeiras ações são:

1. **Decisão de enquadramento regulatório** (seção 4.4) — não é técnica, é de produto/jurídica
2. **Criar `COMPLIANCE_REGULATORIO_PLAN.md`** com cronograma e responsáveis
3. **Contratar consultoria jurídica-regulatória** especializada
4. **Matriz requisito × tabela/API × estado × gap × dono** (sugestão do Cursor — pode ser gerada a partir deste documento)

Este documento pode ser cruzado com IDs concretos do `SYSTEM_REMEDIATION_STATUS.md`
linha a linha quando houver capacidade de trabalho dedicado a este eixo.

---

## 10. HISTÓRICO

| Data | Evento |
|------|--------|
| 2026-04-21 | Documento criado a partir de análise Clayton + Claude + Cursor |
| — | (próximas atualizações quando compliance for trabalhado) |

---

**FIM DO DOCUMENTO**

Este é um documento de estado, não de execução. Não gera ação imediata.
A remediação sistêmica (FASE 4-8) continua sendo a prioridade até conclusão estrutural.

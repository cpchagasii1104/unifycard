# FALSIFICATION LOG — SSOT UnifiCard

Este documento registra **tentativas explícitas ou implícitas de violação do SSOT**,
bem como os resultados dos testes de falsificação executados ao longo do plano de correção.

Regra de ouro:
> Se um teste de falsificação não está registrado aqui, ele **não aconteceu**.

---

## COMO USAR ESTE LOG

Cada entrada deve representar **uma tentativa concreta de quebrar o SSOT**, seja por:
- escrita fora da autoridade única
- leitura legacy usada como decisão
- bypass de Gate
- ambiguidade detectada tardiamente

**Ambiguidade conta como falha até prova em contrário.**

---

## ORDEM E NATUREZA DO LOG (IMPORTANTE)

- Este log é **APPEND-ONLY**
- Entradas são **ordenadas por data de execução**, não por Gate
- **Nada é apagado**
- **Nada é editado retroativamente**
- Correções, descobertas tardias ou novos testes geram **novas entradas**
- Linha do tempo tem prioridade sobre fase do plano

Este documento é **forense**, não narrativo.

---

## TEMPLATE DE ENTRADA (copiar para cada novo teste)

### Entrada #[N]

- **Data:** YYYY-MM-DD
- **Gate:** Gate X
- **Domínio:** (ex.: bank, payments, marketplace, events, services, system)
- **Arquivo(s) envolvido(s):**
  - path/to/file.ts
- **Tentativa de falsificação:**
  - (descrever exatamente o ataque, cenário ou hipótese testada)
- **Hipótese de violação:**
  - (qual SSOT estaria sendo quebrado se isso passasse)
- **Resultado:**
  - PASSOU | FALHOU
- **Evidência:**
  - logs
  - prints
  - trechos de código
  - comandos executados
  - dumps
- **Conclusão:**
  - (por que passou ou falhou)
- **Ação corretiva (se aplicável):**
  - (refatorar, bloquear, registrar como proibido, criar novo Gate, etc.)

---

## ENTRADAS REGISTRADAS

### Entrada #1 — BASELINE HISTÓRICO

- **Data:** 2026-01-27
- **Gate:** Gate 0
- **Domínio:** system
- **Arquivo(s) envolvido(s):**
  - N/A
- **Tentativa de falsificação:**
  - Verificar se o sistema já possuía uma Fonte Única da Verdade (SSOT) financeira
    antes do início do plano de correção.
- **Hipótese de violação:**
  - Existência de múltiplas autoridades concorrentes de saldo, transação,
    ledger e split financeiro.
- **Resultado:**
  - FALHOU
- **Evidência:**
  - MATRIZ DE IMPACTO FORENSE — SSOT UnifiCard
  - Escritas diretas e paralelas em:
    - accounts
    - ledger
    - transactions
    - payment_splits
    - event_split_declarative
    - region_accounts
    - service_payment_*
- **Conclusão:**
  - O sistema operava historicamente com múltiplas verdades financeiras concorrentes.
  - Não existia SSOT financeiro consolidado.
- **Ação corretiva:**
  - Ativação formal do Plano de Correção SSOT com Gates sequenciais.
  - Congelamento do baseline e início da governança forense.

---

## REGRAS DE GOVERNANÇA DO LOG

1. Este log é **obrigatório** para:
   - fechamento de Gates
   - auditoria interna
   - revisão de arquitetura
2. Falha documentada é **vitória técnica**
3. Falha escondida é **dívida técnica**
4. Gate **não passa** se:
   - houver testes de falsificação previstos não registrados
   - existir ambiguidade sem entrada correspondente
5. Ausência de entrada = teste **não executado**

---

## STATUS

- Documento **ATIVO**
- Natureza: **forense / contratual**
- Autoridade: **governança SSOT**
- Este arquivo sobrevive a refactors de código, mudanças de time e reestruturações.

---

FIM DO FALSIFICATION LOG

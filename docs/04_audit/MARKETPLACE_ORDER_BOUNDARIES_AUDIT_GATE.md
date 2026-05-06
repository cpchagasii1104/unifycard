# Gate de auditoria — bordas marketplace / pedido / estoque

**Norma:** alinhado a `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — **§17.6 Gates de auditoria estrutural (CI/CD)** e invariantes monetários/estoque (Parte I — ex.: `price_cents`, `available_quantity`, `is_active` onde aplicável a ofertas). **Ancoragem:** [`docs/CORE_DOCUMENTS.md`](../CORE_DOCUMENTS.md).

Protocolo para **validar diffs/PRs** que tocam PDV legado, adapters, rotas de pedido ou ofertas.  
Objetivo: garantir que **toda entrada converge para o funil oficial** (`order.service` + transações já definidas), sem bypass.

**Não é revisão de estilo.** É caça a violações do modelo.

---

## Critério de aprovação (binário)

O diff **só passa** se:

> Todo input novo ou alterado converge para o funil (`orderService` / fluxo transacional equivalente já existente) **e** não existe caminho paralelo que crie pedido, mutar estoque ou cobrar fora desse modelo.

**E:** todas as operações críticas (criação de pedido, reserva de estoque, efeitos que antecedem cobrança) ocorrem **dentro** dos fluxos transacionais já definidos no domínio — não basta “chamar `order.service`” e depois executar lógica económica crítica à parte.

Veredito possível: **seguro** | **risco (com mitigação exigida)** | **não passa**

---

## 1. Entradas (PDV / adapter / rotas)

Verificar no diff **e** no impacto (ficheiros tocados):

| Procurar | Falha se |
|----------|----------|
| Criação de pedido sem passar por `order.service` (ou método transacional explícito do mesmo domínio) | Contorno |
| `createPhysicalOrder`, `this.orders.set`, `Map` como estado de pedido | SSOT em RAM |
| `stock -=`, `quantity -=` em objeto de catálogo/produto em memória | Estoque fora do domínio |
| Novo serviço que “simula” checkout sem `orderRepository` + reserva | Bypass |

**Normas:** `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (nomes de dinheiro/estoque); núcleo de pedido já documentado em `order.service.ts`.

### 1.1 Efeitos económicos fora do funil

Além de pedido/reserva, reprovar se o diff introduz **efeitos económicos relevantes** fora dos fluxos oficiais (Bank / payment-intent / execução já existente):

| Procurar | Falha se |
|----------|----------|
| Cobrança, captura, settlement ou ajuste de saldo **sem** passar pelos serviços canónicos já usados no projeto | Bypass do SSOT financeiro |
| `INSERT` / escrita direta em `bank_ledger` ou equivalente fora dos repositórios/serviços definidos para tal | Ledger paralelo |
| Cálculo de valor final cobrável **apenas** no adapter, sem alinhar a `pricing` / intent / regras do marketplace | Dinheiro “na marra” |

**Nota:** o checklist financeiro global do PR já cobre muito disso; esta linha liga **explicitamente** adapters PDV/marketplace ao mesmo princípio.

---

## 2. Variant resolution

| Procurar | Falha se |
|----------|----------|
| `variants[0]`, primeiro elemento sem regra | SKU/preço/estoque ambíguos |
| Uso de `productId` onde o contrato exige `productVariantId` sem função explícita | Integridade frágil |

**Passa se:** existe função ou serviço nomeado (ex.: `resolveDefaultVariant`, `getDefaultVariantForPdv`) com erros explícitos para 0/N variantes e regra documentada em comentário curto ou tipo.

---

## 3. Idempotência

| Procurar | Falha se |
|----------|----------|
| `ON CONFLICT DO NOTHING` sem `RETURNING` / sem leitura da linha existente | Sucesso silencioso + duplicata |
| Retry sem chave estável ou sem devolver o **mesmo** `order_id` | Pedido/cobrança duplicável |

**Passa se:** chave estável (header `Idempotency-Key` ou tabela auxiliar `tenant_id + key → order_id`) e comportamento de retry documentado.

---

## 4. Transações

| Procurar | Falha se |
|----------|----------|
| Adapter que abre transação própria e depois chama pedaços inconsistentes com `addItem` / `createOrderWithItemsAndReservations` | Estado parcial |
| Reserva de estoque fora da mesma transação que cria `order_items` (quando o fluxo exige os dois) | Órfãos / drift |

**Lembrete (núcleo atual):** `addItem` usa `BEGIN`/`COMMIT`/`ROLLBACK` com reserva + item na mesma transação; `submitOrder` rejeita pedido sem itens.

---

## 5. Compatibilidade de API

Se o endpoint legado for mantido:

| Procurar | Falha se |
|----------|----------|
| Resposta mudou de forma que quebra clientes sem adapter/DTO | Regressão de contrato |
| Falta `mapOrderToLegacyResponse` (ou equivalente) | Breaking change implícito |

---

## 6. Limpeza e flags

| Procurar | Falha se |
|----------|----------|
| `MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES` / rotas condicionais | Flag sem justificativa após migração |
| Código morto ainda importado sem uso | Confusão operacional |

**Nota:** com flag off, rotas legadas podem não registar-se, mas o **código ainda pode carregar** — remoção exige evidência (grep + logs).

---

## Automação CI (opcional)

Um job que execute `rg … && exit 1` em **todo** o `backend/src` só é viável **depois** de removido o legado conhecido (`createPhysicalOrder`, `Map` de pedidos, `stock.quantity -=` no PDV em memória). Enquanto isso existir no trunk, o comando **falha por desígnio** — não indica regressão nova.

**Estratégias:**

1. **Manual / PR:** revisor corre os comandos da secção seguinte no **diff** e ficheiros tocados.
2. **CI em PR (implementado):** `.github/workflows/marketplace-order-boundaries-audit.yml` — corre `backend/scripts/audit-marketplace-order-boundaries.sh` com `MARKETPLACE_BOUNDARIES_AUDIT_SOFT=1` (não bloqueia PR; mostra violações no log).
3. **CI bloqueante:** remover `MARKETPLACE_BOUNDARIES_AUDIT_SOFT` do job **após** baseline limpa — o script passa a devolver exit 1 em violações.
4. **Local:** `bash backend/scripts/audit-marketplace-order-boundaries.sh` (bloqueante por defeito).

### Quando tornar o CI bloqueante (baseline limpa)

**Pode** remover `SOFT` e falhar o PR em violações quando:

- O script no trunk **não encontra** ocorrências reais dos padrões **ou** só restam falsos positivos **documentados** e aceites.
- Nenhum fluxo crítico depende do legado (PDV em memória, etc.).
- O job em modo soft já correu tempo suficiente para o time ver os logs sem surpresa.

**Não** tornar bloqueante enquanto ainda existirem, sem plano fechado:

- `createPhysicalOrder` / pedidos em `Map` como SSOT
- `stock.quantity -=` (ou equivalente) fora do domínio transacional
- `variants[0]` sem regra explícita
- Exceções não mapeadas ao gate

---

## Comandos úteis (antes / depois do merge)

Na raiz do repo (ajustar caminhos se necessário):

```bash
# Entradas legadas / memória
rg -n "createPhysicalOrder|getOrdersMap\\(|\\.orders\\.set\\(" backend/src

# Estoque em memória (padrões comuns)
rg -n "stock\\.quantity\\s*-=" backend/src/modules/marketplace

# Variante “primeira do array” (revisar hits manualmente)
rg -n "variants\\s*\\[\\s*0\\s*\\]" backend/src

# Idempotência silenciosa
rg -n "ON CONFLICT.*DO NOTHING" backend/src backend/migrations

# Uso de order.service nos novos caminhos
rg -n "orderService\\.|from ['\"].*order\\.service" backend/src/modules/pdv backend/src/modules/marketplace

# createOrder( fora de order.service.ts — candidatos a bypass (rever hits: repositório, testes, re-exports)
rg -n "createOrder\\(" backend/src --glob '!**/order.service.ts'

# Alternativa (Bash): linhas com createOrder( que não mencionam "order.service" (heurística; ruído possível)
# rg -n "createOrder\\(" backend/src | grep -v order.service
```

---

## O que o revisor não assume

- Não assume que “flag off” = ninguém usa o path (validar logs/grep).
- Não assume bug no núcleo sem evidência no diff.
- Não assume segurança de integração sem ver idempotência + variant + contrato.

---

## Referência rápida — funil oficial

1. `orderService.createOrder` (draft) **ou** batch transacional `createOrderWithItemsAndReservations` onde aplicável  
2. `orderService.addItem(..., 'PDV' | 'MARKETPLACE')` — reserva + item na mesma transação  
3. `orderService.submitOrder` — valida itens > 0  
4. Pagamento / intent — fluxos existentes; idempotência no pagamento já pode usar header no PDV canónico  

**PDV HTTP:** fonte única **`/pdv/*`** (`modules/pdv`) + `order.service` (PostgreSQL). **`/marketplace/pdv/*`** foi removido; chamadas antigas recebem **410 Gone** (`marketplace-pdv-deprecated.routes.ts`). Ver `docs/CORE_DOCUMENTS.md` §5.1.

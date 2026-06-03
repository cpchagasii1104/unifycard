# MAPA DE ESCOPO — MVP-A (recirculação econômica por Eventos)

**Tipo:** MAPA DE ESCOPO MVP — **NÃO é DECISION normativa, NÃO é DECISION-008X, NÃO promulga norma constitucional, NÃO implementa nada.**
**Sessão:** 2026-06-03 · **Branch:** rescue-structural · **HEAD origem:** `662d152a` · **Docs-only.**
**Local:** `docs/03_execution_log/` (dentro das áreas graváveis do `00_AGENT_PROTOCOL §6.1`; há precedente de auditoria/MVP nessa área — ex.: `MARKETPLACE_ECOSYSTEM_AUDIT_MVP.md`; não existe pasta dedicada `mvp/scope`; `02_decisions` não foi usado por não ser DECISION normativa; nenhuma pasta nova criada).
**Consolida** análises read-only desta sessão. **Trava de honestidade:** todo FATO VIVO abaixo é ancorado em arquivo/tabela do repo; o que não pôde ser confirmado no repo nesta sessão é marcado **"(pendente de confirmação no repo)"**. Os relatórios "MVP Map A/B/C" são **insumo de sessão, não arquivos versionados** — não citados como fonte institucional.

---

## DECISÃO DE ESCOPO (Clayton)

> O primeiro MVP do Unificard vai provar a tese da **recirculação econômica usando o que já está vivo: Eventos + Carteira + Split + Fundo Regional + Social básico.**
>
> A maquininha, o comércio físico, o PDV, o marketplace de produtos, rides, delivery e PJ comercial completa **não entram no MVP inicial**. Eles são **segunda onda**, porque dependem de substrato que ainda precisa ser desenhado e materializado sem quebrar o Bank nem criar verdade paralela.
>
> O MVP inicial precisa mostrar que **um evento econômico real gera pagamento, ledger, split e retorno regional/social**. Se isso funcionar bem, a maquininha vira apenas **mais uma porta de entrada para o mesmo motor**.

---

## 1. FRONTEIRA FINANCEIRA DO MVP-A

**1. Pagamento real do MVP-A = Eventos/Ingressos.** O coração financeiro é a cadeia:
```
evento/ingresso → Bank → bank_ledger → bank_splits → fundo regional/social
```
- SSOT financeiro = `bank_ledger` / `bank_transactions` / `bank_splits` (CONFIRMADO: `SSOT_REGISTRY_UNIFICARD.md §5.2–5.5`; schema vivo `pg_constraint`).
- Substrato de pagamento/split de evento PRESENTE no código (CONFIRMADO por arquivo): `backend/src/core/events/event-payment-execution.service.ts`, `event-split-declarative.service.ts`, `backend/src/modules/bank/bank-split-engine.service.ts`, `backend/src/modules/events/ticket.service.ts` / `ticket-sale.repository.ts`.
- Fundo regional via Bank: `SSOT_REGISTRY §5.9.2` (flag `USE_BANK_REGIONAL_FUND`, contas `system:regional_fund:...`); `.env` DEV tem `USE_BANK_REGIONAL_FUND=true`.
- ⚠️ **A cadeia E2E completa evento→Bank→ledger→split→fundo regional funcionando no caminho de PRODUÇÃO é o próprio bloqueador §3.2 — substrato presente, E2E-produção (pendente de confirmação no repo nesta sessão docs-only).**

**2. Serviços/agenda entram só como camada NÃO-financeira ou organizacional:** disponibilidade, agenda, booking/compromisso, visualização, organização operacional. **NÃO declarar pagamento de serviço como fluxo financeiro E2E do MVP-A enquanto o wiring real não for verificado.**

**3. Serviço com cobrança = MVP-A.1.** Só entra após prova read-only específica confirmando: não passa por mock; grava no Bank; registra ledger; aplica split quando aplicável; não cria verdade paralela.

**4. `mockUnifyCardCharge` é BLOQUEADOR DE PRODUÇÃO** (regra dura). CONFIRMADO que existe: `backend/src/core/checkout/CheckoutService.ts`. Mock de pagamento **nunca** vai para produção; qualquer fluxo do MVP-A que dependa dele é bloqueador, não detalhe técnico.

---

## 2. O QUE ENTRA NO MVP-A

**Vertical financeiro real:**
- login/registro; perfil básico; carteira/extrato;
- eventos; criação/publicação de evento (se o fluxo estiver vivo — substrato em `modules/events`);
- venda de ingresso com pagamento real; Bank; `bank_ledger` como SSOT financeiro; `bank_splits`; split automático do ingresso; fundo regional recebendo split;
- P2P entre usuários (substrato presente em `backend/src/modules/bank/bank-transaction.service.ts`; E2E vivo *pendente de confirmação no repo*);
- visualização do valor retornando.

**Camada social / engajamento:**
- feed social básico (substrato `backend/src/core/home-feed/home-feed.service.ts`);
- grupos básicos (módulo `modules/groups` existe; maturidade *pendente de confirmação*);
- RSVP/check-in de evento (substrato `backend/src/modules/events/checkin.service.ts` + `event-checkin.repository.ts`);
- transparência/visualização do retorno social/regional (se já houver substrato — *pendente de confirmação no repo*).

**Camada organizacional NÃO-financeira:**
- agenda/disponibilidade; booking/compromisso (substrato `availability`/`bookings` vivo, ver mapa C0);
- calendário/organização; serviços **sem cobrança real** no MVP-A.

> **Observação obrigatória:** NÃO vender serviço pago como parte do MVP-A enquanto pagamento de serviço não for provado E2E.

---

## 3. O QUE FICA FORA DO MVP-A (segunda onda / congelado)

maquininha · comércio físico · PDV fechando pagamento no Bank · marketplace de produtos · checkout genérico fora de eventos · orders de produto · delivery · rides/transporte · PJ comercial completa · onboarding PJ operacional completo · payout externo / PIX / TED / liquidação externa · pagamento de serviço E2E · risk command center · policy management · biometria/gov.br/prova de vida · correspondente externo · caução/hold financeiro · CRM completo · ERP completo · subscriptions · loyalty · venue · invoice · módulos fantasma/comentados por DT.

**Razão geral (para todos):** *fora do MVP-A porque depende de substrato, decisão, wiring financeiro, schema, UX ou validação que ainda não está pronta sem risco de verdade paralela.*

Ligações de governança já registradas: PJ comercial/onboarding PJ → bloqueados por `DECISION-0081/0082/0083` (M0/D1/D3) + estrutura técnica pendente; preço → `DT-COMMERCIAL-PRICE-FEDERATED-SSOT`; risk/operador → `DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING`; caução → diretriz verbalizada em `DECISION-0082 §8.1` (não decidida).

---

## 4. BLOQUEIOS MÍNIMOS DO MVP-A (antes de lançamento)

1. **Mock payment:** garantir que NENHUM fluxo do MVP-A em produção passe por `mockUnifyCardCharge` (`core/checkout/CheckoutService.ts`).
2. **Evento/ingresso:** confirmar que o pagamento de evento/ingresso realmente usa Bank, ledger e split real no caminho de produção (substrato presente; E2E-produção a confirmar).
3. **Contas sistema:** `DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION` está **CLOSED** (`REMEDIATION_DT_LOG.md:924`, F10/DECISION-0036) — bloqueio reduz-se a **confirmar que a convergência F10 segura está aplicada em ambiente limpo** antes de depender de split/fundo, não a resolver DT aberta.
4. **Cascas visíveis:** ocultar ou sinalizar honestamente módulos/rotas não-vivos, para não prometer marketplace/rides/PDV/delivery.
5. **Serviço/agenda:** garantir que serviço/agenda no MVP-A não prometa pagamento real.
6. **Gates:** manter E2E de evento verde e gates financeiros obrigatórios antes de qualquer lançamento.

---

## 5. SEQUÊNCIA SUGERIDA (mapa, não implementação)

1. Confirmar/verificar fluxo real de eventos/ingressos no ambiente atual.
2. Auditar ausência de mock nos caminhos do MVP-A.
3. Confirmar contas sistema/split/fundo regional (convergência F10) em ambiente limpo.
4. Costurar UX do MVP-A: eventos · carteira · fundo regional · social básico · agenda não-financeira.
5. Esconder/congelar cascas fora do MVP-A.
6. Rodar gates financeiros e E2E específicos.
7. Só depois avaliar **MVP-A.1**: pagamento de serviço; serviço/agenda financeiro; possível integração com marketplace de serviços.

---

## 6. GATES E VALIDAÇÕES FUTURAS (esperados; sem rodar agora)

CONFIRMADOS no repo (nomes exatos):
- `validate:actor-writer-boundaries` (`backend/package.json` → `audit-actor-writer-boundaries.mjs`)
- `validate:bank-ledger-boundaries` (`backend/package.json` → `audit-bank-ledger-boundaries.mjs`)
- `validate:regression-guards` (`backend/package.json` → `guard-financial-regression.ts` + `sql-regression-lint.ts` + `check-migration-numbering.js`)
- `validate:architecture:strict` (`package.json` raiz → `validate-architectural-patterns.mjs --strict`) — *nota: o alias do prompt "validate-architectural-patterns --strict" mapeia para este npm script*.

A confirmar (nomes não localizados como script exato nesta sessão):
- E2E do fluxo de evento/ingresso — *gate a confirmar*.
- E2E de split/fundo regional — *gate a confirmar*.
- checagem de ausência de mock em produção — *gate a confirmar / a desenhar*.
- checagem de que nenhum módulo fora do MVP-A é apresentado como funcional — *gate a confirmar / a desenhar*.

---

## 7. RISCOS DE LANÇAMENTO

- mock payment em produção = **risco crítico de fraude/perda financeira**;
- casca visível = quebra de confiança;
- serviço pago sem wiring = falsa venda;
- marketplace produto antes do Bank/wiring = buraco financeiro;
- PJ comercial antes de D2/D3 técnica/D5 = risco de autoridade e identidade;
- payout externo antes de F2/F3 = risco de liquidação;
- regional fund sem conta/split canônico = risco de promessa social falsa.

---

## 8. ESTADO / REFERÊNCIAS

- Decisão de escopo: Clayton (2026-06-03). Mapa consolida análises read-only de sessão.
- Cadeia normativa PJ relacionada (contexto, não escopo MVP): `DECISION-0081` (M0), `DECISION-0082` (D1), `DECISION-0083` (D3).
- Próximo passo recomendado: **frente read-only de verificação E2E do fluxo evento→Bank→ledger→split→fundo** (auditar mock + wiring real em produção) antes de costurar UX do MVP-A.

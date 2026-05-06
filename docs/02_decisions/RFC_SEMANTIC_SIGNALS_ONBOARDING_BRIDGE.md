# RFC — Ponte de sinais e onboarding governado (sem semântica paralela)

**ID:** RFC-SEMANTIC-SIGNALS-ONBOARDING-BRIDGE  
**Estado:** `RASCUNHO` — **não** altera código até aprovação humana + entrada em `docs/03_execution_log/`  
**Gatilho v1 (§4):** **manual assistido** — sugestão preparada como **proposta** (`pending`); aplicação de onboarding **só** após acção explícita do utilizador («Aplicar» ou equivalente). *Documental; aguarda assinatura no log.*  
**Tipo:** decisão de produto / contrato de integração (ficheiro em `docs/02_decisions/` — **não** é `docs/01_normative/`)

## Precedência

1. `docs/01_normative/` (`00_AGENT_PROTOCOL.md`, `AUTHORITY_LAW.md` **Art. 11–14**, Lei 5, SSOT Bank).  
2. `PRODUTO_PLANO_MESTRE_COMPLETO.md` — **C.1**, **C.10**, **C.19**, **C.25**, **EIXO 9**, **C.31–C.34**.  
3. `docs/02_decisions/C.25_SPEC.md` — lista fechada para CI sobre inferência/sugestão.  
4. **Este RFC** — define **ponte** entre sinais/padrões aprovados e o **motor existente** de onboarding; em conflito, perde para (1)–(3).

## 1. Actor / serviço (função, não nome de marketing)

**Papel contratual:** **consumidor de sinais** + **aplicador de padrões aprovados** (EIXO 9), que produz **entrada estruturada** para fluxos já existentes (ex.: `store-onboarding.service.ts`).

**O que este componente NÃO é e NÃO faz:**

- Não **interpreta** semântica de domínio (CONCEPT).  
- Não **cria** conceito nem canónico como verdade.  
- Não **decide** fluxo financeiro nem `concept_ref`.  
- Não substitui o **adapter** (**C.10**, **C.19**).

## 2. PROIBIDO — violação de sistema (texto literal para review / CI)

As seguintes acções são **proibidas** para este módulo e para qualquer código que invoque «sugestão» ou «inferência» **fora** da allowlist em `C.25_SPEC.md` §1:

```text
PROIBIDO:
- definir ou fixar concept_ref
- escrever em canonical_products fora do fluxo oficial (C.23 quando adoptado; migrations governadas)
- influenciar checkout
- influenciar ledger ou trilhos bank_*
- criar fallback semântico ou atalho por category_id
- usar category como identidade de execução
- qualquer transformação semântica que substitua C.1 (product → canonical_product → concept)
```

Qualquer PR que viole o bloco acima → **regressão de arquitetura** (alinhar **C.22**, **C.31–C.32**).

## 3. Regra temporal da inferência

**Inferência / montagem de sugestão ocorre ANTES do fluxo transaccional real, nunca DURANTE.**

- **Antes:** leitura de `company_type`, carregamento de padrão aprovado, montagem de `payload` para chamada ao serviço de onboarding.  
- **Durante / depois:** resolução de `concept_ref`, intent, liquidação — **só** adapter + contratos existentes (**C.1**).

## 4. Gatilho de execução (**decisão v1** — manual assistido)

**Escolha operacional (v1):** **B — manual assistido** (não é manual puro: o sistema **prepara** sugestão; o utilizador **aplica**).

**Não escolhido em v1:** execução **automática** no `createTenant` (opção A — adiada: exige **2B**, **C.25_SPEC** fechado e ciclo **C.17** estável para reduzir risco de sugestão errada persistida cedo). **Não escolhido em v1:** gatilho **assíncrono** só-evento (opção C — evolução documentada abaixo).

### Fluxo real (garantias)

```text
createTenant (ou ponto de entrada equivalente após tenant existir)
→ sistema pode ler company_type_id / sinais permitidos (leitura)
→ prepara sugestão / payload como PROPOSTA (estado pending — SEM efeitos colaterais)
→ apresentação ao utilizador: ex. "Temos um pacote sugerido para o seu negócio"
→ utilizador executa acção explícita (ex.: "Aplicar")
→ chama store-onboarding.service.ts (ou rota que já o invoca) com o payload
→ onboarding executa materialização (sem inferência adicional no meio do fluxo)
```

**Garantias explícitas (v1):**

- A sugestão **não** é aplicada automaticamente no `createTenant`.  
- **Inferência / montagem de proposta** ocorre **antes** do fluxo transaccional real (**§3**).  
- **Sem** impacto em `concept_ref`, checkout ou ledger até o fluxo canónico existente (**C.1**, **C.19**).  
- Cumpre o **teste de desligamento** (**§6**): sem o módulo de sugestão, onboarding manual e `POST /marketplace/store-onboarding` continuam possíveis.

**Regra de produto (frase para o time):** *sugestão pode nascer sozinha; **ação** nunca.*

**Integração com código existente:** reutilizar `store-onboarding.service.ts`; **não** duplicar resolução `canonical → concept`.

### Evolução futura (**não** v1 — só após condições)

Gatilho **assíncrono** (event-driven) ou automação acrescida **só** após, cumulativamente:

- **2B** concluída e validada;  
- **`C.25_SPEC.md`** §1–5 fechado e reflectido no CI;  
- Pelo menos **um** ciclo **C.17** com evidência em `docs/03_execution_log/`.

Qualquer evolução exige **RFC incremental** ou emenda a este RFC + registo no log.

### 4.1 Anti-padrões que violam §4 (v1) — **proibido em implementação**

1. **Saltar o «Aplicar»:** qualquer `autoApplyOnboarding()` ou equivalente quando `suggestionExists` **sem** acto explícito do utilizador → violação directa de §4.  
2. **Sugestão como estado já aplicado:** persistir ou expor sugestão `pending` como se onboarding ou catálogo já estivessem activos → **autoridade implícita** (EIXO 9).  
3. **Assumir RFC sem log:** merge de código que implemente gatilho v1 **sem** entrada assinada em `docs/03_execution_log/` conforme §9.1 → **decisão institucional não existe**.

## 5. Entrada em `C.25_SPEC.md`

Após aprovação deste RFC (ou merge do seu conteúdo na versão final):

- Preencher **C.25_SPEC.md** §1 com: **módulo permitido**, **função/ficheiro permitido**, **tipo de operação permitida** (ex.: só leitura + montagem de payload).  
- Preencher §2 com zonas proibidas (mínimo: já listadas no `C.25_SPEC.md` + este §2).  
- Preencher §4 com regras de CI **literais** (regex ou paths).

**Regra:** sem esta sincronização → **sem lista fechada** → **CI não opina sobre inferência** (**C.25**).

## 6. Teste de desligamento (dependência)

**Critério obrigatório:**

| Pergunta | Resposta exigida |
|----------|------------------|
| Se este módulo for **removido** ou desactivado, o sistema continua a funcionar para onboarding **manual**? | **SIM** |
| O fluxo `concept_ref` / adapter / checkout continua intacto sem este módulo? | **SIM** |

Se qualquer resposta fosse **NÃO**, a ponte tornou-se **dependência estrutural** de inferência — **REPROVADO** até redesenho.

## 7. Motor existente (nuance factual)

Já existe **pedaço** da ponte em `backend/src/modules/marketplace/store-onboarding.service.ts` (herança por `company_types`, materialização de produtos a partir de canónicos **scoped** por tenant). Este RFC **não** obriga reescrita total: obriga **alinhamento** a EIXO 9, **2B** (globais), e **C.25_SPEC** quando fechado.

## 8. Frase-guia (ordem de poder)

> **Inferência prepara · sistema executa onboarding · adapter valida semântica · ledger executa dinheiro.**

Se esta ordem quebrar, o desenho quebra.

## 9. Próximos passos (checklist humano)

- [ ] Revisão cruzada com dono de produto + engenharia  
- [x] **Gatilho v1 cravado em §4** (manual assistido; proposta `pending` + «Aplicar») — *aguarda assinatura no log para efeito institucional*  
- [ ] Copiar §2 PROIBIDO para guidelines de PR  
- [ ] Fechar `C.25_SPEC.md` §1–5 (allowlist de módulos/funções alinhada a §4) e log  
- [ ] Só então implementar código e CI

### 9.1 Modelo de assinatura institucional (log) — **copiar para `docs/03_execution_log/` após aprovação**

**Regra:** RFC e §4 documentalmente prontos **≠** decisão activa. **Só** após registo assinado abaixo (ou equivalente com os mesmos elementos) a equipa deve tratar o gatilho v1 como **autorizado para implementação**.

```text
Data: YYYY-MM-DD
Responsável: Nome (papel)
Decisão: Aprovação do RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE — §4 Gatilho v1 (manual assistido)
Concordância: Confirmo que:
- sugestão não executa automaticamente no createTenant nem em qualquer ponto sem acção explícita do utilizador
- ação exige intervenção humana explícita (ex.: «Aplicar») antes de efeitos colaterais de onboarding
- sem impacto em concept_ref, checkout ou ledger fora dos fluxos já regidos por C.1 / C.19
- conheço §4.1 (anti-padrões) e reforço review para impedir auto-apply e confusão pending/activo
```

**Frase operacional:** *sugestão existe por padrão; **execução** existe por **autorização**.*

---

## Ligações

- `PRODUTO_PLANO_MESTRE_COMPLETO.md` — **EIXO 9**, **C.25**, **C.31–C.34**  
- `docs/02_decisions/C.25_SPEC.md`  
- `docs/02_decisions/SEMANTIC_CATALOG_GOVERNANCE.md`  
- `docs/02_decisions/PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md` — prompt Agent mode para **Fase 2B** (sem misturar EIXO 9 no adapter; **C.15**)

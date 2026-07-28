# DECISION-0192 — DOUTRINA DO SUJEITO TERRITORIAL DO FUNDO REGIONAL (o comprador financia a própria comunidade)

**Data:** 2026-07-27 · **Status:** 🔴 **VEREDITO C na auditoria independente de 2026-07-27 — CORRIGIDA (D1-BIS · D5-BIS · D5-TER), AGUARDANDO RE-AUDITORIA.** NÃO-SELADA. SELF-SEAL NÃO PERMITIDO. **NÃO é autoridade de roteamento até novo parecer.**
**Base:** HEAD `229652a9d7f05e8a30a46037858251a8098ab5fe` (branch `rescue-structural`). Denominador NÃO-STALE.
**Modo:** DOCS-ONLY · ZERO CÓDIGO/MIGRATION/GUARD/BANCO · PORTA-1 FECHADA · não semeia policy · não autoriza execução material.
**Deriva de / subordinada a:** [[DECISION-0049]] (`regionalOriginBasis`) · [[DECISION-0166]] **D0** (PF=residência · **PJ=endereço fiscal/HQ** — ramo PJ INTOCADO por esta decisão, ver D1-BIS) · **D8** (*"ajustar percentuais dentro de limites governados"* — ver D5-BIS) · D2/D3/D6 (nível territorial; admin configura policy, admin não move dinheiro) · [[DECISION-0177]] D2/D6 (sujeito territorial = Actor comprador, escopo estreito) · [[DECISION-0048]] (categoria seleciona policy, não calcula split) · Lei 5 · Lei 7 · Artigo V · Artigo XI.
**Origem probatória:** GATE read-only "os ajustes conectam às contas certas?" (2026-07-27, registrado em `6567cf068`) + decisão soberana direta de Clayton na mesma data.

---

## 0. NATUREZA E LIMITE DESTA DECISÃO

Esta decisão é **docs-only**. NÃO altera código, migration, guard, Bank, RLS, policy ou FK; NÃO semeia nenhuma `economic_policy`; NÃO abre a PORTA-1; NÃO declara o próprio selo.

Ela **não cria** mecanismo novo. `regionalOriginBasis` já existe e já funciona (DECISION-0049, provado por E2E — §3). O que faltava não era mecanismo: era **doutrina**. Esta decisão preenche exatamente essa lacuna e nada além.

---

## D0 — O PROBLEMA QUE ESTA DECISÃO FECHA

O motor canônico PE-3 resolve o destino do fundo regional a partir de `regionalOriginBasis`, um campo **explícito por LINHA de policy**. O código **não impõe nenhum valor** e **não tem default** — obedece o que a policy publicar.

Enquanto isso permanecer assim, **cada policy publicada inventa a própria doutrina territorial**. O resultado previsível, uma vez que a tela de administração exista (`F-ECONOMIC-POLICY-ADMIN` Fatia 3, selada em `0fe1972ba`), é uma plataforma onde Curitiba recebe por um critério e Londrina por outro, **sem que ninguém consiga explicar por quê** — e sem que nada no sistema esteja tecnicamente errado.

Isso não é bug: é **ausência de norma** num ponto onde a norma decide para quem vai o dinheiro. Artigo XI exige que a regra seja pública e justificada; uma regra que varia silenciosamente por linha de configuração não é pública.

---

## D1 — A REGRA (decisão soberana de Clayton, 2026-07-27)

> **O sujeito territorial do fundo regional é o COMPRADOR. Quem gasta financia a própria comunidade.**

Canonicamente: para linha de policy com `line_type='regional_fund'` **cujo pagador seja PESSOA FÍSICA**, o valor doutrinário de `regionalOriginBasis` é **`payer_identity_residence`** (`economic-policy.types.ts:114-121`).

### 🔴 D1-BIS — ESCOPO É PF. O RAMO PJ DA DECISION-0166 D0 PERMANECE ÍNTEGRO (correção pós-auditoria, veredito C-2)
**A redação original dizia "para toda linha de policy" e a palavra "PJ" não aparecia uma única vez.** Isso **apagava silenciosamente** o ramo pessoa jurídica da `DECISION-0166 D0` (ratificada), que fixa: *"PF: residência canônica … **PJ: endereço cadastral/fiscal canônico (HQ/fiscal)**"*. Efeito material do erro: PJ compradora sem `address_assignments` role `RESIDENCE` cairia em `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE` **para sempre** — e a D4 abaixo proíbe expressamente cair no endereço da empresa.

**Correção:** esta decisão governa **exclusivamente o caso PF**, que é exatamente o que sua prova E2E (D3) demonstra. **A DECISION-0166 D0 permanece VIGENTE E INTOCADA quanto a PJ.** Esta decisão não a revoga, não a substitui e não a interpreta.

**Lacuna registrada, não resolvida aqui:** o vocabulário `RegionalOriginBasis` **não possui valor algum para "endereço fiscal/HQ do PAGADOR"** — só existem `receiver_company_operational` e `receiver_company_hq`, ambos do recebedor. Logo o ramo PJ de D0 **nunca teve vocabulário para ser expresso**. O substrato de resolução, esse, **já existe e não foi usado**: `actor-territorial-resolver.ts:13` expõe `ACTOR_FISCAL_HQ`. **Materializar PJ exige criar um 8º valor de `RegionalOriginBasis`, o que é ato de DECISION nomeada própria — não desta.** Até lá, **PJ compradora está fora do escopo desta doutrina**, e nenhum implementador deve deduzir que `payer_identity_residence` se aplica a ela.

**Justificativa registrada (Artigo XI):** a fatia regional existe para que o consumo de uma comunidade retorne a essa comunidade. Ancorar no comprador significa que o dinheiro fica **onde o consumo aconteceu** — o município cuja população movimenta a plataforma é o município que capitaliza. A base alternativa (`receiver_identity_residence`) reforçaria regiões que exportam trabalho, e é uma tese legítima, **mas não é a tese desta plataforma**.

**Consequência distributiva assumida conscientemente:** cidades com maior consumo capitalizam mais rápido que cidades com maior produção. Esta assimetria é **escolhida**, não acidental, e qualquer correção futura (equalização inter-regional, piso por cidade) é frente própria com decisão própria — **não** se obtém trocando `regionalOriginBasis` caso a caso.

---

## D2 — RELAÇÃO COM A DECISION-0177 (generalização, não contradição)

A DECISION-0177 D2/D6 já fixou o sujeito territorial como **Actor comprador**, porém **com ressalva explícita de escopo estreito**: valia para a combinação selada `regional_fund` × `commission_distributable` na campanha B-CITY-2, e **não** como regra geral.

Esta decisão **estende aquele precedente a toda policy cujo pagador seja PF** (ver D1-BIS), na mesma direção. Não há reversão nem conflito: a 0177 permanece vigente no seu escopo, e a 0192 estende o mesmo critério ao universo PF que a tela de administração agora torna livremente criável.

**⚠️ Correção pós-auditoria:** a redação original dizia *"generaliza para toda policy"*. Com o escopo corrigido para PF em D1-BIS, **"toda policy" seria falso** — PJ permanece governada pela `DECISION-0166 D0` e sem vocabulário para ser expressa. Corrigido para não deixar duas afirmações incompatíveis dentro do mesmo documento.

---

## D3 — O QUE JÁ ESTÁ PROVADO (e portanto não precisa ser reconstruído)

O mecanismo que esta doutrina passa a governar **já é provado por E2E real**, não por leitura de código — `validate-pipeline-e2e-regional-fund-pf-resolver.ts:260-309`, cenário comprador=São Paulo / prestador=Curitiba:

- `receiver_identity_residence` → credita Curitiba, São Paulo intacta;
- `payer_identity_residence` → credita São Paulo, Curitiba intacta;
- base sem residência cadastrada → `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE`, **zero split gravado**.

**Esta decisão escolhe qual das duas primeiras é a doutrina. Ela não altera, não afrouxa e não reinterpreta a terceira.**

---

## D4 — FAIL-CLOSED PERMANECE INTOCADO

Nada nesta decisão cria fallback. Permanecem integralmente vigentes, e **é vedado** introduzir default, herança ou inferência que os contorne:

- residência do comprador ausente → **rejeita a transação inteira** (`POLICY_REGIONAL_ORIGIN_UNRESOLVABLE`); é **proibido** cair na residência do prestador, no endereço da empresa, ou em qualquer "outra ponta";
- `regional_fund_accounts` sem mapping para o escopo resolvido → `REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED`; **o pagamento nunca cria a conta**;
- cidade fora do piloto → `REGIONAL_FUND_CITY_NOT_ENABLED`;
- nível `neighborhood` → `REGIONAL_FUND_NEIGHBORHOOD_HOLD` (501).

**"Doutrina do comprador" não significa "achar o comprador de algum jeito".** Significa: ou a residência do comprador está governada e resolvida, ou não há split.

---

## D5 — AUSÊNCIA DELIBERADA DE TETO E PISO (decisão soberana de Clayton, 2026-07-27)

Perguntado se um administrador pode publicar uma policy com fundo regional = 0%, Clayton decidiu: **sim — liberdade total.**

Registra-se, portanto, que **hoje não existe piso para o fundo regional nem teto para a taxa da plataforma**, e que **essa ausência é estado deliberado, não esquecimento**. Nenhuma auditoria futura deve "corrigi-la" por conta própria; instituir piso ou teto exige **ato soberano expresso de Clayton**.

### 🔴 D5-BIS — RELAÇÃO COM A DECISION-0166 D8 (correção pós-auditoria, veredito C-1)
**A redação original omitia a `DECISION-0166 D8` do bloco "deriva de" e declarava a ausência de limites como permanente** — o que, na prática, **revertia silenciosamente um artigo RATIFICADO**, violando o Artigo XI (*emendas explícitas, públicas, justificadas, nunca silenciosas*). Agravante: o ponto de extensão que esta D5 invoca **nomeia D8 no próprio comentário** (`economic-policy-write-validation.ts:7-9`) — a colisão estava a uma linha de ser vista, e não foi.

**`DECISION-0166 D8` diz:** *"O admin pode ajustar percentuais **dentro de limites governados** (tetos/pisos definidos por regra, ex.: teto máximo de comissão)."*

**Leitura harmonizadora, que é a correção — e NÃO uma revogação:** D8 estabelece que limites governados **podem existir** e que o admin opera dentro deles. **Nenhum limite foi instituído até hoje.** Portanto D8 permanece **integralmente vigente e não revogada**: hoje o conjunto de limites é vazio, e operar sem limites é operar dentro de um conjunto vazio — não é operar contra D8.

**O que Clayton efetivamente decidiu foi "não agora", não "nunca".** Suas palavras foram *"pode seguir sem teto/piso, **deixe de forma que eu possa configurar**"* — que pressupõe configurabilidade futura, exatamente o que D8 prevê. A redação original transformou um "ainda não" em "jamais", e isso era erro da direção, não decisão de Clayton.

**Consequência:** instituir tetos/pisos **não exige revogar nada** — exige apenas o ato soberano de instituí-los, no ponto de extensão já nomeado e ainda vazio.

### 🔴 D5-TER — CORREÇÃO FACTUAL SOBRE AS INVARIANTES (veredito C-3)
A redação original afirmava que a soma de 10000 bps era *"a única invariante econômica obrigatória e materialmente travada"*. **Falso.** `economic-policy-write-validation.ts` impõe hoje, no mínimo, mais três travas materiais: (1) **toda** policy exige ao menos uma linha `revenue_share` (`:191-197`) — sem ela o cálculo falha `DRIFT_NO_REVENUE_SHARE` em pagamento real; (2) `regional_fund` exige `regionalLevel` (`:234-238`); (3) `regionalLevel` é **proibido** nas demais linhas (`:239-241`). A liberdade real do admin é **menor** do que esta decisão afirmava — e afirmar liberdade maior que a real é o tipo de imprecisão que faz alguém desenhar contra o sistema.

A soma exata de 10000 bps permanece obrigatória porque não fechar 100% não é liberdade — é incoerência contábil que zeraria ou negativaria a fatia do prestador **no momento do pagamento real**, e não na configuração.

O ponto de extensão nomeado para teto/piso permanece disponível e **vazio por decisão** (`economic-policy-write-validation.ts`).

---

## D6 — O QUE ESTA DECISÃO NÃO FAZ

- **Não semeia policy.** O motor canônico segue fail-closed com zero políticas; os percentuais reais permanecem decisão soberana não tomada.
- **Não abre a PORTA-1** nem toca `PORTA_HOLD_KEYS`.
- **Não altera a tela.** Fazer a tela refletir materialmente a doutrina (fixar/pré-selecionar `payer_identity_residence`, ou recusar as demais bases em linha `regional_fund`) é **execução material**, sujeita a GATE + GO + auditoria independente própria. Redigir a doutrina não a implementa.
- **Não decide** expansão para cidades além do piloto, governança por votação do fundo, nem percentual por categoria de marketplace — todas permanecem abertas.

---

## D7 — ENFORCEMENT FUTURO (não autorizado aqui)

Quando houver GO material próprio, o enforcement desta doutrina deve ser **estrutural, não documental**: uma policy com `line_type='regional_fund'` e `regionalOriginBasis` diverso de `payer_identity_residence` só pode existir se **uma decisão soberana nomeada a autorizar expressamente** — e o desvio deve ser visível, nunca silencioso.

Consistente com DECISION-0166 D6 (*"admin configura policy; admin NÃO move dinheiro"*): esta doutrina restringe **o que o admin pode configurar**, e não introduz nenhuma capacidade nova de mover dinheiro.

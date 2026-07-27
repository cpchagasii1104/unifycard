# DECISION-0192 — DOUTRINA DO SUJEITO TERRITORIAL DO FUNDO REGIONAL (o comprador financia a própria comunidade)

**Data:** 2026-07-27 · **Status:** REDIGIDA — DOUTRINA DECIDIDA POR CLAYTON; AGUARDANDO AUDITORIA INDEPENDENTE ANTES DE QUALQUER ENFORCEMENT MATERIAL. **NÃO-SELADA. SELF-SEAL NÃO PERMITIDO.**
**Base:** HEAD `229652a9d7f05e8a30a46037858251a8098ab5fe` (branch `rescue-structural`). Denominador NÃO-STALE.
**Modo:** DOCS-ONLY · ZERO CÓDIGO/MIGRATION/GUARD/BANCO · PORTA-1 FECHADA · não semeia policy · não autoriza execução material.
**Deriva de / subordinada a:** [[DECISION-0049]] (`regionalOriginBasis`) · [[DECISION-0166]] D2/D3/D6 (nível territorial; admin configura policy, admin não move dinheiro) · [[DECISION-0177]] D2/D6 (sujeito territorial = Actor comprador, escopo estreito) · [[DECISION-0048]] (categoria seleciona policy, não calcula split) · Lei 5 · Lei 7 · Artigo V · Artigo XI.
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

Canonicamente: para toda linha de policy com `line_type='regional_fund'`, o valor doutrinário de `regionalOriginBasis` é **`payer_identity_residence`** (`economic-policy.types.ts:114-121`).

**Justificativa registrada (Artigo XI):** a fatia regional existe para que o consumo de uma comunidade retorne a essa comunidade. Ancorar no comprador significa que o dinheiro fica **onde o consumo aconteceu** — o município cuja população movimenta a plataforma é o município que capitaliza. A base alternativa (`receiver_identity_residence`) reforçaria regiões que exportam trabalho, e é uma tese legítima, **mas não é a tese desta plataforma**.

**Consequência distributiva assumida conscientemente:** cidades com maior consumo capitalizam mais rápido que cidades com maior produção. Esta assimetria é **escolhida**, não acidental, e qualquer correção futura (equalização inter-regional, piso por cidade) é frente própria com decisão própria — **não** se obtém trocando `regionalOriginBasis` caso a caso.

---

## D2 — RELAÇÃO COM A DECISION-0177 (generalização, não contradição)

A DECISION-0177 D2/D6 já fixou o sujeito territorial como **Actor comprador**, porém **com ressalva explícita de escopo estreito**: valia para a combinação selada `regional_fund` × `commission_distributable` na campanha B-CITY-2, e **não** como regra geral.

Esta decisão **generaliza aquele precedente para toda policy**, na mesma direção. Não há reversão nem conflito: a 0177 permanece vigente no seu escopo, e a 0192 estende o mesmo critério ao universo que a tela de administração agora torna livremente criável.

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

Registra-se, portanto, que **não existe piso para o fundo regional nem teto para a taxa da plataforma**, e que **essa ausência é uma decisão, não uma lacuna**. Nenhuma auditoria futura deve tratá-la como esquecimento a ser "corrigido" por conta própria; instituir piso ou teto exige **decisão soberana nova e expressa**.

A única invariante econômica que permanece obrigatória e materialmente travada é a **soma exata de 10000 bps** (`assertPolicyLinesValid`), porque não fechar 100% não é liberdade — é incoerência contábil que zeraria ou negativaria a fatia do prestador **no momento do pagamento real**, e não na configuração.

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

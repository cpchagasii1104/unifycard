# DECISION-0169 — Onboarding/Sugestão de Templates Fiscais por CNAE/Segmento: desenho normativo (Fase B-0 da F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION)

- **Status:** RATIFICADA (docs-only) — GO B-0 de Clayton em 2026-07-10. **NÃO autoriza implementação:**
  a Fase B material só abre com GO próprio, depois desta RFC; Fases C/D e 4d-1 seguem trancadas.
- **Data:** 2026-07-10
- **Autoridade:** Clayton (soberana), seguindo recomendação da Yala do selo da Fase A ("a Fase B é a
  primeira superfície viva de sugestão/onboarding — exige norma antes de código").
- **Predecessoras:** DECISION-0168 (templates fiscais = draft/sugestão) · DECISION-0167 (motor lê SÓ
  configuração ativa) · DECISION-0117 E (business_templates + aplicação auditável) · Fase A SELADA
  (`4637f85fa`: freeze R1 + business_template_fiscal_profiles/items vazias).
- **Substrato que esta RFC COMPÕE (tudo já existe; nada novo é criado aqui):**
  `businessTemplatesService.listActiveTemplates/recommendForCompany/applyTemplate/customizeApplication`
  (vivo, rota montada) · `company_template_applications` (aplicação auditável) ·
  `business_template_fiscal_profiles/items` (Fase A, vazias) · `fiscal_identity_economic_activities`
  (CNAEs reais, is_primary, source, fetched_at) · `cnae_concept_suggestions` (CNAE→concept com
  confidence/rationale/source/catalog_version/review_status) · `taxCatalogRepository` (leitura de regras
  ativas do tenant) · `assertCompanyTemplateAuthority` (autoridade existente).

---

## §1 — FONTES DE SUGESTÃO (quem pode sugerir template)

Fontes governadas, em ordem de força probatória:
1. **Escolha manual da empresa** por segmento (lista de templates ativos — `listActiveTemplates`, vivo).
2. **Sugestão por `company_type`** (o `recommendForCompany` VIVO já faz: casa `companyTypeSlug` da
   composition com o tipo cadastral da empresa).
3. **Sugestão por CNAE PRIMÁRIO** (`fiscal_identity_economic_activities.is_primary = true`) — a mais
   defensável: é o que a empresa declarou ao governo.
4. **Sugestão por CNAE SECUNDÁRIO** — força menor; nunca sozinha decide.
5. **Ponte `cnae_concept_suggestions`** (CNAE→concepts→templates cujas composições referenciam esses
   concepts) — sempre carregando confidence/rationale/source/review_status.
6. **Curadoria manual futura** (contador parceiro/consultoria — DECISION-0168 §9).

**REGRA DURA (§1.R): SUGESTÃO NÃO É APLICAÇÃO.** Nenhuma fonte — nem CNAE primário com confidence
máxima — aplica template automaticamente. Sugestão produz uma LISTA RANQUEADA com motivo; aplicar é
ATO explícito de um humano autorizado (§2). O padrão já é lei na 0117 E ("aplicação MANUAL-ASSISTIDA;
nunca auto-aplica") — esta RFC o estende à dimensão fiscal sem exceção.

## §2 — AUTORIDADE (quem pode aplicar como draft)

- **Representante autorizado da empresa** — via `assertCompanyTemplateAuthority` (EXISTENTE no
  business-templates.service; nenhuma autoridade paralela nasce).
- **Contador/actor autorizado** — pela MESMA fachada de autoridade do sistema (canRepresentActor/
  delegação §4.9 quando o vínculo contador-empresa existir como delegação governada); não se cria
  atalho "perfil contador" fora da authority.
- **Admin governado futuro** — só quando o painel admin existir (Fase 5 da frente fiscal, D6/D8),
  pela mesma fachada.
**PROIBIDO:** criar verificação de autoridade nova/paralela para o fluxo de template fiscal.

## §3 — APLICAÇÃO (continua em `company_template_applications`)

A aplicação CONTINUA usando `company_template_applications` — nenhuma tabela paralela de "aplicação
fiscal". Já registra: company_id, template_id, template_version_id, applied_by_actor_id, applied_at,
status (applied/superseded), customizations.

**Campos que FALTAM hoje (proposta ADITIVA para a Fase B material — NÃO implementar agora):**
- `recommendation_origin` TEXT CHECK IN ('manual', 'company_type', 'cnae', 'accountant', 'admin') —
  de onde veio a recomendação que levou à aplicação;
- `recommendation_confidence` TEXT NULL + `recommendation_rationale` TEXT NULL — obrigatórios quando
  origin='cnae' (herdam o vocabulário de curadoria de `cnae_concept_suggestions`).
Migração aditiva, forward-only, sem tocar linhas existentes (origin legado = NULL honesto).

## §4 — DRAFT FISCAL / CHECKLIST (a fronteira dura da Fase B)

**A Fase B NÃO ESCREVE em `tax_types`, `tax_rules` nem `actor_fiscal_profiles`. Nunca.**

O que a Fase B produz é READ-MODEL derivado (descartável, recomputável — SSOT §7):

```
template fiscal PUBLICADO (business_template_fiscal_profiles/items, casado por território §8)
+ aplicação do template pela empresa (company_template_applications)
+ configuração fiscal ATIVA existente do tenant (tax_rules via taxCatalogRepository — leitura)
= pendências/sugestões (checklist)
```

Exemplo canônico:
```
Template publicado sugere: tributo municipal de serviço (tax_suggestion, scope city, actor)
Empresa aplicou o template; tenant NÃO tem regra ativa correspondente
→ pendência: "validar [tributo] com seu contador"
```
NUNCA:
```
Template sugere tributo → sistema cria tax_rule automaticamente   ← PROIBIDO (é a Fase C, com contador)
```
Correspondência sugestão↔regra ativa (para saber se a pendência está "coberta") é HEURÍSTICA DE
EXIBIÇÃO por dimensões governadas (scope_level + taxpayer_kind + território + concept quando houver) —
nunca vínculo persistido de FK entre template e tax_rule (impossível por design: global × tenant).

## §5 — `fiscal_config_missing` DURANTE A FASE B

Até a ativação validada (Fase C): o motor fiscal (4d, quando existir) continua vendo
`fiscal_config_missing` — template aplicado NÃO é configuração; o PDV NÃO mostra provisão estimada
"real" (nem "do template" — seria invenção, D9.2); o painel PODE (e deve) mostrar PENDÊNCIA com o
aviso "modelo de referência, requer validação — fale com seu contador".

## §6 — CNAE COMO PONTE DEFENSÁVEL (nunca adivinhação)

Cadeia canônica: `fiscal_identity_economic_activities` (o CNAE REAL, com is_primary/source/fetched_at)
→ `cnae_concept_suggestions` (CNAE→concepts, com curadoria) → concepts → templates cujas composições
referenciam esses concepts. TODA sugestão derivada de CNAE carrega: source · confidence · rationale ·
review_status · data/versão do catálogo. **PROIBIDO** inferir fiscalidade de slug/nome de navegação
("açougue" não infere nada — N2 §3.2); a única ponte é o dado fiscal REAL da empresa (CNAE) por
mapeamento CURADO.

## §7 — DESEMPATE E MÚLTIPLAS SUGESTÕES (regra: nunca autoaplicar)

| Situação | Comportamento |
|---|---|
| Vários CNAEs | primário pesa mais; secundários entram como alternativas ranqueadas |
| CNAE primário × secundário conflitantes | apresentar ambos com motivo; empresa escolhe |
| company_type ≠ CNAE | apresentar os dois com origem explícita ("seu cadastro diz X; seu CNAE diz Y"); NUNCA resolver silenciosamente |
| Vários templates possíveis | lista ranqueada (CNAE primário > company_type > CNAE secundário > manual), cada um com motivo |
| Confidence baixa (review_status ≠ aprovado ou confidence fraca) | exibir como "sugestão fraca", nunca no topo, nunca pré-selecionada |
| Template sem fiscal_profile PUBLICADO | template comercial segue aplicável; superfície diz "sem modelo fiscal publicado para este template/território" — ausência honesta, não bloqueio |
| Território incompatível | §8 |
Em TODOS os casos: apresentar opções e pedir escolha/validação humana. Zero autoaplicação.

## §8 — TERRITÓRIO (filtro e fallback DE EXIBIÇÃO)

O fiscal_profile publicado tem território de validade (Fase A). Resolução para a empresa: pela
jurisdição CADASTRAL dela (Location Core — mesmo D0 da frente fiscal), do específico ao amplo:
**city → state → country**. Se não houver publicado para a cidade, cair para o estadual; depois o
nacional; se nada: **"sem template fiscal publicado para este território"** (ausência honesta).
**O fallback é DE EXIBIÇÃO/sugestão — fallback NUNCA vira regra fiscal ativa**; a regra ativa nasce
só na Fase C, com o contador validando exatamente o que vale para AQUELA empresa naquele território.

## §9 — ESTADOS DO ONBOARDING (vocabulário conceitual governado)

`no_template` → `suggested` (há sugestões, nada aplicado) → `applied_draft` (template aplicado via
company_template_applications) → `fiscal_pending` (aplicado + template fiscal publicado existe +
pendências abertas) → `partially_validated` (algumas sugestões cobertas por regras ativas) →
`ready_for_activation` (contador revisou, pronto para ativar) → `activated_by_accountant`.
**`activated_by_accountant` PERTENCE À FASE C** — a Fase B material implementa no máximo até
`ready_for_activation`. Estados são READ-MODEL derivado (recomputável), não coluna de verdade — a
verdade continua nas tabelas canônicas (aplicações + regras ativas).

## §10 — SUPERFÍCIE FUTURA (read-models; SEM rota/admin/frontend nesta fase)

Lista de templates sugeridos (com ORIGEM e MOTIVO de cada) · checklist fiscal · pendências ·
sugestões COBERTAS por regras ativas · regras FALTANTES · alerta "fale com seu contador" ·
distinção visível entre template COMERCIAL aplicado e template FISCAL publicado/pendente ·
estado do onboarding (§9). Tudo derivado, tudo com o rótulo da 0167 §9.

## §11 — RELAÇÃO COM A FASE C (contrato de fronteira)

A Fase C é a ÚNICA que transformará sugestão em `tax_type`/`tax_rule` DO TENANT — pela via canônica
`taxCatalogRepository.createDraftRule` → `activateRule`, com `source` contendo: template (slug) +
versão + fiscal_profile (id) + validador (actor) + data. Nenhum outro caminho de escrita existirá; o
guard da Fase A (T5) já morde superfícies de template escrevendo no catálogo — a Fase C nascerá como
serviço PRÓPRIO de ativação, fora das superfícies de template, e o guard será estendido para
permitir SÓ esse serviço.

## §12 — RELAÇÃO COM A FASE D / PDV

Preview do PDV depende de configuração ATIVA e/ou motor (4d): sem ativação → PDV mostra só PENDÊNCIA;
sem motor 4d → não há provisão calculada de espécie alguma; **template NUNCA é usado diretamente
para estimativa fiscal** (nem "estimativa preliminar" — o guard T5 e a allowlist 0167 §3 já o impedem).

## §13 — RISCOS BLOQUEADOS POR ESTA RFC (cada um com o anticorpo)

| Risco | Anticorpo |
|---|---|
| Template virar regra fiscal automática | §1.R + §4 (read-model only) + guard T5 vivo |
| CNAE virar certeza absoluta | §6/§7: confidence/review_status sempre; primário pesa, nunca decide sozinho |
| company_type virar verdade fiscal | §7: origem explícita, conflito exposto, humano escolhe |
| category/N2 virar identidade fiscal | §6 (N2 §3.2) + guard Fase A (category proibida na casa) |
| Template escrever em tax_rules | §4/§11 + guard T5 (mutation M13 provada) |
| Motor 4d ler template | 0167 §3 + guard T5 (mutation M12 provada) |
| Painel mostrar imposto estimado sem regra ativa | §5/§12 (pendência sim; número nunca) |
| Contador removido do processo | §2/§11: ativação SÓ com validador humano; Lei do Contador (D9.1) |
| Empresa achar que sugestão é apuração oficial | rótulos obrigatórios §5/§10 + 0167 §9 |

## §14 — ESCOPO NEGATIVO DESTA RFC (B-0)

Docs-only: zero código, migration, seed, template real, mapeamento CNAE real; zero mudança em
company_template_applications/business_templates/tax_types/tax_rules/actor_fiscal_profiles; Fases B
material/C/D e 4d-1 NÃO abertas; zero Bank/PDV/frontend/admin/rotas/internet/crawler.

## §15 — SEQUÊNCIA SUGERIDA PARA A FASE B MATERIAL (sem abrir)

B-1: colunas aditivas de recomendação em company_template_applications (§3) + serviço de sugestão
(read-only: ranqueia fontes §1 com motivo, resolve território §8) — zero escrita fiscal.
B-2: checklist read-model (§4) + estados derivados (§9 até ready_for_activation).
Cada uma com GATE §2.3.2 + GO + Yala. Fase C e D ficam para depois, com a C condicionada ao desenho
do serviço de ativação (extensão consciente do guard T5).

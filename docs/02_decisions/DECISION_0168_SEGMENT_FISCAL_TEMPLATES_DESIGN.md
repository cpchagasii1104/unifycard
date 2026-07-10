# DECISION-0168 — Modelos Fiscais por Segmento (templates fiscais governados): desenho normativo (Fase 4d-0A)

- **Status:** RATIFICADA (docs-only) — GO 4d-0A de Clayton em 2026-07-10. **NÃO autoriza implementação**
  (schema/tabela/seed/motor = frentes futuras com GO próprio; 4d-1 segue trancada por D9.7).
- **Data:** 2026-07-10
- **Autoridade:** Clayton (soberana) — ideia original dele ("modelos pré-moldados por segmento, como o
  marketplace"), lapidada com a trava: template = base sugerida, NUNCA verdade fiscal automática.
- **Predecessoras:** DECISION-0167 (motor de provisão, 4d-0) · DECISION-0166 D0–D9 · DECISION-0117 E
  (templates empresariais versionados — substrato central desta decisão) · Fases 4a/4b/4c SELADAS.

---

## §0 — ACHADO DO READ-FIRST: O SUBSTRATO JÁ EXISTE (esta decisão COMPÕE, não cria camada nova)

O GATE desta decisão (D9.4 anti-verdade-paralela) encontrou que a "Etapa 1" da ideia **JÁ ESTÁ
CONSTRUÍDA E SEEDADA**, e que três noções de "segmento" já vivem no repo:

1. **`business_templates` + `business_template_versions` + `company_template_applications`**
   (DECISION-0117 E, migration `20260611170000`): templates empresariais CANÔNICOS, VERSIONADOS
   (versão imutável — mudar = nova versão), composição por REFERÊNCIA a slugs governados (nunca
   cópia), aplicação MANUAL-ASSISTIDA e AUDITÁVEL (quem aplicou, quando, qual versão, customizações;
   status applied/superseded). Seeds vivos: `supermercado-completo`, `distribuidora-de-bebidas`,
   `salao-servicos`. **Este é o esqueleto da ideia do Clayton — já com a doutrina certa.**
2. **`company_types` + `company_type_allowed_concepts` + `company_type_service_categories`**: tipo
   cadastral da empresa + concepts permitidos por tipo.
3. **`business_segments`** (SPRINT 81, módulo `business-segment` — reconciliado na 4b): perfil
   OPERACIONAL (COMMERCE/CLINIC/SALON/BAR_RESTAURANT/SERVICES) que define módulos visíveis; já
   documenta "segmento ≠ permissão, nenhuma lógica automática".
4. **Ponte CNAE já existe com curadoria:** `fiscal_identity_economic_activities` (CNAEs reais da
   empresa, ancorados na identidade fiscal) + `cnae_concept_suggestions` (CNAE→concept com
   confidence/rationale/source/catalog_version/review_status).

**DECISÃO ESTRUTURAL CENTRAL (D-0):** a camada fiscal por segmento NASCE COMO FACETA/EXTENSÃO de
`business_templates` — **não** como 4ª noção de segmento, **não** como tabela solta de "segmento
fiscal". Um template de negócio ganha, em fatia futura, uma composição fiscal SUGERIDA ao lado da
composição comercial que já tem. Criar vocabulário paralelo de segmento = REPROVA.

**Refinamento à ideia original (aceito pela lógica do próprio Clayton):** a intuição "é a mesma
coisa perante o governo" aponta, no mundo real, para o **CNAE** — não para o nome do segmento. Duas
"mecânicas" são iguais perante o governo na medida em que compartilham CNAE+regime+território. Por
isso a sugestão de template no onboarding deve poder DERIVAR do CNAE da empresa (que já está em
`fiscal_identity_economic_activities`), usando `cnae_concept_suggestions` como ponte — o segmento
"açougue" vira um apelido navegável do que o CNAE já diz.

## §1 — NOME DA CAMADA (nomenclatura canônica)

- **Camada comercial (existente):** `business_templates` (DECISION-0117 E) — mantém o nome.
- **Faceta fiscal (nova, futura):** **`business_template_fiscal_profiles`** — em português:
  **"Modelos Fiscais por Segmento"**. Referencia `business_template_versions` (FK), versionada e
  imutável como a irmã comercial.
- **PROIBIDO** confundir com: `categories`/N2 (navegação), `concepts` (identidade semântica),
  `actor_fiscal_profiles` (verdade do contribuinte), `tax_rules` (verdade da regra),
  `business_segments` (perfil operacional de módulos). Cada um segue com seu papel; o template
  fiscal só REFERENCIA.

## §2 — O QUE UM TEMPLATE PODE CONTER (tudo como SUGESTÃO/draft, por referência)

**Comercial (já existe na composition da 0117 E):** concepts de produtos/serviços sugeridos ·
estrutura inicial de catálogo · categorias/N2 de navegação · módulos (PDV/estoque/agenda) · campos
de cadastro · unidades de medida/variações.

**Fiscal (a faceta nova):** checklist fiscal do segmento ("normalmente este segmento configura X, Y,
Z") · `tax_types` sugeridos (por nome/esfera, como REFERÊNCIA) · `tax_rules` sugeridas EM DRAFT
(estrutura, nunca ativa) · `platform_revenue_streams` aplicáveis · relatórios recomendados · campos
obrigatórios de onboarding fiscal · alertas de `fiscal_config_missing` esperados · classificações
fiscais futuras prováveis (NCM/LC116/CNAE/VAT — quando o mapeamento formal existir, DECISION-0167
§11) · regime(s) fiscal(is) TÍPICOS do segmento (informativo).

**Regra de referência:** cada item de catálogo sugerido aponta para `concepts` (nunca categoria
solta, nunca texto livre); cada item fiscal aponta para o vocabulário governado da 4c
(tax_types/tax_rules/streams) — o template é um GRAFO DE REFERÊNCIAS, nunca uma cópia nem uma
segunda definição.

## §3 — O QUE UM TEMPLATE NÃO PODE FAZER (proibições explícitas, viram guard na materialização)

Template **NÃO**: ativa imposto sozinho · inventa alíquota · cria regra fiscal ATIVA sem validação ·
altera `actor_fiscal_profiles` · substitui contador · emite nota fiscal · apura imposto · recolhe
imposto · move dinheiro · cria saldo · toca Bank/ledger/split · sobrescreve configuração ativa da
empresa · cria concept novo sem governança · usa category/N2 como verdade semântica ou fiscal
(N2 §3.2: `if (n2.slug === 'acougue') → assumir 'carne'` é o exemplo PROIBIDO pela própria norma) ·
vira SSOT de coisa alguma.

**Hierarquia imutável:** template = molde/sugestão/pré-configuração. A verdade operacional é e
continua sendo: `actor_fiscal_profiles` + `fiscal_identities` + `tax_types`/`tax_rules` ATIVAS +
`concepts` + Location Core + policy versionada + Bank/ledger quando houver dinheiro.

## §4 — FLUXO FUTURO (conceitual; cada passo em fatia própria)

1. Empresa nasce/cadastra e escolhe o segmento — **OU o sistema SUGERE o template a partir do CNAE**
   da `fiscal_identity` dela (ponte `cnae_concept_suggestions`, com confidence/curadoria).
2. Sistema aplica o modelo como **DRAFT** (via `company_template_applications`, que já é auditável:
   quem, quando, qual versão, customizações).
3. Sistema sugere: catálogo comercial, concepts, checklists, possíveis regras fiscais, pendências.
4. Empresa/contador REVISA ("este imposto se aplica" / "esta regra não" / "esta alíquota ajusta" /
   "este produto reclassifica").
5. Empresa/contador ATIVA → **a ativação escreve pela via canônica que JÁ EXISTE**: cria
   `tax_rules` tenant-scoped em DRAFT via `taxCatalogRepository.createDraftRule` e ativa via
   `activateRule` (rito draft→activate, versionado, imutável, com `configured_by_actor_id` e
   `source` = "template X v.N validado por [contador]"). **Nenhum caminho de escrita novo.**
6. PDV/produtos/serviços passam a usar a CONFIGURAÇÃO ATIVA (nunca o template cru).
7. O motor 4d (DECISION-0167) lê SOMENTE configuração ativa — o template NUNCA entra na allowlist
   de fontes do §3 da 0167. Template aplicado ≠ configurado: enquanto o contador não ativar,
   `fiscal_config_missing` continua verdadeiro e honesto.

## §5 — TEMPLATE COMERCIAL × TEMPLATE FISCAL (separação dura)

| | Comercial | Fiscal |
|---|---|---|
| Sugere | produtos/serviços (concepts), navegação, PDV, estoque, unidades, variações | checklist de impostos, tax_types/tax_rules em draft, classificação provável, regime esperado, documentação, alertas |
| Vira | catálogo da empresa (quando aplicado) | configuração fiscal ATIVA só após contador |
| NUNCA | carrega alíquota | vira produto/concept |

Catálogo comercial não carrega alíquota (padrão de referência P4 da base conceitual da 0167);
template fiscal não vira produto; template de segmento não vira concept.

## §6 — EXEMPLOS CONCEITUAIS (ilustrativos; NÃO são seed)

**Açougue** — concepts sugeridos: carne bovina, carne suína, aves, embutidos, frios (a composição
comercial do `supermercado-completo` já referencia `marketplace-carnes-aves` — o recorte "açougue"
é um template novo REUSANDO as mesmas referências). Fiscal: checklist "regras variam por
regime/estado/cidade; ICMS de alimentos tem tratamento por produto/região — valide com contador";
zero alíquota no template.

**Hortifruti** — concepts: frutas, verduras, legumes, orgânicos (referências já existentes em
`marketplace-hortifruti`). Fiscal: "pode haver isenção/redução por produto/região; template só
orienta".

**Mecânica** — concepts: serviço de mão de obra, venda de peça, troca de óleo, diagnóstico,
manutenção preventiva. Fiscal: **separar serviço (ISS/LC116) de venda de peça (ICMS/NCM)** — a
mesma OS pode ter os dois; nota de serviço ≠ nota de produto; contador valida. Este exemplo é o
que PROVA por que template não pode calcular: serviço-com-peça-inclusa vs peça-separada muda a
incidência e SÓ a operação concreta + contador decidem.

**Transportadora (opcional/futuro)** — frete, coleta, entrega, logística, cargas; regras por
origem/destino; FORA da v1: retenções específicas e documentos fiscais de transporte (CT-e).

## §7 — RELAÇÃO COM O MOTOR 4d (DECISION-0167)

- O motor **NÃO lê template** — template NÃO entra na allowlist de fontes (0167 §3), nem cru nem
  "resolvido". O motor lê `tax_rules` ATIVAS do tenant, ponto.
- Template ajuda a MONTAR a configuração; a configuração é a verdade.
- `fiscal_config_missing` permanece válido e honesto se o template não foi validado/ativado.
- Template sem ativação NÃO gera provisão fiscal — nem estimativa "do template" (estimativa sem
  regra ativa seria invenção, D9.2).

## §8 — RELAÇÃO COM PDV E PRECIFICAÇÃO (visão futura, sem implementar)

PDV/painel podem mostrar: se a empresa usa template validado (e qual versão) · pendências fiscais ·
regras em draft vs ativas · impacto estimado na margem · provisão estimada (motor 4d, rótulo da
0167 §9). Sem configuração validada: **"fiscal_config_missing — valide com seu contador"**. Sempre
read-model derivado; nunca fonte.

## §9 — FONTE E CURADORIA DOS TEMPLATES

Podem criar templates: UnifiCard · contador parceiro · consultoria especializada · empresa
matriz/franquia · comunidade governada (futuro). TODO template carrega: **versão** (imutável;
mudar = nova versão — molde `business_template_versions`) · **fonte** · **autor/responsável** ·
**data** · **território de validade** (FK Location Core — um template fiscal de Curitiba não é o
de Manaus) · **segmento** (referência ao template comercial) · **status** draft/published/deprecated
(rito espelho do sistema: published imutável, deprecated terminal) · aviso fixo: **"modelo de
referência, requer validação"**. Curadoria espelha `cnae_concept_suggestions`
(confidence/rationale/source/review_status) — o padrão de curadoria já existe no repo.

## §10 — ESTRATÉGIA INCREMENTAL (piloto pequeno e controlado)

Não começa com o Brasil todo. Pilotos: **Curitiba + mercado · Curitiba + açougue · Curitiba +
hortifruti · Curitiba + mecânica** (uma cidade, poucos segmentos, produtos limitados, um fluxo de
PDV, poucas regras sugeridas — validação real com contador real). Depois expande por: cidade →
estado → segmento → regime → país. A expansão internacional herda o desenho da 0167 (catálogo por
jurisdição, zero código por país).

## §11 — GAPS DECLARADOS (fora da v1, com lar)

Motor automático de descoberta de legislação na internet (crawler fiscal) · integração
Receita/SEFAZ/prefeituras · NF-e/NFC-e/CT-e · SPED · substituição tributária · retenção na fonte ·
CNAE automático (a ponte manual-curada existe; automatizar é futuro) · NCM/LC116 automático ·
marketplace facilitator · franquias com template central OBRIGATÓRIO (hoje template nunca obriga;
franquia exigirá vínculo de obrigatoriedade governado) · auditoria por contador externo ·
marketplace de templates fiscais (monetização da curadoria). Todos herdam os lares da 0167 §11
quando coincidem.

## §12 — SEQUÊNCIA SUGERIDA (registrada; NENHUMA aberta por esta decisão)

- **4d-0A (esta):** decisão docs-only.
- **F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION:** schema da faceta fiscal (referenciando
  `business_template_versions`), SEM ativação automática, SEM seed de alíquota real (o guard 4c-3
  anti-seed segue mordendo migrations; conteúdo fiscal de template é dado de REFERÊNCIA em tabela
  própria, nunca linha de `tax_rules`).
- **F-SEGMENT-TEMPLATE-ONBOARDING:** aplicar template como draft no onboarding (+ sugestão por CNAE).
- **F-FISCAL-TEMPLATE-ACTIVATION:** contador valida e ativa → escreve pelo rito canônico da 4c-2.
- **F-PDV-FISCAL-PREVIEW:** PDV mostra estimativa (depende do motor 4d-1+, DECISION-0167).
- Cada uma com GATE §2.3.2 + GO próprio. 4d-1 (motor) segue trancada por D9.7 — esta decisão NÃO a abre.

## §13 — ESCOPO NEGATIVO DESTA DECISÃO (4d-0A)

Docs-only: zero schema, zero tabela, zero template real, zero seed, zero alíquota, zero consulta à
internet, zero crawler, zero mudança em tax_rules/actor_fiscal_profiles/business_templates, zero
motor, zero Bank, zero PDV, zero admin, zero marketplace, zero frontend. Guards 4b/4c-3 intactos.

---

## Frase-síntese (a régua desta camada)
> O UnifiCard PODE ter modelos fiscais pré-moldados por segmento — mas eles nascem como TEMPLATES
> GOVERNADOS (versionados, com fonte, com território, com curadoria), nunca como verdade fiscal
> automática. A verdade final é sempre: **empresa + regime + território + concept + regra fiscal
> ativa + versão + validação do contador.** O template dá velocidade; o SSOT dá a verdade; o
> contador muda de papel (de digitador para validador) — mas não desaparece.

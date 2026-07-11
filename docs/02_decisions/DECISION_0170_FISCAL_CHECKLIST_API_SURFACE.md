# DECISION-0170 — Superfície API/Dashboard do Checklist Fiscal: contrato para o MVP (Fase B-3-0 da F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION)

- **Status:** RATIFICADA (docs-only) — GO B-3-0 de Clayton em 2026-07-10. **NÃO autoriza implementação:**
  a B-3 material (rota + consumo no dashboard) só abre com GO próprio sobre este contrato.
- **Data:** 2026-07-10
- **Autoridade:** Clayton (soberana).
- **Predecessoras:** DECISION-0169 (onboarding/sugestão; §9 estados, §10 superfície futura) · B-1 SELADA
  (`504d4016e`) · B-2 SELADA (`fb2cee5fa` — read-model `businessTemplateChecklistService` VIVO, backend-only,
  sem rota) · DECISION-0168/0167/0117 E.
- **DECISÃO CENTRAL (a régua da fase):**
  ```
  B-2 prepara o dado.   B-3 expõe o dado.   Fase C ativa regra.
  4d calcula provisão.  PDV mostra número fiscal só depois do motor/preview.
  ```
  **B-3 NÃO cria verdade nova** — é projeção fiel do read-model da B-2, com autoridade e rótulos.

---

## §1 — ROTA (contrato futuro; padrão vivo do repo)

- **Path:** `GET /companies/:companyId/fiscal-template-checklist`
  (o plugin `company-templates.routes.ts` já monta em `prefix: '/companies'` — a rota nova vive NELE,
  ao lado de `/:companyId/templates/recommended`; nenhum controller/módulo novo).
- **Verbo:** só GET. Nenhum POST/PATCH/DELETE nasce nesta superfície (escrita de checklist não existe —
  o read-model é derivado e recomputável por definição, 0169 §4/§9).
- **Fonte:** `businessTemplateChecklistService.checklistForCompany(tenantId, companyId)` — a ÚNICA fonte;
  a rota não recompõe, não enriquece, não calcula.
- **Catalogação:** a B-3 material DEVE catalogar a rota no §5 do `backend/docs/API_CONTRACT_GOVERNANCE.md`
  (cadeia contrato→domínio→Fastify→doc, protocolo §2.2.8) — este documento é o contrato de origem.

## §2 — AUTORIDADE (quem lê; nunca público)

- Leitura permitida a: **representante autorizado da empresa** · **contador delegado** (via delegação
  governada §4.9 quando o vínculo existir) · **admin governado futuro** (Fase 5 fiscal). **NUNCA público,
  NUNCA cross-company dentro do tenant.**
- Mecanismo: REUSAR `assertCompanyTemplateAuthority` (a MESMA autoridade que gate-ia o `applyTemplate`) —
  o checklist expõe postura fiscal e pendências da empresa; é no mínimo tão sensível quanto aplicar template.
  Nenhuma autoridade paralela nasce.
- **⚠️ OBSERVAÇÃO HONESTA DO READ-FIRST (tratar na B-3 material):** o GET vivo
  `/:companyId/templates/recommended` hoje é gateado SÓ por tenant (sem checagem de autoridade sobre a
  company). Para o checklist isso é INACEITÁVEL (dado fiscal). A B-3 material deve: (a) nascer com
  autoridade forte na rota nova; e (b) endurecer o `/recommended` no mesmo movimento OU registrar DT
  própria — não herdar o gate fraco em silêncio.

## §3 — PAYLOAD (projeção FIEL do read-model da B-2; nomes reais, nada inventado)

Response 200 = `{ ok: true, data: CompanyFiscalChecklist }`, onde `data` é o shape VIVO da B-2:

```
companyId
onboardingState                     // agregado CONSERVADOR (o menos avançado entre aplicações)
territory { countryId, stateId, cityId }        // jurisdição cadastral (IDs Location Core)
applications[] {
  companyId · templateApplicationId · templateId · templateVersionId · templateSlug
  fiscalProfileId | null            // null = ausência honesta (sem publicado p/ o território)
  territoryMatch: 'city'|'state'|'country'|'none'
  state: OnboardingState
  items[] {
    itemId · itemKind · conceptId? · suggestedTaxCode? · suggestedTaxName?
    taxpayerKind? · scopeLevel? · taxRegime? · baseType?
    status: 'pending'|'covered'|'not_applicable'|'needs_review'
    matchedRuleId | null            // regra ativa que COBRE — só em resposta, nunca persistido
    rationale · warnings[]
  }
  warnings[]
}
disclaimer: 'configuração sugerida — requer validação'      // OBRIGATÓRIO em TODA resposta (const da B-2)
warnings[]                          // inclui FISCAL_PENDING_MESSAGE quando houver pendência
```

Complementos permitidos (vêm de dados JÁ persistidos na B-1, sem cálculo): origem da recomendação da
aplicação (`recommendation_origin` + `recommendation_confidence`/`rationale`/`recommended_from_cnae_code`)
— projeção direta das colunas de `company_template_applications`.

## §4 — O QUE O DASHBOARD PODE MOSTRAR NO MVP

Template sugerido (com ORIGEM: cnae/company_type/manual + confidence/rationale) · template aplicado ·
checklist fiscal · pendências (com `FISCAL_PENDING_MESSAGE`) · itens cobertos (`covered`) · itens que
precisam revisão (`needs_review`) · estado até `ready_for_activation` · alerta "validar com contador" ·
o disclaimer SEMPRE visível junto de qualquer dado fiscal.

## §5 — O QUE O DASHBOARD NÃO PODE MOSTRAR (proibições de superfície)

Imposto calculado · valor de provisão (`provision_cents` NÃO existe no payload e não pode ser derivado
no cliente) · percentual/alíquota como verdade ativa · os termos "imposto oficial"/"tributo apurado"/
"valor a recolher" · botão de ATIVAR imposto (CTA de ação real = Fase C) · criação de tax_rule/tax_type ·
emissão fiscal · integração Receita/SEFAZ · qualquer movimento financeiro. A superfície projeta; nunca age.

## §6 — ESTADOS EXPOSTOS

Somente os 6 do vocabulário da B-2: `no_template` · `suggested` · `applied_draft` · `fiscal_pending` ·
`partially_validated` · `ready_for_activation`. **`activated_by_accountant` é da Fase C** — já está
deliberadamente FORA do vocabulário da B-2 (ONBOARDING_STATES), e o guard da B-3 reafirma: resposta que
o contenha = FAIL.

## §7 — ERROS E AUSÊNCIA HONESTA (nunca inventar imposto)

| Situação | Resposta |
|---|---|
| Sem autenticação | 401 UNAUTHENTICATED |
| Sem autoridade sobre a company | 403 (mesmo código do rito de templates) — sem vazar existência de dados |
| Company inexistente no tenant | 404 |
| Empresa sem template | 200 com `onboardingState: 'no_template'`, `applications: []` (+ sugestões são OUTRA rota — a B-3 não mistura) |
| Sugerido mas não aplicado | 200 `suggested` (estado agregado), applications vazio |
| Aplicado sem fiscal_profile publicado | 200 com `fiscalProfileId: null`, `territoryMatch: 'none'`, warning "sem template fiscal publicado para este território" |
| Sem regras fiscais ativas | 200 `fiscal_pending` + itens `pending` + `FISCAL_PENDING_MESSAGE` |
| Território sem cobertura | idem ausência honesta (nunca fallback que finja cobertura) |
| Configuração incompleta | estados/warnings do read-model — NUNCA número fiscal inventado |

## §8 — RELAÇÃO COM A FASE C

B-3 NÃO ativa imposto; NÃO chama `createDraftRule`/`activateRule`; NÃO escreve NADA. Pode mostrar CTA
TEXTUAL "validar com contador" (sem ação executável). A ação real de ativação — botão, serviço, escrita
pelo rito canônico — pertence à Fase C, com GO próprio e extensão consciente dos guards.

## §9 — RELAÇÃO COM 4d/PDV

B-3 NÃO chama o motor 4d (que nem existe — trancado); NÃO calcula provisão; NÃO alimenta PDV com número
fiscal. PODE ser usada no dashboard/onboarding do MVP (é exatamente o seu propósito: demonstrar valor sem
imposto fake). PDV com estimativa fiscal NUMÉRICA = outra frente, após motor (4d-1+) e preview (Fase D).

## §10 — GUARD DA B-3 MATERIAL (requisitos que a fatia deve provar por mutação)

O guard (extensão do `audit-segment-fiscal-template`, seção T8) deve FALHAR se: a rota escrever qualquer
coisa (INSERT/UPDATE/DELETE) · chamar `createDraftRule`/`activateRule` · tocar `tax_types`/`tax_rules`
(fora da leitura que o read-model da B-2 já faz) · tocar Bank/PDV · retornar `activated_by_accountant` ·
retornar `provision_cents`/valor calculado de imposto · omitir o rótulo `configuração sugerida — requer
validação` (a rota deve projetar o `disclaimer` da B-2, e o guard exige o símbolo) · expor o checklist sem
autoridade (rota sem `assertCompanyTemplateAuthority` = FAIL).

## §11 — ESCOPO NEGATIVO DESTA RFC (B-3-0)

Docs-only: zero código, rota, controller, frontend; serviço B-2 e guards intocados; zero migration/seed/
regra ativa/tax_types/tax_rules; Fases C/D e 4d-1 NÃO abertas; zero Bank/PDV/invoicing/internet.

## §12 — SEQUÊNCIA SUGERIDA (sem abrir)

**B-3 material** (com GO): rota GET + autoridade + catalogação no API_CONTRACT_GOVERNANCE §5 + guard T8 +
mutações + endurecimento (ou DT) do `/recommended` (§2). **Depois:** consumo no dashboard/onboarding do
MVP (frontend — GO próprio, superfície visual). Fases C/D e 4d-1 seguem por GOs próprios.

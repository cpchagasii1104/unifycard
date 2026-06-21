# sistema/perfil — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa PERFIL (PF + PJ): onde o actor declara "eu faço isso". Fonte: IA-ACTOR/IA-TEMPO/IA-BANCO · SELO_A3_2_PROFISSIONAL_C1 · DECISION-0113/0118.

## SSOT de "eu faço isso"
- **PF:** `actor_professional_concepts` (concept_id NOT NULL; `actor_id`; **sem preço**; gated por `canRepresentActor`; GET nunca cria). É o SSOT actor-first correto. Bio = `actor_professional_profiles`. Rowcount vivo = 1.
  - ⚠️ FK `concept_id→concepts` = **NO ACTION (fraca)** → fortalecer p/ RESTRICT (padrão canônico).
- **PJ:** `company_concept_publications` (concept_id; gate `canManageCompany` + KYB approved; satisfaz DECISION-0118 "representação genérica não basta p/ dono de PJ").

## Verdade paralela = GHOST (não amputar — re-acoplar; diretriz Clayton)
- **`user_skills_categories`** = TABELA AUSENTE; rota `POST /categories/assign-skill` MONTADA, faz `INSERT`→42P01. Carregava `hourly_rate`+`category_id` por `global_user_id` (sem `canRepresentActor`). Intento ("eu faço skill") é real → **re-acoplar a `actor_professional_concepts`**, não deletar.

## Agenda declarativa latente
- `professional_profile.availability` (JSONB) = input declarativo, **nunca materializado** em slots reais → DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING (frente própria, fora de F-OFFER).

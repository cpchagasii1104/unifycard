# Contrato de rastreabilidade centrada em actor (norma)

**Tipo:** norma constitucional — define **como o sistema deve comportar-se** em matéria de autoria e responsabilidade.  
**Não é:** checklist de execução, grep nem query. Para verificação operacional por módulo, ver `PLANO_BASE_MODULO.md` §8.9 e pipelines de CI.

**Autoridade normativa principal:** `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8 (Identity / actor âncora / writer) e §4.9 (Authority / delegação).  
**Registo SSOT:** `SSOT_REGISTRY_UNIFICARD.md` §5.1 (Identity / Actor).  
**Precedência civil vs dados:** `IDENTITY_SSOT_PRECEDENCE.md`.

Este contrato **consolida** intenção e vocabulário; em caso de conflito de detalhe, prevalece a **LEI** e o **SSOT_REGISTRY**.

---

## 1. Princípio fundamental

Toda ação de **produto** (criação, mutação relevante, permissão exercida em contexto de tenant) **deve** ser **atribuível** a um **contexto de actor** resolvido pelo modelo normativo: quem actua (`actor_id` operacional), com **autoridade** válida (§4.9), e — onde a norma civil exige — **âncora humana** via `global_user_id` / `identities` e `responsible_actor_id` conforme §4.8.

**Regra de ouro:** se uma ação **não** puder ser explicada com clareza em termos de **actor + authority + (quando aplicável) âncora civil**, **não** deve existir como caminho de produto suportado.

---

## 2. Actor como unidade de responsabilidade operacional

- **`actor_id`** é a unidade mínima de **papel** e de **atribuição operacional** no tenant (quem aparece como sujeito da ação).
- Actores humanos sujeitos a identidade global **devem** estar coerentes com `users` / `global_user_id` / `identities` onde a política e o §6.5 do plano base exigem vínculo civil — ver `PLANO_IDENTITY_RECONCILIATION.md` e invariante global no `PLANO_BASE_MODULO.md` §6.5.
- **Histórico:** desactivação ou alteração de vínculos **não** apaga por si a necessidade de **retenção** e rastreabilidade exigidas por compliance; concretizar em política de dados e DDL (soft-delete, logs), não “apagar civil”.

---

## 3. Duas dimensões obrigatórias: civil vs operacional

| Dimensão | O quê fixa | Norma |
|----------|------------|--------|
| **Responsabilidade civil (âncora)** | Quem responde perante o modelo para entidades não-humanas | §4.8.2 `responsible_actor_id` até actor humano na cadeia |
| **Permissão operacional** | Quem pode executar **P** em nome de **actor A** | §4.9, fachada `authority.service`, mapa canónico de permissões |

**Proibição:** confundir as duas (ver §4.9.2 e SSOT sobre `responsible_actor_id` vs delegação).

---

## 4. Cadeia de responsabilidade e delegação

- Entidades não-humanas relevantes **devem** ter **âncora civil** explícita quando a norma e o DDL assim o exigem (`responsible_actor_id` → humano).
- **Delegação** expande **quem pode agir** sem apagar a âncora: cadeia **rastreável** até actor humano §4.8 — ver §4.9.9 (`actor_origem`, `actor_destino`, escopo, validade temporal, elo anterior).
- **Transferências** de responsabilidade civil ou alterações materiais de vínculo **devem** ser **registadas** (eventos, tabelas de delegação, ou processos auditáveis normados) — **não** “sumir” responsável sem trilho.

---

## 5. Auditoria e imutabilidade (nível de intenção)

- O sistema **deve** tender a modelo **append-only** para factos financeiros e de ledger onde o SSOT já o impõe (Bank).
- Para domínios gerais, a **intenção normativa** é: correções aparecem como **novos** registos ou eventos, não edição silenciosa de factos de auditoria. A **implementação** por tabela ou serviço **varia**; novos agregados de auditoria **exigem** RFC + actualização da LEI/SSOT — **proibido** segundo SSOT paralelo de “quem fez o quê”.

---

## 6. Offboarding e sucessão

- Saída de actor, revogação de permissão ou mudança de responsável **preserva** o histórico exigido por lei e produto; **não** reinterpretar passado apagando trilhos.
- Sucessão de responsáveis **deve** ser **explícita** e **temporalmente ordenada** (sem lacunas de responsável onde a norma de negócio exija continuidade).

---

## 7. Quarentena e risco sistémico

- Bloqueio e quarentena **respeitam** cadeia civil e cascata §4.8.4 (`isActorEffectivelyBlocked`, etc.).
- Risco **propaga-se** pela rede de responsabilidade e authority — **não** tratar entidades como ilhas isoladas quando a norma de risco assim o define.

---

## 8. Excepções normadas (não são “buracos”)

- **Actors de sistema** (`actor_system`, `system`): infraestrutura; **sem** `responsible_actor_id` civil; **não** substituem pessoa física em obrigações civis — §4.8.5.
- **Writer único + excepções de INSERT** em `actors`: apenas as listadas na LEI §4.8.1 (identity.service Gate 0, `actor.repository` sob contrato, testes).
- **Scripts e migrações** não-runtime: §4.8.6 — não abrem atalho em handlers de API.

---

## 9. Proibições absolutas (alinhamento transversal)

- Atribuir identidade civil ou vínculo `global_user_id` por **heurística** de nome, email ou `display_name` (ver reconciliação identity e CP-5).
- **INSERT** em `actors` em runtime fora do writer / excepções §4.8.1.
- Permissão **hardcoded** por módulo sem remeter ao mapa canónico e à fachada de authority (alvo: convergência §4.9.8).
- Apagar ou sobrescrever **histórico auditável** onde a norma ou o compliance exijam retenção.
- Confundir **actor** com substituto de **`identities`** / documento fiscal: actor **opera**; **identities** é autoridade de KYC/documento quando aplicável (`IDENTITY_SSOT_PRECEDENCE.md`).

---

## 10. Relação com execução e CI

| Camada | Papel |
|--------|--------|
| **Este contrato + LEI** | Definem o **deve ser** |
| **`PLANO_BASE_MODULO.md` (ex.: §8.9)** | Greps e checks por módulo / evidência |
| **CI / guards / dependency-cruiser** | Reforço automático onde configurado |

**Versão:** 1.0 — alinhada ao repositório à data de criação; evoluções **devem** actualizar este ficheiro ou a LEI por RFC explícita.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- IDENTITY_SSOT_PRECEDENCE.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT.md
- 00_INDEX.md
- SSOT_REGISTRY_UNIFICARD.md
<!-- AUTO-GENERATED-END -->
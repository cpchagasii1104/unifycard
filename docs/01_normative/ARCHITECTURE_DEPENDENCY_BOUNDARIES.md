# Fronteiras de dependência (código) — Unificard Backend

**Papel:** traduzir a lei (§4.6–4.7 Bank, §4.8 identity, §4.9 authority) em **regras de grafo de imports** executáveis por ferramentas (`dependency-cruiser`, ESLint `no-restricted-imports`, CI).

**Precedência:** `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` > este documento > configuração da ferramenta. Em conflito, prevalece a lei.

**Estado da ferramenta no repo (hoje):**

- Existe `backend/.dependency-cruiser.cjs` com regras **parciais** (ex.: tipos `canonical-product-db`, camadas `core/*`, DDD do `marketplace`).
- Scripts `pnpm arch:marketplace:validate` e `pnpm arch:core:validate` analisam **subconjuntos** de `src/` — **não** cobrem o backend inteiro nem todas as fronteiras abaixo.
- `scripts/validate-architectural-rules.ts` valida contratos de **perfil vs write-side**, não o grafo completo de módulos.

Ou seja: **há enforcement técnico inicial**, mas **não** equivale a “arquitetura totalmente travada”.

---

## 1. Mapa de pastas (referência)

| Zona | Caminho típico | Papel |
|------|------------------|--------|
| Kernel | `src/core/` | Pool, tenants, ports, authorization, identity utils, orquestração transversal |
| Features | `src/modules/*` | Domínios de produto (social, bank, marketplace, …) |
| Bank (SSOT valor) | `src/modules/bank/` | SQL e serviços canónicos de contas, ledger, transações, splits (§4.6) |
| Social / actor persistido | `src/modules/social/` | `actor.repository` e adjacências |
| Writer identity | `src/modules/identity/actor-writer.service.ts` | Única criação de actors em runtime (§4.8) |
| Scripts | `src/scripts/` | Não são runtime da API; regras podem ser relaxadas ou separadas no `pathNot` da ferramenta |

---

## 2. Regras alvo (ordem sugerida de endurecimento)

Cada regra tem: **intenção**, **from → to**, **nota sobre o estado atual**.

### R1 — Bank: repositórios não são biblioteca de outros módulos

- **Intenção:** Fora de `src/modules/bank/`, **proibido** importar ficheiros `bank-*-repository.ts` (ou equivalente). Outros módulos usam **serviços** do Bank (`bank-*-service.ts`) ou ports registados, não SQL direto (alinhado a §4.6–4.7 e SSOT §5.2–5.5).
- **from:** `^src/modules/(?!bank/).*`
- **to:** `bank-.*\\.repository\\.(ts|js)$`
- **Estado atual:** **violações existentes** (ex.: rotas/serviços que importam `bank-account.repository`). Tratar como **dívida**: fase 1 = `warn` + lista de exceções temporárias; fase 2 = `error` após refactor.

### R2 — Bank: serviços podem ser consumidos; preferir superfície estável

- **Intenção:** Importar `bank-*-service.ts` ou helpers explícitos (`financial-authorship.helper`, tipos) a partir de `modules/*` é **permitido** enquanto não existir fachada única exposta via `bankPortsRegistry` para todos os casos.
- **Ferramenta:** não forbir por padrão; documentar como **direção permitida** (features → bank services).

### R3 — Identity: criação de actors

- **Intenção:** Fora de `modules/social` (persistência), `modules/identity` (writer), `core/identity` (Gate 0) e adapters de ports, **proibir** imports que terminem em `actor.repository` **para chamadas que criam** actors — a ferramenta só vê imports estáticos; por isso a regra prática é:
  - **Alvo forte:** nenhum `INSERT INTO actors` fora dos ficheiros normados (já coberto por grep/CI humano).
  - **Alvo grafo (opcional):** `forbid` de `findOrCreateUserActor` / `findOrCreatePageActor` fora de `actor-writer` + `actor.repository` + testes — exige AST ou convenção de import; pode ficar para fase posterior.

### R4 — Authority (§4.9)

- **Intenção:** Decisões `canActAs` / resolução de permissão **não** devem ser duplicadas em módulos como cópia de matrizes; a **fonte** é `authorization.service` (ou fachada única futura). Regra de grafo **fraca** (revisão + grep): novos ficheiros em `modules/*` não devem definir mapas paralelos de `PermissionKey` sem atualizar `permission-keys` / mapa canónico.
- **Ferramenta:** difícil sem convenção de naming; priorizar **auditoria** (N1) antes de `forbid`.

### R5 — Core não depende de rotas de modules

- **Intenção:** `src/core/**` não importa `*.routes.ts` sob `src/modules/`.
- **Estado:** reforço de regras já no espírito do `core-services-no-routes`; pode generalizar no `.dependency-cruiser.cjs`.

### R6 — Marketplace DDD (já no cruiser)

- Manter regras existentes `domain/application/routes` em `modules/marketplace`.

---

## 3. Integração CI (recomendado, evolutivo)

1. **Curto prazo:** manter `arch:marketplace:validate` e `arch:core:validate` no CI.
2. **Médio prazo:** adicionar `depcruise src --include-only "^src" -c .dependency-cruiser.cjs` com regras novas em **warn** e baseline de exceções.
3. **Longo prazo:** elevar R1 (e outras) a **error** quando a dívida de imports a repositórios Bank estiver zerada.

---

## 4. Relação com prompts operacionais

- **Authority (código):** `CURSOR_PROMPT_AUTHORITY_LAYER.md` — fases N1–N4; após N2 estável, aplicar endurecimento R1/R4 aqui.
- **Identity:** `CURSOR_PROMPT_ACTOR_IDENTITY.md` — grep de `INSERT INTO actors` continua complementar ao grafo.

---

## 5. Anti-padrões (explícitos)

- Introduzir `dependency-cruiser` com **centenas de violações** em `error` no dia 1 → trava o repo.
- Substituir revisão de domínio por regra automática **sem** alinhar à lei (SSOT / §4.9).
- Excluir `src/scripts` das regras de produto **sem** documentar — scripts podem importar repositórios para backfill; rotas Fastify **não**.

---

*Documento vivo: atualizar quando `.dependency-cruiser.cjs` ou a lei mudarem.*

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- SSOT_REGISTRY_UNIFICARD.md
<!-- AUTO-GENERATED-END -->
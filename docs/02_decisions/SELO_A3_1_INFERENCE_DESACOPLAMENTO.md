# SELO A3.1 — Desacoplar inference do serviço profissional legado morto

## A3.1 BACKEND — SELADA (2026-05-31)
Selada por Clayton. Fatia backend de execução do DESENHO_A3 promulgado (`c6830926`).
**Encerrada formalmente no commit `526b1c6f`.**

### Escopo único
`backend/src/core/profile/profile-inference.service.ts` (+2/-1).

### Mudança
Desacoplamento de `getUserProfileSnapshot` do serviço profissional legado morto (tabelas
`user_skills_categories` etc. ausentes no schema vivo), que rejeitava dentro do `Promise.all` e
derrubava todo o snapshot → 500 em `GET /profile/inference` e `/profile/inference/snapshot`.

```diff
-      profileProfessionalService.getProfessionalProfile(tenantId, userId),
+      // Bloco profissional depende de serviço legado morto; degrada SÓ ele (physical/learning seguem propagando).
+      profileProfessionalService.getProfessionalProfile(tenantId, userId).catch(() => ({ skills: [], count: 0 })),
```

### Invariantes respeitados
- `.catch` **local apenas** na promise profissional;
- fallback honesto `{ skills: [], count: 0 }` (shape exato consumido: `professional?.skills` + `.length`);
- `physical` e `learning` continuam **sem** catch e propagam erro real (não engole erro geral);
- C1 intacto · legado `/profile/professional` inalterado;
- frontend não tocado · migration não tocada · financeiro não tocado;
- sem `console.log`/`devLog`;
- `git status --short` limpo.

### Validação aceita
- **Baseline (antes):** inference/snapshot **500** por legado · C1 **200** · physical **200** · legado **500**.
- **Pós:** inference **200** · snapshot **200** com `professional: { skills: [], count: 0 }` · C1 **200** ·
  physical **200** · legado **500** inalterado.
- `tsc` = **0** · gates sem regressão · `validate:architectural` baseline **`Total=20` sem aumento**
  (`critical_new=0`).
- Sweep pelo fluxo real (login dev → actor resolvido dinamicamente pelo `userId`, não hardcoded).

### Ratificação
Opus (executor/relatório) · Clayton (selo, após conferir bruto `git show 526b1c6f`).

### Fila após o selo
- **A3.1 backend:** SELADA.
- **A3.2 frontend/Claude (papel unificado):** próxima — só **prompt/desenho de execução**, NÃO autorizada a código até
  aprovação de Clayton. Migrar a aba Profissional para `/profile/professional/c1` seguindo o DESENHO_A3.
- **Interesses/Aprendizado:** bloqueado.
- **Financeiro / migration:** bloqueado.

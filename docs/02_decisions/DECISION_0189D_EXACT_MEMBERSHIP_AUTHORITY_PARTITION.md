# DECISION-0189D — PARTIÇÃO EXATA DA AUTORIDADE DE MEMBERSHIP EMPRESARIAL

> Adendo da cadeia DECISION-0189 / 0189A / 0189B / 0189C. Promulgado por ratificação soberana
> (Clayton, 2026-07-19) para **registrar e tornar inequívoca** a partição de autoridade JÁ
> estabelecida pela DECISION-0189 — em especial a terminalidade de `manage_members` e a matriz
> normativa §13.3 — resolvendo a colisão com fallbacks de `can_manage_company` existentes no
> runtime. **Docs-only estrito nesta etapa.** Não cria regra nova de produto: FIXA a norma já
> promulgada e nomeia as colisões runtime a corrigir SOMENTE após GO material separado.

HEAD de promulgação: `dd0e67805`. Branch: `rescue-structural`.

## 0. NATUREZA E MOTIVO
A DECISION-0189 §13.3 já promulgou `manage_members` como permissão EXATA do lifecycle de
membership comum (convidar · suspender/retomar/revogar membro comum · alterar grants
não-protegidos · declarar vínculo jurídico), e `company:manage_governance` como autoridade dos
alvos/grants PROTEGIDOS. A §2.3 classificou `manage_members` como **terminal** (sem fallback de
role/is_primary/ownership/capability). O runtime, porém, carrega fallbacks de `can_manage_company`
que tratam governança como superset implícito — o que a norma NÃO promulgou. A frase "governança
administra membros comuns" existe apenas como COMENTÁRIO no código, nunca como regra da decisão.
Esta DECISION-0189D elimina a ambiguidade norma×código, sem introduzir vocabulário novo.

## 1. DETERMINAÇÕES RATIFICADAS

1. **`manage_members` é capability TERMINAL e EXATA** para o lifecycle de membership empresarial
   comum.
2. **Nenhuma autoridade de membership comum é inferida** de: `can_manage_company` · `role` ·
   `is_primary` · representação (`canRepresentActor`) · ownership · vínculo · ou qualquer outra
   capability.
3. **Exigem `manage_members` explicitamente:**
   - listar e consultar convites;
   - lookup de destinatário por código;
   - emitir convite;
   - revogar convite;
   - revalidar a autoridade do convidador durante o aceite;
   - suspender, retomar ou revogar membro SEM grant protegido;
   - alterar grants não-protegidos;
   - declarar vínculo jurídico de membro SEM grant protegido.
4. **`company:manage_governance` é autoridade EXATA para:**
   - conceder ou remover grants protegidos;
   - administrar, suspender ou revogar membro DETENTOR de grant protegido;
   - transferir governança;
   - preservar a proteção do último gestor.
5. **`company:manage_governance` NÃO é superset implícito de `manage_members`.**
6. Para alvo COMUM, `can_manage_company` isoladamente NÃO autoriza comandos de membership.
7. Para alvo PROTEGIDO, `can_manage_company` é a autoridade aplicável, SEM exigir conjunção
   artificial com `can_manage_members`.
8. O **gestor inicial** continua recebendo server-side `can_manage_company=true` e
   `can_manage_members=true`. Nenhuma dessas permissões vem de `role`, `is_primary` ou entrada
   controlada pelo cliente. (Logo, criação normal da empresa não sofre deadlock.)
9. Ficam registradas como **COLISÕES RUNTIME a corrigir SOMENTE após GO material separado**
   (nenhuma corrigida por esta DECISION):
   - fallback por `can_manage_company` na **emissão** de convite
     (`company-access-invitations.service.ts` — `inviteMember`);
   - fallback por `can_manage_company` na **revalidação do convidador durante o aceite**
     (`acceptInvitation`);
   - fallback por `can_manage_company` na **revogação** de convite (`revokeInvitation`);
   - fallback por `can_manage_company` para **administração de membro COMUM** em
     `assertAdministrationCeiling` (`company-membership-commands.service.ts` —
     `if (caller.can_manage_company) return;` para alvo sem grant protegido).
10. Esta DECISION **NÃO cria nem autoriza**: `manage_access` · `can_manage_access` ·
    `can_view_fiscal` · nova PermissionKey · catálogo v3 · migration ou schema · alteração de
    código · frontend · ativação fiscal · cálculo tributário · Bank · movimentação financeira ·
    abertura da PORTA 01 · selo Yala.
11. **`manage_access` permanece proposta NÃO promulgada.** O vocabulário canônico desta campanha
    continua sendo `manage_members`.
12. **`can_view_fiscal` permanece FORA desta campanha** e só poderá nascer em frente fiscal
    própria, com decisão, catálogo, material, provas e auditoria independentes.
13. **`member_status` permanece a ÚNICA verdade do lifecycle.** `is_active` NÃO é reintroduzido
    (coluna já removida fisicamente na F4 — migration `20260719140000` `DROP COLUMN is_active`;
    protegido pelo guard `audit-company-access-authority-foundation`).

## 2. PARTIÇÃO NORMATIVA (referência à §13.3 já promulgada)

| Operação | Alvo | Permissão EXATA |
|---|---|---|
| listar/consultar convites · lookup por código · emitir convite · revogar convite · revalidar convidador no aceite | membership comum | `manage_members` |
| suspender/retomar/revogar membro · alterar grants não-protegidos · declarar vínculo jurídico | membro SEM grant protegido | `manage_members` |
| conceder/remover grant protegido · administrar/suspender/revogar detentor de grant protegido · transferir governança · último-gestor | alvo/grant PROTEGIDO | `company:manage_governance` (`can_manage_company`) |

Uma capability NÃO implica a outra. O mesmo sujeito pode carregar ambas (gestor inicial, §1.8).

## 3. TRAVA DE ESCOPO (esta etapa)
Docs-only. Commit toca SOMENTE:
`docs/02_decisions/DECISION_0189D_EXACT_MEMBERSHIP_AUTHORITY_PARTITION.md` · `REMEDIATION_DT_LOG.md`
· `dividatecnica.md`. Nenhum backend/frontend/migration/schema/teste/guard/runner/contrato/
catálogo/Bank/Fiscal/untracked alterado. **O material 0189D permanece NÃO AUTORIZADO** — exige
GO material separado. Sem auditoria Yala e sem selo nesta etapa.

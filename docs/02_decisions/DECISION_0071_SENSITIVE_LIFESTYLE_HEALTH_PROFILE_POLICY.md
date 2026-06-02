# DECISION-0071 — Política de dados sensíveis Lifestyle/Saúde no Perfil

**Status:** RATIFICADA — DECISÃO DE PRODUTO/PRIVACIDADE (D1). DOCS-ONLY; implementação **NÃO** autorizada aqui (2026-06-01).
**Sessão:** 2026-06-01 (pós-auditoria READ-ONLY da `DT-LIFESTYLE-SENSITIVE-IN-BLOB`).
**Decisor:** Clayton (9 escolhas + 2 eixos adicionais).
**Commit âncora:** HEAD origem `dec3b883`.
**Documento canônico:** este arquivo.
**Complementa (sem revogar):** `SELO_C1_LEARNING_INTEREST.md`, DECISION-0070. **Subordinada a:** Constituição /
LEIS (LGPD/privacidade como limite material), LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY.
**Vinculada a:** `DT-LIFESTYLE-SENSITIVE-IN-BLOB` (OPEN — D1 tomada, implementação pendente).

---

## 1. Contexto (auditoria read-only)

`global_users.metadata.lifestyle` guarda `sexualOrientation`, `relationshipStatus`, `drinks`, `smokes`
— **sem consentimento, visibility, audit ou retenção explícitos** (blob, global-user-keyed). `drinks/smokes`
alimentam `social-targeting.service` (scoring). A frente de **Saúde** tem UI/rotas/services/repos
(`profile-health.*`, frontend ProfileHealth) mas as **tabelas estão AUSENTES** (`user_health_facts`/
`health_taxonomies`/`health_consents` = ABSENT; migration `0382` arquivada, NÃO aplicada) → feature
**fantasma**. Em DEV os valores de lifestyle estão nulos (risco é de SHAPE/futuro, não de volume atual).
Learning/Interest já saíram do blob para o C1 (selado) — **esta decisão NÃO reabre essa frente.**

## 2. Escolhas de Clayton (9 pontos)

| # | Ponto | Escolha |
|---|-------|---------|
| 1 | `sexualOrientation` | **A — remover/bloquear do MVP.** Categoria especial LGPD; só volta em frente futura com consentimento explícito + visibility privada + audit + delete real. |
| 2 | `relationshipStatus` | **A — manter como lifestyle privado.** Dado declarado, visibility privada por default, consentimento explícito; **nunca** público por default; **nunca** em targeting/matching/recomendação sem decisão futura específica; sai do blob para substrato actor-first. |
| 3 | `drinks` / `smokes` | **A — manter como lifestyle privado, SEM targeting.** Declarados pelo usuário, mas não alimentam recomendação/matching/social-targeting nesta fase. |
| 4 | Uso em `social-targeting` | **A — bloquear imediatamente** o uso de `drinks/smokes` no targeting até existir consentimento explícito. Sem uso secundário de dado sensível por conveniência de produto. |
| 5 | Visibility default | **A — private por default.** Dado sensível nasce privado; abertura futura exige consentimento explícito. |
| 6 | Consentimento | **A — explícito por campo sensível** (não por bloco). |
| 7 | Retenção/remoção | **A — delete real / anonymize** do valor sensível ao remover; audit registra o **evento**, **sem** preservar o valor sensível antigo em claro. |
| 8 | Escopo de identidade | **A — actor-first.** Nada de `global_user_id` como identidade operacional final quando o dado pertence ao actor. |
| 9 | Saúde no MVP | **B — desativar rotas/UI de Saúde com 501** até substrato governado nascer. O desenho 0382 é promissor mas hoje é fantasma (UI/rotas sobre tabelas ausentes) → endpoint honesto > feature quebrada com dado sensível. Quando voltar: actor-first + consent explícito + visibility privada + audit + retenção/delete (frente própria). |

## 3. Eixos adicionais (régua de risco — sinal conceitual, não import de laboratório)

> O conteúdo do laboratório externo é **sinal conceitual**, não evidência material do Unificard atual.
> Nada de schema/nomes/contratos do laboratório é importado como prova. Aproveita-se só a **régua de risco**.

10. **Captura indireta de saúde por TEXTO LIVRE.** Qualquer campo livre (declaração, observação, nota, bio,
    resposta) que permita o usuário escrever dado de saúde ("sou diabético", "tomo remédio X", "tenho
    depressão") deve ser tratado como **possível caminho de captura de dado de saúde** — LGPD olha a
    **natureza** do dado, não o nome da tabela/tela. **Trava:** campos livres que possam receber dado de
    saúde **não são neutros** — exigem política explícita (finalidade de saúde, base legal, append-only com
    consentimento) **antes** de aceitar contexto/uso de saúde. **Estado atual (read-only):** `biologicalSex`
    **não existe** no repo; o único caminho livre-saúde encontrado é `profile-health.repository`
    (`declaration_text`/`notes`/`payload` + `consent`), **dentro do substrato de Saúde que o ponto 9 desativa
    (501)** → coberto por (9). Se uma futura varredura achar **campo livre vivo com uso de saúde fora** do
    substrato de Saúde, **registrar como DT/subitem próprio — não corrigir** (DOCS-ONLY).

11. **Limitação de finalidade para dados CIVIS usados em Saúde.** Dados coletados como identidade/cadastro
    civil (ex.: `biologicalSex`, se vier a existir) **não podem** ser reaproveitados para inferência, regra
    clínica, recomendação ou perfil de Saúde **sem decisão explícita de finalidade + base/consentimento
    compatível**. **Trava de finalidade**, não implementação agora. **Estado atual:** `biologicalSex` não
    existe no repo — trava **prospectiva**.

## 4. Vetos permanentes (vinculantes)

- ❌ Dado sensível em `global_users.metadata` como **SSOT final**.
- ❌ Targeting/matching/recomendação com dado sensível **sem consentimento explícito**.
- ❌ **Health fantasma**: rota/UI ativa de Saúde sobre tabela ausente.
- ❌ `user`/`global_user_id` como identidade operacional final quando o dado pertence ao **actor**.
- ❌ Reaproveitar dado civil para Saúde sem finalidade/consentimento explícito (eixo 11).
- ❌ Tratar campo de texto livre como neutro quando pode capturar dado de saúde (eixo 10).

## 5. Consequências

- A próxima **frente técnica depende destas escolhas** e **não está autorizada** aqui.
- **Saúde fora do MVP:** rotas/UI de Saúde devem virar **501 honesto** (fatia executora própria) enquanto não
  houver substrato governado; o desenho 0382 vira **frente própria** (schema + consent/audit) se/quando Saúde
  for priorizada.
- **Lifestyle permanece** (relationshipStatus/drinks/smokes), mas exige **SSOT actor-first com consent +
  visibility (private default) + audit + retenção/delete** antes de sair do blob; **`sexualOrientation` sai**
  (remover/bloquear).
- `social-targeting`: **desacoplar drinks/smokes** do scoring (bloqueio imediato em fatia própria).
- **Cleanup do blob** de lifestyle só **após** o SSOT nascer + backfill (fail-closed), como Learning/Interest.
- `DT-LIFESTYLE-SENSITIVE-IN-BLOB` permanece **OPEN** (D1 tomada; implementação pendente).

## 6. Sequência de fatias recomendada (não autorizada aqui)

1. **F-SAUDE-501** — desativar rotas/UI de Saúde com 501 honesto (curta, alto valor de segurança; remove o fantasma).
2. **F-TARGETING-DECOUPLE** — remover `drinks/smokes` do `social-targeting` (curta).
3. **F1 schema** — SSOT lifestyle actor-first (`actor_lifestyle_attributes` ou equivalente) com
   visibility/consent/audit; `sexualOrientation` **fora**.
4. **F2 backend** — service sensitive (write/read actor-first, enforcement consent/visibility, audit sem valor em claro).
5. **F3 frontend** — ProfilePhysical "Estilo de Vida" → novo substrato; toggles de visibility/consent; remover `sexualOrientation`.
6. **F4 readers** — `core.service` e quaisquer consumidores → SSOT respeitando visibility.
7. **F5 cleanup do blob** — remover `metadata.lifestyle` após backfill (fail-closed) + selo + CLOSE da DT.

> **Ordem inegociável:** a política (esta DECISION) vem **antes** de qualquer schema/código. Superfície depois da política de dados sensíveis (LGPD).

## 7. Superada por

(em aberto — decisão vigente)

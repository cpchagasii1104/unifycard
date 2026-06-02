# DECISION-0079 — Política de bairro (neighborhood) no Location Core: texto de exibição, não FK canônica no MVP

**Status:** RATIFICADA — DECISÃO DE MODELAGEM/POLÍTICA (D-NEIGHBORHOOD). **DOCS-ONLY**; implementação não autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 (pós F-GEO-3).
**Decisor:** Clayton (bairro = exibição controlada até existir fonte oficial; não forçar FK por nome).
**Commit âncora:** HEAD origem `70f9aa73`.
**Documento canônico:** este arquivo.
**Subordinada a:** `DECISION-0020`/`0021` (Location Core soberano), `DECISION-0074` (endereço civil PF → Location
Core), `DECISION-0076` (enriquecimento transitório do blob), `DECISION-0077` (estratégia geo B+D+C; §8 vetava coluna
textual "sem decisão nova" — **esta é a decisão nova** que qualifica esse veto para o caso bairro-exibição),
`DECISION-0078` (cache/backfill CEP), `SSOT_REGISTRY_UNIFICARD.md`, LGPD.
**Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), `DECISION-0075` §7 (fronteira endereço PJ).
**Escopo:** SOMENTE a natureza/destino do bairro no endereço civil PF; **NÃO** implementa e **NÃO** toca PJ/Companies.

---

## 1. Problema

Após F-GEO-2d/F-GEO-3, o endereço civil PF já é **SSOT para quase tudo**:

```text
CEP / rua / número / complemento → Location Core (addresses)          ✅ canônico
UF                               → FK canônica (states.abbreviation)  ✅ canônico (F-GEO-3)
cidade                           → FK canônica (cities.name, IBGE)    ✅ canônico (F-GEO-3)
bairro (neighborhood)            → ainda vem do blob (metadata.address) ⚠️ residual
```

**Estado material (DEV, read-only 2026-06-02):** `neighborhoods`=**0**; `addresses WHERE neighborhood_id IS NOT
NULL`=**0**; `profiles WHERE metadata ? 'address'`=**1**. `addresses` tem apenas a coluna `neighborhood_id` (uuid FK);
**não** existe coluna textual de bairro. O bairro "Sítio Cercado" (CEP `81920410`) só existe hoje em
`profiles.metadata.address.neighborhood`.

**Consequência prática:** o cleanup de `profiles.metadata.address` (F4) **não pode** acontecer ainda — apagar o blob
hoje **perderia o bairro** sem destino canônico. Cidade/UF têm IBGE (código oficial) → viram FK. **Bairro tem apelido
(nome), não código oficial** → não há fonte para FK confiável.

## 2. Perguntas da decisão (respondidas)

1. **Bairro deve ser FK canônica agora?** **Não.**
2. **Existe fonte confiável com código oficial de bairro?** **Não** (IBGE codifica município, não bairro; ViaCEP
   retorna `bairro` como texto, sem código).
3. **ViaCEP retorna bairro sem código — isso pode virar FK?** **Não** — viraria *match por nome livre* ("match por
   barbante"), exatamente o anti-padrão vetado em DECISION-0077 §8.
4. **O sistema precisa de bairro para autoridade territorial ou só exibição?** **Só exibição/endereço postal** no
   MVP. Autoridade territorial/fiscalidade/matching crítico operam por UF/cidade (que têm código oficial).
5. **O cleanup do blob pode acontecer se o bairro não tiver destino?** **Não.** Bloqueado até existir destino do bairro.
6. **Menor modelo honesto para não perder "Sítio Cercado"?** Bairro como **texto de exibição controlado no Location
   Core** (não FK), migrado do blob, antes de remover o blob.

## 3. Escolha — **Opção B: bairro = texto de exibição controlado no Location Core (não FK canônica no MVP)**

```text
UF / cidade  = FK canônica (states/cities por external_code/IBGE) — autoridade territorial.
bairro       = TEXTO DE EXIBIÇÃO controlado no Location Core — NÃO FK, NÃO SSOT territorial.
```

Destino concreto (a materializar em fatia futura, se ratificado): **coluna textual controlada em `addresses`**, ex.
`addresses.neighborhood_display_text` (ou nome equivalente definido na F-GEO-4a). Natureza dessa coluna:

- **não** é SSOT territorial;
- **não** é FK (`neighborhood_id` permanece para o dia em que houver catálogo oficial);
- é **dado de exibição / importação de CEP** (origem ViaCEP/input);
- **não** deve ser usado para autoridade, fiscalidade, matching crítico ou delimitação territorial.

### Opções avaliadas e descartadas

| Opção | O que é | Veredito |
|---|---|---|
| **A** — bairro FK canônica agora (`neighborhoods`/`neighborhood_id`) | match por nome sem código oficial | ❌ frágil ("barbante"); vetado por DECISION-0077 §8 |
| **B** — bairro texto de exibição controlado no Location Core | coluna textual não-canônica | ✅ **escolhida** (MVP) |
| **C** — perder bairro no cleanup | aceitar apagar "Sítio Cercado" | ❌ regressão de UX; perda de dado |
| **D** — manter blob indefinidamente p/ bairro | andaime vira prédio | ❌ não converge; viola norma assintótica |

## 4. Justificativa

- `neighborhoods` está **vazio** (0) e `addresses.neighborhood_id` nunca usado (0) — não há catálogo a reutilizar.
- ViaCEP traz bairro como **texto sem código**; IBGE não codifica bairro → **FK por nome seria match frágil**.
- O bairro é **necessário para exibição e endereço postal** (não pode simplesmente sumir).
- Bairro **não** é usado como autoridade territorial — essa função é de UF/cidade (que têm código oficial).
- Filosofia explicitada: **cidade/UF são canônicos por FK; bairro pode ser dado de exibição, não autoridade
  territorial.** É a distinção "cidade tem IBGE; bairro tem apelido — um vira canônico, o outro vira exibição controlada".

## 5. Consequência (desbloqueio do cleanup)

Para desbloquear o cleanup de `profiles.metadata.address`, na ordem:

1. **criar destino canônico de exibição** para bairro no Location Core (coluna textual controlada) — fatia futura;
2. **migrar bairro do blob** para esse destino (preservando "Sítio Cercado");
3. **core.service deixa de ler bairro do blob**;
4. **só então remover** `profiles.metadata.address`.

## 6. Vetos (vinculantes)

```text
❌ criar neighborhood FK por nome livre (sem catálogo/código oficial de bairro)
❌ usar bairro textual para autoridade territorial / fiscalidade / matching crítico / delimitação
❌ limpar profiles.metadata.address ANTES de o destino do bairro existir e estar populado
❌ tocar PJ/Companies/company address nesta instância (frente de outra instância — DECISION-0075 §7)
❌ implementar (código/migration/runtime) nesta decisão (docs-only)
```

## 7. Sequência futura (não autorizada aqui)

```text
D-NEIGHBORHOOD  — esta decisão (DECISION-0079, docs-only)
F-GEO-4a        — adicionar campo de bairro TEXTUAL controlado ao Location Core (ex.: addresses.neighborhood_display_text), se ratificado
F-GEO-4b        — migrar bairro do blob (metadata.address.neighborhood) → destino textual do Location Core
F-GEO-4c        — core.service deixa de ler bairro do blob (passa a ler o campo textual canônico)
F-GEO-4d        — cleanup de profiles.metadata.address (= F4 do endereço PF)
F-GEO-5         — selo + CLOSE da DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE
```

`DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` **permanece OPEN**. Esta decisão **não** fecha a DT — apenas fixa a
política que destrava a sequência de cleanup.

## 8. Superada por

(em aberto — decisão vigente)

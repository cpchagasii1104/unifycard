# DECISION-0076 — Política de enriquecimento geográfico (city/state/neighborhood) do endereço civil PF

**Status:** RATIFICADA — DECISÃO DE POLÍTICA/MODELAGEM (D2). **DOCS-ONLY**; implementação não autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 (pós F1/F2 do endereço civil PF → Location Core).
**Decisor:** Clayton (Opção A — enriquecimento transitório do blob até estratégia canônica).
**Commit âncora:** HEAD origem `5e098a25`.
**Documento canônico:** este arquivo.
**Subordinada a:** `DECISION-0074` (endereço civil PF → Location Core), `DECISION-0020`/`0021` (Location Core soberano),
`SSOT_REGISTRY_UNIFICARD.md`. **Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), `DECISION-0075` §7
(fronteira Location Core / endereço PJ). **Escopo:** SOMENTE Pessoa Física; PJ/Companies fora desta instância.

---

## 1. Contexto (auditoria read-only, HEAD `5e098a25`)

Após F1 (backend + backfill) e F2 (frontend), o endereço civil PF é **gravado no Location Core canônico**
(`addresses` + `address_assignments`, `owner_type='profile'`/`role='RESIDENCE'`) no modelo **CEP-âncora**
(country=BR + `postal_code`/`street`/`number`/`complement`; `state_id`/`city_id`/`neighborhood_id` = NULL).
O frontend **não escreve mais** endereço em `profiles.metadata.address`. Porém o reader `core.service.
getCompleteProfile` ainda **enriquece** `city`/`state`/`neighborhood` a partir do **blob preservado** para não
regredir a exibição (ex.: `Curitiba/PR/Sítio Cercado`).

**Achados materiais que travam o corte do blob:**
- `addresses` **não tem coluna textual** de city/state/neighborhood — só FK (`city_id`/`state_id`/`neighborhood_id`).
- **Não existe resolver CEP→city/state/neighborhood nem geocoding** no backend (o CEP-autofill `useProfileCep` é
  frontend, não persiste FK; BrasilAPI no backend só é usada para CNPJ).
- **Catálogo insuficiente:** `states`=27 (todas UF), `cities`=**27 (só capitais)**, `neighborhoods`=**0**.
  Capitais como Curitiba resolvem; cidades não-capitais e **qualquer** bairro **não** resolvem.

## 2. Respostas às perguntas materiais

1. **Location Core tem city/state/neighborhood textual canônico?** Não — só FK nullable + `postal_code`/`street`/
   `number`/`complement`.
2. **Existe resolver confiável CEP→city/state/neighborhood?** Não (backend). Frontend tem CEP-autofill de UI, sem
   persistência canônica de FK.
3. **Catálogo suficiente p/ Curitiba/PR e casos gerais?** Curitiba sim (capital); **casos gerais não** (só 27
   capitais; 0 bairros).
4. **Opção escolhida:** **A — manter enriquecimento transitório do blob no reader** até existir estratégia
   canônica (CEP/catálogo/geocoding). (B = FK best-effort: resolve só capitais, deixa o resto NULL → exibição
   desigual + perde city/state que o usuário digitou; C = aceitar CEP-âncora sem city/UF → regressão de UI; D =
   coluna textual em `addresses` → fere o modelo FK-canônico do Location Core. Todas rejeitadas.)
5. **Qual evita regressão sem inventar geografia?** **A** — sem perda de exibição, sem FK frágil, sem schema novo.
6. **Qual prepara melhor PF e PJ?** **A** — PF segue canônico (Location Core) + exibição via fallback; a estratégia
   de enriquecimento geográfico (CEP/catálogo/geocoding) vira **frente compartilhada futura** que PF e PJ
   aproveitam, **sem esta instância tocar PJ**.
7. **Cleanup do `profiles.metadata.address` pode acontecer já?** **Não.** O reader ainda depende do blob para
   city/state/neighborhood.
8. **Pré-condições que bloqueiam o F4 cleanup:** ao menos UMA de — (a) resolver canônico CEP/geocoding
   implementado; (b) FK city/state/neighborhood resolvida com segurança (catálogo completo + bairros, não só
   capitais); (c) UI aceitar exibição sem city/state/neighborhood; (d) decisão explícita de perda/remoção desses
   textos.

## 3. Decisão (vinculante)

- **Location Core continua o SSOT do endereço PF** (postal_code/street/number/complement + FK de localização
  nullable + lat/lng quando houver). `source` registra procedência (`UX_INPUT`/`IMPORT_LEGACY`/…).
- **`profiles.metadata.address` deixa de ser destino de escrita** (F2 já cortou), mas **permanece como fallback
  transitório de exibição** de `city`/`state`/`neighborhood` no reader (`core.service`).
- **Enriquecimento geográfico canônico** (resolver CEP/catálogo/geocoding que popule FK ou exiba city/UF a partir
  do CEP) é **frente futura própria**, **compartilhável com PJ** — NÃO autorizada aqui.
- **Cleanup do blob (F4) fica BLOQUEADO** até ao menos uma das pré-condições do §2.8.

## 4. Vetos permanentes

- ❌ Cortar o enriquecimento do blob no reader / remover `metadata.address` **antes** de uma pré-condição §2.8.
- ❌ Resolver FK city/state/neighborhood de forma frágil (match parcial / nome-completo sem catálogo) — "fanfic
  geográfica".
- ❌ Criar coluna textual de city/state/neighborhood em `addresses` (fere Location Core FK-canônico).
- ❌ Tocar PJ/Companies/company address, CPF/DECISION-0062, gender, financeiro.
- ❌ Implementar (código/migration/runtime) nesta fatia.

## 5. Impacto / comunicação PJ

A fronteira já está registrada em **`DECISION-0075` §7** (e em `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE`): em
`addresses`, **city/state/neighborhood não são textuais canônicos** — FK nullable + CEP-âncora. A frente **PJ não
deve assumir cidade/UF textual canônica**; se precisar para fiscalidade/geo/display, é decisão própria de
enriquecimento por CEP/catálogo/geocoding. Esta DECISION-0076 reforça que o enriquecimento geográfico é uma
**frente compartilhável** — quando nascer, beneficia PF e PJ pelo mesmo trilho.

## 6. Sequência atualizada

```text
D1 (DECISION-0074) ✅ → F1 backend+backfill ✅ → F2 frontend ✅ → D2 (esta, política de enriquecimento) ✅
→ F3* readers/core sem blob — BLOQUEADO até pré-condição §2.8 (não é o próximo corte automático)
→ F-GEO (frente futura compartilhável PF/PJ): resolver CEP/catálogo/geocoding canônico
→ F4 cleanup profiles.metadata.address (após F-GEO ou decisão §2.8)
→ F5 selo + CLOSE da DT
```

> O reader continua com o fallback transitório do blob. **Não arrancar o andaime enquanto a parede seca.**

## 7. Superada por

(em aberto — decisão vigente)

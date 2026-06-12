# 2026-06-12 — F-CANONICAL-MEDIA-CONTEXT-IDENTITY-V2-COLLISION-SAFE-CLOSURE

GO corretivo FINAL da IA Diretora após o re-reseal Yala com veredito SEPARADO:
**eixo temporal D2 = PASS MATERIAL** · **eixo mídia = FAIL** com único bloqueador
`DT-MEDIA-CONTEXT-FINGERPRINT-SERIALIZATION-AMBIGUITY`.

## Âncora

- Parent: `6f2c8969` (HEAD da macrofrente contextual+temporal) · branch `rescue-structural` ·
  dev `unificard_dev` 375/375 → **376/376**.
- Commits: **A** `a63ea22c` (identidade V2) · **B** (fechamento — e2es, backfill, gate, provas,
  cartório).

## Causa-raiz provada (Yala)

`computeMediaContextFingerprintV1 = md5(parts.join('|'))` — campos LIVRES adjacentes (licença,
provenance) permitiam preimages idênticos: `license='a' + provenance='b|c'` ==
`license='a|b' + provenance='c'`. O serviço reusava por fingerprint SEM recomparar dimensões →
`reusedExistingAsset=true` e a licença `a|b` DESCARTADA em silêncio (violação da D1).

## Correção (4 propriedades simultâneas — GO §2)

1. **Serialização inequívoca**: preimage `MEDIA_CTX_V2;BLOB:S36:…;…;LICENSE:S1:a;PROVENANCE:S3:b|c`
   — campo nomeado + marcador `N` de NULL + length-prefix em BYTES UTF-8 (conteúdo com `|`/`;`/`:`
   é inerte; injeção de gramática não colide).
2. **Versionamento**: `context_identity_version=2` (coluna NOT NULL + CHECK; persistida pelo
   runtime via `MEDIA_CONTEXT_IDENTITY_VERSION`).
3. **Hash forte**: sha256 (`media_context_fingerprint_v2`); md5/V1 fora da identidade viva
   (`context_fingerprint_v1` = arqueologia, sem índice).
4. **Comparação material completa**: lookup por fingerprint/idempotency-key localiza CANDIDATO;
   reuso SÓ após `materiallyEqualMediaContext` (blob, tenant, actor, context_type, context_owner,
   source, purpose, licença, provenance — `IS NOT DISTINCT FROM` + `media_context_dimension_norm`).
   Colisão material ⇒ **409 MEDIA_CONTEXT_FINGERPRINT_COLLISION**; key divergente ⇒
   **409 MEDIA_IDEMPOTENCY_CONFLICT**. Corridas 23505 seguem a mesma regra.

**Fonte única do encoder** (GO §3, opção A): funções SQL na migration
`20260612120000_media_context_identity_v2.sql` usadas por backfill E runtime — o TypeScript
(`media-context-identity.ts`) apenas as invoca; nenhuma segunda fórmula manuscrita.

**Semântica normada explícita**: canonicalização PRÉ-PERSISTÊNCIA (trim do charset ASCII
explícito ` \t\n\r\f`; vazio ⇒ NULL — NULL ≡ '' por DECISÃO via normalização; case PRESERVADO);
identidade case-insensitive (lower); Unicode byte-exato em UTF-8 (NFC ≠ NFD distintos); espaços
internos significativos. Dado LEGADO preservado byte-exato (migração não normaliza colunas).

## Migration 376 (forward-only; 374/375 intocadas)

Funções V2 → colunas versão/arqueologia → fail-closed PRÉ (source fora do vocabulário ·
sugestão/empresa sem tenant+actor declarante = contexto NÃO inferível) → arqueologia V1 →
recálculo V2 de TODAS as declarações → fail-closed PÓS (completeness · colisão V2 = ABORT sem
mesclar/apagar/escolher) → NOT NULL+CHECK → DROP índice V1 → UNIQUE V2.
Checksum aplicado no dev: `1dd23a8a6df7b947af33022a707069f175062f2daece9cd1128552bfbe1daa7a`
(== sha256 do arquivo — byte-exato).

`migrate.ts`: guard aditivo `MIGRATION_STOP_BEFORE` (test-tooling; sem a env, comportamento
idêntico) — habilita o e2e de backfill legado.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e media-contextual-identity (ampliado) | **35/35** — vetor Yala EXATO (preimages distintos/parseáveis; licença correta em cada linha; blob único; moderação independente) · NULL×EMPTY×TRIM×CASE · espaços internos · NFC≠NFD · emoji · delimitadores/injeção de encoding · **colisão forçada service-level: 409, linha intacta, nada criado** |
| e2e media-migration-backfill-legacy (NOVO) | **20/20** — fase A: stop-before 374 → seed legado real (empresarial pending + canônico approved + business_media + canonical_service_media; licença com bordas/case; provenance `b\|c`) → 374/375/376 → IDs/blobs/relações/moderação/licença/source/provenance PRESERVADOS byte-exatos; contexto inferido pela 374; `context_fingerprint == media_context_fingerprint_v2(...)`; `context_fingerprint_v1 == fórmula V1`; índice V1 retirado/UNIQUE V2 vivo · fase B: sugestão sem declarante ⇒ 376 ABORTA fail-closed (374/375 commitadas; coluna V2 ausente; linha intacta) |
| Regressões mídia | isolation **25/25** · CP2 **26/26** · canônico integrado **21/21** · integrado contextual-temporal **10/10** |
| Temporal PRESERVADO | owner-authority **24/24** · gate temporal **23/0** (nenhum arquivo temporal alterado) |
| Gate canônico | **76/5/0/0/0** — 6d reescrito V2 · 6d1 anti-join('\|')/md5 · 6d2/6d3 recomparação em TODAS as call-sites (matchAll + janela por site) · 6d4 comparação completa (9 dimensões) · 6d5 versão/recálculo/V1-não-soberano · 6d6 provas permanentes (vetor Yala + colisão + backfill) |
| Provas negativas | **16/16** sha-verificadas — P-M1 (context_owner fora da comparação) · P-M2 (LICENSE fora do preimage da migration) · P-M3/4/5 (mantidas) · **P12** join('\|')+md5 · **P13** fingerprint-only trust · **P14** licença fora da comparação · **P15** V1 soberano (lookup no v1) · **P16** prova de backfill removida (rename) · P-T1..P-T6 (temporal, mantidas) |
| Gates obrigatórios | actor-writer OK · bank-ledger OK · regression-guards OK · system-state PASS · arch --strict critical_new=0 (4 warnings textuais pré-existentes, zero em arquivos da frente) · git diff --check 0 |
| tsc | backend **VERMELHO — 25 pré-existentes** (arco 0113: account.routes 10 · event-rfq 8 · event-settlement 2 · e2e-events-money-reads 5), **ZERO novo** · frontend **0** |

## Cleanup

dev byte-estável: media 0/0/0 · availability=32 'user' · bookings=0 · service_offerings=0 ·
actors=10 · companies=2 · bank 0/0 · storage local=0 · DBs efêmeras da frente=0 (4 criadas,
4 dropadas) · logs temporários removidos · tree = frente + drift protegido.

## Cartório

- DT-MEDIA-CONTEXT-FINGERPRINT-SERIALIZATION-AMBIGUITY: OPEN (achado Yala) → **CLOSED**.
- EIXO TEMPORAL DECISION-0118 D2: **PASS MATERIAL Yala — CLOSED tecnicamente** (registrado).
- DT-UNIFIED-AVAILABILITY-GROUP-AUTHORITY-FALLBACK-SEMANTICS: **OPEN** (COALESCE de GROUP →
  macrofrente autoridade/delegação; não bloqueia; fallback não autorizado como definitivo).
- DECISION-0118: ADENDO factual de implementação V2 (nenhuma DECISION nova).

## Estados

- F-CANONICAL-MEDIA-CONTEXT-IDENTITY-V2-COLLISION-SAFE-CLOSURE: **tecnicamente concluída —
  aguardando re-reseal Yala**.
- EIXO TEMPORAL DECISION-0118 D2: **PASS preservado**.
- MACROFRENTE CANÔNICA: **NÃO CLOSED** (só o PASS da Yala autoriza).

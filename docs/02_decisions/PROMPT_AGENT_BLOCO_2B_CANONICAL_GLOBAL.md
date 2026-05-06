# Prompt — Agent mode · BLOCO 2B (canonical `global` no pipeline semântico)

**Uso:** colar no Cursor em **Agent mode** quando a equipa for executar a **Fase 2B**, **depois** de assinatura institucional do RFC (§9.1) se o gatilho v1 estiver em implementação paralela — para 2B puro, a regra de **não** misturar EIXO 9 no adapter basta.

**Log sugerido ao iniciar:** `docs/03_execution_log/YYYY-MM-DD_bloco2_global.md` (substituir data; ou usar ficheiro esqueleto `2026-04-10_bloco2_global.md` se for o marco real).

---

```text
INTENÇÃO: Habilitar canonical global (scope = 'global', tenant_id IS NULL) em TODO o pipeline semântico relevante, sem violar C.1, C.15, C.22 e sem introduzir inferência/sugestão em runtime de resolução.

CONTEXTO:
- Seguir PRODUTO_PLANO_MESTRE_COMPLETO.md (v1.9+)
- Respeitar docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md:
  - §2 PROIBIDO
  - §4 Gatilho v1 (manual assistido) e §4.1 anti-padrões
- C.25: enquanto C.25_SPEC.md §1–5 não estiver fechado e aprovado → NÃO criar automação CI nova sobre «inferência» (grep de padrões SQL/adapter conforme plano existente continua válido).

REGRAS ABSOLUTAS (BLOCO 2B):
- NÃO implementar onboarding automático nem auto-apply de sugestão (RFC §4.1).
- NÃO usar sugestão/inferência como fallback semântico.
- NÃO resolver concept_ref fora do adapter (C.10, C.19).
- NÃO alterar fluxos de checkout/ledger além do estritamente necessário para dados já governados pelo plano (preferir zero mudança em módulos bank).

REGRA DE OURO (repetir mentalmente):
Durante o BLOCO 2B é PROIBIDO:
- qualquer auto-apply de onboarding
- qualquer uso de inferência como fallback
- qualquer lógica fora do adapter para resolver concept_ref
- qualquer alteração desnecessária em fluxo de checkout/ledger

CLASSIFICAÇÃO OBRIGATÓRIA (antes de alterar qualquer query a canonical_products):

Para cada uso de canonical_products, classificar explicitamente:

ESCOPO A — acesso por ID (vinculação directa)
- Deve respeitar exactamente a linha referenciada (C.11)
- NÃO aplicar ORDER BY scoped/global nem precedência de descoberta
- NÃO aplicar lógica de descoberta (OR tenant/global) sobre o ID

ESCOPO B — descoberta (GTIN, fingerprint, busca sem ID canónico fixo)
- Aplicar:
  (scoped AND tenant_id = X) OR (global AND tenant_id IS NULL) [+ scope = 'global' conforme schema]
- ORDER BY favorecer scoped primeiro
- LIMIT 1 onde o contrato for «uma linha vencedora»

REGRA:
- Classificação errada → bug semântico (silencioso: o pior tipo)
- Registar no log, por ficheiro/query: A ou B e justificação em uma linha

FAIL CONDITION (CRÍTICO — classificação A/B):

Se qualquer query ou método que toque canonical_products NÃO estiver classificável como Escopo A ou Escopo B (dúvida, «híbrido», ou «vou tratar como B» sem decisão explícita no log):
- NÃO modificar o ficheiro em causa
- NÃO continuar a execução para o passo seguinte
- Registar no log como BLOQUEIO (query/local, motivo da dúvida)
- Parar o bloco 2B até haver classificação A ou B com justificação — ou escalar para decisão humana no log

EXECUÇÃO (ordem C.15 — sem excepção):

1) Adapter — backend/src/modules/marketplace/adapters/concept-offer-refs.adapter.ts
- Antes de editar: listar cada query → A ou B no log
- Escopo A: SELECT pela chave primária / ID armazenado; linha exacta; sem OR global/scoped nem ORDER de precedência
- Escopo B: (scoped AND tenant_id = produto.tenant) OR (global AND scope = 'global' AND tenant_id IS NULL); scoped vence; dedupe C.20 onde aplicável; sem fallback silencioso
- Sem misturar regras de B em caminhos A (C.18)

2) Repository — backend/src/core/catalog/canonical/canonical-product.repository.ts (e equivalentes directos a canonical_products)
- Métodos por ID → Escopo A; findByTenantAndGtin / fingerprint → Escopo B (OR global/scoped; ORDER scoped primeiro; LIMIT 1 conforme plano)
- Registar classificação A/B no log por método

3) Services — catalog, store-onboarding, marketplace que consultam canónicos
- Leituras alinhadas ao adapter/repositório; sem segunda lógica de concept_ref

4) Rotas / integração — só ajustes finos depois de 1–3

5) Anti-regressão (C.22) — gate obrigatório
- grep em backend/src por FROM/JOIN canonical_products; justificar ou corrigir cada ocorrência
- NÃO declarar PASS no bloco 2B com grep «sujo» (ocorrência sem classificação A/B + decisão documentada ou correcção)

FAIL FAST:
- FAIL CONDITION (classificação A/B) disparada → BLOQUEIO; não editar; não avançar
- qualquer violação de C.1 / C.11 / C.18 → parar; não avançar ao passo seguinte até corrigir

VALIDAÇÃO SEMÂNTICA (checklist):
- global por ID resolve a linha global READY sem trocar para scoped?
- descoberta por chave retorna scoped quando ambos existem?
- nenhum fallback por GTIN quando canonical_product_id está definido?

CHECKPOINTS:
- Classificação A/B registada no log para adapter + repo + serviços tocados? [S/N]
- Adapter PASS? [S/N]
- Repository PASS? [S/N]
- Services PASS? [S/N]
- Grep C.22 limpo (todas as ocorrências revistas)? [S/N] — sem isto, bloco 2B NÃO fechado

LOG:
- Registrar comandos, ficheiros tocados, classificação A/B por query/método, BLOQUEIOs (se houver), falhas e correções em docs/03_execution_log/YYYY-MM-DD_bloco2_global.md
```

---

## Ligações

- `PRODUTO_PLANO_MESTRE_COMPLETO.md` — Fase **2B**, **C.15**, **C.22**  
- `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`  
- `docs/02_decisions/C.25_SPEC.md`

# DT-VEHICLE-SPEC-FACET-VOCABULARY — ficha técnica: onde encaixa na ontologia

**Status:** OPEN (dado íntegro e ligado; falta normalizar os campos-vocabulário). 2026-07-08.
**Contexto:** F-VEHICLE-CAMINHONETE-CATALOG-AND-SPECS (commit `2c776ff11`).

## O encaixe (resposta à cobrança de Clayton "encaixar certo na ontologia, SSOT, N0/N1/N2")

```
N0 (domínio)        mobilidade-e-logistica            ← já existia
CONCEPT (identidade) caminhonete                       ← SSOT do tipo (o que É)
  → marca            vehicle_makes                      ← identidade
  → modelo           vehicle_models (concept=caminhonete) ← identidade
  → ano              vehicle_model_years                ← identidade (fato)
  → versão/trim      vehicle_model_specs.version        ← identidade fina (variante)
FACET (como É)       vehicle_model_specs (23 campos)    ← ATRIBUTO, não identidade
```

Regra ratificada honrada: **N1/N2 organizam navegação, CONTEXT ativa, CONCEPT define. N2 não
substitui CONCEPT.** A ficha técnica **não é CONCEPT nem N1/N2** — descreve, não identifica. Ela é
facet, ancorada ao CONCEPT via `model_id`. Correto.

## A nuance ainda aberta: 3 sub-tipos de campo dentro da ficha

Analisando os valores reais semeados (817 fichas):

1. **ESCALARES** (potencia_cv 50–437, torque, peso 850–3800, dimensões, tanque, caçamba): fatos
   numéricos tipados. **OK como estão** — número não é taxonomia.
2. **DESCRITIVOS livres** (motor: 81 valores distintos; pneus: "265/60R18"): strings de referência
   técnica. **OK como texto** — é referência, não vocabulário fechado.
3. **VOCABULÁRIO** (combustivel: 12 valores; tracao: 6; cambio: 28; direcao: 3; num_portas: 2):
   valores que se REPETEM e deveriam ser **canônicos** (SSOT de valor), não TEXT livre. Hoje entraram
   como TEXT direto do CSV, **com ruído**: "Gasolina / Álcool", "Gasolina / Flex", "4x2/4x4",
   "Manual 5M / Auto 4AT" — valores compostos que misturam duas coisas.

## A dívida

Os campos do grupo 3 precisam de **normalização para vocabulário canônico** antes de habilitar
**busca facetada** ("caminhonete 4x4 a diesel, câmbio automático"). Isso é Lei de Coerência
(CONCEPT→ATRIBUTOS→valor canônico), não texto paralelo. Enquanto TEXT livre, o filtro facetado
sofreria fragmentação ("4x4" vs "4x2/4x4" vs "Dianteira / 4x4").

**Importante:** busca facetada por atributo (4x4/diesel) **≠ N1/N2**. N1/N2 organizam CONCEPTs para
descoberta; faceta de atributo filtra variantes dentro de um CONCEPT. Não criar N1/N2 para isso.

## Recomendação (próxima fatia, não agora)

`F-VEHICLE-SPEC-FACET-CANONICAL`: tabela(s) de vocabulário para combustivel/tracao/cambio/direcao
(valores canônicos + normalização dos compostos), e migrar os campos-vocabulário de TEXT para FK/enum
governado. Habilita busca facetada. Escalares e descritivos ficam como estão.

Por ora: dado **íntegro, ligado ao CONCEPT e completo** (as 27 colunas). O que falta é só canonizar os
5 campos-vocabulário — dívida registrada, não bloqueia locação/venda/consulta da ficha.

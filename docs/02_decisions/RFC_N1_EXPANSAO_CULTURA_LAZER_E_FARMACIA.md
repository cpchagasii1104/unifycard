# RFC — Expansão de N1: cultura-lazer-e-eventos + farmácia (proposta p/ ratificação)

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton; NADA semeado — N1 é norma CONGELADA,
doc 19; expansão segue o processo do doc 21)
**Data:** 2026-07-07 · **Origem:** Clayton no hub do marketplace: "falta mercado, farmácia,
materiais de construção, turismo/viagens".

## 1. O que a auditoria mostrou (por que este RFC é pequeno)
- **Mercado** = N1 `alimentacao` ✓ JÁ EXISTE · **Materiais de construção** = N1
  `materiais-de-construcao` ✓ · **Moda** = `vestuario-e-acessorios` ✓ — a página do domínio
  agora PROJETA os 13 N1 governados de `produtos-e-comercio` (zero taxonomia nova).
- **Faltam de verdade (sem casa no doc 19):**

## 2. Proposta de N1 novos (compostos do segmentos.md, reconciliação §nota-ontológica)
**N0 `cultura-lazer-e-eventos`** (hoje SEM nenhum N1 semeado):
| N1 proposto | Definição | N2 direcionais |
|---|---|---|
| `eventos-e-ingressos` | O evento em si e seu acesso | shows, festivais, baladas, teatro |
| `turismo-e-passeios` | Experiências locais guiadas | passeios, trilhas guiadas, city tour |
| `viagens-e-hospedagem` | Deslocamento + estadia | passagens, pacotes, hotel, temporada |
| `esporte-e-lazer` | Prática e assistência esportiva | campeonatos, quadras, academias-lazer |
(Proteção anti-conflito: `producao-e-realizacao-de-eventos` continua em `servicos` —
prestação ≠ o evento em si, como o doc 19 já crava.)

**Farmácia:** NÃO propor N1 próprio em produtos-e-comercio (umbrella de varejo). Proposta:
N1 `farmacia-e-saude` em `saude-e-bem-estar` (varejo farmacêutico + parafarmácia) — coerente
com a resolução `estetica-e-cuidados-pessoais` (o doc já separa aparência de saúde). N2:
medicamentos, dermocosméticos, suplementos, primeiros socorros.

## 3. Ratificação necessária
1. Os 4 N1 de cultura-lazer (ou emendas)
2. `farmacia-e-saude` em saude-e-bem-estar (ou farmácia como N2 de outro N1 — dizer qual)
Após "ratificado": migration semeia `n1_nodes` + doc 19 ganha adendo formal + as páginas
Eventos (domínio) e o hub passam a projetar automaticamente.

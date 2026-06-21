# Sistema de documentos da IA-DIRETORA — `docs/orquestracao/`

> Sistema de **PROCESSO** da diretora (como as instâncias coordenam e o que se aprende sobre o sistema).
> Organizado por **ETAPA DO SISTEMA** (conhecimento durável, anti-retrabalho) + um **motor de rodadas**
> (transitório). Tem ciclo de vida: o que cumpriu o papel arquiva.

## §0 — FONTE DE VERDADE (inegociável)
A verdade é, e continua sendo: `docs/01_normative/` · `docs/02_decisions/` (+ `DECISOES.md`) · cartório
(`REMEDIATION_*`/`STATUS_EXECUCAO_GLOBAL.md`) · `SSOT_REGISTRY_UNIFICARD.md` + schema/código vivo.
**Este sistema BEBE da fonte — não a substitui.** Todo documento aqui **cita** a fonte (`arquivo:linha`/
DECISION/tabela) e **nunca** cria verdade paralela. Promulgação/DT/DECISION soberana vão ao cartório oficial.
**Em conflito, a fonte vence e este sistema é corrigido.**

## §1 — Duas camadas

### (A) `sistema/<etapa>/` — CONHECIMENTO por etapa do sistema (DURÁVEL · anti-retrabalho)
Uma pasta por etapa/módulo do sistema, na ordem da jornada/causalidade. Ex.:
```
sistema/
  cadastro/  perfil/  pf/  pj/  grupos/  identidade-actor/  autoridade/  semantica/
  oferta/  agenda/  comercio/  banco/  logistica/  presenca/  localizacao/  ...
```
Dentro de CADA etapa, **arquivos específicos padronizados** (criados quando há conteúdo — não scaffolding vazio):
- `MAPA.md` — superfícies/SSOT da etapa (declarado × verificado; ponteiros à fonte).
- `TESTES.md` — testes/e2e da etapa (ex.: "teste cadastro").
- `ACHADOS.md` — achados/riscos/**verdades paralelas**/DTs da etapa.
- `DECISOES.md` — ponteiros às DECISIONs/normas que regem a etapa (não as reescreve).
> Isto é o que **reduz retrabalho**: ao voltar a uma etapa, o mapa/testes/achados já estão lá, citando a fonte.

### (B) `processo/<frente>/` — MOTOR de rodadas (TRANSITÓRIO)
A coordenação viva de uma frente de trabalho (que normalmente CRUZA várias etapas):
```
processo/<frente>/  INBOX.md · CONSOLIDADO.md · respostas/IA-<X>.md · _arquivo/
```
A frente é o **motor**; ao consolidar, ela **distribui os achados duráveis para `sistema/<etapa>/`** (cada
verdade vai para a etapa dona) e arquiva a rodada. O conhecimento não fica preso em rodada arquivada.

## §2 — Globais
`README.md` (este mapa) + `METODO.md` (protocolo/CARTA/ritual/ciclos) — valem para TODA frente e etapa.

## §3 — Ciclo de vida
- Rodada **ABERTA → FECHADA**: ao fechar, a IA-DIRETORA (1) **arquiva** a rodada em `processo/<frente>/_arquivo/`
  e (2) **destila os achados** para os `sistema/<etapa>/` correspondentes (MAPA/ACHADOS/TESTES/DECISOES).
- `CONSOLIDADO.md` da frente = snapshot vivo + ledger de 1 linha por fatia fechada (não é log).
- **Nunca apagar** (arquivar = mover/preservar). **Sem monólito** (fechado sai do vivo).

## §4 — Encaixe no projeto (não duplicar)
Norma=`01_normative` · Decisão=`02_decisions` · Cartório=`REMEDIATION_*`/`STATUS` · Execução=`03_execution_log`
· Memória das instâncias=`docs/memorias/`. **`docs/orquestracao/` = o PROCESSO + o conhecimento-por-etapa da
diretora; alimenta os anteriores, nunca os substitui.**

## §5 — Estado (2026-06-20 · migração APLICADA no fecho da Rodada 7)
- **Migração FEITA:** `INBOX.md`/`CONSOLIDADO.md`/`respostas/` → `processo/cadeia-de-oferta/`. Globais (`README`/`METODO`) na raiz.
- **1ª destilação FEITA:** `sistema/{oferta,perfil,autoridade,agenda,semantica,comercio,banco,identidade-actor}/ACHADOS.md` (achados da Rodada 7, citando a fonte).
- **Rodada 7 = FECHADA** (readiness PASS_TO_CONVERGENCE). Estado vivo da frente: `processo/cadeia-de-oferta/CONSOLIDADO.md`.
- Daí em diante toda frente nova nasce em `processo/<frente>/` e destila em `sistema/<etapa>/`.

## §6 — Frente FUTURA de documentação (registrada, não agora)
**`F-STATUS-EXECUCAO-INDEX-BY-STAGE`** (dono: **IA-DOCUMENTOS** + IA-DIRETORA). O `STATUS_EXECUCAO_GLOBAL.md`
(16k+ linhas) consolidou inúmeras frentes/sessões num monólito. Frente futura: **destilar/indexar** seu
conteúdo (e o cartório) **por etapa** em `sistema/<etapa>/` — uma VIEW navegável que **aponta de volta** às
entradas do STATUS. **STATUS permanece SOBERANO** (append-only, fonte de verdade): a view **bebe dele, não o
esvazia nem o substitui**. Objetivo: achar "tudo de cadastro/banco/oferta" sem rolar 16k linhas = anti-retrabalho.
Abrir como rodada própria quando Clayton der GO (READ-ONLY de leitura + escrita só em `sistema/<etapa>/`).

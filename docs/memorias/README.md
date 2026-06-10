# `docs/memorias/` — Acervo de memórias operacionais das instâncias

Este diretório guarda a **memória operacional** das instâncias de IA que trabalham no projeto Unificard / UnifyBank sob coordenação de Clayton. Cada arquivo `MINHA_MEMORIA_*.md` é a memória própria de **uma** instância: mapa de aprendizado, armadilhas, classificações e dúvidas — acrescentada ao longo do tempo (append-only; histórico nunca apagado).

---

## ⚠️ Memória NÃO é norma soberana

As memórias são **insumo operacional**, não fonte de verdade. Elas registram *como a instância entendeu o sistema num momento* — e o repositório anda rápido (o HEAD pulou várias vezes só em 2026-06-09). **Sempre revalidar contra as fontes soberanas e o estado vivo antes de agir.**

**Fontes soberanas (nesta ordem de precedência):**
1. Constituição / Leis / Normas (`docs/01_normative/`, `07_NOMENCLATURA_CANONICA`, etc.)
2. DECISIONs (`REMEDIATION_DECISIONS_LOG.md` + cada `DECISION_*.md`)
3. SSOT / nomenclatura canônica
4. Código vivo + schema vivo (runtime)
5. `REMEDIATION_DT_LOG.md` · `STATUS_EXECUCAO_GLOBAL.md` (estado da remediação)

Em conflito entre memória e qualquer fonte acima, **a fonte soberana vence** e a memória deve ser corrigida.

---

## Instâncias e papéis

| Arquivo | Instância | Eixo / especialidade | Modo |
|---|---|---|---|
| `MINHA_MEMORIA_ACTOR_USERS.md` | **IA-ACTOR-USERS** | Actor/Users/Authority: 3 camadas de identidade, `canRepresentActor`, 5 canais DECISION-0113, R2/delegação | READ-ONLY |
| `MINHA_MEMORIA_USUARIOS_E_ACESSO.md` | **IA-USUÁRIOS-E-ACESSO** | Identidade, acesso, login/sessão e autoridade (auditoria) | READ-ONLY |
| `MINHA_MEMORIA_DINHEIRO.md` | **IA-DINHEIRO** | Eixo monetário: Bank/`bank_ledger` (Lei 5 SSOT), payments, split/payout/settlement | READ-ONLY |
| `MINHA_MEMORIA_TEMPO.md` | **IA-TEMPO** | Eixo temporal: agenda, disponibilidade (`unified-availability`), booking | READ-ONLY |
| `MINHA_MEMORIA_BANCO_DE_DADOS.md` | **IA-BANCO-DE-DADOS** | Schema, migrations, integridade, runtime do banco | READ-ONLY |
| `MINHA_MEMORIA_DOCUMENTOS.md` | **IA-DOCUMENTOS** | Documentação, normas, doutrina de manutenção | READ-ONLY |
| `MINHA_MEMORIA_DECISOES.md` | **IA-DECISOES** | Decisões soberanas (DECISIONs), trilhos e escopos | READ-ONLY |
| `MINHA_MEMORIA_DT.md` | **IA-DT** | Dívidas técnicas: mapeia/classifica/alerta (não fecha DT no log oficial) | READ-ONLY |
| `MINHA_MEMORIA_EXECUTORA_UNIFICARD.md` | **EXECUTORA UNIFICARD** | Execução controlada: a única que **edita** código/docs — só sob GO | EXECUTORA (sob GO) |

Papéis de coordenação (não têm arquivo de memória aqui):
- **IA Diretora / ChatGPT** — consolida os insumos das instâncias, sequencia o trabalho e emite o **GO**.
- **Yala** — verificadora adversarial READ-ONLY; faz reseal/PASS-FAIL sobre o que a executora entrega.
- **Clayton** — decide regra de **produto/social** e promulga norma.

---

## Regra de uso (método)

1. **Especialistas são READ-ONLY.** Mapeiam, classificam, alertam e escrevem **só** a própria memória (append-only). Não editam código, migration, banco, frontend, nem os logs oficiais.
2. **A executora `unificard` é a única que edita** código/docs — e **somente quando recebe um GO** explícito da IA Diretora.
3. **Dúvidas da executora podem ser roteadas às especialistas** (ver seção "Dúvidas abertas" em `MINHA_MEMORIA_EXECUTORA_UNIFICARD.md`). Cada especialista responde só o que é do seu eixo.
4. **Respostas das especialistas são insumo, NÃO autorização automática.** Uma resposta não vira patch sozinha.
5. **IA Diretora / ChatGPT consolida** os insumos e decide a sequência; só então emite o GO.
6. **Clayton decide produto / regra social** e promulga a norma. Decisão de produto não é tomada pela executora nem pelas especialistas.

> Resumo da cadeia: especialistas observam → executora pergunta → especialistas respondem (insumo) → IA Diretora consolida e emite GO → executora executa 1 fatia → Yala verifica → Clayton decide o que é produto/norma.

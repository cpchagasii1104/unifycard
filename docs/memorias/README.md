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
| `MINHA_MEMORIA_ACTOR_USERS.md` | **IA-ACTOR-USERS** | Actor/Users/Authority — instância única com 2 eixos. **Eixo A** (actor-alvo/autoridade): `canRepresentActor`, 5 canais DECISION-0113, actionContext, actorId em params/query/body, ownership de recursos, R2/delegação. **Eixo B** (acesso humano): user/global_user/identity, login/sessão, RBAC, roles/permissions, company_users, operador de marketplace, admin/compliance, FASE 6. | READ-ONLY |
| ~~`MINHA_MEMORIA_USUARIOS_E_ACESSO.md`~~ | ~~IA-USUÁRIOS-E-ACESSO~~ | **INATIVA — escopo absorvido por `MINHA_MEMORIA_ACTOR_USERS.md` (Eixo B)** desde 2026-06-10. NÃO é instância ativa; arquivo preservado só como memória histórica (não conta nas respostas da rodada). | INATIVA |
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

---

## Protocolo obrigatório de uso das memórias

> Estas regras são o cadeado do método. O painel (memórias) só é confiável se cada leitura/resposta carimba o HEAD e revalida no vivo. Painel mostra a última foto, não o agora.

### 1. Memória não é norma soberana
Fontes soberanas continuam sendo, **nesta ordem de verificação**:
1. Normas (`docs/01_normative/`, `07_NOMENCLATURA_CANONICA`, Constituição/Leis).
2. DECISIONs (`REMEDIATION_DECISIONS_LOG.md` + cada `DECISION_*.md`).
3. SSOT / nomenclatura canônica.
4. Schema vivo + código vivo (runtime) + migrations aplicadas + gates/E2Es.
5. `REMEDIATION_DT_LOG.md` · `STATUS_EXECUCAO_GLOBAL.md` (estado operacional).

Em conflito, **a fonte soberana vence** e a memória é corrigida — nunca o contrário.

### 2. Toda resposta baseada em memória precisa declarar
- **HEAD no momento da resposta** + **branch**;
- **se revalidou** no código/schema/DECISION/STATUS vivo (sim/não/parcial);
- **fonte soberana usada** (qual norma/DECISION/arquivo:linha/tabela provou);
- **se a memória pode estar stale** (HEAD da memória ≠ HEAD vivo no ponto material).

### 3. Formato padrão de PEDIDO (origem: memória da executora)
```
PEDIDO DA EXECUTORA
Status: ABERTO
HEAD no momento do pedido:
Branch:
Frente relacionada:
Dúvida objetiva:
Evidência esperada:
STOPs:
```

### 4. Formato padrão de RESPOSTA (origem: memória da especialista)
```
RESPOSTA DA INSTÂNCIA
HEAD no momento da resposta:
Fonte soberana confirmada:
Veredito:
Evidências:
Riscos:
Recomendação:
STOPs:
Status: RESPONDIDO        # ou STALE, se o HEAD da resposta envelheceu
```

### 5. Estados permitidos
- **ABERTO** — pergunta postada, ainda sem resposta.
- **RESPONDIDO** — respondida e (idealmente) revalidada no HEAD da resposta.
- **STALE** — o HEAD da resposta divergiu do vivo num ponto material; precisa revalidar antes de reusar.

### 6. Regra anti-edição-paralela
- A **executora `unificard`** pode editar qualquer arquivo — **somente sob GO** da IA Diretora/Clayton.
- **Especialistas só editam a própria memória** (append-only).
- Especialistas **nunca** editam código, migration, banco, frontend, `STATUS_EXECUCAO_GLOBAL.md`, `REMEDIATION_DT_LOG.md`, `REMEDIATION_DECISIONS_LOG.md` nem `opus.md`.
- **Resposta de especialista é insumo, não GO.** Patch só nasce de um GO da IA Diretora.
- O **PEDIDO** vive na memória da executora (origem); a **RESPOSTA** vive na memória da especialista (autora), com ponteiro de volta — assim nunca há duas mãos no mesmo arquivo.

### 7. Regra anti-stale
- Se o HEAD da memória diverge do HEAD vivo **e o assunto é material**, **revalidar no vivo antes de usar**.
- Se não revalidou, declarar **INCONCLUSIVO** ou **STALE** — não afirmar como verdade.
- Memória **acelera** o READ-FIRST; **não substitui** o READ-FIRST.

---

## Eixos internos da instância única IA-ACTOR-USERS (Eixo A × Eixo B)

> **Histórico:** até 2026-06-10 isto era a "fronteira oficial" entre **duas** instâncias (IA-ACTOR-USERS ×
> IA-USUÁRIOS-E-ACESSO). A IA Diretora consolidou: NÃO há instância separada de acesso humano — ela é o
> **Eixo B** da instância única `IA-ACTOR-USERS`. `MINHA_MEMORIA_USUARIOS_E_ACESSO.md` está INATIVA
> (memória histórica). Permanece a mesma distinção conceitual, agora como **dois eixos de uma só instância**.

**Eixo A — actor-alvo e autoridade operacional** ("esse actorId alvo pode ser usado/representado?"):
- auditoria adversarial de `actorId` (DECISION-0113);
- os 5 canais (actionContext · x-actor-id · query · params `:actorId` · params `:id` de recurso privado);
- `canRepresentActor` (catraca de representabilidade);
- ownership de recursos (suppliers/contacts/groups/daily-metrics);
- R2 / delegação (congelada).

**Eixo B — acesso humano e institucional** ("esse usuário/logado/role/permissão tem acesso?"):
- modelo humano de acesso; login / sessão;
- `global_user_id`, `user_id`, `identity` (as 3 camadas como identidade humana);
- RBAC legado / V2, roles, permissões funcionais; efeitos da FASE 6;
- `company_users`; operador de marketplace; admin/compliance.

**Regra de roteamento (interna à instância):**
- Dúvida = "esse **actorId alvo** pode ser usado/representado?" → responder pelo **Eixo A**.
- Dúvida = "esse **usuário/logado/role/permissão** tem acesso?" → responder pelo **Eixo B**.
- Quando a dúvida cruza os dois eixos, a **mesma instância** responde separando A e B; a **IA Diretora consolida**.

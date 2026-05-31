# PLANO — PERFIL CONTEXTUAL POR ACTOR (resolver de contexto + conexão aos SSOTs)

> Documento de boot para nova conversa. Lê isto antes de qualquer ação.
> Projeto: UnifiCard / UnifyBank · Branch: `rescue-structural` · Banco: `unificard_dev`
> Idioma operacional: português. Metodologia multi-IA (Opus chat = analista/operador;
> ChatGPT = crítico; Claude Code = executora controlada).

**ESPINHA DORSAL (o modelo em 7 linhas):**
```
Perfil é porta, não SSOT.
CONCEPT define o que algo é.
actor_id opera.
CPF responsabiliza.
capability contextualiza.
authority decide.
bank_ledger liquida.
```

---

## 0. CORREÇÃO DE PREMISSA (ler primeiro — o título engana)

A frase "perfil salvar como SSOT" está **errada de propósito** e precisa ser corrigida
antes de construir qualquer coisa, senão o sistema nasce torto:

- **O perfil NÃO é o SSOT.** O perfil é uma **casca contextual** — uma porta de entrada
  e uma vitrine. Ele NÃO é dono de nenhuma verdade.
- **O que o usuário preenche no perfil vai para o SSOT correto de cada domínio.** A aba
  é a porta; a verdade mora atrás dela, no SSOT.
- Se o perfil fosse o SSOT, cada aba criaria uma realidade paralela — exatamente o que
  o princípio raiz do UnifiCard proíbe: *"o sistema é único; nenhuma camada pode criar
  realidade paralela."*

**Formulação correta:** o perfil é a porta; o SSOT está atrás dela. A aba lê/escreve no
SSOT do domínio, nunca guarda a verdade em si mesma.

---

## 1. O QUE QUEREMOS CONSTRUIR (o destino)

Duas capacidades, que são uma só máquina:

1. **O perfil se molda pelo actor ativo.** Mesmo usuário, actors diferentes (ele-pessoa,
   a empresa dele, a banda dele) → abas diferentes, capacidades diferentes, SSOTs
   diferentes conectados. A mesma máquina de resolução roda para todos; o resultado
   muda por actor.

2. **O que o usuário preenche conecta ao SSOT certo.** Preferências (rock/sushi) →
   substrato de preferências. Ramo da empresa → CONCEPT. Agenda → availability.
   Dinheiro → bank_ledger. Nada fica preso numa aba decorativa.

O nome técnico do destino: **D-CONTEXT-RESOLVER** (o resolver de contexto por actor),
alimentado por **D-CONCEPT** (a taxonomia governada de ramos → capabilities).

---

## 2. O MODELO (como tudo se encaixa)

```
CPF (raiz de responsabilidade civil — não é chave operacional, é âncora)
  → global_user → identity (identities.tax_id = destino fiscal) → ACTOR HUMANO
       │
       ├─ contexto PESSOAL (dados, localização, preferências) → SSOTs de perfil/preferência
       │
       └─ pode criar/administrar outros ACTORS, cada um com contexto próprio:
            empresa · banda · página · grupo · loja · clínica · distribuidora ...
            (cada um aponta de volta ao actor humano responsável — cadeia civil)
```

**As entradas que definem CONTEXTO e CONTROLE DE AÇÃO de QUALQUER actor** (cada uma vem
do SSOT certo, NUNCA de string/keyword no nome). As 4 primeiras definem *contexto*; a 5ª
(autoridade efetiva) não define contexto — ela decide se a ação pode acontecer:

| Entrada | O que responde | SSOT de origem |
|---|---|---|
| `actor_type` | que ESTRUTURA é (user/page/group/channel) | coluna estrutural — **D1** |
| CONCEPT | o que a entidade É (distribuidora, clínica, banda) | `concepts` — **D-CONCEPT** |
| capability (contexto operacional) | o que está disponível operar | `actor_registry.capabilities_json` |
| autoridade efetiva | o que PODE de fato | authority engine + ownership/delegação + regras sistêmicas |
| modo operante | Consumir vs Operar | estado de sessão/contexto |

> ⚠️ **capability ≠ authority.** `capabilities_json` é entrada/filtro/contexto operacional —
> diz "este actor tem a capacidade X disponível". NÃO concede autoridade soberana sozinho.
> A decisão de autoridade efetiva continua no authority engine + ownership/delegação +
> regras sistêmicas. Tratar `capabilities_json` como SSOT absoluto de permissão criaria
> um SSOT paralelo de authority — proibido.

**Mapa aba → SSOT (a régua do resolver):**

| Aba / o que o usuário preenche | SSOT alvo (onde a verdade fica) |
|---|---|
| dados civis/fiscais | `identities.tax_id` = destino canônico; `global_users` = bootstrap/linha civil (não vira cartório paralelo) |
| preferências (rock, sushi, churrasco) | substrato de preferências (hoje blob em `global_users.metadata` — a tipar) |
| localização | endereço / `addresses` |
| agenda | `availability` (modelo unificado de disponibilidade) |
| reservas/agendamentos | `bookings` |
| participantes | `availability_participants` |
| empresa | `companies` |
| categoria / ramo | **CONCEPT** / `company_type` |
| capability (o que está disponível operar) | `actor_registry` (capabilities) |
| autoridade efetiva (o que pode de fato) | authority engine + ownership/delegação |
| financeiro | `bank_ledger` (imutável) |
| repartição econômica | `bank_splits` |

---

## 3. ESTADO REAL HOJE (verificado nesta sessão — o que existe vs o que é fachada)

| Camada | SSOT | Estado real |
|---|---|---|
| Dinheiro | `bank_ledger` / `bank_splits` | ✅ REAL, soberano, imutável |
| Tempo | `availability` / `bookings` | ✅ REAL, actor-aware (modelo unificado de disponibilidade) |
| Identidade | `actors` / `identities` | ✅ REAL pós-F3.1 (identity→actor com global_user_id) |
| **Categoria/ramo** | **CONCEPT** | ❌ **FACHADA**: ~99/102 categories sem concept_id; ramo resolvido por keyword no `display_name` |
| **Capabilities** | **actor_registry** | ⚠️ PARCIAL: tabela existe e tem writer canônico vivo (`INSERT ... ON CONFLICT`), lida pelo `authorization.service`; mas frontend usa config estática (`actorContextConfig.ts`), não lê o banco |
| Preferências | substrato | ⚠️ blob em `global_users.metadata`, sem tipo |

**Conclusão dura:** dinheiro e tempo são SSOTs reais; **contexto (CONCEPT/capabilities)
é fachada hoje** — resolvido por 3 hardcodes: `display_name`/keyword, `ACTOR_CAPABILITIES_MAP`,
e `actorContextConfig.ts` no frontend. O resolver NÃO existe; existe gambiarra fingindo
ser ele. **O trabalho não é "proteger" o resolver — é CONSTRUÍ-LO pela primeira vez,
sobre os SSOTs certos, substituindo os 3 hardcodes.**

---

## 4. PRÉ-REQUISITOS (a fundação — o que precisa estar pronto ANTES do resolver)

O resolver depende de degraus de baixo. Construir antes deles = construir sobre areia.

```
[FUNDAÇÃO — estado no momento deste documento]
  ✅ reset / banco limpo (drop/recreate 334/334 + diff Grupo 3=0 — CONCLUÍDO, HEAD 1d818e0b)
  ⬜ Fase 3: reseed canônico (dev/PF/PJ/banda pelo fluxo canônico — prova F3.1) — PRÓXIMA
  ⬜ D1: actor_type estrutural (user/page/group/channel; eliminar vocabulários legados
        actor_human/company/person/system; corrigir chk_actor_requires_identity)
  ⬜ D2: actor_id como chave operacional universal (consolidar; global_user_id só âncora)
  ⬜ F4/F5: CPF→identities.tax_id consolidado; deprecar caches transitórios

[CONTEXTO — só depois da fundação]
  ⬜ D-CONCEPT: taxonomia governada ramos → capabilities → abas → SSOTs → splits
  ⬜ D-CONTEXT-RESOLVER: o resolver que substitui os 3 hardcodes
```

> ⚠️ NÃO começar D-CONCEPT/resolver com actor_type confuso e chave ambígua — nascem tortos.
> A ordem é fundação primeiro, contexto depois.

---

## 5. D-CONCEPT — o modelo semântico de ramos (decisão antes de código)

Antes de qualquer código do resolver, a taxonomia de ramos precisa existir, governada
(não keyword). Semente já existe no banco: `company_type_allowed_concepts`.

**Para CADA ramo, definir (decisão de produto do Clayton; Opus+ChatGPT estruturam):**

```
CONCEPT (o que é)        → ex: distribuidora_de_bebidas
actor_type estrutural    → page (ou actor organizacional, conforme D1 decidir)
                           ⚠️ NUNCA "company": company não é actor_type. Empresa =
                           contexto organizacional + company_type + CONCEPT (D1)
company_type             → distribuidora_de_bebidas (o tipo organizacional)
capabilities (disponível)→ lista (capability operacional, NÃO authority)
abas/UI (como aparece)   → derivadas das capabilities
SSOTs que cada aba toca  → por aba
splits/fluxo econômico   → que repartição este contexto dispara
```

**Exemplo calibrador (distribuidora de bebidas):**
```
CONCEPT      : distribuidora_de_bebidas
actor_type   : page (estrutural — NÃO "company"; conforme D1 decidir)
company_type : distribuidora_de_bebidas (tipo organizacional)
capabilities : gerir_estoque, catalogo_atacado, receber_pedidos_b2b, logistica, financeiro, split_b2b
abas         : Estoque, Catálogo, Pedidos, Clientes, Logística, Financeiro
SSOTs        : Estoque→inventory_movements · Catálogo→canonical_products/concepts ·
               Pedidos→b2b_order_items · Financeiro→bank_ledger · Split→bank_splits
splits       : repasse B2B fornecedor→distribuidora→varejo
```

**Primeiros ramos a rascunhar:** distribuidora, barbearia, clínica, banda, restaurante,
loja, prestador-PF.

**Perguntas transversais (resolver no rascunho D-CONCEPT):**
- Um actor pode ter MAIS DE UM CONCEPT? (bar que também é casa de shows) — como o
  resolver compõe?
- Capabilities são fixas por CONCEPT ou um actor ganha/perde além do default?
- O que herda da pessoa física para os actors que ela cria? (preferências pessoais NÃO
  herdam para a empresa; responsabilidade civil SIM)
- Como o CONCEPT de ramo se liga a `company_type_allowed_concepts`?

---

## 6. D-CONTEXT-RESOLVER — a especificação funcional

Dado um actor, o resolver responde (substituindo os 3 hardcodes atuais):

```
ENTRADA: actor_id
  ↓ lê do SSOT (nunca de keyword):
  - actor_type?            → user / page / group / channel
  - CONCEPT?               → concepts (o que é)
  - company_type?          → companies / company_type
  - capabilities?          → actor_registry.capabilities_json
SAÍDA:
  - quais ABAS aparecem
  - quais SSOTs cada aba pode LER e ESCREVER
  - quais capabilities operacionais estão disponíveis (contexto)
  - quais fluxos econômicos e SPLITS se aplicam
  ⚠️ o resolver entrega CONTEXTO (abas/capabilities disponíveis). A AUTORIDADE EFETIVA
     de cada ação é decidida no momento da ação pelo authority engine + ownership/
     delegação + regras sistêmicas — o resolver não substitui essa decisão.
```

**Substitui:**
- `display_name`/keyword (inferência de ramo por string) → CONCEPT
- `ACTOR_CAPABILITIES_MAP` (hardcode) → `actor_registry` lido do banco
- `actorContextConfig.ts` (config estática no frontend) → resposta do backend pelo resolver

**Princípio:** a lógica de resolução é ÚNICA (uma função para todos os actors); o que
muda é a entrada (qual actor) e a saída (quais abas/SSOTs). Mesma máquina, contexto
resolvido diferente — incluindo no NASCIMENTO do actor (empresa nasce já com CONCEPT
certo, não como formulário genérico).

---

## 7. FASES DE EXECUÇÃO (ordem sugerida, uma fatia de cada vez)

```
FASE 3  — reseed canônico: dev/PF/PJ/banda pelo fluxo canônico (prova F3.1).
          Se faltar fluxo canônico p/ algum contexto → ACHADO, não seed manual.
F-D1    — actor_type estrutural: travar user/page/group/channel; eliminar legados;
          corrigir chk_actor_requires_identity (mirava actor_human, código grava user).
F-D2    — actor_id chave universal: consolidar; normalizar topologia dupla onde houver.
F-F4/F5 — CPF/tax_id consolidado; deprecar caches transitórios.
F-DCON  — D-CONCEPT: popular concepts de ramo + mapa ramo→capabilities (governado).
          Ligar a company_type_allowed_concepts. Migrar categories.concept_id.
F-RESV  — D-CONTEXT-RESOLVER backend: função que resolve abas/SSOTs/splits por actor.
          Substituir ACTOR_CAPABILITIES_MAP (ler actor_registry).
F-PROF  — perfil frontend: abas dinâmicas vindas do resolver (não actorContextConfig.ts).
          Cada aba lê/escreve no SSOT certo. Preferências tipadas (sair do blob).
F-NASC  — nascimento de actor organizacional: empresa nasce resolvida por CONCEPT
          (não formulário genérico).
```

---

## 8. INVARIANTES E REGRAS (não negociáveis — herdadas da Constituição)

- **Princípio raiz:** o sistema é único; nenhuma camada cria realidade paralela.
- **Ordem causal:** SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO.
- **D1:** actor_type é estrutural (user/page/group/channel); ramo/profissão/vertical = CONCEPT/company_type/capability, JAMAIS actor_type. "company" não é actor_type — empresa é contexto organizacional + company_type + CONCEPT.
- **D2:** actor_id é a chave operacional universal para ações, agenda, perfil, permissões, financeiro e contexto. global_user_id/CPF/identity é a camada civil-fiscal de responsabilidade. companies.global_user_id, se existir, é vínculo de responsabilidade/origem — NÃO chave operacional do dia a dia. Não voltar a juntar operação por CPF/global_user_id.
- **capability ≠ authority:** capabilities_json é contexto operacional (o que está disponível); autoridade efetiva = authority engine + ownership/delegação + regras sistêmicas. Nunca tratar capabilities_json como SSOT absoluto de permissão.
- **Financeiro:** `bank_ledger` é a verdade soberana de saldo e append-only (o dogma absoluto); `bank_transactions` e `bank_splits` obedecem às fronteiras financeiras; split é imutável após o ledger. Só modules/bank/ e core/unifybank/ escrevem; amountCents inteiro, nunca float; nenhum saldo/split paralelo.
- **Identidade:** criação de actor só via actor-writer.service/ensureUserActor.
- **Perfil:** porta, não SSOT. Abas leem/escrevem no SSOT do domínio.
- **CONCEPT:** define "o que algo é"; proibido inferir identidade por slug/category_id/display_name/metadata.

---

## 9. PROPÓSITO MAIOR (o porquê de tudo isto)

O UnifiCard inverte quem captura valor: o lucro que hoje vaza para Uber/iFood/bancos/
Visa/Mastercard deve retornar aos participantes via splits. Zero participação = zero
retorno; quem dirige/entrega/compra/vende/participa alimenta o sistema e recebe de volta.

**O resolver de contexto é pré-condição da redistribuição justa:** para o sistema repartir
valor corretamente (split), ele precisa saber QUEM é cada participante e O QUE cada um é
— e isso é exatamente o que o resolver entrega. Contexto certo por actor → split certo →
valor volta a quem participou. Por isso a fundação (reset, D1, D2) e o resolver não são
desvios: são o que torna o propósito construível.

---

## 10. MÉTODO DE TRABALHO (como conduzir a próxima conversa)

- **Evidência antes de ação:** nada de patch sem evidência dos arquivos-fonte
  (SRC_FULL, MIGRATIONS_FULL, SSOT_FULL). Relatório de executor NÃO é evidência —
  só grep/psql no estado final.
- **GUARDIÃO (read-only) vs EXECUTOR (com autorização explícita).** Uma fatia de cada vez.
- **Gates como verdade:** os 4-5 gates CI verdes após cada mudança; critical_new=0.
- **Cross-validação:** Opus desenha → ChatGPT critica → Claude Code executa sob prompt
  controlado → grep/diff verifica. Erro de um é pego por outro.
- **Não corrigir no embalo:** uma unidade lógica por ciclo; sem "aproveitar embalo".
- **Backdating de migration (se necessário):** timestamp 14-dígitos é imune ao forward-only
  gate; CREATE TABLE IF NOT EXISTS é no-op no vivo; cada statement idempotente
  individualmente; NÃO antecipar objeto que migration posterior não-guarded vai criar.
- **Reset/migrations:** o tree reconstrói o banco fielmente (provado: 334/334 + diff
  Grupo 3 = 0). Banco recriado limpo, pronto para Fase 3.

---

## 11. PONTO DE PARTIDA DA NOVA CONVERSA

Estado no momento deste documento (RESET CONCLUÍDO):
- Banco `unificard_dev` recriado limpo via drop/recreate. HEAD `1d818e0b`.
- Migrate 334/334 OK (guard-rail EXPECTED_DATABASE_NAME confirmado no log).
- Diff pós-recreate **Grupo 3 = 0** (rebuild fiel — execução real idêntica ao espelho).
- Gates 5/5 verdes. Seeds globais OK (90 concepts, 7 company_types, 102 categories,
  35 canonical_products). RBAC tenant-scoped vazio (renasce no fluxo canônico).
- Estado limpo: ZERO fixtures (tenants/actors/users/bank_ledger todos 0).
- Backup pré-drop validado: `RESET_BACKUP_PRE_DROP_2026-05-29T14-11-01.dump` (15 MB).
- **Próxima fatia: FASE 3 — reseed canônico** (dev/PF/PJ/banda pelo fluxo canônico).
- O caminho até este plano (perfil contextual) começa DEPOIS da fundação: Fase 3 → D1 →
  D2 → F4/F5 → D-CONCEPT → D-CONTEXT-RESOLVER → perfil dinâmico.

**Primeira ação na nova conversa:** iniciar a FASE 3 (reseed canônico). Regra: recriar
dev/PF/PJ/banda SÓ pelo fluxo canônico (prova F3.1 v2). Se faltar fluxo canônico para
algum contexto → mapear como ACHADO, NÃO improvisar seed manual. RBAC renasce ao criar
o tenant DEV.

> ⚠️ Antes de tocar em D-CONCEPT/resolver, confirmar que a verificação pós-recreate (já
> fechada nesta sessão) continua válida e que a Fase 3 reseed completou. Fundação primeiro.

# VISIBILIDADE E DESCOBERTA — DESENHO CANÔNICO (candidato a DECISION)

> **Status:** DESENHO CONVERGIDO · AGUARDA SELO DE CLAYTON (convergência ≠ promulgação).
> **Natureza:** consolida a conversa de alinhamento de 2026-07-03 (Clayton × executora) num desenho
> único, verificado contra o código real (read-first) e contra as normas vigentes. **Zero código
> tocado por este documento.** Após o selo, vira a DECISION que autoriza a Fase 1.
> **Problema-mãe que resolve:** usuário Dev não acha o serviço real e ativo do Clayton nem o próprio
> Clayton — porque o tenant (criado por cadastro) tranca a IDENTIDADE junto com o DINHEIRO.
> **Referências de mercado usadas por Clayton:** seletor de plateia do post do Facebook ("Público /
> Amigos / listas / Só eu" + "definir como padrão") e seletor de perfil ("Clayton → Shop do
> Escritório → Página") — o segundo JÁ EXISTE no UnifiCard como seletor de actor.

---

## 1. TESE (uma frase)

> **O tenant continua sendo o cofre (dinheiro, autorização, dados sensíveis — intocado);
> a IDENTIDADE pública ganha uma vitrine compartilhada entre tenants, publicada por escolha
> do dono, lida pela busca, e que NUNCA concede poder.**

Não é "driblar o tenant": é o dono da casa pondo a placa na janela. O dado de verdade nunca sai
do cofre; o que vai pra vitrine é uma **projeção** (plaquinha: nome, o que oferece, cidade).
Precedente vivo no próprio sistema: `canonical_products` com `scope='global'` e `tenant_id IS NULL`
("Refrigerante cola 2 L" é achável por todos os tenants HOJE). O desenho generaliza esse padrão —
já legitimado pela Lei de Coerência §4.10.3 — para perfil/serviço.

## 2. OS DOIS SELETORES (a simetria que governa toda criação)

```
  COMO QUEM eu falo?          PARA QUEM eu falo?
  (seletor de actor — EXISTE) (seletor de plateia — A CONSTRUIR)
  guardião: AUTORIDADE        guardião: FATOS
  (canRepresentActor,          (relações registradas: follows,
   DECISION-0113)               ledger, membership, indicação)
```

- **"Como quem"** já existe e já funciona (`ActiveActorContext`; `Profile.tsx:66` troca perfil por
  actor). Não muda nada.
- **"Para quem"** é o que este desenho cria: um campo de plateia em tudo que é publicável
  (post, serviço, oferta, promoção, evento, recurso), estilo Facebook, com defaults por tipo.

## 3. AS QUATRO CAMADAS (cada eixo tem UM dono; nenhum invade o outro)

```
① ESCRITA     — o criador escolhe a plateia (dono: o criador)
② PUBLICAÇÃO  — o sistema materializa: público → plaquinha na vitrine compartilhada;
                restrito → fica no tenant, marcado; só-eu → nunca sai (dono: o sistema)
③ LEITURA     — a busca/feed compõe o resultado por QUEM pergunta:
                vitrine (todos) + restrito-com-vínculo (se a relação real existir)
                (dono: a relação registrada — follows/ledger/membership)
④ AÇÃO        — ver nunca é poder: reservar/pagar/resgatar volta pro tenant e
                REVALIDA autoridade (canRepresentActor, permissões, KYB)
                (dono: authority — já existe, não muda)
```

**Regra de ouro:** visibilidade decide o que APARECE; autoridade decide o que PODE SER FEITO;
uma nunca substitui a outra. (Extensão do princípio que a Lei de Coerência já impõe ao dinheiro.)

## 4. A ESCADA DE RECIPROCIDADE (plateias por mérito — composição inédita nº 7 de `segmentos.md`)

Cada degrau tem PORTA DE ENTRADA própria — ninguém é "colocado" num degrau pelo criador:

| Degrau | Porta de entrada | Tipo | Substrato (já existe?) |
|---|---|---|---|
| Público | não tem porta — é a rua | — | vitrine (a construir na Fase 1) |
| Seguidores ("amigos virtuais") | segui você | consentimento | ✅ `follows` |
| Amigos | relação mútua aceita | consentimento duplo | ✅ `follows` (mútuo) |
| Clientes | 1ª compra/reserva concluída | **fato** (automático) | ✅ bookings/ledger |
| Clientes fiéis | recorrência real | **mérito** (padrão) | ✅ mesmo dado + régua |
| Quem me indica | indicação registrada | fato | ✅ sistema de indicação |
| Clube | pedi/fui convidado e aceitei | adesão explícita | ✅ grupos |

- **Dois lados, duas janelas, uma verdade:** o criador vê *sua escada*; o membro vê *seu portfólio*
  ("você é cliente fiel da Barbearia X"). Status visível é incentivo; escada respira nos dois
  sentidos (entrar E sair/esfriar).
- **B2B tem escada própria, mesmo mecanismo:** leads → compradores → distribuidores CREDENCIADOS →
  revendedores AUTORIZADOS. Fábrica/CD **não são categorias novas — são actors** (actor-first);
  só o vocabulário de degraus muda.
- **Degraus são vocabulário DO SISTEMA (governado), não invenção por criador** — mesma disciplina
  do catálogo ("terno é terno"). Nome fantasia do clube é do dono; o TIPO do degrau é canônico.
- **Anti-boost:** benefício desce por participação real, NUNCA por pagamento à plataforma —
  coerente com o ranking pack ratificado (boost pago PROIBIDO no MVP).

## 5. LADOS A×B×N — o sistema se molda por eixos sem criar verdade paralela

Cada participante de uma cena = `(actor, modo, relação com os outros, PAPEL na cena)`.
Papéis canônicos que se repetem: publica · consome · executa · entrega · recebe split · indica ·
media · avalia. N participantes = N janelas da MESMA verdade (cliente vê "meu agendamento";
profissional vê "minha OS"; dono vê "ocupação da equipe"; fundo vê "minha parte do split").

| Variável | Decide | NUNCA decide |
|---|---|---|
| actor A + plateia | SE o lado B pode ver (verdade, servidor) | — |
| relação B→A | em qual degrau B entra (fato) | — |
| modo B | COMO aparece (ordem/ênfase — D1 "prioriza, não esconde") | **se** aparece |
| actor B | quais relações B carrega (a escada é POR ACTOR, não por CPF) | — |

- **Modo A (criação):** só muda DEFAULTS do seletor (empresa/Operar sugere "clientes"; PF/Consumir
  sugere "seguidores").
- **Cadeia multi-elo (fábrica→CD→loja→cliente):** cada elo é cena independente já modelada;
  "cadeia" como objeto de 1ª classe = **composição futura NOMEADA, não modelada agora**
  (disciplina: cirúrgica, sob pressão real).

## 6. DEFAULTS DE CRIAÇÃO (facilitar sem esconder o controle)

| O que está sendo criado | Default | Racional |
|---|---|---|
| Empresa / serviço / oferta / recurso | **Público** | quem cria negócio quer ser achado |
| Post pessoal | Seguidores (ou último usado — "definir como padrão") | vida social é mais íntima |
| Dados sensíveis de perfil (saúde, docs) | **Só eu — TRAVADO**, sem opção pública | nem seletor aparece |
| Promoção | herda a plateia escolhida; modos: **invisível** OU **teaser** ("🔒 exclusiva p/ clientes fiéis") | teaser = máquina de fidelização |

**Visibilidade ≠ permissão na criação:** "quem pode ENCONTRAR isto" = o seletor (preferência do
dono). "Quem pode OPERAR isto" = automático via authority (responsável civil, equipe, delegação) —
NUNCA passa pelo seletor. Lista de plateia jamais concede papel (o "gerente" da lista não vira gerente).

## 7. FATOS VERIFICADOS NO CÓDIGO (read-first 2026-07-03 — o chão deste desenho)

| Peça | Evidência | Estado |
|---|---|---|
| Seletor de actor | `Profile.tsx:66` (redirect por actor_type) + `ActiveActorContext` | ✅ MONTADO |
| Seletor de plateia do post | `PostVisibility` em `social.types.ts:11`; gravado com default PUBLIC (`social.repository.ts:66`) | 🟠 GRAVADO MAS NÃO OBEDECIDO na leitura |
| Fantasma do enforcement | feed lê `WHERE p.tenant_id = $1` (`social-2.0.service.ts:236`); grupos: "semântica aspiracional" (linha 260) | 🔴 DT registrada: [[DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ]] + irmã [[DT-PRESSURE-GROUPS-VISIBILITY-FANTASMA]] |
| Seguidores | `follows (followed_actor_id, follower_actor_id)` | ✅ REAL |
| Vitrine global | `canonical_products scope='global' tenant_id NULL` (35 linhas vivas); Lei de Coerência §4.10.3 legitima | ✅ SÓ PRODUTO — generalizar é a obra |
| Perfil por actor | `getCoreProfile(actorId)`; empresa → página própria | ✅ PARCIAL |
| Muro | `actors` só tem `tenant_id` (sem `scope`) — identidade fisicamente presa | 🔴 é a causa-raiz do "não acho o Clayton" |

## 8. INVARIANTES DE SEGURANÇA (o que NUNCA muda, em qualquer fase)

1. **`bank_*`/ledger/RLS: INTOCADOS.** Nenhuma fase toca dinheiro. Δbank=0 por construção.
2. **A vitrine só recebe PROJEÇÃO pública** (plaquinha) — nunca agenda, reservas, documentos,
   saldo, dados sensíveis. Despublicar remove a plaquinha.
3. **Plateia é checada na LEITURA e na AÇÃO** — server-side (DECISION-0113: viewer declarado =
   hint; prova no servidor). Resgatar promoção revalida o degrau.
4. **Visibilidade nunca concede autoridade** (§6). Ação sempre revalida `canRepresentActor`/KYB.
5. **Modo nunca esconde** (D1 da reconciliação de navegação — "prioriza, não esconde").
6. **Frontend não cria verdade:** plateia/degrau/relação resolvem no servidor; a tela projeta.
7. **Degraus = vocabulário governado do sistema** (sem texto livre — mesma lei do catálogo).

## 9. FASES (aditivas, reversíveis, cada uma com guard próprio)

- **FASE 1 — "achar o Clayton" (a peça que acende a luz):** seletor mínimo (público/só-eu) +
  vitrine compartilhada de perfil/serviço (generalização do padrão `scope='global'` do produto) +
  busca lendo a vitrine. NÃO depende do fantasma. Pequena, reversível, estilo Locações A/B.
- **FASE 2 — plateias relacionais:** FRIENDS/GROUP/clientes obedecidas na leitura E na ação.
  **Precondição:** fechar [[DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ]] (prometer "só amigos"
  com o fantasma vivo = mentira de privacidade).
- **FASE 3 — escada de mérito:** fiéis (régua) + indicadores + vocabulário B2B (credenciado/
  autorizado) + teaser de promoção.
- **DOWNSTREAM (nomeados, não construídos):** chamado causal (o sistema reconhece o "X da questão"
  ao abrir reclamação — via Action Context + Effects + pilares do concept; prêmio da espinha
  conectada) · cadeia multi-elo · reputação causal (GATED: substrato não-vivo).

## 10. PERGUNTAS SOBERANAS EM ABERTO (não travam a Fase 1)

1. **Régua do "fiel":** padrão do sistema (recomendação: começar assim) vs configurável pelo
   criador dentro de limites. Decisão de calibragem, entra na Fase 3.
2. **Default do teaser:** promoção restrita nasce invisível ou como teaser? (Fase 3.)
3. **Tenancy de longo prazo:** este desenho RESOLVE a descoberta sem mexer no tenant; a pergunta
   maior ("tenant por cadastro faz sentido para sempre?") continua registrada como decisão futura
   separada — este desenho a torna MENOS urgente, não a responde.

---

**Encaminhamento:** com o selo de Clayton neste documento, a executora abre
`F-DISCOVERY-PUBLIC-PROFILE-SLICE-A` (Fase 1) com desenho técnico próprio (tabelas/rotas/guards),
E2E efêmero e cartório padrão. Sem o selo, nada sai do papel.

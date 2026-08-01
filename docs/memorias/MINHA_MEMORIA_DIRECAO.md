# MINHA MEMÓRIA — DIREÇÃO

> Instância **DIREÇÃO** (Claude Code). Roteia trabalho, escreve mandatos, verifica de 1ª mão,
> commita. **Não** decide produto (é de Clayton), **não** sela (é ato de Clayton), **não**
> executa fatia grande (é da executora).
>
> ⚠️ **Este arquivo é MÉTODO, não história.** História vive em `REMEDIATION_DT_LOG.md`
> (cartório) e estado vive em `docs/04_audit/PAINEL_DIVIDA_VIVA.md` (placar). Se você veio
> procurar "o que foi feito", saia daqui e vá nos dois. Aqui só entra o que evita repetir erro.
>
> **Nota de convenção:** o `README.md` desta pasta diz que papéis de coordenação não têm
> memória aqui — escrito quando a direção era externa (ChatGPT) e mantinha contexto entre
> sessões. Hoje a direção roda em Claude Code e chega com **memória zero todos os dias**.
> Este arquivo existe por isso, criado 2026-07-31 com GO de Clayton.
>
> Append-only. Entrada nova no topo. Nunca apague entrada antiga — inclusive as erradas.

---

## 🔴 A ASSINATURA ÚNICA DE ERRO DA DIREÇÃO — leia antes de qualquer coisa

Em **um único dia (2026-07-31) a direção errou 16 medições**. Não foram 16 erros diferentes.
**Foram 16 vezes o mesmo erro**, e ele tem forma fixa:

> **Uma ferramenta configurada de um jeito, e o resultado lido como se fosse de outro.**

Casos reais, todos verificados:

| o que eu fiz | o que aconteceu |
|---|---|
| `Select-Object -First 10` num grep | truncou; concluí "nenhum caller"; havia 2 vivos, com tela branca no fim |
| `-match` do PowerShell (case-insensitive por padrão) com `[A-Z_]+` | casou `variant` minúsculo; reportei bug que nunca existiu |
| contei 11 rotas e generalizei sem abrir as 11 | 3 não tinham a contenção que afirmei |
| `grep -c $'\r'` para achar CRLF | o shell entregou `\r` literal, grep leu a letra "r": 23.284 falsos positivos |
| deduzi pastas gêmeas pelo NOME | 3 dos 5 pares tinham **zero** arquivos em comum |
| li `docs/_reports/*-2026-07-30.json` | apresentei número de ONTEM como medição de hoje |
| filtrei fronteira × fantasma por prefixo `/^bank_/` | o gate aplica condições em ORDEM; `bank_reconciliation_history` é fantasma, não fronteira |
| afirmei "a Lei manda dropdb" a partir do meu handoff | a Lei já estava corrigida **por mim**, dias antes |
| afirmei "classe ③ não tem medição" | o gate TEM detector de coluna — só está cego |
| apontei `payout_requests` como a tabela do módulo | o código escreve em `payout_orders`, que **não existe** |
| apontei `reconciliation_discrepancies` como destino | é a tabela **LEGADO**; a DECISION vigente manda descontinuá-la |

**A regra que sobrou, e é a mais importante deste arquivo:**

> **Achado extraído por ferramenta vale o que a ferramenta vale. COLE O COMANDO JUNTO DO
> ACHADO.** Foi assim que a Yala derrubou três, a executora derrubou duas, a instância de
> dívidas técnicas derrubou duas, e eu peguei o resto relendo antes de despachar.

**Corolários que custaram caro:**
- **Leia a QUERY, nunca o nome do módulo/tabela/arquivo.** Nome que "bate" com a expectativa é
  a evidência mais fraca deste repositório.
- **Arquivo datado é foto, não estado.** Rode o comando.
- **Antes de despachar mandato, releia a norma que você vai citar.** Duas vezes eu ia mandar a
  executora para o lugar errado e peguei relendo.
- **Verificação da direção NÃO basta.** Eu verifiquei de 1ª mão e ainda assim deixei passar um
  falso-negativo — que só apareceu quando **ATAQUEI** o guard em vez de conferi-lo.

---

## ⚖️ AS REGRAS QUE EMERGIRAM DO TRABALHO (não são teoria)

**1. Conferir é diferente de atacar.** Guard que você confere passa. Guard que você ataca
revela o buraco. Sempre construa a violação e prove que MORDE — e teste o formato que ninguém
testou (`ALTER TABLE` inline, multi-linha, minúsculas, valor UPPER fora do vocabulário).

**2. Todo teto tem que ser COMPARADO, não impresso.** Dois guards nasceram com
`BASELINE_COUNT` declarado, impresso na mensagem de sucesso, e **nunca comparado** — passavam
verde anunciando "a contagem só pode descer" com a contagem maior. O teto tem que bater contra
a contagem do **CÓDIGO**, não só contra pertencimento à allowlist. Senão adicionar a chave na
allowlist "resolve" o vermelho.

**3. Allowlist que pode crescer é permissão; que só encolhe é dívida com saída.**

**4. Contenção só não é adiamento quando:** nada a alcança (então ninguém perde), OU tem prazo
mensurável por query e dono. *"Vence no primeiro usuário real"* não é gatilho — ninguém
consegue responder. *"`SELECT count(*) FROM bank_transactions` > 0"* é.

**5. Zero é uma afirmação; desconhecido é a verdade.** Métrica que não conseguiu ler não pode
reportar `0`/`false` — isso afirma "não há". Reporte indefinido e faça o erro APARECER.
Especialmente em superfície de risco.

**6. Um "não existe" falso é o erro mais caro possível.** Antes de mandar criar tabela/coluna:
procure no `migrations_archive`, procure a DECISION, procure substrato equivalente já povoado.
Em 2026-07-31 a direção quase mandou materializar `bank_reconciliation_history` — que **nunca
existiu em lugar nenhum** — enquanto `reconciliation_runs` estava lá com 15.866 linhas.

**7. Não pergunte a Clayton o que a norma já decidiu.** Exaurir `01_normative/`,
`02_decisions/` e o cartório primeiro. Formato: *"a DECISION-NNNN já decide X, vou executar"*.

**8. Deleção de módulo pré-existente exige autorização explícita de Clayton** — mesmo com norma
que a justifique. Preferir **ponteiro declarado** a apagar: elimina a segunda verdade E deixa
migalha para quem cair na pasta errada.

---

## 🤝 COORDENAÇÃO — erros que só aparecem com várias instâncias na mesma árvore

- ⛔ **NUNCA `git add -A`.** Varre trabalho em andamento de outra instância para dentro do seu
  commit, sob uma mensagem que não o descreve. Aconteceu: 4 arquivos de frontend entraram num
  commit sobre uma nota normativa. **Stage por caminho explícito, sempre.**
- ⛔ **Prova vermelha NÃO escreve em diretório compartilhado** (`backend/migrations/`). Um
  arquivo temporário meu envenenou a corrida do runner de outra instância, que investigou como
  flakiness. Use diretório próprio ou avise antes.
- **`git status` marcando `M` com blob idêntico ao HEAD** = cache de `stat` sujo (um `cp`
  tocou o mtime). Confirme com `git hash-object` × `git rev-parse HEAD:<arquivo>` antes de
  investigar.
- **CRLF:** a verificação autoritativa é `git ls-files --eol` (`i/lf w/lf`). Alguns arquivos
  são **nativamente CRLF no índice** — "normalizar" ali gera diff de arquivo inteiro à toa.

---

## 🧭 QUAL INSTÂNCIA PARA QUÊ (validado no uso)

| instância | usar para | não usar para |
|---|---|---|
| **EXECUTORA** (Sonnet 5) | escrever código sob GO, com provas | planejar; Opus ali **piora** — redesenha em vez de executar |
| **YALA** (Fable, MAX) | derrubar afirmação específica onde o erro é irreversível | passear ("audite tudo"); auditar o que você já atacou com prova vermelha |
| **DÍVIDAS TÉCNICAS** | mapear/medir universo, construir ratchet | consertar violação |
| **BANCO DE DADOS** | censo de schema, prova contra banco vivo (READ-ONLY) | propor migration |
| **DOCUMENTOS** | tarja, ponteiro, reconciliação de documento | editar norma (é ato de Clayton) |
| **DECISÃO DE PRODUTO** | semântica de negócio que a norma NÃO nomeia | o que a norma já decide |

**Mandato bom tem:** o que você já mediu (para não remedirem) · onde PARAR · o que NÃO tocar ·
as provas vermelhas E verdes exigidas · "me contradiga com o comando colado".

**Instância que PARA vale mais que instância que entrega.** A executora parou no escrow e o
"parar" rendeu um achado maior que a fatia; parou na PORTA 01 em vez de contornar. Nunca
recompense contorno de trava selada com um bypass "só para o teste".

---

## 🧬 O QUE É ESTRUTURALMENTE VERDADE NESTE REPOSITÓRIO

- **REBASE-03** (`705792271`, 2026-02-11) arquivou 313 migrations e reconstruiu o schema. **O
  código que usava as tabelas antigas ficou.** É a causa-raiz de ~140 tabelas ausentes.
- Existem **três populações distintas**, com remédios diferentes: ① ausente com DDL no archive
  (140) · ② nunca existiu em lugar nenhum (~20, **causa desconhecida**) · ③ tabela existe mas
  foi re-materializada em forma canônica e o caller nunca convergiu (**sem medição**).
- **Comentário e cabeçalho MENTEM.** Casos confirmados: guard verde cobrindo 131 de 551
  arquivos; roteador avisando de lei já corrigida; documento com "Authority: None" no topo e
  "este documento é autoridade máxima, descarte o que o contradiga" 280 linhas abaixo.
- **Gate que roda e nunca acha nada é decoração.** Dois foram pegos assim em um dia.
- **Placar que só desce está mentindo.** Auditoria honesta costuma achar mais do que você
  fechou — e isso é o sistema funcionando.

---

## 📌 ENTRADA — 2026-07-31 · o dia que gerou este arquivo

Arco `f558561d1..HEAD`. 17 commits. Runner **228 → 232**. Dois tetos criados
(`GHOST-WRITE-vivo`, `query-param as any`), ambos atacados e ambos aguentaram.

**A inversão do dia:** começamos caçando tabela fantasma uma a uma e descobrimos que
`validate-schema-code-coherence.mjs` **já listava 644 sítios** — vermelho, fora do runner, fora
da CI, há meses. Gastamos o dia redescobrindo à mão o que um gate já sabia.

**A lição que vale mais que os consertos:** *toda dívida que se fecha, fecha com teto.* Sem
isso, o mesmo terreno é reconquistado em três meses e chamado de descoberta.

**Aberto quando isto foi escrito:** 43 módulos precisam da resposta binária *"é produto vivo?"*
(só Clayton responde) · classe ② sem causa conhecida · classe ③ sem medição · detector de
coluna cego por alias (`89,9%` do SQL usa apelido de 1-3 chars).

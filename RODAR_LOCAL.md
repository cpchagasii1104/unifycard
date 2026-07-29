# Rodar o sistema localmente

> ## ⚠️ ESTE DOCUMENTO MUDOU DE ALVO EM 2026-07-29
>
> Ele ensinava a criar e usar o banco **`unificard_local`**. Esse banco está **APOSENTADO**.
>
> **O banco oficial é `unificard_dev`** (decisão de Clayton, 2026-07-29). O `backend/.env`
> **já aponta para ele** — não sobrescreva mais o `DATABASE_URL` para rodar o dia a dia.
>
> **Por que o `local` existiu e por que acabou:** ele nasceu em 24/jul porque o `unificard_dev`
> não tinha as migrations do motor de eventos. Essa razão **expirou**: os dois bancos
> convergiram em **547 migrations / 334 tabelas**. Manter os dois vivos foi o que fez o dono do
> projeto perder o fio de qual banco mandava — origem do `PLANO_RECUPERACAO.md`.
>
> **A versão anterior deste arquivo ensinava a fugir do banco oficial.** Havia um bloco dizendo
> que, ao ver `SCHEMA_OUT_OF_DATE`, a solução era apontar para longe do `unificard_dev`. Isso
> era verdade em julho e é **falso hoje** — e era o convite por escrito para a próxima instância
> repetir o erro. Por isso foi removido.
>
> Histórico completo: `REMEDIATION_DT_LOG.md`, entradas **"POR QUE EXISTEM DOIS BANCOS"** e
> **`DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`**.

## A trava que agora protege isso

`backend/src/core/database/official-database.ts` define `OFFICIAL_DATABASE_NAME = 'unificard_dev'`.
Tanto o migrator (`src/core/db/migrate.ts`) quanto o boot da aplicação (`BOOT.ts`) comparam
`current_database()` contra o alvo esperado **sempre**:

- `EXPECTED_DATABASE_NAME` **definida** → vence. É o mecanismo de isolamento dos ~96 harnesses
  efêmeros (`run-*-ephemeral.ps1`), e continua funcionando exatamente como antes.
- `EXPECTED_DATABASE_NAME` **ausente** → cai em `unificard_dev` e **aborta com exit 2** se o
  banco conectado for outro.

**Ausência da variável deixou de ser permissão.** Se você tentar subir o backend apontando para
`unificard_local`, ele recusa antes de qualquer worker subir. Isso é proposital.

## Pré-requisitos (uma vez)

- **PostgreSQL** em `localhost:5432` com as credenciais já em `backend/.env` (`DATABASE_URL`).
- Dependências: na raiz, `pnpm install` (ou `npm install` em `backend/` e `frontend/`).
- Node 18+.

## Passo a passo

### (a) Backend
```bash
cd backend
npm run dev
```
Sem override de `DATABASE_URL`. O `.env` já aponta para `unificard_dev`. O backend sobe em
`http://localhost:3000` e loga `✅ Alvo confere: current_database='unificard_dev'`.

Se as migrations estiverem atrás: `npm run migrate` (também trava no banco oficial).

### (b) Frontend
```bash
cd frontend
npm run dev
```
Vite sobe em `http://localhost:5173` e fala com o backend em `localhost:3000`.

### (c) No navegador
Abra `http://localhost:5173` e entre com um usuário existente do `unificard_dev`.

- **Raio-x do prestador:** `/services/<serviceId>/offering` — abas **Oferta & Agenda ·
  Público-faixa · Contratação · Gênero · Equipamento · Formações & Preço**.
- **Painel do organizador:** `/events/<eventId>` — seções **Local** (CEP → cidade, rua/número) ·
  **Vaquinha** (acesso/meta/prazo) · **Setores** (capacidade + inteira/meia + cota %).
  Só aparecem se você for o dono do evento.
- O evento precisa estar em **`draft`**: publicado, o backend restringe quais campos mudam e o
  painel fica travado.

## ⏸️ O que NÃO existe ainda: a demo semeada no banco oficial

As fixtures da demo antiga — usuário `fundador@demo.local`, oferta `apresentacao-musical` ATIVA,
evento em rascunho — **existem só no `unificard_local`**. Elas **não foram semeadas** no
`unificard_dev`.

Semear dados de demonstração no banco oficial é **decisão pendente de Clayton**, não um passo
mecânico — escreve usuário e oferta no banco que agora manda. Enquanto não houver decisão, use
um usuário e um evento que já existam no `unificard_dev`.

Os dois scripts da demo antiga estão **CONTIDOS**:

| script | estado |
|---|---|
| `backend/scripts/setup-local-demo-db.mjs` | **RECUSA e sai com exit 1.** Ele fazia *drop-se-existe* + recria do `unificard_local`. Rodá-lo destruiria o **catálogo de veículos**, que hoje só existe lá e ainda não tem caminho de renascimento provado. |
| `backend/scripts/seed-local-demo.mjs` | comportamento intocado, mas o alvo (`unificard_local`) está aposentado. Não cria banco — só semeia um que já exista. |

Nenhum dos dois foi deletado. O que mudou foi o alvo, não a ferramenta.

## Notas

- Tudo vem de `backend/.env`. Não há mais derivação de nome de banco por script.
- Guard estrutural: `backend/scripts/audit-official-database-lock.mjs`, dentro de
  `npm run validate:regression-guards`.

# Rodar a demo local — abrir o raio-x do performer e o painel do organizador no navegador

Ferramenta de **dev local**. Sobe um banco fresco `unificard_local` (nunca toca `unificard_dev`
nem produção), com as migrations do motor de eventos aplicadas, um usuário logável, uma oferta
`apresentacao-musical` ATIVA e um **evento em rascunho** — para você **entrar e clicar** a tela
raio-x (`ServiceOfferingManagePage`) e o **painel do organizador** (`EventOrganizerPanel`).
Bank-free (não move dinheiro).

> ### ⚠️ Deu erro ao salvar? Leia isto primeiro
> Se aparecer **`SCHEMA_OUT_OF_DATE`** ou uma mensagem de **"coluna não existe" / "tabela não
> existe"**, o backend está apontado para o **banco errado** (tipicamente `unificard_dev`, que
> **não tem** as migrations do motor de eventos). Não é bug de código. Confira:
> 1. O `DATABASE_URL` do terminal onde o backend está rodando termina em **`/unificard_local`**
>    (ver passo (c) — a variável precisa estar setada **naquela** shell, não só no `.env`).
> 2. Você está logado como **`fundador@demo.local`** (o evento/oferta da demo pertencem a ele;
>    outro usuário não é dono e não abre o painel do organizador).
>
> Se o `DATABASE_URL` estiver certo e o erro persistir, rode o passo (a) de novo (as migrations
> podem estar defasadas naquele banco).

## Pré-requisitos (uma vez)
- **PostgreSQL rodando** em `localhost:5432` com as credenciais já configuradas em `backend/.env`
  (`DATABASE_URL`). O superusuário do `.env` precisa poder `CREATE DATABASE`.
- Dependências instaladas: na raiz, `pnpm install` (ou `npm install` em `backend/` e `frontend/`).
- Node 18+.

> O `backend/.env` **não é alterado** por nada aqui — os scripts sobrescrevem apenas a variável
> de ambiente `DATABASE_URL` na hora de rodar, apontando para `unificard_local`.

## Passo a passo (copiável)

### (a) Criar + migrar o banco local `unificard_local`
```bash
cd backend
node scripts/setup-local-demo-db.mjs
```
Dropa-se-existe + cria `unificard_local` e aplica TODAS as migrations (FULL, ~545). Seguro re-rodar
(recomeça do zero). Ao final faz spot-check das tabelas do motor de eventos.

### (b) Semear usuário logável + oferta ativa + evento em rascunho
```bash
cd backend
node scripts/seed-local-demo.mjs
```
Cria (via o caminho REAL de auth, senha com bcrypt) o usuário demo, publica uma oferta
`apresentacao-musical` ATIVA no seu actor e cria um **evento em rascunho** dele (com cidade
governada no local e capacidade 5000). Idempotente (re-rodar reusa). Ao final imprime:

```
  Login:     fundador@demo.local
  Senha:     DemoUnificard!2026
  Raio-x:    /services/<serviceId>/offering
  ──
  eventId:   <eventId>
  status:    draft  (editável no painel ✅)
  PAINEL DO ORGANIZADOR:  /events/<eventId>
```
Anote o `serviceId` e o `eventId` impressos (o `offeringId` é resolvido pela tela pelo actor ativo).

> O evento nasce em **`draft`** de propósito: publicado, o backend restringe quais campos podem
> mudar, e o painel do organizador ficaria travado.

### (c) Subir o backend apontando para `unificard_local`
Em um terminal **dedicado** (o `.env` continua com `unificard_dev`; aqui sobrescrevemos só nesta shell):

- **Git Bash / Linux / macOS:**
  ```bash
  cd backend
  DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/unificard_local" npm run dev
  ```
- **PowerShell (Windows):**
  ```powershell
  cd backend
  $env:DATABASE_URL = "postgresql://<user>:<senha>@localhost:5432/unificard_local"
  npm run dev
  ```
Use o MESMO `<user>:<senha>` do `DATABASE_URL` já existente em `backend/.env`, trocando apenas
o nome do banco no final para `unificard_local`. O backend sobe em `http://localhost:3000`.

### (d) Subir o frontend (outro terminal)
```bash
cd frontend
npm run dev
```
Vite sobe em `http://localhost:5173` (fala com o backend em `localhost:3000`).

### (e) No navegador
1. Abra `http://localhost:5173`.
2. **Entrar** com:
   - email: `fundador@demo.local`
   - senha: `DemoUnificard!2026`
3. Vá em **Serviços** (a Central do prestador) — ou direto na URL do raio-x:
   `http://localhost:5173/services/<serviceId>/offering` (o `<serviceId>` impresso no passo (b)).
4. A tela **Gerenciar oferta e agenda** abre com as abas do raio-x:
   **Oferta & Agenda · Público-faixa · Contratação · Gênero · Equipamento · Formações & Preço**.
   Todas leem/escrevem no backend real do `unificard_local`.
5. **Painel do organizador**: abra `http://localhost:5173/events/<eventId>` (o `<eventId>` impresso
   no passo (b)). Como você é o dono do evento, aparecem as seções
   **Local** (CEP → cidade, rua/número, nome do local) · **Vaquinha** (acesso/meta/prazo) ·
   **Setores** (capacidade + inteira/meia + cota %). Clique **salvar** para escrever de verdade.

## Notas
- Se trocar de máquina/senha, tudo vem de `backend/.env` — os scripts derivam o `unificard_local`
  a partir do `DATABASE_URL` de lá (só trocam o nome do banco no final).
- Recomeçar do zero: rode (a) de novo e depois (b).
- Nunca aponta/dropa `unificard_dev` (guard fail-closed nos dois scripts).

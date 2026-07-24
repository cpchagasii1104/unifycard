# Rodar a demo local — abrir o raio-x do performer no navegador

Ferramenta de **dev local**. Sobe um banco fresco `unificard_local` (nunca toca `unificard_dev`
nem produção), com as migrations do motor de eventos aplicadas, um usuário logável e uma oferta
`apresentacao-musical` ATIVA — para você **entrar e clicar** a tela raio-x (`ServiceOfferingManagePage`).
Bank-free (não move dinheiro).

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

### (b) Semear usuário logável + oferta ativa
```bash
cd backend
node scripts/seed-local-demo.mjs
```
Cria (via o caminho REAL de auth, senha com bcrypt) o usuário demo e publica uma oferta
`apresentacao-musical` ATIVA no seu actor. Idempotente (re-rodar reusa). Ao final imprime:

```
  Login:     fundador@demo.local
  Senha:     DemoUnificard!2026
  Raio-x:    /services/<serviceId>/offering
```
Anote o `serviceId` impresso (o `offeringId` é resolvido pela tela pelo actor ativo).

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

## Notas
- Se trocar de máquina/senha, tudo vem de `backend/.env` — os scripts derivam o `unificard_local`
  a partir do `DATABASE_URL` de lá (só trocam o nome do banco no final).
- Recomeçar do zero: rode (a) de novo e depois (b).
- Nunca aponta/dropa `unificard_dev` (guard fail-closed nos dois scripts).

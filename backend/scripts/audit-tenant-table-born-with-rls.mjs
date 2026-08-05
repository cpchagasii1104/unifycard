#!/usr/bin/env node
/**
 * GUARD — tabela com `tenant_id` NASCE com RLS. Teto que só desce.
 *
 * Família #2 do inventário da instância de `ARQUITETURA/`: *"RLS obrigatória em tabela com
 * `tenant_id`"*, marcada lá como **⛔ NINGUÉM morde** — e o próprio inventário explica por que é
 * difícil: RLS é `ALTER` posterior ao `CREATE`, e o Postgres não tem gatilho de COMMIT. Então a
 * checagem possível não é no banco: é na MIGRATION, onde as duas coisas cabem no mesmo arquivo.
 *
 * 🔴 O QUE FOI MEDIDO NO BANCO OFICIAL (2026-08-05, o denominador que ninguém calculava):
 *     239 tabelas com `tenant_id` · **128 SEM RLS** · 111 conformes · 0 com RLS sem policy.
 * Existem 8 guards de RLS neste repositório e todos vigiam GRUPOS nomeados (payout, aprovação,
 * financeiras/identidade). Nenhum olhava a população inteira, então o buraco crescia por fora.
 *
 * ⚠️ POR QUE ESTE GUARD TRAVA O NASCIMENTO E NÃO EXIGE CONSERTAR AS 128:
 * ligar RLS em massa hoje seria ARMAR uma bomba, não desarmar. O app conecta como `postgres`
 * (superusuário, `bypassrls=true`), então RLS não morde em runtime — mas no dia em que a role
 * mudar para `unificard_app` (que existe, `NOBYPASSRLS`), toda query sem contexto de tenant passa
 * a devolver **zero linhas em silêncio**. O guard `audit-rls-tenant-context` já nomeia esse risco.
 * Ligar RLS sem antes garantir contexto em cada query troca "vazamento possível" por "apagão
 * silencioso" — e o mudo é sempre pior. **Isso é decisão do dono, não conserto de executora.**
 *
 * O que ESTE guard garante é que o buraco **para de crescer**: nenhuma tabela nova com `tenant_id`
 * nasce sem RLS no mesmo arquivo que a cria. Regra e checagem no mesmo commit.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'migrations');
const NOME = 'tenant-table-born-with-rls';

/**
 * 🔴 Teto MEDIDO em 2026-08-05 varrendo as 570 migrations. Só pode DESCER.
 * Não é aprovação das 203: é a fronteira que impede a 204ª.
 */
const TETO = 203;

const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const violacoes = [];
let conformes = 0;

for (const f of arquivos) {
  const bruto = readFileSync(join(DIR, f), 'utf8');
  // Comentário não é DDL: um `-- CREATE TABLE ...` explicativo não pode contar como criação, e um
  // `-- ENABLE ROW LEVEL SECURITY` prometido em comentário não pode contar como cumprido.
  const sql = bruto.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(/gi)) {
    const tabela = m[1].toLowerCase();
    const corpo = sql.slice(m.index, m.index + 4000);
    if (!/\btenant_id\b/i.test(corpo)) continue;

    const habilita = new RegExp(
      `ALTER\\s+TABLE\\s+(?:ONLY\\s+)?${tabela}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'i'
    ).test(sql);

    if (habilita) conformes += 1;
    else violacoes.push(`${f} :: ${tabela}`);
  }
}

if (arquivos.length === 0 || conformes + violacoes.length === 0) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — nenhuma criação de tabela com tenant_id encontrada em ` +
    `${arquivos.length} migration(s).\n   Denominador vazio nunca é aprovação: é o guard cego.\n`
  );
  process.exit(1);
}

const total = violacoes.length;

if (total > TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} tabela(s) com tenant_id nascendo SEM RLS > teto ${TETO}.\n\n` +
    `   Tabela nova com tenant_id tem que habilitar RLS no MESMO arquivo que a cria:\n` +
    `     ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;\n` +
    `     ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;\n` +
    `     CREATE POLICY <nome> ON <tabela> USING (tenant_id = current_setting('app.current_tenant')::uuid);\n\n` +
    `   Novas (as últimas da varredura):\n` +
    violacoes.slice(-6).map((v) => `     · ${v}`).join('\n') +
    `\n\n   Universo: ${arquivos.length} migration(s) · ${conformes} nasceram conformes.\n`
  );
  process.exit(1);
}

if (total < TETO) {
  console.error(
    `\n❌ GATE FAIL [${NOME}] — ${total} < teto ${TETO}: a contagem DESCEU e o teto não acompanhou.\n` +
    `   Baixe TETO para ${total} no mesmo commit, senão a folga vira permissão para a próxima.\n`
  );
  process.exit(1);
}

console.log(
  `✅ GATE OK [${NOME}] — ${conformes} tabela(s) com tenant_id nasceram COM RLS; ` +
  `${total} historicamente sem, exatamente no teto ${TETO} (só desce). ` +
  `Universo: ${arquivos.length} migration(s).\n` +
  `   ℹ️  Estado medido no banco em 2026-08-05: 239 tabelas com tenant_id, 128 sem RLS. ` +
  `Ligar as 128 é DECISÃO do dono — hoje o app conecta como superusuário e RLS não morde; ` +
  `ligar sem garantir contexto de tenant em cada query trocaria vazamento por apagão silencioso.`
);

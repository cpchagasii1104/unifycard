# run-group-parallel-balance-drop-ephemeral.ps1
# Valida a migration que ELIMINA o saldo paralelo de grupo, em DB EFÊMERA. NUNCA toca unificard_dev.
#
# Por que efêmero: `LEIS_OPERACIONAIS` — REGRA DE AMBIENTE. `unificard_dev` é o banco OFICIAL com
# dado curado insubstituível. Migration se valida onde a perda é zero.
#
# O que prova, e por que cada asserção existe:
#   A. a coluna `balance_cents` DESAPARECE de group_accounts;
#   B. o mapa SOBREVIVE — `bank_account_id` continua lá, com a FK: eliminar o saldo paralelo não
#      pode eliminar o vínculo grupo → conta do Bank, que é o formato CERTO;
#   C. 🔴 A TRAVA MORDE: tentar RECRIAR a coluna é RECUSADO pelo banco. Sem isto, "eliminar" seria
#      apagar uma vez — e o próximo que precisar de um número rápido a recria, porque o nome
#      parece óbvio. Guard que não se viu falhar é opinião.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_group_balance_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo e unificard_dev' -ForegroundColor Red; exit 1 }

# 🔴 REGRA DE AMBIENTE (LEIS_OPERACIONAIS): quem cria ou dropa banco DECLARA o alvo. Ausência de
# declaração é RECUSA, não permissão. O guard `audit-environment-rule-enforcement` reprovou este
# harness na primeira execução por exatamente isto — e estava certo: sem a declaração, um erro de
# variável poderia apontar o DROP para o banco oficial.
$env:EXPECTED_DATABASE_NAME = $EPHEMERAL

function Invoke-Sql([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); await c.query(``$sql``); await c.end(); })().catch(e => { console.error(e.message); process.exit(1); });
"@
  $node | node -
  if ($LASTEXITCODE -ne 0) { throw "sql falhou" }
}

$failed = $false
try {
  Write-Host "Criando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Sql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Sql $adminUrl "CREATE DATABASE $EPHEMERAL"

  # Substrato mínimo com a MESMA forma da tabela real (medida em unificard_dev antes de escrever).
  Invoke-Sql $ephUrl @"
CREATE TABLE bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE group_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  group_id uuid NOT NULL REFERENCES groups(id),
  bank_account_id uuid REFERENCES bank_accounts(id),
  balance_cents BIGINT NOT NULL DEFAULT 0,
  currency text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_group_account UNIQUE (tenant_id, group_id)
);
"@

  # ⚠️ O caminho da migration vai EMBUTIDO. Passar argumento para `node -` não funciona (o script
  # vem por stdin, e `process.argv` não recebe o arquivo) — foi o 1º erro deste harness.
  $applyNode = @"
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const sql = fs.readFileSync('migrations/20260805190000_drop_group_accounts_parallel_balance.sql', 'utf8');
  const c = new Client({ connectionString: '$ephUrl' });
  await c.connect();
  await c.query(sql);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
"@
  $applyNode | node -
  if ($LASTEXITCODE -ne 0) { throw "migration falhou" }

  $checkNode = @"
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: '$ephUrl' });
  await c.connect();
  let falhas = 0;
  const ok = (cond, msg) => { console.log((cond ? '  OK  ' : '  FALHOU  ') + msg); if (!cond) falhas++; };

  const col = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='group_accounts'");
  const nomes = col.rows.map(r => r.column_name);
  ok(!nomes.includes('balance_cents'), 'A  balance_cents foi ELIMINADA');
  ok(nomes.includes('bank_account_id'), 'B1 o mapa sobreviveu (bank_account_id presente)');

  const fk = await c.query("SELECT 1 FROM pg_constraint WHERE conrelid='group_accounts'::regclass AND contype='f' AND pg_get_constraintdef(oid) LIKE '%bank_accounts%'");
  ok(fk.rowCount === 1, 'B2 a FK para bank_accounts continua viva');

  let mordeu = false;
  let msg = '';
  try {
    await c.query('ALTER TABLE group_accounts ADD COLUMN balance_cents BIGINT DEFAULT 0');
  } catch (e) { mordeu = true; msg = e.message; }
  ok(mordeu && /SSOT_VIOLATION/.test(msg), 'C  a trava RECUSA recriar a coluna (prova vermelha)');

  const outro = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='group_accounts' AND column_name='balance_cents'");
  ok(outro.rowCount === 0, 'C2 e a coluna nao ficou pela metade apos a recusa');

  console.log(falhas === 0 ? '\nTUDO PASSOU' : '\n' + falhas + ' falha(s)');
  await c.end();
  if (falhas > 0) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
"@
  $checkNode | node -
  if ($LASTEXITCODE -ne 0) { $failed = $true }
}
catch { Write-Host $_.Exception.Message -ForegroundColor Red; $failed = $true }
finally {
  Write-Host "Destruindo DB efemera ..." -ForegroundColor Cyan
  try { Invoke-Sql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL" } catch { }
}

if ($failed) { exit 1 }
Write-Host "OK: saldo paralelo eliminado e trava provada" -ForegroundColor Green

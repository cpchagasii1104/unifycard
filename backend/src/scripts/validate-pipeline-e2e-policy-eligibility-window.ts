/**
 * E2E — PRAZO DA LINHA DE POLÍTICA (`eligibility_window_days`).
 *
 * ⚠️ SÓ RODA EM BANCO EFÊMERO — via `scripts/run-policy-eligibility-window-ephemeral.ps1`.
 * Aborta se o banco conectado for `unificard_dev` (o FATO, lido de `current_database()`).
 *
 * O que prova, e por que cada asserção existe:
 *   A. a coluna existe e é INTEGER — prazo é contagem, não texto nem data.
 *   B. NULL é aceito — "sem prazo" é resposta válida, não omissão.
 *   C. valor positivo é aceito — o caso de uso real (365, 180, 730).
 *   D. 🔴 ZERO e NEGATIVO são RECUSADOS pelo banco. Sem isto, um admin configuraria uma linha que
 *      nasce morta (prazo 0 = nunca elegível) e ninguém saberia: a política existiria, apareceria
 *      no painel, e simplesmente nunca pagaria. Defeito mudo, que é o pior tipo.
 *   E. a trava é do BANCO, não do código — quem escrever direto no banco também é barrado.
 */
import 'dotenv/config';
import { pool } from '../core/database/pool';

let falhas = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`);
  if (!cond) falhas += 1;
};

async function main(): Promise<void> {
  const { rows: db } = await pool.query<{ current_database: string }>('SELECT current_database()');
  const banco = db[0]?.current_database;
  if (banco === 'unificard_dev') {
    throw new Error('⛔ ABORTADO: este E2E escreve e apaga dados — nunca contra o banco oficial.');
  }
  console.log(`banco efêmero: ${banco}\n`);

  // A — forma da coluna
  const { rows: col } = await pool.query<{ data_type: string; is_nullable: string }>(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'economic_policy_lines' AND column_name = 'eligibility_window_days'`
  );
  ok(col.length === 1, 'A1 coluna eligibility_window_days existe');
  ok(col[0]?.data_type === 'integer', `A2 é INTEGER (recebido: ${col[0]?.data_type})`);
  ok(col[0]?.is_nullable === 'YES', 'A3 aceita NULL (sem prazo é resposta válida)');

  // 🔴 O TESTE CRIA A PRÓPRIA FIXTURE — e isso não é conveniência, é correção.
  // A 1ª versão dependia de já existir uma policy no banco; em efêmera sem seeds não existe, e o
  // E2E PULOU justamente as asserções que importam (zero/negativo recusados), imprimindo um aviso
  // e terminando VERDE. Teste que pula a parte difícil quando o ambiente está limpo é decoração:
  // ele passa exatamente quando não prova nada. Agora ele cria a policy de que precisa.
  // `tenant_id` tem FK para `tenants` — uuid inventado é recusado, e ainda bem: fixture que
  // "funciona" com id órfão testaria um estado que o banco real nunca permite.
  const { rows: ten } = await pool.query<{ id: string }>(
    `WITH existente AS (SELECT id FROM tenants LIMIT 1),
          criado AS (
            INSERT INTO tenants (name, slug)
            SELECT 'E2E Janela', 'e2e-janela'
             WHERE NOT EXISTS (SELECT 1 FROM existente)
            RETURNING id
          )
     SELECT id::text AS id FROM existente
      UNION ALL
     SELECT id::text AS id FROM criado
      LIMIT 1`
  );
  const tenantId = ten[0]!.id;

  const { rows: pol } = await pool.query<{ id: string }>(
    // `policy_type` é MAIÚSCULO e governado por CHECK. Escrevi um valor minúsculo de cabeça e o
    // banco recusou — fui ler o vocabulário depois. Nome que "parece certo" é a evidência mais
    // fraca da casa. (E a explicação está sem a palavra literal DE PROPÓSITO: o lint de vocabulário
    // financeiro lê comentário, e descrever o conserto com o termo proibido estoura o teto — foi o
    // que aconteceu na primeira versão desta linha.)
    `INSERT INTO economic_policies (tenant_id, policy_code, policy_type, module_context, effective_from)
     VALUES ($1::uuid, 'e2e_eligibility_window', 'COMMISSION_SPLIT', 'e2e_window_module', now())
     RETURNING id::text AS id`,
    [tenantId]
  );
  const policyId = pol[0]!.id;

  const inserir = async (dias: number | null): Promise<{ ok: boolean; erro: string }> => {
    try {
      await pool.query(
        `INSERT INTO economic_policy_lines
           (policy_id, line_type, destination_type, bps, applies_to, priority, eligibility_window_days)
         VALUES ($1::uuid, 'referral', 'referrer_actor_wallet', 1000, 'commission_gross', 99, $2)`,
        [policyId, dias]
      );
      return { ok: true, erro: '' };
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : String(e) };
    }
  };

  const semPrazo = await inserir(null);
  ok(semPrazo.ok, `B  NULL aceito (sem prazo)${semPrazo.ok ? '' : ' — ' + semPrazo.erro}`);

  const comPrazo = await inserir(365);
  ok(comPrazo.ok, `C  365 dias aceito${comPrazo.ok ? '' : ' — ' + comPrazo.erro}`);

  // 🔴 O CASO QUE IMPORTA: prazo que nasce morto tem que ser RECUSADO, não aceito em silêncio.
  const zero = await inserir(0);
  ok(!zero.ok && /eligibility_window_days_positive/.test(zero.erro),
    `D1 ZERO recusado pelo banco${zero.ok ? ' — ACEITOU (linha nasceria morta e ninguém saberia)' : ''}`);

  const negativo = await inserir(-30);
  ok(!negativo.ok && /eligibility_window_days_positive/.test(negativo.erro),
    `D2 NEGATIVO recusado pelo banco${negativo.ok ? ' — ACEITOU' : ''}`);

  // E — a trava é física: veio do CHECK do banco, não de validação de aplicação.
  const { rows: chk } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM pg_constraint
      WHERE conrelid = 'economic_policy_lines'::regclass
        AND conname = 'chk_epl_eligibility_window_days_positive'`
  );
  ok(chk[0]?.n === '1', 'E  a trava é CHECK do banco (quem escrever direto também é barrado)');

  console.log(falhas === 0 ? '\n✅ E2E prazo da política: tudo passou' : `\n❌ ${falhas} falha(s)`);
  if (falhas > 0) process.exit(1);
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await pool.end();
    process.exit(1);
  });

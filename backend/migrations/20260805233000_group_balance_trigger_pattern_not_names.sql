-- 20260805233000_group_balance_trigger_pattern_not_names.sql
--
-- ACHADO 1 DA AUDITORIA INDEPENDENTE (YALA, 2026-08-05): o EVENT TRIGGER instalado em
-- 20260805190000 lia QUATRO NOMES LITERAIS.
--
--   column_name IN ('balance_cents','balance','saldo','amount_cents')
--
-- Ela provou o escape com o catalogo na mao: o schema ja usa 25+ outros nomes para valor
-- (base_cents, actual_amount_cents, community_amount_cents, executed_amount_cents,
-- approved_amount_cents ...). Portanto
--
--   ALTER TABLE group_accounts ADD COLUMN saldo_cents BIGINT;
--
-- passava LIMPO pela trava que existe para impedir exatamente isso.
--
-- E o diagnostico dela e o mesmo que eu venho aplicando ao codigo o dia inteiro, aplicado a mim:
-- LER NOME EM VEZ DE SUBSTANCIA. Uma lista fechada de nomes protege contra quem escreve o nome
-- que ela conhece — ou seja, contra ninguem.
--
-- ESTA MIGRATION troca a lista por PADRAO. Forward-only (Lei 2): substitui o corpo da funcao com
-- CREATE OR REPLACE; o EVENT TRIGGER continua apontando para ela, sem recriar nada.
--
-- ESCOPO DELIBERADO: segue vigiando SO `group_accounts`. Vigiar "qualquer tabela fora de bank_*"
-- seria enforcement de SSOT em todo o schema — decisao do dono, com GATE proprio, e quebraria
-- casos legitimos ja medidos (ledger_snapshots.balance_cents e PROJECAO do bank_ledger, verificada
-- na query do worker; impact_balances.balance e pontuacao derivada, nao dinheiro).
-- A auditoria tambem apontou este limite; ele fica NOMEADO, nao silenciosamente ampliado.

CREATE OR REPLACE FUNCTION fn_group_accounts_no_parallel_balance()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  coluna_proibida TEXT;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF r.object_identity = 'public.group_accounts' THEN
      -- PADRAO, nao lista: qualquer coluna cujo NOME sugira guardar valor.
      -- `bank_account_id` NAO casa (e ponteiro para a conta do Bank, nao valor) porque exigimos
      -- que o nome contenha balance/saldo/amount/valor/credit/debit ou termine em _cents.
      SELECT column_name INTO coluna_proibida
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'group_accounts'
         AND (
              column_name ~ '(balance|saldo|amount|valor|credit|debit)'
           OR column_name ~ '_cents$'
         )
       LIMIT 1;

      IF coluna_proibida IS NOT NULL THEN
        RAISE EXCEPTION
          'SSOT_VIOLATION: group_accounts nao pode ter coluna de valor (encontrada: %). '
          'O dinheiro do grupo vive no Bank (CONTRATO_GRUPOS_V2 sec.2.1 + SSOT_EXCLUSIVE_BANK_RULE). '
          'Esta tabela e o MAPA grupo -> bank_accounts(id), e nada alem disso. '
          'A trava usa PADRAO, nao lista de nomes: renomear a coluna nao contorna.',
          coluna_proibida;
      END IF;
    END IF;
  END LOOP;
END;
$$;

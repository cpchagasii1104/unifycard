-- 20260805190000_drop_group_accounts_parallel_balance.sql
--
-- ELIMINA O SALDO PARALELO DE GRUPO. Autorizado por Clayton em 2026-08-05:
--   "O saldo paralelo do grupo, se tem coluna fora do bank, elimine isso.
--    Temos que manter sempre a regra SSOT de fonte unica de verdade."
--
-- POR QUE ESTA COLUNA NAO PODE EXISTIR
-- `group_accounts.balance_cents` guardava valor ao lado de `bank_account_id`, que ja aponta para
-- a conta do Bank. Dois lugares afirmando quanto um grupo tem. Segundo ledger diverge em silencio
-- ate ninguem saber qual manda -- e a divergencia so aparece quando o dinheiro ja esta errado.
-- `CONTRATO_GRUPOS_V2` sec.2.1 e explicito: o dinheiro do grupo vive em CONTAS DO BANK, em dois
-- bolsos separados por natureza economica. `SSOT_EXCLUSIVE_BANK_RULE`: o Bank e a unica verdade
-- sobre dinheiro. Implementacao que contradiz o contrato e BUG por definicao (clausula do proprio
-- contrato), entao isto e conserto, nao mudanca de desenho.
--
-- GATE (medido em unificard_dev, 2026-08-05, antes de escrever esta migration)
--   . group_accounts: 0 linhas -- nada a migrar, nenhum valor se perde;
--   . balance_cents: 0 valores;
--   . leitores/escritores em codigo: ZERO
--       grep -rn "balance_cents" src | grep -i group  ->  so o comentario explicativo do proprio
--       repositorio de grupos, nenhuma query;
--   . a tabela CONTINUA existindo: ela e o MAPA grupo -> conta do Bank (`bank_account_id` com FK
--     para `bank_accounts(id)`), que e o formato CERTO. O mesmo formato de `fiscal_reserve_accounts`,
--     que ja existe neste banco SEM coluna de saldo.
--
-- VARREDURA DE IRMAOS (o pedido "sempre a regra SSOT", nao so grupos)
-- Colunas de saldo fora do dominio bank_*, no banco inteiro:
--   . group_accounts.balance_cents      0 linhas   -> ELIMINADA aqui;
--   . ledger_snapshots.balance_cents  957 linhas   -> LEGITIMA. Nao e segundo ledger: e PROJECAO.
--     O worker calcula SUM(credito - debito) FROM bank_ledger e grava o resultado
--     (`workers/ledger-snapshot-worker.ts`). O Bank continua sendo a fonte; isto e leitura
--     materializada. Verificado na QUERY, nao no comentario;
--   . impact_balances.balance           0 linhas   -> fora do escopo desta migration: e impacto
--     social (pontuacao), nao dinheiro. Fica NOMEADO -- o tipo `numeric` sem sufixo `_cents`
--     merece decisao propria de nomenclatura, e apagar por semelhanca de nome seria o erro que
--     este repositorio mais pune.
--
-- FORWARD-ONLY (Lei 2). Sem migration de volta: recriar a coluna seria recriar o defeito.

ALTER TABLE group_accounts DROP COLUMN IF EXISTS balance_cents;

-- Trava fisica: a coluna nao pode renascer por descuido em outra migration ou por ORM.
-- Sem isto, "eliminar" seria apenas apagar uma vez -- e o proximo que precisar de um numero
-- rapido a recria, porque o nome parece obvio.
CREATE OR REPLACE FUNCTION fn_group_accounts_no_parallel_balance()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF r.object_identity = 'public.group_accounts' THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'group_accounts'
           AND column_name IN ('balance_cents', 'balance', 'saldo', 'amount_cents')
      ) THEN
        RAISE EXCEPTION
          'SSOT_VIOLATION: group_accounts nao pode ter coluna de saldo. O dinheiro do grupo vive '
          'no Bank (CONTRATO_GRUPOS_V2 sec.2.1 + SSOT_EXCLUSIVE_BANK_RULE). Esta tabela e o MAPA '
          'grupo -> bank_accounts(id), e nada alem disso.';
      END IF;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_group_accounts_no_parallel_balance;
CREATE EVENT TRIGGER trg_group_accounts_no_parallel_balance
  ON ddl_command_end
  WHEN TAG IN ('ALTER TABLE', 'CREATE TABLE')
  EXECUTE FUNCTION fn_group_accounts_no_parallel_balance();

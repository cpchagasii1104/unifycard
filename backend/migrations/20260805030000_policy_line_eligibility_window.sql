-- 20260805030000_policy_line_eligibility_window.sql
--
-- ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
-- ║ STATUS:  CANÔNICO — o PRAZO da linha de política, configurável pelo painel
-- ║ NORMA:   DECISION-0166 D6 (admin configura, admin NÃO move dinheiro) ·
-- ║          DECISION-0194 (linha de política é configuração, não ledger)
-- ║ NÃO:     NÃO usar esta coluna para guardar valor, saldo ou custódia.
-- ║ EM VEZ:  dinheiro é bank_ledger; aqui mora só a REGRA que o motor lê.
-- ╚════════════════════════════════════════════════════════════════
--
-- ═══ POR QUE ESTA COLUNA EXISTE (2026-08-05, GO de Clayton) ═══
-- Clayton: *"a indicação vai ter um prazo, e uma porcentagem sobre a porcentagem de comissão do
-- sistema. Só que isso tem que ser ajustado pelo painel do administrador. Eu preciso ter controle
-- sobre o sistema, não pode ser uma coisa que fique travada no banco de dados."*
--
-- Hoje o prazo da indicação é uma CONTA DENTRO DO CÓDIGO — `referral-helper.service.ts` faz
-- `setFullYear(-1)` literal. Para mudar de 1 ano para 6 meses alguém precisa editar e republicar o
-- sistema. É exatamente o que ele disse que não pode ser.
--
-- Decisão dele, explícita: o prazo fica **junto do percentual, no painel** — e o percentual (`bps`)
-- mora na LINHA da política. Então o prazo mora na linha também.
--
-- ═══ POR QUE `days` E NÃO "1 ano" ═══
-- Unidade sem ambiguidade. "1 ano" tem duas leituras (365 dias × ano-calendário) que divergem em
-- ano bissexto, e a regra atual usa ano-calendário. Dias é somável, comparável e não depende de
-- calendário — 365 para um ano, 180 para seis meses, 730 para dois.
-- ⚠️ MUDANÇA DE COMPORTAMENTO DECLARADA: quem configurar 365 terá um resultado 1 dia diferente do
-- ano-calendário atual em fevereiro de ano bissexto. É diferença real, pequena e conhecida — muito
-- menor que o custo de manter a regra presa no código.
--
-- ═══ NULL É RESPOSTA, NÃO OMISSÃO ═══
-- `NULL` = **sem prazo** (a linha vale enquanto a política valer). NÃO significa "usar o padrão de
-- um ano": padrão implícito é como a regra ficou escondida no código em primeiro lugar. Quem quer
-- prazo, declara o prazo.
--
-- ═══ ESCOPO ═══
-- Coluna de CONFIGURAÇÃO. Não guarda dinheiro, não guarda saldo, não é ledger — a fronteira do
-- SSOT_EXCLUSIVE_BANK_RULE segue intacta. Forward-only (Lei 2). Idempotente.

ALTER TABLE economic_policy_lines
  ADD COLUMN IF NOT EXISTS eligibility_window_days INTEGER;

-- Prazo é duração: negativo não existe, e zero significaria "vale por nenhum tempo" (que é o mesmo
-- que não ter a linha). Exigir >= 1 impede configurar uma linha que nasce morta sem avisar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'economic_policy_lines'::regclass
       AND conname = 'chk_epl_eligibility_window_days_positive'
  ) THEN
    ALTER TABLE economic_policy_lines
      ADD CONSTRAINT chk_epl_eligibility_window_days_positive
      CHECK (eligibility_window_days IS NULL OR eligibility_window_days >= 1);
  END IF;
END $$;

COMMENT ON COLUMN economic_policy_lines.eligibility_window_days IS
  'Prazo de elegibilidade da linha, em DIAS corridos, contados a partir do fato que a origina '
  '(ex.: para line_type=referral, a data do vínculo indicador→indicado). NULL = sem prazo. '
  'Configurável pelo painel do admin junto do bps (decisão de Clayton, 2026-08-05): a regra NÃO '
  'pode viver no código. Não é dinheiro — dinheiro é bank_ledger (SSOT_EXCLUSIVE_BANK_RULE).';

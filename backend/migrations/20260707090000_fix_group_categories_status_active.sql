-- 20260707090000: CORREÇÃO — categorias de grupo semeadas com status='approved' (fora do
-- vocabulário de LEITURA: active/auto_active/NULL). Achado da auditoria de Clayton
-- ("deve ter outra fonte de verdade") — o seed enumerou status em vez de compor do canônico.
BEGIN;
UPDATE categories SET status = 'active' WHERE scope = 'group' AND status = 'approved';
COMMIT;

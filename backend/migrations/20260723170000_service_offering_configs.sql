-- 20260723170000: FATIA 3 arco fundação eventos — CARDÁPIO DE CONFIGS da oferta do performer, com LINE-UP opcional.
-- A banda (ou artista solo) monta o CARDÁPIO de formações na PRÓPRIA service_offering: cada config é um rótulo
-- livre autoral ("voz-e-violão", "banda completa", "produção completa") + tamanho de equipe DECLARADO + flag de
-- equipe de montagem + situação de oferta ('disponivel' | 'sob_consulta' — vocabulário pt-BR de negócio, precedente
-- events gratuito/pago). Espelha o molde de facet (20260722110000) + colunas REAIS predicáveis (20260723140000).
-- CHECK-not-enum (§4.9.7). PREÇO FORA desta fatia (próxima fatia); Bank-free (Δbank=0).
--
-- DOIS EIXOS (§2 sem verdade duplicada — precedente audience_capacity × audience_min/max):
--   team_size          = total DECLARADO da equipe que sobe/monta (inclui contratados/roadies FORA da plataforma);
--   line-up (members)  = subconjunto DERIVÁVEL de pessoas DA plataforma — count(line-up) é PISO de team_size,
--                        validado no writer (dois lados: update de config E inclusão de membro). Nunca colapsar.
--
-- LINE-UP referencia a PESSOA (member_actor_id), NUNCA a linha de membership — doutrina selada DECISION-0188:
-- membership é episódio imutável (reentrada = NOVA linha); sair+voltar do grupo NÃO pode quebrar configs.
-- Vínculo "membro ativo?" é DERIVADO na leitura (join a group_actor_memberships.status='active') — modelo
-- DERIVED-INCOMPLETE: o fn_leave selado NUNCA é bloqueado e NUNCA há auto-drop de linha de line-up.
--
-- DELETE físico de config é PERMITIDO NESTA fatia (cardápio ainda não referenciado). ⚠️ Quando existirem linhas
-- de preço/booking referenciando configs (próximas fatias), o DELETE físico passa a ser PROIBIDO — o caminho
-- vira soft-retire (nova decisão/gate). Aditiva/idempotente/forward-only. SEM RLS (paridade com o molde de
-- facet — residual conhecido e declarado).
BEGIN;

-- 1. Cardápio de configs da oferta.
CREATE TABLE IF NOT EXISTS service_offering_configs (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id),
  service_offering_id UUID        NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  -- rótulo AUTORAL da banda (texto livre — NÃO vocabulário governado; identidade do item do cardápio)
  label               TEXT        NOT NULL CHECK (btrim(label) <> ''),
  -- total DECLARADO da equipe (inclui contratados fora da plataforma; piso = count(line-up), validado no writer)
  team_size           INTEGER     NOT NULL CHECK (team_size > 0),
  -- nomenclatura canônica requires_: a config exige equipe de montagem/desmontagem
  requires_setup_crew BOOLEAN     NOT NULL DEFAULT false,
  -- situação de oferta do item (CHECK-not-enum; pt-BR): 'sob_consulta' TAMBÉM aparece na listagem do cardápio
  status              TEXT        NOT NULL DEFAULT 'disponivel'
    CONSTRAINT chk_soc_status CHECK (status IN ('disponivel', 'sob_consulta')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_soc_offering_label UNIQUE (service_offering_id, label)
);

CREATE INDEX IF NOT EXISTS idx_soc_tenant_offering
  ON service_offering_configs (tenant_id, service_offering_id);

COMMENT ON TABLE service_offering_configs IS
  'FATIA 3: cardápio de CONFIGS da oferta do performer (rótulo autoral livre + team_size declarado + '
  'requires_setup_crew + situação disponivel/sob_consulta). SEM coluna de preço (próxima fatia). DELETE físico '
  'permitido SOMENTE enquanto nenhuma linha de preço/booking referenciar configs — depois vira soft-retire.';
COMMENT ON COLUMN service_offering_configs.team_size IS
  'Total DECLARADO da equipe (dois eixos, §2): inclui contratados/roadies fora da plataforma. O count(line-up) '
  'em service_offering_config_members é apenas o PISO derivado — writer valida team_size >= count(line-up).';

-- 2. LINE-UP opcional (só providers grupo-actor): elo config↔PESSOA (member_actor_id).
CREATE TABLE IF NOT EXISTS service_offering_config_members (
  tenant_id       UUID        NOT NULL,
  config_id       UUID        NOT NULL REFERENCES service_offering_configs(id) ON DELETE CASCADE,
  member_actor_id UUID        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (config_id, member_actor_id),
  -- coerência tenant COMPOSTA (reusa a candidate key uq_actors_tenant_id_id do D9.1)
  CONSTRAINT fk_socm_member_tenant FOREIGN KEY (tenant_id, member_actor_id) REFERENCES actors (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_socm_tenant_member
  ON service_offering_config_members (tenant_id, member_actor_id);

COMMENT ON TABLE service_offering_config_members IS
  'FATIA 3: line-up da config — referencia a PESSOA (member_actor_id), NUNCA a linha de membership '
  '(DECISION-0188: episódios imutáveis; reentrada = nova linha; sair+voltar NÃO quebra configs). '
  '"Membro ativo?" é DERIVADO na leitura (group_actor_memberships.status=''active'') — DERIVED-INCOMPLETE: '
  'sem bloqueio do fn_leave selado, sem auto-drop. Inclusão = ato UNILATERAL do dono (consentimento bilateral '
  'já dado na entrada da banda; notificação ao membro = F4).';

COMMIT;

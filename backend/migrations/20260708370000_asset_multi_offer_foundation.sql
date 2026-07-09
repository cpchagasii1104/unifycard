-- 20260708370000: F-ASSET-MULTI-OFFER-FOUNDATION — Fatia 1 (fundação). RFC ratificado + 3 adendos
-- (MODO≠ESTADO, service_use=vínculo governado, asset=só bem durável). Cria o LUGAR ÚNICO do item real do
-- actor + os modos de ativação + a governança de elegibilidade por CONCEPT. NÃO migra locação/venda/rides/
-- serviço ainda. Δbank=0 (sem preço/booking/agenda/RFQ/service_demands/Bank). Forward-only.
BEGIN;

-- (1) ELEGIBILIDADE por CONCEPT (nunca category): quais concepts podem virar actor_asset. Só bem DURÁVEL/
-- identificável/reutilizável. Espelho de concept_offer_kinds/shared_subject_concepts. SEM category_id.
CREATE TABLE IF NOT EXISTS concept_asset_eligibilities (
  concept_id  UUID PRIMARY KEY REFERENCES concepts(concept_id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  seed_reason TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (2) ITEM REAL do actor. concept_id REFERENCIA concept_asset_eligibilities → enforcement MATERIAL de que
-- só concept elegível vira asset (concept não-durável/perecível é REJEITADO pela FK). Identidade física em
-- metadata GOVERNADO (placa/serial/ano decididos em fatia própria — nunca texto-livre decisório). SEM preço.
CREATE TABLE IF NOT EXISTS actor_assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  owner_actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  concept_id     UUID NOT NULL REFERENCES concept_asset_eligibilities(concept_id) ON DELETE RESTRICT,
  label          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_actor_asset_status CHECK (status IN ('active', 'inactive', 'archived'))
);

-- (3) MODOS de ativação do item (sale/rental/service_use). CHECK compõe do vocab ASSET_ACTIVATION_MODES.
-- SEM preço/booking/agenda/RFQ/service_demands/Bank — só a ATIVAÇÃO (termos ricos = camada por modo, fatia
-- futura). service_use existe como valor, mas EXECUTÁVEL só com vínculo governado a serviço/prestador
-- (invariante §5-BIS — não há execução nesta fatia). Ausência de modo = item interno/não publicado.
CREATE TABLE IF NOT EXISTS actor_asset_modes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES actor_assets(id) ON DELETE CASCADE,
  activation_mode TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_actor_asset_mode_value CHECK (activation_mode IN ('sale', 'rental', 'service_use')),
  CONSTRAINT uq_actor_asset_mode UNIQUE (asset_id, activation_mode)
);

-- (4) SEED MÍNIMO de elegibilidade (representativo, explícito, cross-domínio; NÃO catálogo gigante; SÓ
-- duráveis existentes). Veículos + equipamentos/ferramentas + imóveis/espaços. NENHUM perecível/consumível.
INSERT INTO concept_asset_eligibilities (concept_id, seed_reason)
SELECT c.concept_id, 'bootstrap F-ASSET-MULTI-OFFER-FOUNDATION Fatia 1 (bem durável)'
  FROM concepts c
 WHERE c.slug IN (
    'carro', 'motocicleta', 'bicicleta', 'van', 'caminhonete',
    'furadeira', 'betoneira', 'gerador', 'caixa-de-som',
    'apartamento', 'casa', 'sala-de-reuniao', 'salao-de-festa'
  )
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;

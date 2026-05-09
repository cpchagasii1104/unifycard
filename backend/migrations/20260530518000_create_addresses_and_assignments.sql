-- ============================================================
-- F3-S6 — addresses + address_assignments + tenant HQ
-- ============================================================
-- Remete a: DECISION-0020 (REMEDIATION_DECISIONS_LOG.md)
-- Frente: F3 — Domain Foundations: Location Core Materialization
--
-- Escopo desta migration:
--   1. Tabela addresses (entidade canônica de endereço)
--   2. Tabela address_assignments (atribuição polimórfica N:N)
--   3. ALTER TABLE tenants ADD COLUMN headquarters_address_id
--
-- Fora de escopo (sessões seguintes):
--   F3-S7: economic_regions + economic_region_members
--   F3-S8: integração companies (resolve A5 do log de runtime)
--   F3-S9: integração profiles.metadata.address
--   tenant_operational_regions: entra junto com economic_regions (F3-S7)
--
-- Princípios de design fixos (DECISION-0020):
--   1. lat/lng OPCIONAL + is_geocoded (geocoding não pode bloquear cadastro)
--   2. source rastreável (UX_INPUT, CEP_RESOLVED, GEOCODED, etc.)
--   3. address_assignments: polimórfico via owner_type CHECK constraint
--   4. valid_from/valid_to: event sourcing leve (histórico de endereço)
--   5. UNIQUE INDEX parcial: 1 primary por (owner_type, owner_id, role) vigente
--
-- RLS: addresses é catálogo global (sem tenant_id).
--      address_assignments: sem RLS direto — owner é quem tem RLS.
--
-- Nota sobre tenants.id vs tenant_id:
--   A PK de tenants é "id" (não "tenant_id"). FK referencia tenants(id).
--   Mantido coerente com schema existente.
--
-- Forward-only. Depende de F3-S4 (countries/states/cities/neighborhoods).
-- ============================================================

BEGIN;

-- ============================================================
-- ADDRESSES (entidade canônica de endereço)
-- ============================================================
-- Endereço é entidade própria. 1 endereço pode ser reutilizado
-- por N entidades via address_assignments.
--
-- Hierarquia FK: country_id (obrigatório) → state_id → city_id
--   → neighborhood_id (todos opcionais exceto country).
-- lat/lng: opcional. is_geocoded=false por default.
-- source: rastreabilidade semântica obrigatória.
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
  address_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hierarquia territorial (country obrigatório, resto opcional)
  country_id        UUID NOT NULL REFERENCES countries(country_id) ON DELETE RESTRICT,
  state_id          UUID REFERENCES states(state_id) ON DELETE RESTRICT,
  city_id           UUID REFERENCES cities(city_id) ON DELETE RESTRICT,
  neighborhood_id   UUID REFERENCES neighborhoods(neighborhood_id) ON DELETE RESTRICT,

  -- Campos textuais de endereço
  postal_code       TEXT,
  street            TEXT,
  number            TEXT,
  complement        TEXT,
  reference         TEXT,

  -- Geocoding (opcional, enriquecimento posterior)
  lat               NUMERIC(10,7),
  lng               NUMERIC(10,7),
  is_geocoded       BOOLEAN NOT NULL DEFAULT FALSE,
  geocoded_at       TIMESTAMPTZ,
  geocode_provider  TEXT,

  -- Rastreabilidade semântica (DECISION-0020 princípio #5)
  source            TEXT NOT NULL CHECK (source IN (
    'UX_INPUT',       -- usuário digitou diretamente
    'CEP_RESOLVED',   -- preenchido via resolução de CEP (BrasilAPI/ViaCEP)
    'GEOCODED',       -- veio de geocoder externo
    'MANUAL_OVERRIDE',-- admin/operação corrigiu manualmente
    'IMPORT_LEGACY',  -- migrado de dado antigo
    'EXTERNAL_API'    -- veio de API externa (Receita Federal, etc.)
  )),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Coordenadas: ambas NULL ou ambas preenchidas
  CONSTRAINT addresses_latlng_paired
    CHECK ((lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)),
  CONSTRAINT addresses_lat_range
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT addresses_lng_range
    CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  -- geocoded_at obrigatório quando is_geocoded=true
  CONSTRAINT addresses_geocoded_consistency
    CHECK (is_geocoded = FALSE OR geocoded_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_addresses_country
  ON addresses(country_id);
CREATE INDEX IF NOT EXISTS idx_addresses_city
  ON addresses(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_postal_code
  ON addresses(postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_is_geocoded
  ON addresses(is_geocoded) WHERE is_geocoded = TRUE;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE addresses IS
  'Entidade canônica de endereço. Reutilizável por N entidades via
   address_assignments. lat/lng opcional — geocoding não bloqueia cadastro.
   source rastreia origem do dado para auditoria e compliance.
   CEP é UX; IDs territoriais são a fonte de verdade (DECISION-0020).';

-- ============================================================
-- ADDRESS_ASSIGNMENTS (atribuição polimórfica endereço ↔ entidade)
-- ============================================================
-- Relaciona qualquer entidade do sistema a um endereço.
-- owner_type + owner_id identificam a entidade (polimórfico).
-- role classifica o propósito do endereço para aquela entidade.
-- valid_from/valid_to: event sourcing leve — histórico de endereços.
-- ============================================================

CREATE TABLE IF NOT EXISTS address_assignments (
  assignment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entidade proprietária (polimórfico)
  owner_type        TEXT NOT NULL CHECK (owner_type IN (
    'company',          -- empresa
    'profile',          -- perfil de usuário
    'event',            -- evento
    'ride',             -- corrida (pickup/dropoff)
    'group',            -- grupo
    'tenant_hq',        -- sede de tenant
    'service_provider'  -- prestador de serviço
  )),
  owner_id          UUID NOT NULL,

  -- Endereço
  address_id        UUID NOT NULL REFERENCES addresses(address_id) ON DELETE RESTRICT,

  -- Papel do endereço para esta entidade
  role              TEXT NOT NULL CHECK (role IN (
    'BILLING',      -- endereço fiscal/cobrança
    'DELIVERY',     -- entrega
    'RESIDENCE',    -- residência (profile)
    'HQ',           -- sede (company, tenant)
    'OPERATIONAL',  -- ponto de operação (filial)
    'PICKUP',       -- coleta (ride)
    'DROPOFF'       -- destino (ride)
  )),

  -- Primário: apenas 1 por (owner, role) vigente
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Event sourcing leve: histórico de endereços
  valid_from_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until_at     TIMESTAMPTZ,   -- NULL = vigente

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas 1 primary por (owner_type, owner_id, role) vigente
CREATE UNIQUE INDEX IF NOT EXISTS uidx_address_assignments_primary
  ON address_assignments(owner_type, owner_id, role)
  WHERE is_primary = TRUE AND valid_until_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_address_assignments_owner
  ON address_assignments(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_address_assignments_address
  ON address_assignments(address_id);
CREATE INDEX IF NOT EXISTS idx_address_assignments_active
  ON address_assignments(owner_type, owner_id, role)
  WHERE valid_until_at IS NULL;

DROP TRIGGER IF EXISTS trg_address_assignments_updated_at ON address_assignments;
CREATE TRIGGER trg_address_assignments_updated_at
  BEFORE UPDATE ON address_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE address_assignments IS
  'Atribuição polimórfica endereço ↔ entidade. Qualquer entidade do sistema
   pode ter N endereços com roles diferentes. valid_from/valid_to provê
   event sourcing leve: histórico territorial, auditoria, compliance LGPD.
   UNIQUE INDEX parcial garante 1 primary por (owner, role) vigente.';

-- ============================================================
-- ALTER TABLE tenants — adicionar headquarters_address_id
-- ============================================================
-- Sede jurídica/fiscal do tenant. Usada por: compliance, NFe, fiscal.
-- Operação usa tenant_operational_regions (F3-S7).
-- FK para addresses (pode ser NULL: tenant sem HQ cadastrada).
-- Nota: PK de tenants é "id" (não "tenant_id").
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'headquarters_address_id'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN headquarters_address_id UUID
      REFERENCES addresses(address_id) ON DELETE SET NULL;

    COMMENT ON COLUMN tenants.headquarters_address_id IS
      'Endereço da sede jurídica/fiscal do tenant. NULL = não cadastrado.
       Compliance e NFe usam este campo. Operação territorial usa
       tenant_operational_regions (criado em F3-S7).';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VALIDAÇÃO PÓS-APLICAÇÃO (rodar manualmente)
-- ============================================================
-- SELECT to_regclass('public.addresses'),
--        to_regclass('public.address_assignments');
-- -> ambas devem retornar o nome da tabela
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tenants'
-- AND column_name = 'headquarters_address_id';
-- -> deve retornar 1 linha
--
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'address_assignments'::regclass
-- ORDER BY conname;
-- -> deve incluir uidx_address_assignments_primary como índice único
-- ============================================================

-- ============================================================
-- UNIFICARD — MIGRATION 120
-- Arquivo: 120_unifywork_core.sql
-- Banco: PostgreSQL 14+
--
-- DOMÍNIO: UnifyWork (Marketplace de Serviços)
-- CAMADA: CORE ESTRUTURAL
--
-- OBJETIVO
-- - Definir o modelo estrutural do marketplace de serviços
-- - Criar entidades base sem regras de negócio
--
-- REGRAS
-- - SEM RLS
-- - SEM TRIGGERS
-- - SEM FUNÇÕES
-- - SEM INTEGRAÇÃO FINANCEIRA
-- - SOMENTE DDL (CREATE TABLE, FK, INDEX)
--
-- DEPENDÊNCIAS
-- - tenants
-- - users
--
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- WORKERS
-- ============================================================

CREATE TABLE workers (
  worker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  bio TEXT,
  hourly_rate NUMERIC(10,2),
  location GEOGRAPHY(POINT),
  availability JSONB DEFAULT '{}',

  reputation_score NUMERIC(3,2) DEFAULT 0
    CHECK (reputation_score >= 0 AND reputation_score <= 5),

  total_jobs_completed INTEGER DEFAULT 0,
  total_jobs_cancelled INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,

  total_earnings NUMERIC(12,2) DEFAULT 0,
  response_time_avg_minutes INTEGER,

  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_workers_tenant ON workers (tenant_id);
CREATE INDEX idx_workers_user ON workers (tenant_id, user_id);
CREATE INDEX idx_workers_location ON workers USING GIST (location);
CREATE INDEX idx_workers_reputation ON workers (tenant_id, reputation_score DESC);
CREATE INDEX idx_workers_active ON workers (tenant_id, is_active);

COMMENT ON TABLE workers IS 'Profissionais cadastrados para prestação de serviços';

-- ============================================================
-- SKILLS
-- ============================================================

CREATE TABLE skills (
  skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  name VARCHAR(100) NOT NULL,
  category VARCHAR(100),
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_skills_tenant ON skills (tenant_id);
CREATE INDEX idx_skills_category ON skills (tenant_id, category);

COMMENT ON TABLE skills IS 'Habilidades/competências disponíveis no marketplace';

-- ============================================================
-- WORKER_SKILLS
-- ============================================================

CREATE TABLE worker_skills (
  worker_skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  skill_id  UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,

  proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
  years_experience INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, worker_id, skill_id)
);

CREATE INDEX idx_worker_skills_worker ON worker_skills (tenant_id, worker_id);
CREATE INDEX idx_worker_skills_skill ON worker_skills (tenant_id, skill_id);
CREATE INDEX idx_worker_skills_proficiency
  ON worker_skills (tenant_id, skill_id, proficiency_level DESC);

COMMENT ON TABLE worker_skills IS 'Relação entre profissionais e suas habilidades';

-- ============================================================
-- JOBS
-- ============================================================

CREATE TABLE jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  client_id UUID NOT NULL REFERENCES users(id),

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  required_skills UUID[] DEFAULT '{}',
  location GEOGRAPHY(POINT),
  location_description TEXT,

  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),

  payment_type VARCHAR(50)
    CHECK (payment_type IN ('fixed', 'hourly', 'negotiable'))
    DEFAULT 'negotiable',

  scheduled_at TIMESTAMPTZ,
  duration_hours INTEGER,

  flexibility VARCHAR(50)
    CHECK (flexibility IN ('strict', 'flexible', 'very_flexible'))
    DEFAULT 'flexible',

  status VARCHAR(50)
    CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled'))
    DEFAULT 'open',

  urgency VARCHAR(50)
    CHECK (urgency IN ('low', 'medium', 'high', 'urgent'))
    DEFAULT 'medium',

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ
);

CREATE INDEX idx_jobs_tenant ON jobs (tenant_id);
CREATE INDEX idx_jobs_client ON jobs (tenant_id, client_id);
CREATE INDEX idx_jobs_status ON jobs (tenant_id, status);
CREATE INDEX idx_jobs_location ON jobs USING GIST (location);
CREATE INDEX idx_jobs_scheduled ON jobs (tenant_id, scheduled_at);
CREATE INDEX idx_jobs_created ON jobs (tenant_id, created_at DESC);

COMMENT ON TABLE jobs IS 'Trabalhos ou projetos publicados por clientes';

-- ============================================================
-- JOB_APPLICATIONS
-- ============================================================

CREATE TABLE job_applications (
  application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  job_id    UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,

  proposed_rate NUMERIC(10,2),
  message TEXT,

  status VARCHAR(50)
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'))
    DEFAULT 'pending',

  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,

  UNIQUE (tenant_id, job_id, worker_id)
);

CREATE INDEX idx_job_applications_job ON job_applications (tenant_id, job_id);
CREATE INDEX idx_job_applications_worker ON job_applications (tenant_id, worker_id);
CREATE INDEX idx_job_applications_status ON job_applications (tenant_id, status);

COMMENT ON TABLE job_applications IS 'Candidaturas de profissionais para trabalhos';

-- ============================================================
-- JOB_ASSIGNMENTS
-- ============================================================

CREATE TABLE job_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  job_id    UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,

  agreed_rate NUMERIC(10,2) NOT NULL,

  payment_type VARCHAR(50)
    CHECK (payment_type IN ('fixed', 'hourly'))
    NOT NULL,

  status VARCHAR(50)
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled'))
    DEFAULT 'assigned',

  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  worker_confirmed BOOLEAN DEFAULT false,
  client_confirmed BOOLEAN DEFAULT false,
  no_show BOOLEAN DEFAULT false,
  no_show_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_assignments_job ON job_assignments (tenant_id, job_id);
CREATE INDEX idx_job_assignments_worker ON job_assignments (tenant_id, worker_id);
CREATE INDEX idx_job_assignments_status ON job_assignments (tenant_id, status);

COMMENT ON TABLE job_assignments IS 'Atribuição de trabalhos a profissionais';

-- ============================================================
-- WORK_REVIEWS
-- ============================================================

CREATE TABLE work_reviews (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  assignment_id UUID NOT NULL REFERENCES job_assignments(assignment_id)
    ON DELETE CASCADE,

  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),

  reviewer_type VARCHAR(50)
    CHECK (reviewer_type IN ('client', 'worker'))
    NOT NULL,

  rating INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,

  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  professionalism_rating INTEGER CHECK (professionalism_rating BETWEEN 1 AND 5),

  tags TEXT[] DEFAULT '{}',

  is_verified BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, assignment_id, reviewer_id)
);

CREATE INDEX idx_work_reviews_assignment ON work_reviews (tenant_id, assignment_id);
CREATE INDEX idx_work_reviews_reviewee ON work_reviews (tenant_id, reviewee_id);
CREATE INDEX idx_work_reviews_rating ON work_reviews (tenant_id, rating DESC);

COMMENT ON TABLE work_reviews IS 'Avaliações de trabalhos concluídos';

COMMIT;

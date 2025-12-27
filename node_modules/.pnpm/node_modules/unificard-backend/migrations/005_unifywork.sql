-- ============================================
-- 005_unifywork.sql
-- UnifyWork: Sistema de Trabalho Comunitário
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- Para localização geográfica

-- ===========================
-- WORKERS (Profissionais)
-- ===========================
CREATE TABLE workers (
  worker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  bio TEXT,
  hourly_rate NUMERIC(10,2),  -- Taxa horária em moeda local
  location GEOGRAPHY(POINT),  -- Localização geográfica
  availability JSONB DEFAULT '{}',  -- {monday: ["09:00-18:00"], ...}
  
  -- Reputação
  reputation_score NUMERIC(3,2) DEFAULT 0 CHECK (reputation_score >= 0 AND reputation_score <= 5),
  total_jobs_completed INTEGER DEFAULT 0,
  total_jobs_cancelled INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  
  -- Estatísticas
  total_earnings NUMERIC(12,2) DEFAULT 0,
  response_time_avg_minutes INTEGER,  -- Tempo médio de resposta em minutos
  
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY workers_rls ON workers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_workers_tenant ON workers(tenant_id);
CREATE INDEX idx_workers_user ON workers(tenant_id, user_id);
CREATE INDEX idx_workers_location ON workers USING GIST(location);
CREATE INDEX idx_workers_reputation ON workers(tenant_id, reputation_score DESC);
CREATE INDEX idx_workers_active ON workers(tenant_id, is_active);

-- ===========================
-- SKILLS (Habilidades)
-- ===========================
CREATE TABLE skills (
  skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100),  -- Ex: construção, limpeza, tecnologia, etc
  description TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(tenant_id, name)
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY skills_rls ON skills
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_skills_tenant ON skills(tenant_id);
CREATE INDEX idx_skills_category ON skills(tenant_id, category);

-- ===========================
-- WORKER_SKILLS (many-to-many)
-- ===========================
CREATE TABLE worker_skills (
  worker_skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  
  proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),  -- 1=iniciante, 5=expert
  years_experience INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,  -- Skill verificada por alguém
  
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(tenant_id, worker_id, skill_id)
);

ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_skills_rls ON worker_skills
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_worker_skills_worker ON worker_skills(tenant_id, worker_id);
CREATE INDEX idx_worker_skills_skill ON worker_skills(tenant_id, skill_id);
CREATE INDEX idx_worker_skills_proficiency ON worker_skills(tenant_id, skill_id, proficiency_level DESC);

-- ===========================
-- JOBS (Trabalhos/Projetos)
-- ===========================
CREATE TABLE jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  client_id UUID NOT NULL REFERENCES users(user_id),
  
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  required_skills UUID[] DEFAULT '{}',  -- Array de skill_ids
  location GEOGRAPHY(POINT),
  location_description TEXT,  -- Descrição textual do local
  
  -- Orçamento
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  payment_type VARCHAR(50) CHECK (payment_type IN ('fixed', 'hourly', 'negotiable')) DEFAULT 'negotiable',
  
  -- Agendamento
  scheduled_at TIMESTAMP,
  duration_hours INTEGER,
  flexibility VARCHAR(50) CHECK (flexibility IN ('strict', 'flexible', 'very_flexible')) DEFAULT 'flexible',
  
  -- Status
  status VARCHAR(50) CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')) DEFAULT 'open',
  urgency VARCHAR(50) CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  closed_at TIMESTAMP
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_rls ON jobs
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX idx_jobs_client ON jobs(tenant_id, client_id);
CREATE INDEX idx_jobs_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_location ON jobs USING GIST(location);
CREATE INDEX idx_jobs_scheduled ON jobs(tenant_id, scheduled_at);
CREATE INDEX idx_jobs_created ON jobs(tenant_id, created_at DESC);

-- ===========================
-- JOB_APPLICATIONS (Candidaturas)
-- ===========================
CREATE TABLE job_applications (
  application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  
  proposed_rate NUMERIC(10,2),  -- Taxa proposta pelo worker
  message TEXT,  -- Mensagem de apresentação
  
  status VARCHAR(50) CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')) DEFAULT 'pending',
  
  applied_at TIMESTAMP DEFAULT now(),
  responded_at TIMESTAMP,
  
  UNIQUE(tenant_id, job_id, worker_id)
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_applications_rls ON job_applications
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_job_applications_job ON job_applications(tenant_id, job_id);
CREATE INDEX idx_job_applications_worker ON job_applications(tenant_id, worker_id);
CREATE INDEX idx_job_applications_status ON job_applications(tenant_id, status);

-- ===========================
-- JOB_ASSIGNMENTS (Trabalhos Atribuídos)
-- ===========================
CREATE TABLE job_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  
  agreed_rate NUMERIC(10,2) NOT NULL,  -- Taxa acordada
  payment_type VARCHAR(50) CHECK (payment_type IN ('fixed', 'hourly')) NOT NULL,
  
  status VARCHAR(50) CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'assigned',
  
  -- Datas importantes
  assigned_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Pagamento
  payment_transaction_id UUID REFERENCES transactions(transaction_id),
  payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'paid', 'refunded')) DEFAULT 'pending',
  
  -- No-show tracking
  worker_confirmed BOOLEAN DEFAULT false,
  client_confirmed BOOLEAN DEFAULT false,
  no_show BOOLEAN DEFAULT false,
  no_show_reason TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_assignments_rls ON job_assignments
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_job_assignments_job ON job_assignments(tenant_id, job_id);
CREATE INDEX idx_job_assignments_worker ON job_assignments(tenant_id, worker_id);
CREATE INDEX idx_job_assignments_status ON job_assignments(tenant_id, status);
CREATE INDEX idx_job_assignments_payment ON job_assignments(tenant_id, payment_transaction_id);

-- ===========================
-- WORK_REVIEWS (Avaliações)
-- ===========================
CREATE TABLE work_reviews (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  assignment_id UUID NOT NULL REFERENCES job_assignments(assignment_id) ON DELETE CASCADE,
  
  reviewer_id UUID NOT NULL REFERENCES users(user_id),  -- Quem avaliou
  reviewee_id UUID NOT NULL REFERENCES users(user_id),  -- Quem foi avaliado
  reviewer_type VARCHAR(50) CHECK (reviewer_type IN ('client', 'worker')) NOT NULL,
  
  -- Avaliação
  rating INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  
  -- Critérios específicos (opcional)
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  professionalism_rating INTEGER CHECK (professionalism_rating BETWEEN 1 AND 5),
  
  -- Badges/tags
  tags TEXT[] DEFAULT '{}',  -- Ex: ['professional', 'friendly', 'fast']
  
  is_verified BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(tenant_id, assignment_id, reviewer_id)
);

ALTER TABLE work_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_reviews_rls ON work_reviews
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_work_reviews_assignment ON work_reviews(tenant_id, assignment_id);
CREATE INDEX idx_work_reviews_reviewee ON work_reviews(tenant_id, reviewee_id);
CREATE INDEX idx_work_reviews_rating ON work_reviews(tenant_id, rating DESC);

-- ===========================
-- TRIGGERS
-- ===========================

-- Trigger para updated_at em workers
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em job_assignments
CREATE TRIGGER update_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- FUNÇÕES HELPER
-- ===========================

-- Calcular reputação do worker
CREATE OR REPLACE FUNCTION calculate_worker_reputation(p_worker_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_total_reviews INTEGER;
  v_completion_rate NUMERIC;
  v_no_show_penalty NUMERIC;
BEGIN
  -- Média de ratings
  SELECT AVG(rating), COUNT(*)
  INTO v_avg_rating, v_total_reviews
  FROM work_reviews
  WHERE reviewee_id = (SELECT user_id FROM workers WHERE worker_id = p_worker_id)
    AND reviewer_type = 'client';
  
  -- Taxa de conclusão
  SELECT 
    CASE 
      WHEN (total_jobs_completed + total_jobs_cancelled) = 0 THEN 0
      ELSE (total_jobs_completed::NUMERIC / (total_jobs_completed + total_jobs_cancelled))
    END
  INTO v_completion_rate
  FROM workers
  WHERE worker_id = p_worker_id;
  
  -- Penalidade por no-show
  SELECT no_show_count INTO v_no_show_penalty FROM workers WHERE worker_id = p_worker_id;
  
  -- Fórmula final (peso: rating 50%, completion 30%, no-show -20%)
  RETURN LEAST(5.0, GREATEST(0.0,
    COALESCE(v_avg_rating, 0) * 0.5 +
    COALESCE(v_completion_rate, 0) * 5 * 0.3 -
    COALESCE(v_no_show_penalty, 0) * 0.2
  ));
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- COMENTÁRIOS
-- ===========================

COMMENT ON TABLE workers IS 'Profissionais/trabalhadores cadastrados';
COMMENT ON TABLE skills IS 'Habilidades/competências disponíveis';
COMMENT ON TABLE worker_skills IS 'Habilidades de cada worker';
COMMENT ON TABLE jobs IS 'Trabalhos/projetos publicados';
COMMENT ON TABLE job_applications IS 'Candidaturas de workers para jobs';
COMMENT ON TABLE job_assignments IS 'Trabalhos atribuídos a workers específicos';
COMMENT ON TABLE work_reviews IS 'Avaliações de trabalhos concluídos';
COMMENT ON FUNCTION calculate_worker_reputation IS 'Calcula score de reputação baseado em reviews, completion rate e no-shows';
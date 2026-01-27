-- ============================================================
-- UNIFICARD — MIGRATION 063
-- Arquivo: 063_schedule_unique_owners.sql
-- Tipo: REGRA ESTRUTURAL (unicidade lógica)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O sistema de agendas (schedules) do Unificard é orientado
-- a um modelo de "owner", onde uma agenda pode pertencer a:
--
-- • uma empresa
-- • um usuário
-- • um serviço
--
-- Por definição de negócio, cada owner pode possuir
-- NO MÁXIMO uma agenda ativa.
--
-- OBJETIVO
-- • Garantir unicidade de agenda por tipo de owner
-- • Impedir duplicação silenciosa de schedules
-- • Manter flexibilidade de ownership no modelo
--
-- DECISÕES IMPORTANTES
-- • A unicidade é garantida via ÍNDICES ÚNICOS PARCIAIS
-- • Não é usada UNIQUE CONSTRAINT para permitir NULLs
-- • O banco NÃO valida exclusividade entre company/user/service
-- • A aplicação é responsável por definir o owner correto
--
-- PRÉ-REQUISITO
-- • Esta migration assume que NÃO existem owners duplicados
--   (ex: duas agendas para a mesma empresa).
-- • Caso existam, a migration falhará — por design.
--
-- ESCOPO
-- ✔ Impõe unicidade por company_id
-- ✔ Impõe unicidade por global_user_id
-- ✔ Impõe unicidade por service_id
--
-- ❌ Não altera dados existentes
-- ❌ Não redefine modelo de ownership
--
-- DEPENDÊNCIAS
-- • schedules
--
-- IDEMPOTÊNCIA
-- • Todos os índices usam IF NOT EXISTS
--
-- ============================================================


-- ============================================================
-- 1) UMA AGENDA POR EMPRESA
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_company
  ON schedules (company_id)
  WHERE company_id IS NOT NULL;


-- ============================================================
-- 2) UMA AGENDA POR USUÁRIO
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_user
  ON schedules (global_user_id)
  WHERE global_user_id IS NOT NULL;


-- ============================================================
-- 3) UMA AGENDA POR SERVIÇO
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_service
  ON schedules (service_id)
  WHERE service_id IS NOT NULL;


-- ============================================================
-- FIM 063_schedule_unique_owners.sql
-- ============================================================



















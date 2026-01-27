// Script para criar tabela events básica antes de rodar migrations 090-095
// Necessário porque migration 026 foi apenas marcada no baseline

import { pool } from '../src/core/database/pool';

async function main() {
  console.log('🔧 Criando tabela events básica...');
  
  try {
    const client = await pool.connect();
    try {
      // Verificar se já existe
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'events'
        ) as exists;
      `);
      
      if (checkResult.rows[0]?.exists) {
        console.log('✅ Tabela events já existe');
        return;
      }
      
      // Criar tabela sem foreign keys primeiro
      console.log('   Criando tabela events (sem foreign keys)...');
      await client.query(`
        CREATE TABLE events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          city_id UUID,
          state_id UUID,
          country_id UUID,
          created_by_global_user_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT events_time_check CHECK (end_time > start_time)
        );
      `);
      
      // Adicionar foreign keys se as tabelas existirem
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tenants', 'cities', 'states', 'countries', 'global_users');
      `);
      
      const existingTables = new Set(tables.rows.map((r: any) => r.table_name));
      
      if (existingTables.has('tenants')) {
        console.log('   Adicionando FK para tenants...');
        await client.query(`
          ALTER TABLE events 
          ADD CONSTRAINT events_tenant_fk 
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
        `);
      }
      
      // Índices
      console.log('   Criando índices...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_events_tenant ON events (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by_global_user_id);
        CREATE INDEX IF NOT EXISTS idx_events_city ON events (city_id) WHERE city_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time);
        CREATE INDEX IF NOT EXISTS idx_events_end_time ON events (end_time);
      `);
      
      // RLS
      console.log('   Configurando RLS...');
      await client.query(`
        ALTER TABLE events ENABLE ROW LEVEL SECURITY;
      `);
      
      await client.query(`
        DROP POLICY IF EXISTS events_rls ON events;
        CREATE POLICY events_rls ON events
          USING (tenant_id::text = current_setting('app.current_tenant', true));
      `);
      
      console.log('✅ Tabela events criada com sucesso');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao criar tabela events:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

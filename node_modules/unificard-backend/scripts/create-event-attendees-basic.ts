// Script para criar tabela event_attendees básica antes de rodar migration 091

import { pool } from '../src/core/database/pool';

async function main() {
  console.log('🔧 Criando tabela event_attendees básica...');
  
  try {
    const client = await pool.connect();
    try {
      // Verificar se já existe
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'event_attendees'
        ) as exists;
      `);
      
      if (checkResult.rows[0]?.exists) {
        console.log('✅ Tabela event_attendees já existe');
        return;
      }
      
      // Criar tabela básica
      console.log('   Criando tabela event_attendees...');
      await client.query(`
        CREATE TABLE event_attendees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          event_id UUID NOT NULL,
          actor_id UUID,
          global_user_id UUID,
          check_in_status VARCHAR(20) DEFAULT 'PENDING',
          transaction_id UUID,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      
      // Adicionar foreign keys se as tabelas existirem
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tenants', 'events');
      `);
      
      const existingTables = new Set(tables.rows.map((r: any) => r.table_name));
      
      if (existingTables.has('events')) {
        console.log('   Adicionando FK para events...');
        await client.query(`
          ALTER TABLE event_attendees 
          ADD CONSTRAINT event_attendees_event_fk 
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
        `);
      }
      
      if (existingTables.has('tenants')) {
        console.log('   Adicionando FK para tenants...');
        await client.query(`
          ALTER TABLE event_attendees 
          ADD CONSTRAINT event_attendees_tenant_fk 
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
        `);
      }
      
      // Índices
      console.log('   Criando índices...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees (event_id);
        CREATE INDEX IF NOT EXISTS idx_event_attendees_tenant ON event_attendees (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_event_attendees_actor ON event_attendees (actor_id) WHERE actor_id IS NOT NULL;
      `);
      
      // RLS
      console.log('   Configurando RLS...');
      await client.query(`
        ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
      `);
      
      await client.query(`
        DROP POLICY IF EXISTS event_attendees_rls ON event_attendees;
        CREATE POLICY event_attendees_rls ON event_attendees
          USING (tenant_id::text = current_setting('app.current_tenant', true));
      `);
      
      console.log('✅ Tabela event_attendees criada com sucesso');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao criar tabela event_attendees:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();


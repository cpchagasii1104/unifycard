// Script para registrar migration 113 no schema_migrations
import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function registerMigration() {
  try {
    const result = await pool.query(
      "SELECT filename FROM schema_migrations WHERE filename = '113_groups_social_features.sql'"
    );
    
    if (result.rows.length === 0) {
      await pool.query(
        "INSERT INTO schema_migrations (filename) VALUES ('113_groups_social_features.sql') ON CONFLICT DO NOTHING"
      );
      console.log('✅ Migration 113 registrada no schema_migrations');
    } else {
      console.log('✅ Migration 113 já estava registrada');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

registerMigration();







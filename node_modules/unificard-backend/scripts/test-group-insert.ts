// Script para testar o INSERT de grupos com dados mínimos
import { pool } from '../src/core/database/pool';
import { getClientWithTenant } from '../src/core/database/pool';
import 'dotenv/config';

async function testGroupInsert() {
  try {
    // 1. Obter tenant e user
    const tenantResult = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenants ORDER BY created_at ASC LIMIT 1`
    );
    if (!tenantResult.rows[0]) {
      throw new Error('Nenhum tenant encontrado');
    }
    const tenantId = tenantResult.rows[0].tenant_id;

    const userResult = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    if (!userResult.rows[0]) {
      throw new Error('Nenhum usuário encontrado');
    }
    const userId = userResult.rows[0].user_id;

    const client = await getClientWithTenant(tenantId);

    try {
      console.log('🧪 Testando INSERT de grupo com dados mínimos...\n');

      // Teste 1: INSERT mínimo (apenas campos obrigatórios)
      console.log('Teste 1: INSERT mínimo');
      try {
        const result1 = await client.query(`
          INSERT INTO groups (tenant_id, name, owner_user_id)
          VALUES ($1, $2, $3)
          RETURNING group_id, name, description, category_id, visibility, slug
        `, [tenantId, 'Teste Mínimo', userId]);

        console.log('   ✅ Sucesso!');
        console.log(`   - group_id: ${result1.rows[0].group_id}`);
        console.log(`   - name: ${result1.rows[0].name}`);
        console.log(`   - description: ${result1.rows[0].description || '(null)'}`);
        console.log(`   - category_id: ${result1.rows[0].category_id || '(null)'}`);
        console.log(`   - visibility: ${result1.rows[0].visibility}`);
        console.log(`   - slug: ${result1.rows[0].slug || '(null)'}`);

        // Limpar
        await client.query('DELETE FROM groups WHERE group_id = $1', [result1.rows[0].group_id]);
      } catch (err) {
        console.log('   ❌ Erro:', err instanceof Error ? err.message : String(err));
      }

      // Teste 2: INSERT com todos os campos opcionais
      console.log('\nTeste 2: INSERT completo');
      try {
        const categoryResult = await client.query<{ category_id: string }>(
          `SELECT category_id FROM group_categories LIMIT 1`
        );
        const categoryId = categoryResult.rows[0]?.category_id || null;

        const metadata = {
          scope: 'national',
          location: {
            country_id: null,
            state_id: null,
            city_id: null,
            neighborhood: null,
          },
          rules_text: null,
        };

        // Gerar slug separadamente para evitar erro de tipo
        let slug: string | null = null;
        try {
          const slugResult = await client.query<{ slug: string }>(
            `SELECT generate_group_slug($1::text, $2::uuid) as slug`,
            ['Teste Completo', tenantId]
          );
          slug = slugResult.rows[0]?.slug || null;
        } catch (err) {
          console.log('   ⚠️  Erro ao gerar slug:', err instanceof Error ? err.message : String(err));
        }

        const result2 = await client.query(`
          INSERT INTO groups (
            tenant_id, name, slug, description, category_id, visibility,
            avatar_url, cover_url,
            owner_user_id, metadata
          )
          VALUES (
            $1, $2, $3, $4, $5, COALESCE($6::group_visibility, 'public'::group_visibility),
            $7, $8,
            $9, $10
          )
          RETURNING group_id, name, description, category_id, visibility, slug, metadata
        `, [
          tenantId,
          'Teste Completo',
          slug, // slug já gerado
          'Descrição de teste',
          categoryId,
          'public',
          null, // avatar_url
          null, // cover_url
          userId,
          JSON.stringify(metadata)
        ]);

        console.log('   ✅ Sucesso!');
        console.log(`   - group_id: ${result2.rows[0].group_id}`);
        console.log(`   - name: ${result2.rows[0].name}`);
        console.log(`   - slug: ${result2.rows[0].slug || '(null)'}`);
        console.log(`   - description: ${result2.rows[0].description}`);
        console.log(`   - category_id: ${result2.rows[0].category_id || '(null)'}`);
        console.log(`   - visibility: ${result2.rows[0].visibility}`);
        console.log(`   - metadata: ${JSON.stringify(result2.rows[0].metadata, null, 2)}`);

        // Limpar
        await client.query('DELETE FROM groups WHERE group_id = $1', [result2.rows[0].group_id]);
      } catch (err) {
        console.log('   ❌ Erro:', err instanceof Error ? err.message : String(err));
        if (err instanceof Error && err.message.includes('generate_group_slug')) {
          console.log('   ⚠️  Função generate_group_slug não existe ou tem problema');
        }
      }

      // Teste 3: Verificar se generate_group_slug existe
      console.log('\nTeste 3: Verificar função generate_group_slug');
      try {
        const funcResult = await client.query(`
          SELECT routine_name, routine_type
          FROM information_schema.routines
          WHERE routine_name = 'generate_group_slug'
        `);
        if (funcResult.rows.length > 0) {
          console.log('   ✅ Função existe');
        } else {
          console.log('   ⚠️  Função não existe - slug será NULL');
        }
      } catch (err) {
        console.log('   ❌ Erro ao verificar função:', err instanceof Error ? err.message : String(err));
      }

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

testGroupInsert();


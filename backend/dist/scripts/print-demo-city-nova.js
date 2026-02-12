"use strict";
// src/scripts/print-demo-city-nova.ts
// Script para imprimir informações do cenário de demo "Cidade Nova Beauty"
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("@core/database/pool");
// Carrega variáveis de ambiente
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
async function printDemoInfo() {
    console.log('🔍 Buscando informações do cenário de demo "Cidade Nova Beauty"...\n');
    const client = await pool_1.pool.connect();
    try {
        // 1. Buscar Tenant
        console.log('📦 TENANT:');
        const tenantResult = await client.query(`SELECT tenant_id, name, slug FROM tenants WHERE slug = 'cidade-nova-demo' LIMIT 1`);
        if (tenantResult.rows.length === 0) {
            console.log('❌ Tenant "Cidade Nova Demo" não encontrado!');
            console.log('   Execute a migration 035_seed_demo_city_nova_beauty.sql primeiro.\n');
            return;
        }
        const tenant = tenantResult.rows[0];
        console.log(`   tenantId: ${tenant.tenant_id}`);
        console.log(`   name: ${tenant.name}`);
        console.log(`   slug: ${tenant.slug}\n`);
        // 2. Buscar Empresa
        console.log('🏢 EMPRESA:');
        const companyResult = await client.query(`SELECT company_id, name, description, is_active 
       FROM companies 
       WHERE tenant_id = $1 AND name = 'Cidade Nova Beauty' 
       LIMIT 1`, [tenant.tenant_id]);
        if (companyResult.rows.length === 0) {
            console.log('   ⚠️  Empresa "Cidade Nova Beauty" não encontrada\n');
        }
        else {
            const company = companyResult.rows[0];
            console.log(`   companyId: ${company.company_id}`);
            console.log(`   name: ${company.name}`);
            console.log(`   description: ${company.description || 'N/A'}`);
            console.log(`   isActive: ${company.is_active}\n`);
        }
        // 3. Buscar Profissional (Maria Manicure)
        console.log('👤 PROFISSIONAL:');
        const userResult = await client.query(`SELECT user_id, email, global_user_id 
       FROM users 
       WHERE tenant_id = $1 AND email = 'maria.manicure@cidadenova.demo' 
       LIMIT 1`, [tenant.tenant_id]);
        if (userResult.rows.length === 0) {
            console.log('   ❌ Usuária "Maria Manicure" não encontrada!\n');
            return;
        }
        const user = userResult.rows[0];
        console.log(`   userId: ${user.user_id}`);
        console.log(`   email: ${user.email}`);
        console.log(`   globalUserId: ${user.global_user_id || 'N/A'}\n`);
        // Buscar perfil
        const profileResult = await client.query(`SELECT profile_id, full_name, phone 
       FROM profiles 
       WHERE tenant_id = $1 AND user_id = $2 
       LIMIT 1`, [tenant.tenant_id, user.user_id]);
        if (profileResult.rows.length > 0) {
            const profile = profileResult.rows[0];
            console.log(`   Perfil:`);
            console.log(`     fullName: ${profile.full_name || 'N/A'}`);
            console.log(`     phone: ${profile.phone || 'N/A'}\n`);
        }
        // Buscar worker
        const workerResult = await client.query(`SELECT worker_id, bio, hourly_rate, reputation_score 
       FROM workers 
       WHERE tenant_id = $1 AND user_id = $2 
       LIMIT 1`, [tenant.tenant_id, user.user_id]);
        if (workerResult.rows.length > 0) {
            const worker = workerResult.rows[0];
            console.log(`   Worker:`);
            console.log(`     workerId: ${worker.worker_id}`);
            console.log(`     bio: ${worker.bio || 'N/A'}`);
            console.log(`     hourlyRate: R$ ${worker.hourly_rate || '0.00'}`);
            console.log(`     reputationScore: ${worker.reputation_score}\n`);
        }
        // 4. Buscar Schedule
        if (user.global_user_id) {
            console.log('📅 SCHEDULE:');
            const scheduleResult = await client.query(`SELECT schedule_id, global_user_id, company_id 
         FROM schedules 
         WHERE tenant_id = $1 AND global_user_id = $2 
         LIMIT 1`, [tenant.tenant_id, user.global_user_id]);
            if (scheduleResult.rows.length === 0) {
                console.log('   ⚠️  Schedule não encontrado para Maria Manicure\n');
            }
            else {
                const schedule = scheduleResult.rows[0];
                console.log(`   scheduleId: ${schedule.schedule_id}`);
                console.log(`   globalUserId: ${schedule.global_user_id}\n`);
                // Buscar slots
                const slotsResult = await client.query(`SELECT slot_id, starts_at, ends_at, status 
           FROM schedule_slots 
           WHERE schedule_id = $1 
           ORDER BY starts_at ASC`, [schedule.schedule_id]);
                if (slotsResult.rows.length === 0) {
                    console.log('   ⚠️  Nenhum slot encontrado\n');
                }
                else {
                    console.log(`   Slots (${slotsResult.rows.length}):`);
                    slotsResult.rows.forEach((slot, index) => {
                        const start = new Date(slot.starts_at).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            weekday: 'long',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                        });
                        const end = new Date(slot.ends_at).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            hour: '2-digit',
                            minute: '2-digit',
                        });
                        console.log(`     ${index + 1}. ${start} → ${end} (${slot.status})`);
                    });
                    console.log('');
                }
            }
        }
        // 5. Buscar Categorias
        console.log('🏷️  CATEGORIAS:');
        const categoriesResult = await client.query(`SELECT category_id, name, slug, level 
       FROM categories 
       WHERE slug IN ('beleza', 'beleza-manicure') 
       ORDER BY level ASC`);
        if (categoriesResult.rows.length === 0) {
            console.log('   ⚠️  Categorias não encontradas\n');
        }
        else {
            categoriesResult.rows.forEach((cat) => {
                console.log(`   ${cat.name} (${cat.slug}):`);
                console.log(`     categoryId: ${cat.category_id}`);
                console.log(`     level: ${cat.level}`);
            });
            console.log('');
        }
        // 6. Exemplo de payload para /assistant/message
        console.log('📝 EXEMPLO DE PAYLOAD PARA POST /assistant/message:');
        console.log('');
        console.log('```json');
        console.log(JSON.stringify({
            text: 'Quero uma manicure sexta às 18h',
            channel: 'chat',
            targetType: 'global',
        }, null, 2));
        console.log('```');
        console.log('');
        console.log('💡 O backend vai:');
        console.log('   1. Detectar intent "schedule_service" via Orchestrator');
        console.log('   2. Identificar parâmetros: workerId (Maria), date (sexta), time (18h)');
        console.log('   3. Criar Social Action automaticamente');
        console.log('   4. Executar via Schedule Service → reservar slot');
        console.log('   5. Atualizar Memory Engine com preferências');
        console.log('');
        // 7. Exemplo de curl
        console.log('🔧 EXEMPLO DE CURL:');
        console.log('');
        console.log('```bash');
        console.log(`curl -X POST http://localhost:3333/assistant/message \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -H "Authorization: Bearer <seu_token>" \\`);
        console.log(`  -d '{`);
        console.log(`    "text": "Quero uma manicure sexta às 18h",`);
        console.log(`    "channel": "chat",`);
        console.log(`    "targetType": "global"`);
        console.log(`  }'`);
        console.log('```');
        console.log('');
    }
    catch (error) {
        console.error('❌ Erro ao buscar informações:', error);
        throw error;
    }
    finally {
        client.release();
        await pool_1.pool.end();
    }
}
// Executar
printDemoInfo().catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
});

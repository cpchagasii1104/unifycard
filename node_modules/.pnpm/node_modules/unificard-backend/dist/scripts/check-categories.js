"use strict";
// src/scripts/check-categories.ts
// Script para verificar se as categorias existem no banco
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
async function checkCategories() {
    console.log('🔍 Verificando categorias no banco de dados...\n');
    try {
        // Verificar total de categorias
        const totalResult = await pool_1.pool.query('SELECT COUNT(*) as count FROM categories');
        const total = parseInt(totalResult.rows[0].count, 10);
        console.log(`📊 Total de categorias: ${total}`);
        if (total === 0) {
            console.log('\n⚠️  Nenhuma categoria encontrada!');
            console.log('💡 Execute: npm run seed:categories');
            await pool_1.pool.end();
            process.exit(1);
        }
        // Verificar categorias por nível
        const byLevel = await pool_1.pool.query('SELECT level, COUNT(*) as count FROM categories GROUP BY level ORDER BY level');
        console.log('\n📈 Categorias por nível:');
        byLevel.rows.forEach((row) => {
            console.log(`   Nível ${row.level}: ${row.count} categorias`);
        });
        // Verificar algumas categorias de exemplo
        const examples = await pool_1.pool.query(`SELECT name, level, path 
       FROM categories 
       WHERE level = 2 
       LIMIT 5`);
        console.log('\n✅ Exemplos de profissões (nível 2):');
        examples.rows.forEach((row) => {
            const pathDisplay = row.path.length > 0
                ? row.path.join(' > ') + ' > ' + row.name
                : row.name;
            console.log(`   - ${pathDisplay}`);
        });
        console.log('\n✨ Categorias estão OK!');
        await pool_1.pool.end();
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Erro ao verificar categorias:', error);
        await pool_1.pool.end();
        process.exit(1);
    }
}
checkCategories();

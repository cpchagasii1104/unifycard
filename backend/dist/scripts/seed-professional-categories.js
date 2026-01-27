"use strict";
// src/scripts/seed-professional-categories.ts
// Seed CANÔNICO de categorias profissionais
// ✔ Idempotente
// ✔ Sem parentId externo
// ✔ Sem UPDATE direto em DB
// ✔ Sem mutação de scope/status fora do domínio
// ✔ Uma única árvore profissional
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
const PROFESSIONAL_TREE = [
    {
        name: 'Construção e Reformas',
        slug: 'construcao-reformas',
        description: 'Serviços de construção civil e reformas',
        level1: [
            {
                name: 'Obras e Construção',
                slug: 'obras-construcao',
                level2: [
                    { name: 'Pedreiro', slug: 'pedreiro' },
                    { name: 'Mestre de Obras', slug: 'mestre-obras' },
                    { name: 'Encarregado de Obra', slug: 'encarregado-obra' },
                    { name: 'Ajudante de Pedreiro', slug: 'ajudante-pedreiro' },
                ],
            },
            {
                name: 'Reformas e Acabamentos',
                slug: 'reformas-acabamentos',
                level2: [
                    { name: 'Pintor', slug: 'pintor' },
                    { name: 'Gesseiro', slug: 'gesseiro' },
                    { name: 'Azulejista', slug: 'azulejista' },
                    { name: 'Marceneiro', slug: 'marceneiro' },
                    { name: 'Serralheiro', slug: 'serralheiro' },
                ],
            },
            {
                name: 'Instalações Elétricas e Hidráulicas',
                slug: 'instalacoes-eletricas-hidraulicas',
                level2: [
                    { name: 'Eletricista', slug: 'eletricista' },
                    { name: 'Eletricista Industrial', slug: 'eletricista-industrial' },
                    { name: 'Encanador', slug: 'encanador' },
                    { name: 'Instalador Hidráulico', slug: 'instalador-hidraulico' },
                ],
            },
        ],
    },
    {
        name: 'Tecnologia e Informática',
        slug: 'tecnologia-informatica',
        description: 'Serviços de tecnologia e informática',
        level1: [
            {
                name: 'Desenvolvimento de Software',
                slug: 'desenvolvimento-software',
                level2: [
                    { name: 'Programador', slug: 'programador' },
                    { name: 'Desenvolvedor Web', slug: 'desenvolvedor-web' },
                    { name: 'Desenvolvedor Mobile', slug: 'desenvolvedor-mobile' },
                    { name: 'Desenvolvedor Full Stack', slug: 'desenvolvedor-full-stack' },
                    { name: 'Analista de Sistemas', slug: 'analista-sistemas' },
                ],
            },
        ],
    },
];
async function seed() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Seed profissional NÃO pode rodar em produção');
    }
    console.log('🌱 Seed CANÔNICO — categorias profissionais\n');
    for (const level0 of PROFESSIONAL_TREE) {
        await categories_service_1.categoriesService.createCategory({
            name: level0.name,
            slug: level0.slug,
            description: level0.description ?? null,
            parentSlug: null,
        }, {
            context: 'professional',
            source: 'script',
            allowActive: true,
        });
        for (const level1 of level0.level1) {
            await categories_service_1.categoriesService.createCategory({
                name: level1.name,
                slug: level1.slug,
                description: level1.description ?? null,
                parentSlug: level0.slug,
            }, {
                context: 'professional',
                source: 'script',
                allowActive: true,
            });
            for (const level2 of level1.level2) {
                await categories_service_1.categoriesService.createCategory({
                    name: level2.name,
                    slug: level2.slug,
                    description: null,
                    parentSlug: level1.slug,
                }, {
                    context: 'professional',
                    source: 'script',
                    allowActive: true,
                });
            }
        }
    }
    console.log('\n✅ Seed profissional concluído (idempotente, canônico)');
}
seed()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});

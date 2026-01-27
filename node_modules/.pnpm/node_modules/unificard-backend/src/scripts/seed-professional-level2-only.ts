// src/scripts/seed-professional-level2-only.ts
// Seed CANÔNICO — APENAS profissões (level 2)
// ✔ Usa parentSlug
// ✔ Idempotente
// ✔ Sem SQL direto
// ✔ Sem mutação de status/scope
// ✔ Service governa

import dotenv from 'dotenv';
import { join } from 'path';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

type Profession = { name: string; slug: string };

const PROFESSOES_POR_SUBSETOR: Record<string, Profession[]> = {
  // CONSTRUÇÃO E REFORMAS
  'obras-construcao': [
    { name: 'Pedreiro', slug: 'pedreiro' },
    { name: 'Mestre de Obras', slug: 'mestre-obras' },
    { name: 'Encarregado de Obra', slug: 'encarregado-obra' },
    { name: 'Ajudante de Pedreiro', slug: 'ajudante-pedreiro' },
  ],
  'reformas-acabamentos': [
    { name: 'Pintor', slug: 'pintor' },
    { name: 'Gesseiro', slug: 'gesseiro' },
    { name: 'Azulejista', slug: 'azulejista' },
    { name: 'Marceneiro', slug: 'marceneiro' },
    { name: 'Serralheiro', slug: 'serralheiro' },
  ],
  'instalacoes-eletricas-hidraulicas': [
    { name: 'Eletricista', slug: 'eletricista' },
    { name: 'Eletricista Industrial', slug: 'eletricista-industrial' },
    { name: 'Encanador', slug: 'encanador' },
    { name: 'Instalador Hidráulico', slug: 'instalador-hidraulico' },
  ],

  // TECNOLOGIA
  'desenvolvimento-software': [
    { name: 'Programador', slug: 'programador' },
    { name: 'Desenvolvedor Web', slug: 'desenvolvedor-web' },
    { name: 'Desenvolvedor Mobile', slug: 'desenvolvedor-mobile' },
    { name: 'Desenvolvedor Full Stack', slug: 'desenvolvedor-full-stack' },
    { name: 'Analista de Sistemas', slug: 'analista-sistemas' },
  ],

  // SERVIÇOS DOMÉSTICOS
  'limpeza': [
    { name: 'Faxineira', slug: 'faxineira' },
    { name: 'Diarista', slug: 'diarista' },
    { name: 'Limpeza Pós-Obra', slug: 'limpeza-pos-obra' },
    { name: 'Organizador de Ambientes', slug: 'organizador-ambientes' },
  ],

  // BELEZA
  'cuidados-cabelo': [
    { name: 'Cabeleireiro', slug: 'cabeleireiro' },
    { name: 'Barbeiro', slug: 'barbeiro' },
    { name: 'Colorista', slug: 'colorista' },
    { name: 'Tricologista', slug: 'tricologista' },
  ],

  // SAÚDE
  'fisioterapia-reabilitacao': [
    { name: 'Fisioterapeuta', slug: 'fisioterapeuta' },
    { name: 'Massoterapeuta', slug: 'massoterapeuta' },
    { name: 'Quiropraxista', slug: 'quiropraxista' },
  ],

  // EDUCAÇÃO
  'aulas-particulares': [
    { name: 'Professor Particular', slug: 'professor-particular' },
    { name: 'Instrutor de Idiomas', slug: 'instrutor-idiomas' },
    { name: 'Monitor de Estudos', slug: 'monitor-estudos' },
  ],
};

async function seedLevel2Only() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed profissional NÃO pode rodar em produção');
  }

  console.log('🌱 Seed CANÔNICO — profissões (level 2)\n');

  let totalCriadas = 0;

  for (const [parentSlug, profissoes] of Object.entries(PROFESSOES_POR_SUBSETOR)) {
    for (const profissao of profissoes) {
      try {
        await categoriesService.createCategory(
          {
            name: profissao.name,
            slug: profissao.slug,
            description: null,
            parentSlug,
          },
          {
            context: 'professional',
            source: 'script',
          }
        );

        totalCriadas++;
      } catch (err) {
        // idempotência: erro esperado se já existir
        continue;
      }
    }
  }

  console.log(`\n✅ Seed concluído — ${totalCriadas} profissões processadas`);
}

seedLevel2Only()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

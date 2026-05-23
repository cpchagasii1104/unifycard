/**
 * Dados de expansão N2 alinhados ao plano 21 v3.0.1 (§8 YAML + §5 tabelas).
 * Fonte: docs/01_normative/21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2.md — onda 1: bebidas + reforma (slugs resolvidos).
 */

export type Plan21Mapping = {
  contextSlug: string;
  sortOrder: number;
  isDefault: boolean;
};

export type Plan21N2Row = {
  n1Slug: string;
  domainKey: string;
  slug: string;
  sortOrder: number;
  displayNamePtBr?: string;
  mappings: Plan21Mapping[];
};

export const PLAN21_N2_EXPANSION_WAVE1: Plan21N2Row[] = [
  {
    n1Slug: 'bebidas',
    domainKey: 'produtos-e-comercio',
    slug: 'cervejas',
    sortOrder: 1,
    displayNamePtBr: 'Cervejas',
    mappings: [
      { contextSlug: 'varejo', sortOrder: 1, isDefault: true },
      { contextSlug: 'bar', sortOrder: 1, isDefault: true },
    ],
  },
  {
    n1Slug: 'bebidas',
    domainKey: 'produtos-e-comercio',
    slug: 'vinhos',
    sortOrder: 2,
    displayNamePtBr: 'Vinhos',
    mappings: [
      { contextSlug: 'varejo', sortOrder: 2, isDefault: true },
      { contextSlug: 'bar', sortOrder: 2, isDefault: true },
    ],
  },
  {
    n1Slug: 'bebidas',
    domainKey: 'produtos-e-comercio',
    slug: 'destilados',
    sortOrder: 3,
    displayNamePtBr: 'Destilados',
    mappings: [
      { contextSlug: 'varejo', sortOrder: 3, isDefault: true },
      { contextSlug: 'bar', sortOrder: 3, isDefault: true },
    ],
  },
  {
    n1Slug: 'bebidas',
    domainKey: 'produtos-e-comercio',
    slug: 'drinks',
    sortOrder: 4,
    displayNamePtBr: 'Drinks',
    mappings: [{ contextSlug: 'bar', sortOrder: 4, isDefault: true }],
  },
  {
    n1Slug: 'bebidas',
    domainKey: 'produtos-e-comercio',
    slug: 'nao-alcoolicas',
    sortOrder: 5,
    displayNamePtBr: 'Não alcoólicas',
    mappings: [
      { contextSlug: 'varejo', sortOrder: 4, isDefault: true },
      { contextSlug: 'bar', sortOrder: 5, isDefault: true },
    ],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'pisos-e-revestimentos',
    sortOrder: 1,
    displayNamePtBr: 'Pisos e revestimentos',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 1, isDefault: true }],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'tintas-e-acabamentos',
    sortOrder: 2,
    displayNamePtBr: 'Tintas e acabamentos',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 2, isDefault: true }],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'eletrica',
    sortOrder: 3,
    displayNamePtBr: 'Elétrica',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 3, isDefault: true }],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'hidraulica',
    sortOrder: 4,
    displayNamePtBr: 'Hidráulica',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 4, isDefault: true }],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'ferramentas',
    sortOrder: 5,
    displayNamePtBr: 'Ferramentas',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 5, isDefault: true }],
  },
  {
    n1Slug: 'materiais-de-construcao',
    domainKey: 'produtos-e-comercio',
    slug: 'iluminacao',
    sortOrder: 6,
    displayNamePtBr: 'Iluminação',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 6, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'instalacao-eletrica',
    sortOrder: 1,
    displayNamePtBr: 'Instalação elétrica',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 1, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'instalacao-hidraulica',
    sortOrder: 2,
    displayNamePtBr: 'Instalação hidráulica',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 2, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'pintura',
    sortOrder: 3,
    displayNamePtBr: 'Pintura',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 3, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'reformas-gerais',
    sortOrder: 4,
    displayNamePtBr: 'Reformas gerais',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 4, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'manutencao-residencial',
    sortOrder: 5,
    displayNamePtBr: 'Manutenção residencial',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 5, isDefault: true }],
  },
  {
    n1Slug: 'manutencao-e-reformas',
    domainKey: 'servicos',
    slug: 'pequenos-reparos',
    sortOrder: 6,
    displayNamePtBr: 'Pequenos reparos',
    mappings: [{ contextSlug: 'reforma-casa', sortOrder: 6, isDefault: true }],
  },
];
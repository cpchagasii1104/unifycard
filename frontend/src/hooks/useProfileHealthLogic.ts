import type { HealthTaxonomy, UserHealthFact } from '../api/health';

export function useProfileHealthLogic() {
  const getFactForTaxonomy = (taxonomyId: string, facts: UserHealthFact[]): UserHealthFact | undefined => {
    return facts.find((f) => f.taxonomyId === taxonomyId);
  };

  const getTaxonomyBySlug = (slug: string, taxonomies: HealthTaxonomy[]): HealthTaxonomy | undefined => {
    return taxonomies.find((t) => t.slug === slug);
  };

  return {
    getFactForTaxonomy,
    getTaxonomyBySlug,
  };
}




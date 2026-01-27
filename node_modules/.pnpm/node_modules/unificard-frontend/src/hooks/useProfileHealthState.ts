import { useState } from 'react';
import type { HealthTaxonomy, UserHealthFact, HealthSection } from '../api/health';

export function useProfileHealthState() {
  const [activeSection, setActiveSection] = useState<HealthSection>('general');
  const [taxonomies, setTaxonomies] = useState<HealthTaxonomy[]>([]);
  const [facts, setFacts] = useState<UserHealthFact[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [factValues, setFactValues] = useState<Record<string, any>>({});
  const [factNotes, setFactNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  return {
    activeSection,
    setActiveSection,
    taxonomies,
    setTaxonomies,
    facts,
    setFacts,
    selectedConditions,
    setSelectedConditions,
    factValues,
    setFactValues,
    factNotes,
    setFactNotes,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    saveError,
    setSaveError,
  };
}




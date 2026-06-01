import { useState } from 'react';
import type { Category, CategoryAutocompleteResult } from '../api/categories';

// A3.2 tab-only / C1: a aba Profissional declara competências por CONCEPT.
// Campos de preço/serviço/availability/workers/capability SAÍRAM (C2/C3/C4) — não são mais persistidos.
interface SelectedSkill {
  categoryId: string;              // chave de UI/dedupe (= categoria L2 selecionada)
  conceptId: string;               // identidade semântica/CONCEPT (declaração C1)
  sourceCategoryId: string | null; // breadcrumb de navegação (origem da seleção)
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
}

export function useProfileProfessionalState() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Category[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<CategoryAutocompleteResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);
  const [isCreatingWithAI, setIsCreatingWithAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [newlyAddedSkillId, setNewlyAddedSkillId] = useState<string | null>(null);
  const [searchFieldError, setSearchFieldError] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    autocompleteResults,
    setAutocompleteResults,
    showAutocomplete,
    setShowAutocomplete,
    isSearching,
    setIsSearching,
    autocompleteError,
    setAutocompleteError,
    isCreatingWithAI,
    setIsCreatingWithAI,
    isRecording,
    setIsRecording,
    selectedSkills,
    setSelectedSkills,
    expandedCategories,
    setExpandedCategories,
    bio,
    setBio,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    skillErrors,
    setSkillErrors,
    newlyAddedSkillId,
    setNewlyAddedSkillId,
    searchFieldError,
    setSearchFieldError,
    loadingChildren,
    setLoadingChildren,
  };
}


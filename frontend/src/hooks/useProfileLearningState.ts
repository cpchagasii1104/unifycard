import { useState } from 'react';
import type { CategoryTree, Category, CategoryAutocompleteResult, CategoryPathSuggestion } from '../api/categories';

interface SelectedLearning {
  categoryId: string;          // breadcrumb de navegação (= source_category_id no C1)
  conceptId: string;           // identidade semântica (C1, Lei 7)
  categoryName: string;
  categoryPath: string[];
  details: string[];           // UI-local; C1 NÃO persiste (DECISION-0067)
  notes: string;               // UI-local; C1 NÃO persiste
  progress: 'beginner' | 'intermediate' | 'advanced' | null;
}

export function useProfileLearningState() {
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Category[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<CategoryAutocompleteResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);
  const [isCreatingWithAI, setIsCreatingWithAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [_userPlan, setUserPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategoryPathSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [selectedLearnings, setSelectedLearnings] = useState<SelectedLearning[]>([]);
  // Snapshot do C1 no load (diff granular do save: novo→POST, progress alterado→PATCH, removido→DELETE).
  const [initialLearnings, setInitialLearnings] = useState<SelectedLearning[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFieldError, setSearchFieldError] = useState<string | null>(null);

  return {
    categoryTree,
    setCategoryTree,
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
    _userPlan,
    setUserPlan,
    aiAssistEnabled,
    setAiAssistEnabled,
    recognition,
    setRecognition,
    showSuggestionModal,
    setShowSuggestionModal,
    categorySuggestion,
    setCategorySuggestion,
    isSuggesting,
    setIsSuggesting,
    suggestionError,
    setSuggestionError,
    selectedLearnings,
    setSelectedLearnings,
    initialLearnings,
    setInitialLearnings,
    expandedCategories,
    setExpandedCategories,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    searchFieldError,
    setSearchFieldError,
  };
}




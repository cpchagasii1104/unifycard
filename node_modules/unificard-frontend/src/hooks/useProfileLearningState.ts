import { useState } from 'react';
import type { CategoryTree, Category, CategoryAutocompleteResult, CategoryPathSuggestion } from '../api/categories';

interface SelectedLearning {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  details: string[];
  notes: string;
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




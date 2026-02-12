import { useState } from 'react';
import type { Category, CategoryAutocompleteResult } from '../api/categories';

type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
type ServiceType = 'service' | 'product';

interface PredefinedService {
  serviceId: string;
  name: string;
  description?: string;
  basePrice: number;
  discountPercentage?: number;
  finalPrice: number;
  isActive: boolean;
}

interface SelectedSkill {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
  hourlyRate: number | null;
  pricingType: PricingType;
  serviceType: ServiceType;
  chargeVisit: boolean;
  visitPrice: number | null;
  predefinedServices: PredefinedService[];
  comboDiscountRules: any[];
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


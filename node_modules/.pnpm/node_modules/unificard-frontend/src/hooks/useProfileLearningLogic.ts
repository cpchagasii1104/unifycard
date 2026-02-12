interface SelectedLearning {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  details: string[];
  notes: string;
  progress: 'beginner' | 'intermediate' | 'advanced' | null;
}

export function useProfileLearningLogic() {
  const isLearningSelected = (categoryId: string, selectedLearnings: SelectedLearning[]): boolean => {
    return selectedLearnings.some((s) => s.categoryId === categoryId);
  };

  return {
    isLearningSelected,
  };
}




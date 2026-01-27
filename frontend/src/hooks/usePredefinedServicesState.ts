import { useState } from 'react';

export function usePredefinedServicesState() {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  return {
    editingIndex,
    setEditingIndex,
    errors,
    setErrors,
  };
}




import { useState } from 'react';

export function useComboDiscountRulesState() {
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  return {
    errors,
    setErrors,
  };
}




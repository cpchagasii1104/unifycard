// src/components/layout/BankLayout.tsx
// 2026-05-15: thin wrapper sobre UnifiedAuthLayout.

import UnifiedAuthLayout from './UnifiedAuthLayout';
import './BankLayout.css';

export default function BankLayout() {
  return <UnifiedAuthLayout mainClassName="bank-main" />;
}

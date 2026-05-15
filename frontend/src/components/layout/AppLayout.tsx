// src/components/layout/AppLayout.tsx
// 2026-05-15: thin wrapper sobre UnifiedAuthLayout.

import UnifiedAuthLayout from './UnifiedAuthLayout';
import './AppLayout.css';

export default function AppLayout() {
  return <UnifiedAuthLayout mainClassName="app-content" />;
}

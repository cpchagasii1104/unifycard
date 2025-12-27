// src/pages/GrupoDetailPage.tsx
// Página de detalhes de um grupo específico

import { useParams } from 'react-router-dom';
import GroupProfile from '../components/social/GroupProfile';

export default function GrupoDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Grupo não encontrado.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <GroupProfile groupId={id} />
    </div>
  );
}













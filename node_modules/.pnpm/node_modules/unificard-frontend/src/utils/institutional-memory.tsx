// frontend/src/utils/institutional-memory.tsx
// SPRINT 26: Memória Institucional Declarativa
// Componente para exibir e criar declarações de aprendizado institucional
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Memória Institucional Declarativa
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Memória institucional declarativa
// - Declarações explícitas de aprendizado
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-memory.ts (API)
// - institutional-memory.repository.ts (backend)
// - institutional-memory.service.ts (backend)
// 
// Para qualquer necessidade de memória institucional, use este arquivo.
// 
// ═══════════════════════════════════════════════════════════════
// EVOLUÇÃO CONCEITUAL (SPRINT 31)
// ═══════════════════════════════════════════════════════════════
// Este conceito pode evoluir ao longo do tempo.
// Mudanças de significado devem ser registradas em:
// INSTITUTIONAL_CONCEPT_EVOLUTIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// ESCOPO DE DECISÃO (SPRINT 32)
// ═══════════════════════════════════════════════════════════════
// Decisões relacionadas a este contexto (memória institucional)
// devem declarar seu escopo em:
// INSTITUTIONAL_DECISION_SCOPE.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// TENSÃO INSTITUCIONAL (SPRINT 33)
// ═══════════════════════════════════════════════════════════════
// Decisões neste contexto podem coexistir em tensão declarada.
// Ver: INSTITUTIONAL_DECISION_TENSIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// NÃO-DECISÃO DECLARADA (SPRINT 34)
// ═══════════════════════════════════════════════════════════════
// A ausência de decisão neste ponto pode ser registrada explicitamente.
// Ver: INSTITUTIONAL_NON_DECISIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CONTINUIDADE SEM CONSENSO (SPRINT 35)
// ═══════════════════════════════════════════════════════════════
// A permanência deste elemento não implica acordo ou aceitação institucional.
// Ver: INSTITUTIONAL_CONTINUITY_WITHOUT_CONSENSUS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: Memória Institucional
// PÚBLICO PERMITIDO: Apenas admin em modo piloto
// 
// ❌ NÃO USAR FORA DO CONTEXTO DE MEMÓRIA INSTITUCIONAL
// ❌ NÃO importar em componentes de ação
// ❌ NÃO importar em handlers de execução
// ❌ NÃO importar em fluxos de usuário final
// 
// ✅ USAR APENAS em:
//    - Painel admin de leitura institucional
//    - Componentes de visualização de memória
//    - Ferramentas de registro de aprendizado
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  listInstitutionalMemory,
  createInstitutionalMemory,
  deleteInstitutionalMemory,
  type InstitutionalMemoryDeclaration,
} from '../api/institutional-memory';

export function InstitutionalMemory() {
  const [declarations, setDeclarations] = useState<InstitutionalMemoryDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadDeclarations();
  }, []);

  async function loadDeclarations() {
    try {
      setLoading(true);
      const data = await listInstitutionalMemory({ limit: 50 });
      setDeclarations(data);
    } catch (error) {
      console.error('[InstitutionalMemory] Erro ao carregar declarações:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newContent.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      await createInstitutionalMemory({
        content: newContent.trim(),
        context: 'pilot',
      });
      setNewContent('');
      await loadDeclarations();
    } catch (error) {
      console.error('[InstitutionalMemory] Erro ao criar declaração:', error);
      alert('Erro ao criar declaração');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(declarationId: string) {
    if (!confirm('Remover esta declaração?')) {
      return;
    }

    try {
      await deleteInstitutionalMemory(declarationId);
      await loadDeclarations();
    } catch (error) {
      console.error('[InstitutionalMemory] Erro ao deletar declaração:', error);
      alert('Erro ao remover declaração');
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div style={{
      padding: '1.25rem',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      marginTop: '1rem',
    }}>
      <h3 style={{
        fontSize: '1rem',
        margin: '0 0 1rem 0',
        color: '#1a1a1a',
        fontWeight: 600,
      }}>
        Memória Institucional Declarativa
      </h3>

      {/* Formulário para nova declaração */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '4px',
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          color: '#666',
          marginBottom: '0.5rem',
        }}>
          Nova declaração de aprendizado:
        </label>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Ex: Observamos que usuários tendem a explorar primeiro empresas."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newContent.trim() || isCreating}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            background: newContent.trim() && !isCreating ? '#007bff' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: newContent.trim() && !isCreating ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
          }}
        >
          {isCreating ? 'Criando...' : 'Registrar'}
        </button>
      </div>

      {/* Lista de declarações */}
      {loading ? (
        <p style={{ color: '#666', fontSize: '0.9rem' }}>Carregando...</p>
      ) : declarations.length === 0 ? (
        <p style={{ color: '#999', fontSize: '0.9rem', fontStyle: 'italic' }}>
          Nenhuma declaração registrada ainda.
        </p>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {declarations.map((declaration) => (
            <div
              key={declaration.declarationId}
              style={{
                padding: '1rem',
                background: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                position: 'relative',
              }}
            >
              <p style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.9rem',
                color: '#333',
                lineHeight: '1.5',
              }}>
                {declaration.content}
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: '#999',
                marginTop: '0.5rem',
              }}>
                <span>
                  {formatDate(declaration.createdAt)}
                  {declaration.version > 1 && ` • v${declaration.version}`}
                </span>
                <button
                  onClick={() => handleDelete(declaration.declarationId)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'transparent',
                    color: '#999',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


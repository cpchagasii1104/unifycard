// src/components/groups/ImageUpload.tsx
// Componente de upload de imagem para grupos

import React, { useState, useRef, useEffect } from 'react';
import { uploadGroupImage } from '../../api/groups';
import './ImageUpload.css';

interface ImageUploadProps {
  groupId: string;
  type: 'avatar' | 'cover';
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  aspectRatio?: '1:1' | '16:9';
}

export function ImageUpload({
  groupId,
  type,
  currentUrl,
  onUploadComplete,
  onRemove,
  disabled = false,
  aspectRatio = type === 'avatar' ? '1:1' : '16:9',
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atualizar preview quando currentUrl mudar externamente
  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem muito grande. Tamanho máximo: 10MB');
      return;
    }

    setError(null);
    setUploading(true);

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Fazer upload
      const result = await uploadGroupImage(groupId, file, type);
      // 🔴 CORREÇÃO UX: Atualizar state imediatamente com URL retornada
      const imageUrl = result.url;
      setPreview(imageUrl);
      onUploadComplete(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload da imagem');
      // Reverter preview para o valor anterior em caso de erro
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar trigger do click do container
    setPreview(null);
    if (onRemove) {
      onRemove();
    }
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const label = type === 'avatar' ? 'Foto do Grupo' : 'Capa do Grupo';
  const placeholder = type === 'avatar' 
    ? 'Clique para fazer upload da foto (1:1)' 
    : 'Clique para fazer upload da capa (16:9)';

  return (
    <div className="image-upload">
      <label>{label}</label>
      <div 
        className={`image-upload-area ${aspectRatio === '1:1' ? 'square' : 'wide'} ${disabled || uploading ? 'disabled' : ''}`}
        onClick={preview ? undefined : handleClick}
      >
        {preview ? (
          <>
            <img src={preview} alt={label} className="image-preview" />
            {!disabled && !uploading && (
              <div className="image-upload-actions">
                <button
                  type="button"
                  className="image-upload-action-btn image-upload-change"
                  onClick={handleClick}
                  title="Trocar imagem"
                >
                  🔄 Trocar
                </button>
                {onRemove && (
                  <button
                    type="button"
                    className="image-upload-action-btn image-upload-remove"
                    onClick={handleRemove}
                    title="Remover imagem"
                  >
                    ✕ Remover
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="image-upload-placeholder" onClick={handleClick}>
            <span>📷</span>
            <p>{placeholder}</p>
          </div>
        )}
        {uploading && (
          <div className="image-upload-overlay">
            <div className="image-upload-spinner">⏳</div>
            <p>Enviando...</p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />
      {error && (
        <div className="image-upload-error">{error}</div>
      )}
      <small>
        {type === 'avatar' 
          ? 'Imagem será redimensionada para 256x256 e otimizada'
          : 'Imagem será redimensionada para 1280x720 e otimizada'}
      </small>
    </div>
  );
}



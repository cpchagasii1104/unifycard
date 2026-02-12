// frontend/src/components/events/wizard/pages/BirthdayMusicAVPage.tsx
// FASE 5 — PÁGINA: Música e Audiovisual
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayMusicAVPageProps {
  eventSpec: {
    answers?: {
      music?: {
        present?: boolean;
        types?: ("DJ" | "BANDA" | "PLAYLIST")[];
        styles?: ("POP" | "ROCK" | "SERTANEJO" | "REGGAE" | "ELETRONICA" | "VARIADO")[];
        formation_size?: "PEQUENO" | "MEDIO" | "GRANDE" | "INDEFINIDO";
        equipment_needs?: ("SOM" | "LUZ" | "PALCO" | "TELAO")[];
        equipment_source_hypothesis?: "LOCAL" | "ARTISTA" | "ALUGUEL" | "COMBINADO" | "INDEFINIDO";
        volume?: "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO";
      };
      audiovisual?: {
        photography?: boolean;
        filming?: boolean;
      };
    };
  };
  onChange: (partialSpec: {
    music?: {
      present?: boolean;
      types?: ("DJ" | "BANDA" | "PLAYLIST")[];
      styles?: ("POP" | "ROCK" | "SERTANEJO" | "REGGAE" | "ELETRONICA" | "VARIADO")[];
      formation_size?: "PEQUENO" | "MEDIO" | "GRANDE" | "INDEFINIDO";
      equipment_needs?: ("SOM" | "LUZ" | "PALCO" | "TELAO")[];
      equipment_source_hypothesis?: "LOCAL" | "ARTISTA" | "ALUGUEL" | "COMBINADO" | "INDEFINIDO";
      volume?: "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO";
    };
    audiovisual?: {
      photography?: boolean;
      filming?: boolean;
    };
  }) => void;
}

/**
 * BirthdayMusicAVPage
 * 
 * Objetivo: Registrar intenção relacionada a música e audiovisual
 * Campos EventSpec permitidos:
 * - music.present
 * - music.types[]
 * - music.styles[]
 * - music.formation_size
 * - music.equipment_needs[]
 * - music.equipment_source_hypothesis
 * - music.volume
 * - audiovisual.photography
 * - audiovisual.filming
 * 
 * Regras:
 * - Nenhum campo escolhe fornecedor
 * - Nenhum campo cria booking
 * - Tudo é intenção declarada
 * - music.present controla UI, não regra
 */
export default function BirthdayMusicAVPage({ eventSpec, onChange }: BirthdayMusicAVPageProps) {
  const [music, setMusic] = useState<{
    present?: boolean;
    types?: ("DJ" | "BANDA" | "PLAYLIST")[];
    styles?: ("POP" | "ROCK" | "SERTANEJO" | "REGGAE" | "ELETRONICA" | "VARIADO")[];
    formation_size?: "PEQUENO" | "MEDIO" | "GRANDE" | "INDEFINIDO";
    equipment_needs?: ("SOM" | "LUZ" | "PALCO" | "TELAO")[];
    equipment_source_hypothesis?: "LOCAL" | "ARTISTA" | "ALUGUEL" | "COMBINADO" | "INDEFINIDO";
    volume?: "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO";
  }>(eventSpec.answers?.music || {});
  const [audiovisual, setAudiovisual] = useState<{
    photography?: boolean;
    filming?: boolean;
  }>(eventSpec.answers?.audiovisual || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ music, audiovisual });
  }, [music, audiovisual, onChange]);

  return (
    <div className="wizard-page">
      <h3>Música e Audiovisual</h3>
      <p className="step-description">
        Informações sobre música e registro audiovisual. Nenhum campo escolhe fornecedor ou cria booking.
      </p>

      <div className="form-group">
        <label className="form-label">
          Terá música? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${music.present === true ? 'selected' : ''}`}
            onClick={() => setMusic(prev => ({ ...prev, present: true }))}
          >
            Sim
          </button>
          <button
            type="button"
            className={`yes-no-button ${music.present === false ? 'selected' : ''}`}
            onClick={() => setMusic(prev => ({ ...prev, present: false }))}
          >
            Não
          </button>
          <button
            type="button"
            className={`yes-no-button ${music.present === undefined ? 'selected' : ''}`}
            onClick={() => setMusic(prev => ({ ...prev, present: undefined }))}
          >
            Não sei
          </button>
        </div>
      </div>

      {music.present === true && (
        <>
          <div className="form-group">
            <label className="form-label">
              Tipo de música <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['DJ', 'BANDA', 'PLAYLIST'] as const).map(type => (
                <label key={type} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={music.types?.includes(type) || false}
                    onChange={(e) => {
                      const current = music.types || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter(t => t !== type);
                      setMusic(prev => ({
                        ...prev,
                        types: updated.length > 0 ? updated : undefined,
                      }));
                    }}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Estilo musical <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['POP', 'ROCK', 'SERTANEJO', 'REGGAE', 'ELETRONICA', 'VARIADO'] as const).map(style => (
                <label key={style} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={music.styles?.includes(style) || false}
                    onChange={(e) => {
                      const current = music.styles || [];
                      const updated = e.target.checked
                        ? [...current, style]
                        : current.filter(s => s !== style);
                      setMusic(prev => ({
                        ...prev,
                        styles: updated.length > 0 ? updated : undefined,
                      }));
                    }}
                  />
                  <span>{style}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Porte da apresentação <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(['PEQUENO', 'MEDIO', 'GRANDE', 'INDEFINIDO'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  className={`option-card ${music.formation_size === size ? 'selected' : ''}`}
                  onClick={() => setMusic(prev => ({ ...prev, formation_size: size }))}
                >
                  <div className="option-label">{size}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Necessidade de equipamento <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['SOM', 'LUZ', 'PALCO', 'TELAO'] as const).map(equipment => (
                <label key={equipment} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={music.equipment_needs?.includes(equipment) || false}
                    onChange={(e) => {
                      const current = music.equipment_needs || [];
                      const updated = e.target.checked
                        ? [...current, equipment]
                        : current.filter(eq => eq !== equipment);
                      setMusic(prev => ({
                        ...prev,
                        equipment_needs: updated.length > 0 ? updated : undefined,
                      }));
                    }}
                  />
                  <span>{equipment}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Origem imaginada do equipamento <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {(['LOCAL', 'ARTISTA', 'ALUGUEL', 'COMBINADO', 'INDEFINIDO'] as const).map(source => (
                <button
                  key={source}
                  type="button"
                  className={`option-card ${music.equipment_source_hypothesis === source ? 'selected' : ''}`}
                  onClick={() => setMusic(prev => ({ ...prev, equipment_source_hypothesis: source }))}
                >
                  <div className="option-label">{source}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Volume <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(['BAIXO', 'MEDIO', 'ALTO', 'INDEFINIDO'] as const).map(volume => (
                <button
                  key={volume}
                  type="button"
                  className={`option-card ${music.volume === volume ? 'selected' : ''}`}
                  onClick={() => setMusic(prev => ({ ...prev, volume: volume }))}
                >
                  <div className="option-label">{volume}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">
          Fotografia / filmagem <span className="optional">(opcional)</span>
        </label>
        <div className="form-row">
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={audiovisual.photography || false}
              onChange={(e) => setAudiovisual(prev => ({
                ...prev,
                photography: e.target.checked || undefined,
              }))}
            />
            <span>Fotografia</span>
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={audiovisual.filming || false}
              onChange={(e) => setAudiovisual(prev => ({
                ...prev,
                filming: e.target.checked || undefined,
              }))}
            />
            <span>Filmagem</span>
          </label>
        </div>
      </div>
    </div>
  );
}


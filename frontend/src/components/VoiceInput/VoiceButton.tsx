// src/components/VoiceInput/VoiceButton.tsx
// Botão para gravar e enviar áudio de voz

import { useState, useEffect } from 'react';
import { useVoiceRecorder } from './useVoiceRecorder';
import { canUseVoiceSync } from '../../utils/planGate';
import { getUserPlan } from '../../config/features';
import type { VoiceResponse } from './voice.types';
import './VoiceButton.css';

interface VoiceButtonProps {
  sessionId?: string;
  onResponse?: (response: VoiceResponse) => void;
  disabled?: boolean;
}

export default function VoiceButton({ sessionId, onResponse, disabled = false }: VoiceButtonProps) {
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [isCheckingPlan, setIsCheckingPlan] = useState(true);

  // Verificar plano do usuário
  useEffect(() => {
    getUserPlan().then((plan) => {
      setUserPlan(plan);
      setIsCheckingPlan(false);
    });
  }, []);

  const canUse = canUseVoiceSync(userPlan);

  const { state, startRecording, stopRecording, cleanup } = useVoiceRecorder({
    sessionId,
    onSuccess: (response) => {
      onResponse?.(response);
    },
    onError: (error) => {
      console.error('Erro ao processar voz:', error);
    },
  });

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleClick = () => {
    if (disabled || !canUse || isCheckingPlan) return;

    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (isCheckingPlan) {
    return (
      <button className="voice-button" disabled>
        <span className="voice-icon">🎤</span>
        <span className="voice-label">Verificando...</span>
      </button>
    );
  }

  if (!canUse) {
    return (
      <button
        className="voice-button voice-button-disabled"
        disabled
        title="Voz disponível apenas para planos PRO/Enterprise. Faça upgrade para usar."
      >
        <span className="voice-icon">🎤</span>
        <span className="voice-label">Voz (Premium)</span>
      </button>
    );
  }

  return (
    <button
      className={`voice-button ${state.isRecording ? 'voice-button-recording' : ''} ${state.isProcessing ? 'voice-button-processing' : ''}`}
      onClick={handleClick}
      disabled={disabled || state.isProcessing}
      title={state.isRecording ? 'Clique para parar gravação' : 'Clique para gravar áudio'}
    >
      {state.isProcessing ? (
        <>
          <span className="voice-icon voice-icon-spinning">⏳</span>
          <span className="voice-label">Processando...</span>
        </>
      ) : state.isRecording ? (
        <>
          <span className="voice-icon voice-icon-pulse">🔴</span>
          <span className="voice-label">Gravando...</span>
        </>
      ) : (
        <>
          <span className="voice-icon">🎤</span>
          <span className="voice-label">Voz</span>
        </>
      )}
      {state.error && (
        <span className="voice-error" title={state.error}>
          ⚠️
        </span>
      )}
    </button>
  );
}
















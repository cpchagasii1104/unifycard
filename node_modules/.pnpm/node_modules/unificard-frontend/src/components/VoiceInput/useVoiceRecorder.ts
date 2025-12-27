// src/components/VoiceInput/useVoiceRecorder.ts
// Hook para gravar áudio usando MediaRecorder API

import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '../../api/client';
import type { VoiceRecorderState, VoiceResponse } from './voice.types';

interface UseVoiceRecorderOptions {
  sessionId?: string;
  onSuccess?: (response: VoiceResponse) => void;
  onError?: (error: Error) => void;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { sessionId, onSuccess, onError } = options;

  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Inicia gravação de áudio
   */
  const startRecording = useCallback(async () => {
    try {
      // Solicitar permissão de microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Criar MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Criar blob do áudio
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setState((prev) => ({ ...prev, audioBlob, isRecording: false }));

        // Enviar para backend
        await sendAudio(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setState((prev) => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Erro ao iniciar gravação');
      setState((prev) => ({ ...prev, error: err.message, isRecording: false }));
      onError?.(err);
    }
  }, [onError]);

  /**
   * Para gravação de áudio
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Parar stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Envia áudio para o backend
   */
  const sendAudio = useCallback(
    async (audioBlob: Blob, _mimeType: string) => {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        if (sessionId) {
          formData.append('sessionId', sessionId);
        }

        const response = await apiFetch('/assistant/voice', {
          method: 'POST',
          body: formData,
        });

        const data: VoiceResponse = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Erro ao processar áudio');
        }

        setState((prev) => ({ ...prev, isProcessing: false }));
        onSuccess?.(data);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Erro ao enviar áudio');
        setState((prev) => ({ ...prev, error: err.message, isProcessing: false }));
        onError?.(err);
      }
    },
    [sessionId, onSuccess, onError]
  );

  /**
   * Limpa estado e recursos
   */
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState({
      isRecording: false,
      isProcessing: false,
      error: null,
      audioBlob: null,
    });
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cleanup,
  };
}
















// src/modules/assistant/voice.channel.ts
//
// Canal de voz para o assistant
// Recebe áudio, converte para texto (stub inicial), e processa via assistant normal

import type { FastifyInstance } from 'fastify';
import { assistantService } from './assistant.service';
import { planGateService } from '@core/plan/plan-gate.service';
import type { UserContext, SendAssistantMessageInput } from './assistant.types';

interface ProcessVoiceInput {
  audioFile: Buffer;
  mimeType: string;
  userContext: UserContext;
  sessionId?: string;
  targetGlobalUserId?: string;
  targetCompanyId?: string;
}

interface ProcessVoiceResult {
  text: string;
  transcription: string;
  response: any; // AssistantResponse
}

class VoiceChannel {
  /**
   * Processa áudio de voz
   * 
   * Pipeline:
   * 1. Validar acesso (plan gate)
   * 2. Transcrever áudio para texto (stub inicial)
   * 3. Processar texto via assistant normal
   * 4. Retornar resposta
   */
  async processVoice(
    fastify: FastifyInstance,
    input: ProcessVoiceInput
  ): Promise<ProcessVoiceResult> {
    const { audioFile, mimeType, userContext, sessionId, targetGlobalUserId, targetCompanyId } = input;

    // 1. Validar acesso via plan gate
    await planGateService.validateFeatureAccess(
      userContext.tenantId,
      userContext.globalUserId,
      'voice'
    );

    // 2. Transcrever áudio para texto (STUB INICIAL)
    // Por enquanto, retorna texto fixo
    // TODO: Integrar com Whisper/Google Speech-to-Text quando necessário
    const transcription = await this.transcribeAudio(audioFile, mimeType);

    // 3. Processar texto via assistant normal
    const messageInput: SendAssistantMessageInput = {
      text: transcription,
      channel: 'voice',
      sessionId,
      targetGlobalUserId,
      targetCompanyId,
    };

    const response = await assistantService.sendMessage(
      fastify,
      userContext,
      messageInput
    );

    return {
      text: response.lastMessage.content,
      transcription,
      response,
    };
  }

  /**
   * Transcreve áudio para texto (STUB INICIAL)
   * 
   * Por enquanto retorna texto fixo para validar o pipeline
   * TODO: Integrar com:
   * - OpenAI Whisper API
   * - Google Cloud Speech-to-Text
   * - Outro provider de transcrição
   */
  private async transcribeAudio(audioFile: Buffer, mimeType: string): Promise<string> {
    // STUB: Retorna texto fixo para validar pipeline
    // Em produção, aqui seria a integração com o provider de transcrição
    
    console.log({
      audioSize: audioFile.length,
      mimeType,
      'assistant.channel': 'voice',
      'assistant.action': 'transcription_stub',
    }, 'Transcrição de áudio (stub)');

    return 'transcription_stub: Este é um texto de exemplo retornado pelo stub de transcrição. Em produção, este texto viria da transcrição real do áudio.';
  }
}

export const voiceChannel = new VoiceChannel();















